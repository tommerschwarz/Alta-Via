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
    return render_template('index.html', selected_year=selected_year)

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
                    logger.error(f"Error checking playlist {playlist['name']} as potential wrapped: {str(e)}")
        
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

# In routes.py
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
        selected_year = session.get('selected_year', '2024')
        
        # Get the wrapped playlist map from session
        wrapped_playlist_map = session.get('wrapped_playlist_map', {})
        found_playlist = None
        used_playlist_name = None
        
        # Try to find the playlist for the selected year in our map
        if selected_year in wrapped_playlist_map:
            playlist_info = wrapped_playlist_map[selected_year]
            # Look up the playlist in the user's library to get current data
            current_user_playlists = sp.current_user_playlists(limit=50)
            
            for playlist in current_user_playlists['items']:
                if playlist['id'] == playlist_info['id']:
                    found_playlist = playlist
                    used_playlist_name = playlist_info['name']
                    logger.info(f"Found {playlist_info['type']} playlist for year {selected_year}: {used_playlist_name}")
                    break
        
        # If not found in the map, fallback to the original search logic
        if not found_playlist:
            # Define possible playlist names
            custom_playlist_name = f"{user_id} in {selected_year}"
            official_playlist_name = f"Your Top Songs {selected_year}"
            
            current_user_playlists = sp.current_user_playlists(limit=50)
            
            # First try to find custom-named playlist
            for playlist in current_user_playlists['items']:
                if playlist['name'] == custom_playlist_name:
                    found_playlist = playlist
                    used_playlist_name = custom_playlist_name
                    logger.info(f"Found custom-named playlist: {custom_playlist_name}")
                    break
            
            # If custom-named playlist not found, try to find official Wrapped playlist
            if not found_playlist:
                for playlist in current_user_playlists['items']:
                    if playlist['name'] == official_playlist_name:
                        found_playlist = playlist
                        used_playlist_name = official_playlist_name
                        logger.info(f"Found official Wrapped playlist: {official_playlist_name}")
                        break
        
        all_stored_playlists = []
        all_stored_playlist_ids = set()
        
        # Get playlists from Google Sheet
        try:
            response = requests.get(GOOGLE_SHEET_URL)
            logger.info(f"Sheet response status: {response.status_code}")
            
            if response.status_code == 200:
                content = response.text
                # Use CSV reader with proper quote handling
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
                                    # Clean up the genre string
                                    genre_str = genre_str.replace("'", '"').replace('""', '"')
                                    if genre_str.startswith('"') and genre_str.endswith('"'):
                                        genre_str = genre_str[1:-1]
                                    logger.info(f"Cleaned genre string: {genre_str}")
                                    genres = json.loads(genre_str)
                                    if ('unknown' in genres.keys()):
                                        del genres['unknown']
                                    playlist_data['genres'] = genres
                                    logger.info(f"Successfully parsed genres for playlist {playlist_id}")
                                except json.JSONDecodeError as e:
                                    logger.error(f"JSON parsing error for genre string: {genre_str}")
                                    logger.error(f"Error details: {str(e)}")
                                    playlist_data['genres'] = {'unknown': 1}
                            else:
                                playlist_data['genres'] = {'unknown': 1}

                            all_stored_playlists.append(playlist_data)
                        except Exception as e:
                            logger.error(f"Error processing playlist {playlist_id if 'playlist_id' in locals() else 'unknown'}: {str(e)}")
                            continue
        except Exception as e:
            logger.error(f"Error reading from Google Sheet: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
            
        # Add current user's playlist if not already in sheet
        try:
            current_user_playlists = sp.current_user_playlists(limit=50)
            found_playlist = None
            used_playlist_name = None
            
            # First try to find custom-named playlist
            for playlist in current_user_playlists['items']:
                if playlist['name'] == custom_playlist_name and playlist['id'] not in all_stored_playlist_ids:
                    found_playlist = playlist
                    used_playlist_name = custom_playlist_name
                    logger.info(f"Found custom-named playlist: {custom_playlist_name}")
                    break
            
            # If custom-named playlist not found, try to find official Wrapped playlist
            if not found_playlist:
                for playlist in current_user_playlists['items']:
                    if playlist['name'] == official_playlist_name and playlist['id'] not in all_stored_playlist_ids:
                        found_playlist = playlist
                        used_playlist_name = official_playlist_name
                        logger.info(f"Found official Wrapped playlist: {official_playlist_name}")
                        break
            
            # Process the found playlist
            if found_playlist and used_playlist_name and found_playlist['id'] not in all_stored_playlist_ids:
                logger.info(f"Processing playlist: {used_playlist_name}")
                
                # Use display name for visualization but maintain original playlist name
                display_name = f"{user_info['display_name']} in {selected_year}"
                metrics = spotify_utils.get_playlist_metrics_by_id(sp, found_playlist['id'], display_name, used_playlist_name)

                if metrics:
                    # Get track IDs
                    track_ids = [track['id'] for track in metrics['tracks']]
                    track_ids_string = ','.join(track_ids)

                    # Submit to Google Form
                    form_data = {
                        'entry.1548427': user_info['display_name'],
                        'entry.1915400927': used_playlist_name,
                        'entry.1933974811': str(metrics['avgPopularity']),
                        'entry.1375160318': str(metrics['genreCount']),
                        'entry.871544984': str(metrics['avgYear']),
                        'entry.235692165': str(metrics['trackCount']),
                        'entry.1816026476': str(metrics['artistCount']),
                        'entry.2120636163': found_playlist['id'],
                        'entry.595204572': track_ids_string,
                        'entry.1882653839': json.dumps(str(metrics['genres']))
                    }
                    
                    # Send to Google Form
                    form_response = requests.post(GOOGLE_FORM_URL, data=form_data)
                    logger.info(f"Form submission response: {form_response.status_code}")
                    
                    if form_response.status_code == 200:
                        logger.info(f"Successfully submitted playlist {used_playlist_name} to form")
                        all_stored_playlists.append(metrics)
                    else:
                        logger.error(f"Failed to submit to form: {form_response.status_code}")
                        logger.error(f"Form response: {form_response.text}")
                
        except Exception as e:
            logger.error(f"Error processing user playlist: {str(e)}")
            
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