# config.py
import os

class Config:
    SECRET_KEY = os.urandom(24)
    SPOTIFY_CLIENT_ID = '2ff161149174488e8582dc0dd941fcb4'
    SPOTIFY_CLIENT_SECRET = 'b5fa33c9a4674829acb272d34594d5fa'
    SPOTIFY_REDIRECT_URI = 'https://altavia.onrender.com/callback'

print(f"Using Spotify Client ID: {Config.SPOTIFY_CLIENT_ID}")
print(f"Redirect URI: {Config.SPOTIFY_REDIRECT_URI}")