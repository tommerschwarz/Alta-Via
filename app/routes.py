import logging
from flask import (
    current_app, render_template, 
    redirect, url_for, request, session,
    Blueprint, jsonify
)
import spotipy
from . import spotify_utils
from flask_cors import cross_origin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create blueprint
routes = Blueprint('main', __name__)

@routes.route('/')
def index():
    return render_template('index.html')

@routes.route('/login')
def login():
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@routes.route('/callback')
def callback():
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    code = request.args.get('code')
    token_info = sp_oauth.get_access_token(code)
    session['token_info'] = token_info
    return redirect(url_for('main.playlists'))

@routes.route('/playlists')
def playlists():
    if 'token_info' not in session:
        return redirect(url_for('main.login'))
    
    token_info = session['token_info']
    sp = spotipy.Spotify(auth=token_info['access_token'])
    user_playlists = spotify_utils.get_user_playlists(sp)
    
    return render_template('playlists.html', playlists=user_playlists['items'])

@routes.route('/api/playlist-metrics')
def get_playlist_metrics():
    if 'token_info' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
        
    try:
        token_info = session['token_info']
        sp = spotipy.Spotify(auth=token_info['access_token'])
        
        # Combine your yearly playlists and Carli's playlist
        playlists_to_fetch = [
            {'name': f'tommertime in {year}', 'id': None} for year in range(2017, 2025)
        ]
        playlists_to_fetch.append({
            'name': 'carlijimenez in 2024',
            'id': '3Nea27bcJK9Wea0YOFmgQa'
        })
        
        # First, get all user playlists to check what's available
        all_user_playlists = sp.current_user_playlists(limit=50)
        available_playlists = {
            playlist['name']: playlist['id'] 
            for playlist in all_user_playlists['items']
        }
        
        logger.info(f"Found available playlists: {list(available_playlists.keys())}")
        
        metrics = []
        for playlist in playlists_to_fetch:
            try:
                playlist_id = None
                if playlist['id']:  # If ID is provided (Carli's playlist)
                    playlist_id = playlist['id']
                    logger.info(f"Using provided ID for {playlist['name']}: {playlist_id}")
                elif playlist['name'] in available_playlists:  # Your playlists
                    playlist_id = available_playlists[playlist['name']]
                    logger.info(f"Found ID for {playlist['name']}: {playlist_id}")
                else:
                    logger.warning(f"Could not find playlist: {playlist['name']}")
                    continue

                # Fetch playlist data
                if playlist_id:
                    playlist_tracks = sp.playlist_tracks(playlist_id)
                    if not playlist_tracks['items']:
                        logger.warning(f"No tracks found in playlist: {playlist['name']}")
                        continue
                        
                    playlist_metrics = spotify_utils.get_playlist_metrics_by_id(
                        sp, playlist_id, playlist['name']
                    )
                    
                    if playlist_metrics:
                        metrics.append(playlist_metrics)
                        logger.info(f"Successfully processed {playlist['name']}")
                    else:
                        logger.warning(f"No metrics generated for {playlist['name']}")
                
            except Exception as e:
                logger.error(f"Error processing {playlist['name']}: {str(e)}")
                continue
        
        logger.info(f"Returning metrics for {len(metrics)} playlists")
        if not metrics:
            logger.error("No playlists were successfully processed")
            return jsonify({'error': 'No playlists found'}), 404
            
        return jsonify(metrics)
        
    except Exception as e:
        logger.error(f"Error in get_playlist_metrics: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@routes.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main.index'))

@routes.route('/compare', methods=['POST'])
def compare():
    logger.info("Starting playlist comparison")
    
    if 'token_info' not in session:
        logger.info("No token found, redirecting to login")
        return redirect(url_for('main.login'))
    
    playlist1_id = request.form.get('playlist1')
    playlist2_id = request.form.get('playlist2')
    logger.info(f"Comparing playlists: {playlist1_id} and {playlist2_id}")
    
    token_info = session['token_info']
    sp = spotipy.Spotify(auth=token_info['access_token'])
    
    comparison_result = spotify_utils.compare_playlists(sp, playlist1_id, playlist2_id)
    logger.info(f"Comparison result: {comparison_result}")
    
    return render_template('comparison.html', result=comparison_result)