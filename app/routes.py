# app/routes.py
from flask import (
    current_app, render_template, 
    redirect, url_for, request, session,
    Blueprint
)
import spotipy
import os
from . import spotify_utils

# Create a blueprint instead of using current_app directly
routes = Blueprint('main', __name__)

@routes.route('/')
def home():
    return render_template('index.html')

@routes.route('/login')
def login():
    # Use current_app within a context
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@routes.route('/callback')
def callback():
    # Use current_app within a context
    sp_oauth = spotify_utils.get_spotify_oauth(current_app)
    
    # Get the authorization code
    code = request.args.get('code')
    
    # Retrieve the access token
    token_info = sp_oauth.get_access_token(code)
    
    # Store the token in the session
    session['token_info'] = token_info
    
    return redirect(url_for('main.playlists'))

@routes.route('/playlists')
def playlists():
    # Check if user is logged in
    if 'token_info' not in session:
        return redirect(url_for('main.login'))
    
    # Create Spotify client
    token_info = session['token_info']
    sp = spotipy.Spotify(auth=token_info['access_token'])
    
    # Fetch user's playlists
    user_playlists = spotify_utils.get_user_playlists(sp)
    
    return render_template('playlists.html', playlists=user_playlists['items'])

@routes.route('/compare', methods=['POST'])
def compare():
    # Check if user is logged in
    if 'token_info' not in session:
        return redirect(url_for('main.login'))
    
    # Get selected playlist IDs
    playlist1_id = request.form.get('playlist1')
    playlist2_id = request.form.get('playlist2')
    
    # Create Spotify client
    token_info = session['token_info']
    sp = spotipy.Spotify(auth=token_info['access_token'])
    
    # Compare playlists
    comparison_result = spotify_utils.compare_playlists(sp, playlist1_id, playlist2_id)
    
    return render_template('comparison.html', result=comparison_result)