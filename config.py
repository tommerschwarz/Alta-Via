# config.py
import os

class Config:
    SECRET_KEY = os.urandom(24)
    SPOTIFY_CLIENT_ID = '28fbc39f2018449ab318877c240f597f'
    SPOTIFY_CLIENT_SECRET = 'f59b9f2edd3047aa817e3e0e0217ecf5'
    SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:5000/callback'

print(f"Using Spotify Client ID: {Config.SPOTIFY_CLIENT_ID}")
print(f"Redirect URI: {Config.SPOTIFY_REDIRECT_URI}")