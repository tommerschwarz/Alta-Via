import logging
import requests
import json
from flask import (
    current_app, render_template, 
    redirect, url_for, request, session,
    Blueprint, jsonify, send_from_directory
)
import spotipy
from . import spotify_utils
from flask_cors import cross_origin
from spotipy.oauth2 import SpotifyOAuth
import ast
import csv
from io import StringIO
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from flask import (
    current_app, render_template, 
    redirect, url_for, request, session,
    Blueprint, jsonify, flash  # Added flash
)

# Google Form/Sheet configurations
GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSf69_6SX1lsPMIsH3a9XbtECJ9MbFpwFDKImaWI5t6q9QxhaA/formResponse"  # Changed to formResponse
GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1v6pbUgaIO8NRN-rCA-NJdofXHybPwPMGFowG6SHJyRc/export?format=csv"  # Simplified sheet URL
routes = Blueprint('main', __name__)

@routes.route('/')
def index():
    """Serve the main page"""
    selected_year = session.get('selected_year')
    username = session.get('display_name', '')
    return render_template('index.html', selected_year=selected_year, username=username)

@routes.route('/login')
def login():
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@routes.route('/callback')
def callback():
    """Handle the Spotify OAuth callback"""

    for key in list(session.keys()):
        if key != 'csrf_token':  # Preserve CSRF token if using Flask-WTF
            session.pop(key)

    try:
        sp_oauth = spotify_utils.get_spotify_oauth(current_app)
        code = request.args.get('code')
        
        if not code:
            logger.error("No code received from Spotify")
            return redirect(url_for('main.index'))
            
        token_info = sp_oauth.get_access_token(code)
        session['token_info'] = token_info
        
        # Get user info and store in session
        sp = spotipy.Spotify(auth=token_info['access_token'])
        user_info = sp.current_user()
        user_id = user_info['id']
        session['user_id'] = user_info['id']
        
        # Check for available wrapped playlists
        available_years = []
        playlists = sp.current_user_playlists(limit=50)

        user_info = sp.current_user()
        logger.info(f"Authenticated user: {user_info['display_name']} ({user_info['id']})")
        session['user_id'] = user_info['id']
        session['display_name'] = user_info['display_name']

        # Get user info and store in session
        sp = spotipy.Spotify(auth=token_info['access_token'])
        user_info = sp.current_user()
        user_id = user_info['id']
        logger.info(f"Authenticated user: {user_info['display_name']} ({user_id})")
        session['user_id'] = user_info['id']
        
        # Enhanced playlist detection
        available_years = []
        playlists = sp.current_user_playlists(limit=50)
        
        # Log all playlists for debugging
        logger.info(f"User has {len(playlists['items'])} playlists:")
        wrapped_playlist_map = {}  # Map years to playlist objects
        
        for playlist in playlists['items']:
            logger.info(f"Playlist: {playlist['name']} (ID: {playlist['id']})")
            
            # Check for custom named playlists first (unchanged)
            wrapped_pattern = f"{user_id} in "
            if wrapped_pattern in playlist['name']:
                try:
                    year = playlist['name'].replace(wrapped_pattern, '')
                    if year.isdigit() and len(year) == 4:  # Ensure it's a valid year
                        available_years.append(year)
                        wrapped_playlist_map[year] = {
                            'id': playlist['id'], 
                            'name': playlist['name'],
                            'type': 'custom'
                        }
                except Exception as e:
                    logger.error(f"Error parsing year from playlist {playlist['name']}: {str(e)}")
            
            # Check for official Spotify Wrapped playlists
            elif "Your Top Songs" in playlist['name']:
                try:
                    year_match = re.search(r'Your Top Songs (\d{4})', playlist['name'])
                    if year_match:
                        year = year_match.group(1)
                        available_years.append(year)
                        wrapped_playlist_map[year] = {
                            'id': playlist['id'], 
                            'name': playlist['name'],
                            'type': 'official'
                        }
                except Exception as e:
                    logger.error(f"Error parsing year from playlist {playlist['name']}: {str(e)}")
            
            else:
                try:
                    # Find any 4-digit number that could be a year (2000-2030)
                    year_match = re.search(r'(20[0-2][0-9])', playlist['name'])
                    if year_match:
                        potential_year = year_match.group(1)
                        
                        # Check if it has exactly 100 tracks (typical for Wrapped playlists)
                        playlist_tracks = sp.playlist_tracks(playlist['id'], fields='total')
                        track_count = playlist_tracks['total']
                        
                        logger.info(f"Potential wrapped playlist: {playlist['name']} - Year: {potential_year}, Tracks: {track_count}")
                        
                        if track_count == 100:
                            # Only add if we don't already have this year from a more reliable source
                            if potential_year not in wrapped_playlist_map:
                                available_years.append(potential_year)
                                wrapped_playlist_map[potential_year] = {
                                    'id': playlist['id'], 
                                    'name': playlist['name'],
                                    'type': 'detected'
                                }
                except Exception as e:
                    logger.error(f"Error checking playlist {playlist['playlist_name']} as potential wrapped: {str(e)}")
        
        # Store the playlist map in session for later use
        session['wrapped_playlist_map'] = wrapped_playlist_map
        
        logger.info(f"Found wrapped playlists for years: {available_years}")
        
        if not available_years:
            flash("No wrapped playlists found in your account.")
            return redirect(url_for('main.index'))
            
        return render_template('year_select.html', 
                             available_years=sorted(available_years, reverse=True),
                             username=user_info['display_name'])
        
    except Exception as e:
        logger.error(f"Error in callback: {str(e)}")
        return redirect(url_for('main.index'))

@routes.route('/select-year', methods=['POST'])
def select_year():
    year = request.form.get('year')
    if year:
        session['selected_year'] = year
    return redirect(url_for('main.index'))

@routes.route('/api/playlist-metrics')
def get_playlist_metrics():
    logger.info("Starting playlist metrics request")
    
    if 'token_info' not in session:
        logger.error("No token in session")
        return jsonify({'error': 'Not authenticated'}), 401
        
    try:
        token_info = session['token_info']
        sp = spotipy.Spotify(auth=token_info['access_token'])
        
        # Get current user's info
        user_info = sp.current_user()
        user_id = user_info['id']
        display_username = user_info['display_name']
        selected_year = session.get('selected_year', '2024')
        
        logger.info(f"Current user: {display_username} ({user_id}), selected year: {selected_year}")
        
        all_stored_playlists = []
        all_stored_playlist_ids = set()
        
        # Get playlists from Google Sheet
        try:
            response = requests.get(GOOGLE_SHEET_URL)
            logger.info(f"Sheet response status: {response.status_code}")
            
            if response.status_code == 200:
                content = response.text
                csv_reader = csv.reader(StringIO(content), quotechar='"', delimiter=',')
                next(csv_reader)  # Skip header row
                
                for values in csv_reader:
                    if values:  # Check if row is not empty
                        try:
                            playlist_id = values[8].strip()
                            all_stored_playlist_ids.add(playlist_id)
                            
                            playlist_data = {
                                'name': values[1].strip(),
                                'playlist_name': values[2].strip(),
                                'avgPopularity': float(values[3]),
                                'genreCount': int(values[4]),
                                'avgYear': float(values[5]),
                                'trackCount': int(values[6]),
                                'artistCount': int(values[7]),
                                'playlist_id': playlist_id
                            }

                            # Get fresh track data from Spotify
                            tracks = sp.playlist_tracks(playlist_id)
                            track_data = []
                            years = []
                            popularity_scores = []
                            
                            for item in tracks['items']:
                                if item['track']:
                                    track = item['track']
                                    track_data.append({
                                        'id': track['id'],
                                        'name': track['name'],
                                        'artists': [artist['name'] for artist in track['artists']],
                                        'album_image': track['album']['images'][1]['url'] if len(track['album']['images']) > 1 else track['album']['images'][0]['url'] if track['album']['images'] else None
                                    })
                                    years.append(int(track['album']['release_date'][:4]))
                                    popularity_scores.append(track['popularity'])
                            
                            playlist_data.update({
                                'tracks': track_data,
                                'years': years,
                                'popularityScores': popularity_scores
                            })
                            
                            # Genre processing
                            if len(values) > 10:
                                try:
                                    genre_str = values[10].strip()
                                    genre_str = genre_str.replace("'", '"').replace('""', '"')
                                    if genre_str.startswith('"') and genre_str.endswith('"'):
                                        genre_str = genre_str[1:-1]
                                    genres = json.loads(genre_str)
                                    if ('unknown' in genres.keys()):
                                        del genres['unknown']
                                    playlist_data['genres'] = genres
                                except json.JSONDecodeError as e:
                                    playlist_data['genres'] = {'unknown': 1}
                            else:
                                playlist_data['genres'] = {'unknown': 1}

                            # CRITICAL CHANGE: Update name for display to use current user's name
                            # Check if this is a wrapped playlist for the selected year
                            playlist_name = playlist_data['playlist_name']
                            if selected_year in playlist_name:
                                # Format should be "<username> in <year>"
                                playlist_data['name'] = f"{display_username} in {selected_year}"
                                logger.info(f"Updated existing playlist display name to: {playlist_data['name']}")

                            all_stored_playlists.append(playlist_data)
                        except Exception as e:
                            logger.error(f"Error processing playlist {playlist_id if 'playlist_id' in locals() else 'unknown'}: {str(e)}")
                            continue
        except Exception as e:
            logger.error(f"Error reading from Google Sheet: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
        # Look for the user's wrapped playlist for the selected year
        # First check the wrapped playlist map
        wrapped_playlist_map = session.get('wrapped_playlist_map', {})
        found_playlist = None
        used_playlist_name = None
        
        if selected_year in wrapped_playlist_map:
            playlist_info = wrapped_playlist_map[selected_year]
            logger.info(f"Found in wrapped_playlist_map for {selected_year}: {playlist_info}")
            
            # Check if this playlist is already in the database
            if playlist_info['id'] in all_stored_playlist_ids:
                logger.info(f"Playlist {playlist_info['name']} (ID: {playlist_info['id']}) is already in database")
                
                # Find it in our list and update the name to match current user
                for playlist in all_stored_playlists:
                    if playlist['playlist_id'] == playlist_info['id']:
                        playlist['name'] = f"{display_username} in {selected_year}"
                        logger.info(f"Updated display name in database to: {playlist['name']}")
            else:
                # Get the full playlist to process
                logger.info(f"Playlist {playlist_info['name']} (ID: {playlist_info['id']}) not in database, fetching it")
                
                # Look up the playlist 
                try:
                    full_playlist = sp.playlist(playlist_info['id'])
                    
                    # Now process and add this playlist
                    display_name = f"{display_username} in {selected_year}"
                    metrics = spotify_utils.get_playlist_metrics_by_id(
                        sp, 
                        playlist_info['id'], 
                        display_name=display_name, 
                        original_name=playlist_info['name']
                    )
                    
                    if metrics:
                        logger.info(f"Successfully got metrics for {playlist_info['name']}")
                        
                        # Add to the list of playlists being returned to front-end
                        all_stored_playlists.append(metrics)
                        
                        # Submit to Google Form
                        track_ids = [track['id'] for track in metrics['tracks']]
                        track_ids_string = ','.join(track_ids)

                        form_data = {
                            'entry.1548427': display_username,
                            'entry.1915400927': playlist_info['name'],
                            'entry.1933974811': str(metrics['avgPopularity']),
                            'entry.1375160318': str(metrics['genreCount']),
                            'entry.871544984': str(metrics['avgYear']),
                            'entry.235692165': str(metrics['trackCount']),
                            'entry.1816026476': str(metrics['artistCount']),
                            'entry.2120636163': playlist_info['id'],
                            'entry.595204572': track_ids_string,
                            'entry.1882653839': json.dumps(str(metrics['genres']))
                        }
                        
                        # Send to Google Form
                        form_response = requests.post(GOOGLE_FORM_URL, data=form_data)
                        logger.info(f"Form submission response: {form_response.status_code}")
                except Exception as e:
                    logger.error(f"Error processing wrapped playlist: {str(e)}")
        
        # Log what we're returning
        logger.info(f"Returning {len(all_stored_playlists)} playlists")
        for i, p in enumerate(all_stored_playlists):
            logger.info(f"Playlist {i+1}: {p.get('name')} (ID: {p.get('playlist_id')})")
            
        return jsonify(all_stored_playlists)
        
    except Exception as e:
        logger.error(f"Error in get_playlist_metrics: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@routes.route('/api/debug-token')
def debug_token():
    """Debug endpoint to check token status and premium status"""
    try:
        if 'token_info' not in session:
            return jsonify({
                'has_token': False,
                'error': 'No token in session'
            })

        token_info = session['token_info']
        sp = spotipy.Spotify(auth=token_info['access_token'])
        
        # Get user info to check premium status
        user_info = sp.current_user()
        
        return jsonify({
            'has_token': True,
            'token_type': token_info.get('token_type'),
            'expires_at': token_info.get('expires_at'),
            'scope': token_info.get('scope'),
            'product_type': user_info.get('product'),  # 'premium' or 'free'
            'country': user_info.get('country')
        })
    except Exception as e:
        logger.error(f"Error in debug_token: {str(e)}")
        return jsonify({
            'error': str(e),
            'has_token': False
        }), 500
    

@routes.route('/api/spotify-token')
def get_spotify_token():
    """Get the current user's Spotify access token"""
    try:
        if 'token_info' not in session:
            return jsonify({
                'error': 'No token in session'
            }), 401

        token_info = session['token_info']
        return jsonify({
            'token': token_info['access_token']
        })
    except Exception as e:
        logger.error(f"Error getting token: {str(e)}")
        return jsonify({
            'error': str(e)
        }), 500

@routes.route('/submit-playlist', methods=['POST'])
def submit_playlist():
    try:
        data = request.get_json()
        logger.info(f"Received playlist submission: {data}")
        
        # Prepare form data
        form_data = {
            'entry.1234567890': data['playlist_name'],  # Update with actual form field IDs
            'entry.0987654321': data['playlist_id'],
            # Add other form fields as needed
        }
        
        # Submit to Google Form
        response = requests.post(GOOGLE_FORM_URL, data=form_data)
        logger.info(f"Form submission response: {response.status_code}")
        
        if response.status_code == 200:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Form submission failed'}), 500
            
    except Exception as e:
        logger.error(f"Error submitting playlist: {e}")
        return jsonify({'error': str(e)}), 500

@routes.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@routes.route('/logout')
def logout():
    session.clear()  # Clear all session data
    return redirect(url_for('main.index'))