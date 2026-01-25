# run.py
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment BEFORE importing app (which imports config.py)
env_path = Path('.env')
if env_path.exists():
    print("Loading environment from .env file")
    load_dotenv()
else:
    print("No .env file found, using environment variables")

# Import app AFTER environment is loaded
from app import create_app

# Force the correct redirect URI in production
if os.environ.get('RENDER') or os.environ.get('IS_PRODUCTION'):
    print("Setting production redirect URI")
    os.environ['SPOTIFY_REDIRECT_URI'] = 'https://altavia.onrender.com/callback'

print("SPOTIFY_REDIRECT_URI:", os.environ.get('SPOTIFY_REDIRECT_URI'))

app = create_app()

if __name__ == '__main__':
    # Use PORT environment variable provided by Render
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)