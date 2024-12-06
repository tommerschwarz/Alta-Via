# app/__init__.py
from flask import Flask
from config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Import routes after creating app to avoid circular imports
    from . import routes
    
    return app
