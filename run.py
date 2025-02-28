# run.py
from app import create_app
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

print("Current working directory:", os.getcwd())
print(".env file exists:", Path('.env').exists())

from dotenv import load_dotenv
load_dotenv(verbose=True) 

app = create_app()

if __name__ == '__main__':
    # Use PORT environment variable provided by Render
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)