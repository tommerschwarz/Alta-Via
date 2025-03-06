import logging
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from requests.exceptions import HTTPError
from statistics import mean, stdev
from collections import defaultdict
from flask import session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_spotify_oauth(app):
    """Create Spotify OAuth object with minimal required scope"""
    print(f"Utils  Using Spotify Client ID: {app.config['SPOTIFY_CLIENT_ID']}")
    return SpotifyOAuth(
        client_id=app.config['SPOTIFY_CLIENT_ID'],
        client_secret=app.config['SPOTIFY_CLIENT_SECRET'],
        redirect_uri=app.config['SPOTIFY_REDIRECT_URI'],
        scope = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state", # scope
        cache_handler=None,
        show_dialog=False
    )

def get_user_playlists(sp):
    """Fetch user's Spotify playlists"""
    return sp.current_user_playlists(limit=10)

def compare_playlists(sp, playlist1_id, playlist2_id):
    """Compare two playlists and find similarities"""
    logger.info(f"Fetching tracks for playlist 1: {playlist1_id}")
    tracks1 = sp.playlist_tracks(playlist1_id)
    logger.info(f"Fetching tracks for playlist 2: {playlist2_id}")
    tracks2 = sp.playlist_tracks(playlist2_id)
    
    # Extract track IDs
    track_ids1 = set(track['track']['id'] for track in tracks1['items'] if track['track'])
    track_ids2 = set(track['track']['id'] for track in tracks2['items'] if track['track'])
    
    logger.info(f"Found {len(track_ids1)} tracks in playlist 1 and {len(track_ids2)} tracks in playlist 2")
    
    # Find similar tracks
    similar_track_ids = track_ids1.intersection(track_ids2)
    logger.info(f"Found {len(similar_track_ids)} similar tracks")
    
    # Fetch detailed info for similar tracks
    similar_tracks = []
    if similar_track_ids:
        similar_tracks_info = sp.tracks(list(similar_track_ids))
        similar_tracks = [
            {
                'name': track['name'],
                'artist': track['artists'][0]['name'],
                'album': track['album']['name']
            } for track in similar_tracks_info['tracks']
        ]
    
    # Calculate similarity
    total_tracks = max(len(tracks1['items']), len(tracks2['items']))
    similarity_percentage = (len(similar_track_ids) / total_tracks) * 100
    
    return {
        'similarity_percentage': round(similarity_percentage, 2),
        'similar_tracks': similar_tracks,
        'total_tracks_1': len(tracks1['items']),
        'total_tracks_2': len(tracks2['items'])
    }


def get_playlist_metrics(sp, playlist_name):
    # Get current user's info
    user_info = sp.current_user()
    user_id = user_info['id']
    selected_year = session.get('selected_year', '2024')  # Default to 2024 if not set
    playlist_name = f"{user_id} in {selected_year}"
    try:
        # Find the playlist
        results = sp.current_user_playlists()
        playlist_id = None
        for playlist in results['items']:
            if playlist['name'] == playlist_name:
                playlist_id = playlist['id']
                break
                
        if not playlist_id:
            logger.info(f"Could not find playlist ID for: {playlist_name}")
            return None
        
        # Get all tracks
        logger.info(f"Fetching tracks for playlist: {playlist_name}")
        tracks = sp.playlist_tracks(playlist_id)
        
        # Initialize lists for distributions
        popularities = []
        release_years = []
        artists = set()
        artist_genres = defaultdict(set)
        track_data = []  # Move this up with other initializations
        
        for item in tracks['items']:
            if item['track'] is None:
                continue
                
            track = item['track']
            
            # Get album image - print for debugging
            album_images = track['album']['images']
            
            # Get the medium or first available image
            album_image = None
            if album_images:
                # Try to get medium size image (usually second in list)
                if len(album_images) > 1:
                    album_image = album_images[1]['url']
                else:
                    album_image = album_images[0]['url']
            
            # Add to track_data
            track_data.append({
                'id': track['id'],
                'name': track['name'],
                'artists': [artist['name'] for artist in track['artists']],
                'album_image': album_image
            })
            
            # Add to metrics lists
            popularities.append(track['popularity'])
            release_years.append(int(track['album']['release_date'][:4]))
            for artist in track['artists']:
                artists.add(artist['name'])

        metrics = {
            'name': playlist_name,
            'playlist_name': playlist_name,
            'avgPopularity': mean(popularities) if popularities else 0,
            'genreCount': len(artist_genres),
            'avgYear': mean(release_years) if release_years else 0,
            'trackCount': len(popularities),
            'artistCount': len(artists),
            'tracks': track_data,  # Include the track_data here instead of raw tracks
            'popularityScores': popularities,
            'years': release_years,
        }
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error getting metrics for {playlist_name}: {str(e)}")
        return None
    
def get_playlist_comparison(sp, playlist1_id, playlist2_id):
    """Get detailed comparison data for two playlists"""
    p1_tracks = sp.playlist_tracks(playlist1_id)
    p2_tracks = sp.playlist_tracks(playlist2_id)
    
    # Get detailed track info
    p1_data = {
        'years': [],
        'popularity': [],
        'artists': set(),
        'tracks': []
    }
    p2_data = {
        'years': [],
        'popularity': [],
        'artists': set(),
        'tracks': []
    }
    
    # Process each playlist
    for track in p1_tracks['items']:
        if track['track']:
            p1_data['years'].append(int(track['track']['album']['release_date'][:4]))
            p1_data['popularity'].append(track['track']['popularity'])
            p1_data['artists'].update(artist['name'] for artist in track['track']['artists'])
            p1_data['tracks'].append({
                'id': track['track']['id'],
                'name': track['track']['name'],
                'artists': [a['name'] for a in track['track']['artists']]
            })
    
    # Repeat for playlist 2...
    
    # Find common artists and tracks
    common_artists = p1_data['artists'].intersection(p2_data['artists'])
    common_tracks = [t for t in p1_data['tracks'] if any(t['id'] == t2['id'] for t2 in p2_data['tracks'])]
    
    return {
        'playlist1': p1_data,
        'playlist2': p2_data,
        'common_artists': list(common_artists),
        'common_tracks': common_tracks
    }

def get_playlist_metrics_by_id(sp, playlist_id, display_name=None, original_name=None):
    try:
        # Get tracks directly using ID
        logger.info(f"Fetching tracks for playlist ID: {playlist_id}")
        tracks_response = sp.playlist_tracks(playlist_id)
        
        # Initialize lists and dictionaries
        popularities = []
        release_years = []
        artists = set()
        tracks = []
        artist_genres = defaultdict(int)
        all_artists_genres = []
        
        # Process tracks
        for item in tracks_response['items']:
            if item['track'] is None:
                continue
                
            track = item['track']
            
            # Get album image
            album_images = track['album']['images']
            album_image = None
            if album_images:
                album_image = album_images[1]['url'] if len(album_images) > 1 else album_images[0]['url']
            
            # Basic track info
            track_artists = track['artists']
            tracks.append({
                'id': track['id'],
                'name': track['name'],
                'artists': [artist['name'] for artist in track_artists],
                'album_image': album_image
            })
            
            # Metrics data
            popularities.append(track['popularity'])
            release_years.append(int(track['album']['release_date'][:4]))
            
            # Genre extraction
            for artist in track_artists:
                try:
                    # Fetch full artist details to get genres
                    artist_details = sp.artist(artist['id'])
                    artist_genres_list = artist_details.get('genres', [])
                    
                    all_artists_genres.extend(artist_genres_list)
                    
                    for genre in artist_genres_list:
                        normalized_genre = genre.lower().strip()
                        artist_genres[normalized_genre] += 1
                    
                    artists.add(artist['name'])
                
                except Exception as e:
                    logger.error(f"Error fetching genres for artist {artist['name']}: {str(e)}")
        
        # Ensure we have genre data
        if not artist_genres:
            artist_genres['unknown'] = len(tracks)
        
        # Prepare metrics - use display name for visualization
        metrics = {
            'name': display_name or original_name,  # This will be used in the UI
            'playlist_name': original_name,        # Original playlist name
            'avgPopularity': mean(popularities) if popularities else 0,
            'genreCount': len(artist_genres),
            'avgYear': mean(release_years) if release_years else 0,
            'trackCount': len(popularities),
            'artistCount': len(artists),
            'playlist_id': playlist_id,
            'tracks': tracks,
            'popularityScores': popularities,
            'years': release_years,
            'genres': dict(artist_genres),
        }
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error getting metrics for {original_name}: {str(e)}")
        return None