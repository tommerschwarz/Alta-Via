# app/routes.py
from flask import (
    current_app, render_template, 
    redirect, url_for, request, session
)
import spotipy
from . import spotify_utils

@current_app.route('/')
def home():
    return render_template('index.html')

@current_app.route('/login')
def login():
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@current_app.route('/callback')
def callback():
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    
    # Get the authorization code
    code = request.args.get('code')
    
    # Retrieve the access token
    token_info = sp_oauth.get_access_token(code)
    
    # Store the token in the session
    session['token_info'] = token_info
    
    return redirect(url_for('playlists'))

@current_app.route('/playlists')
def playlists():
    # Check if user is logged in
    if 'token_info' not in session:
        return redirect(url_for('login'))
    
    # Create Spotify client
    token_info = session['token_info']
    sp = spotipy.Spotify(auth=token_info['access_token'])
    
    # Fetch user's playlists
    user_playlists = spotify_utils.get_user_playlists(sp)
    
    return render_template('playlists.html', playlists=user_playlists['items'])

@current_app.route('/compare', methods=['POST'])
def compare():
    # Check if user is logged in
    if 'token_info' not in session:
        return redirect(url_for('login'))
    
    # Get selected playlist IDs
    playlist1_id = request.form.get('playlist1')
    playlist2_id = request.form.get('playlist2')
    
    # Create Spotify client
    token_info = session['token_info']
    sp = spotipy.Spotify(auth=token_info['access_token'])
    
    # Compare playlists
    comparison_result = spotify_utils.compare_playlists(sp, playlist1_id, playlist2_id)
    
    return render_template('comparison.html', result=comparison_result)
