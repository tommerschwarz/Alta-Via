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

@routes.route('/login')
def login():
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@routes.route('/callback')
def callback():
    """Handle the Spotify OAuth callback"""
    # Clear session first to avoid old data persisting
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
        logger.info(f"Authenticated user: {user_info['display_name']} ({user_info['id']})")
        session['user_id'] = user_info['id']
        session['display_name'] = user_info['display_name']
        
        # Enhanced playlist detection
        playlists = sp.current_user_playlists(limit=50)
        
        # Log all playlists for debugging
        logger.info(f"User has {len(playlists['items'])} playlists:")
        wrapped_playlist_map = {}  # Map years to playlist objects
        
        # First, find all potential wrapped playlists with their detection method
        potential_wrapped = []
        
        for playlist in playlists['items']:
            logger.info(f"Playlist: {playlist['name']} (ID: {playlist['id']})")
            
            # Check for custom named playlists first
            wrapped_pattern = f"{user_id} in "
            if wrapped_pattern in playlist['name']:
                try:
                    year = playlist['name'].replace(wrapped_pattern, '')
                    if year.isdigit() and len(year) == 4:  # Ensure it's a valid year
                        potential_wrapped.append({
                            'year': year,
                            'id': playlist['id'], 
                            'name': playlist['name'],
                            'type': 'custom',  # Custom naming has highest priority
                            'priority': 3
                        })
                except Exception as e:
                    logger.error(f"Error parsing year from playlist {playlist['name']}: {str(e)}")
            
            # Check for official Spotify Wrapped playlists
            elif "Your Top Songs" in playlist['name']:
                try:
                    year_match = re.search(r'Your Top Songs (\d{4})', playlist['name'])
                    if year_match:
                        year = year_match.group(1)
                        potential_wrapped.append({
                            'year': year,
                            'id': playlist['id'], 
                            'name': playlist['name'],
                            'type': 'official',  # Official has medium priority
                            'priority': 2
                        })
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
                            potential_wrapped.append({
                                'year': potential_year,
                                'id': playlist['id'], 
                                'name': playlist['name'],
                                'type': 'detected',  # Detected has lowest priority
                                'priority': 1
                            })
                except Exception as e:
                    logger.error(f"Error checking playlist {playlist['name']} as potential wrapped: {str(e)}")
        
        # Group by year and select the highest priority playlist for each year
        available_years = []
        for wrapped in sorted(potential_wrapped, key=lambda x: (x['year'], -x['priority'])):
            year = wrapped['year']
            # Only add the year/playlist if we haven't already added this year
            # or if we're replacing with a higher priority playlist
            if year not in wrapped_playlist_map or wrapped['priority'] > wrapped_playlist_map[year]['priority']:
                wrapped_playlist_map[year] = wrapped
                if year not in available_years:
                    available_years.append(year)
        
        # Store the playlist map in session for later use
        session['wrapped_playlist_map'] = wrapped_playlist_map
        
        logger.info(f"Found wrapped playlists for years: {available_years}")
        logger.info(f"Final wrapped_playlist_map: {wrapped_playlist_map}")
        
        # After determining available_years and wrapped_playlist_map:
        session['has_wrapped_playlists'] = len(available_years) > 0
        session['wrapped_playlist_map'] = wrapped_playlist_map
        session['from_callback'] = True  # Mark that we just came from callback
        
        logger.info(f"Found {len(available_years)} wrapped playlists: {available_years}")
        
        # If no playlists found, go to index with no_playlists flag
        if not available_years:
            logger.info("No wrapped playlists found, redirecting to index with no_playlists flag")
            flash("No wrapped playlists found in your account.")
            session['has_wrapped_playlists'] = False  # Explicitly set to False
            flash("No wrapped playlists found in your account.")
            return redirect(url_for('main.index'))
            
        # If playlists found, go to journey overview
        logger.info(f"Redirecting to journey page with {len(available_years)} years")
        return redirect(url_for('main.journey'))
        
    except Exception as e:
        logger.error(f"Error in callback: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Show error to user instead of silently redirecting
        session['auth_error'] = str(e)
        return redirect(url_for('main.index'))

@routes.route('/')
def index():
    """Serve the main page"""
    logger.info("Index route called with session keys: %s", list(session.keys()))
    
    selected_year = session.get('selected_year')
    username = session.get('display_name', '')
    user_playlist_id = session.get('user_playlist_id', '')
    
    # Check if user is authenticated but has no playlists
    no_playlists = False
    auth_error = session.pop('auth_error', None)  # Get and clear any auth error

    # If user has token but no playlists were found in the callback, show the no playlists message
    if 'token_info' in session and session.get('has_wrapped_playlists') is False:
        no_playlists = True
        logger.info("User is authenticated but has no playlists, showing no-playlists message")

    logger.info(f"Rendering index with: username={username}, year={selected_year}, ID={user_playlist_id}, no_playlists={no_playlists}, auth_error={auth_error}")

    return render_template('index.html',
                          selected_year=selected_year,
                          username=username,
                          user_playlist_id=user_playlist_id,
                          no_playlists=no_playlists,
                          auth_error=auth_error)

@routes.route('/journey')
def journey():
    """Show the journey overview page with all wrapped years"""
    logger.info("Journey page requested")

    if 'token_info' not in session:
        logger.warning("Journey requested but not logged in, redirecting to login")
        return redirect(url_for('main.login'))

    wrapped_playlist_map = session.get('wrapped_playlist_map', {})
    available_years = sorted(list(wrapped_playlist_map.keys()), reverse=True)

    if not available_years:
        logger.info("No wrapped playlists found, redirecting to index")
        return redirect(url_for('main.index'))

    logger.info(f"Rendering journey with {len(available_years)} years available")
    return render_template('journey.html',
                          username=session.get('display_name', ''),
                          available_years=available_years)


@routes.route('/api/journey-data')
def get_journey_data():
    """Get all wrapped playlists data with cross-year statistics"""
    logger.info("Starting journey data request")

    if 'token_info' not in session:
        logger.error("No token in session")
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        token_info = session['token_info']
        sp = spotipy.Spotify(auth=token_info['access_token'])

        user_info = sp.current_user()
        display_username = user_info['display_name']

        wrapped_playlist_map = session.get('wrapped_playlist_map', {})
        years = sorted(list(wrapped_playlist_map.keys()), reverse=True)

        # Fetch playlist data for each year
        playlists_data = {}
        playlists_by_year = {}  # For cross-year stats calculation

        for year in years:
            playlist_info = wrapped_playlist_map.get(year, {})
            playlist_id = playlist_info.get('id')

            if not playlist_id:
                continue

            try:
                tracks_response = sp.playlist_tracks(playlist_id)

                tracks = []
                popularities = []
                release_years = []
                artists_set = set()

                for item in tracks_response['items']:
                    if item['track'] is None:
                        continue

                    track = item['track']
                    album_images = track['album']['images']
                    album_image = None
                    if album_images:
                        album_image = album_images[1]['url'] if len(album_images) > 1 else album_images[0]['url']

                    track_artists = [artist['name'] for artist in track['artists']]

                    tracks.append({
                        'id': track['id'],
                        'name': track['name'],
                        'artists': track_artists,
                        'album_image': album_image
                    })

                    popularities.append(track['popularity'])
                    release_years.append(int(track['album']['release_date'][:4]))
                    artists_set.update(track_artists)

                from statistics import mean
                avg_popularity = mean(popularities) if popularities else 0
                avg_year = mean(release_years) if release_years else 0

                playlists_data[year] = {
                    'playlist_id': playlist_id,
                    'playlist_name': playlist_info.get('name', ''),
                    'track_count': len(tracks),
                    'artist_count': len(artists_set),
                    'avg_popularity': round(avg_popularity, 1),
                    'avg_year': round(avg_year, 1),
                    'tracks': tracks
                }

                # Store for cross-year calculation
                playlists_by_year[year] = {'tracks': tracks}

                logger.info(f"Fetched {len(tracks)} tracks for year {year}")

            except Exception as e:
                logger.error(f"Error fetching playlist for year {year}: {str(e)}")
                continue

        # Calculate cross-year statistics
        cross_year_stats = spotify_utils.calculate_cross_year_stats(playlists_by_year)

        response_data = {
            'username': display_username,
            'total_wrapped_count': len(years),
            'years': years,
            'playlists': playlists_data,
            'cross_year_stats': cross_year_stats
        }

        logger.info(f"Returning journey data: {len(years)} years, {cross_year_stats['total_unique_tracks']} unique tracks")
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in get_journey_data: {str(e)}")
        return jsonify({'error': str(e)}), 500


@routes.route('/select-year', methods=['POST', 'GET'])
def select_year():
    # Support both POST form data and GET query params
    year = request.form.get('year') or request.args.get('year')
    if year:
        session['selected_year'] = year
        
        # Add this: get and store the playlist ID for this year
        wrapped_playlist_map = session.get('wrapped_playlist_map', {})
        if year in wrapped_playlist_map:
            session['user_playlist_id'] = wrapped_playlist_map[year]['id']
            logger.info(f"Set user_playlist_id in session: {session['user_playlist_id']}")
        else:
            logger.warning(f"No playlist found for year {year} in wrapped_playlist_map")
            
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
        
        # Get the user's playlist ID directly from session
        user_playlist_id = session.get('user_playlist_id', '')
        logger.info(f"User's playlist ID from session: {user_playlist_id}")

        wrapped_playlist_map = session.get('wrapped_playlist_map', {})
        if selected_year in wrapped_playlist_map:
            user_playlist_id = wrapped_playlist_map[selected_year]['id']
            logger.info(f"User's playlist ID for {selected_year}: {user_playlist_id}")
        
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
                        
                        # Submit to Google Form (only if data collection is enabled)
                        if session.get('data_collection_enabled', True):
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
                        else:
                            logger.info(f"Skipping form submission - data collection disabled")
                except Exception as e:
                    logger.error(f"Error processing wrapped playlist: {str(e)}")
        
        # Log what we're returning
        logger.info(f"Returning {len(all_stored_playlists)} playlists")
        for i, p in enumerate(all_stored_playlists):
            logger.info(f"Playlist {i+1}: {p.get('name')} (ID: {p.get('playlist_id')})")
        

        # Before returning the playlists, add a flag to identify the user's playlist
        for playlist in all_stored_playlists:
            # Mark if this is the user's playlist
            playlist['is_user_playlist'] = (
                playlist.get('playlist_id') == user_playlist_id or
                playlist.get('name') == f"{display_username} in {selected_year}"
            )
            
            # For debugging - log which playlist is identified as the user's
            if playlist['is_user_playlist']:
                logger.info(f"Marked as user's playlist: {playlist.get('name')} (ID: {playlist.get('playlist_id')})")
        
        # Log what we're returning
        logger.info(f"Returning {len(all_stored_playlists)} playlists")

        response_data = {
            'playlists': all_stored_playlists,
            'user_playlist_id': user_playlist_id,
            'username': display_username,
            'selected_year': selected_year
        }

        return jsonify(response_data)
        
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

@routes.route('/privacy-preference', methods=['POST'])
def privacy_preference():
    """Update user's data collection preference"""
    try:
        data = request.get_json()
        enabled = data.get('enabled', True)
        session['data_collection_enabled'] = enabled
        logger.info(f"Data collection preference updated: {enabled}")
        return jsonify({'success': True, 'enabled': enabled})
    except Exception as e:
        logger.error(f"Error updating privacy preference: {e}")
        return jsonify({'error': str(e)}), 500

@routes.route('/year-select')
def year_select():
    """Show year selection page"""
    logger.info("Year selection page requested")
    
    if 'token_info' not in session:
        logger.warning("Year selection requested but not logged in, redirecting to login")
        return redirect(url_for('main.login'))
        
    available_years = []
    wrapped_playlist_map = session.get('wrapped_playlist_map', {})
    
    # Get years from wrapped_playlist_map
    for year, playlist in wrapped_playlist_map.items():
        if year not in available_years:
            available_years.append(year)
    
    # Mark that we didn't just come from callback
    session['from_callback'] = False
    
    logger.info(f"Rendering year_select with {len(available_years)} years available")
    return render_template('year_select.html', 
                         available_years=sorted(available_years, reverse=True),
                         username=session.get('display_name', ''))