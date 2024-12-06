# app/spotify_utils.py
import spotipy
from spotipy.oauth2 import SpotifyOAuth

def get_spotify_oauth(app):
    """Create Spotify OAuth object"""
    return SpotifyOAuth(
        client_id=app.config['SPOTIFY_CLIENT_ID'],
        client_secret=app.config['SPOTIFY_CLIENT_SECRET'],
        redirect_uri=app.config['SPOTIFY_REDIRECT_URI'],
        scope='playlist-read-private playlist-read-collaborative'
    )

def get_user_playlists(sp):
    """Fetch user's Spotify playlists"""
    return sp.current_user_playlists(limit=50)

def compare_playlists(sp, playlist1_id, playlist2_id):
    """Compare two playlists and find similarities"""
    # Fetch tracks from both playlists
    tracks1 = sp.playlist_tracks(playlist1_id)
    tracks2 = sp.playlist_tracks(playlist2_id)
    
    # Extract track IDs
    track_ids1 = set(track['track']['id'] for track in tracks1['items'] if track['track'])
    track_ids2 = set(track['track']['id'] for track in tracks2['items'] if track['track'])
    
    # Find similar tracks
    similar_track_ids = track_ids1.intersection(track_ids2)
    
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