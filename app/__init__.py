# app/__init__.py
from flask import Flask
from config import Config
import os

def create_app():
    # Get the directory of the current file
    template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
    
    app = Flask(__name__, 
                template_folder=template_dir)
    app.config.from_object(Config)

    # Import and register the blueprint
    from .routes import routes
    app.register_blueprint(routes)
    
    return app