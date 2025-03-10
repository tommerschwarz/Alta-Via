from flask import Flask
from config import Config
from flask_cors import CORS
import os

def create_app():
    # Get the absolute path to the templates directory
    template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
    
    # Create Flask app with explicit template folder
    app = Flask(__name__, 
                template_folder=template_dir,
                static_folder='static')   
    
    # Set a secret key from environment variable or use a secure default
    app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24))
    
    # Enable CORS with more permissive settings for development
    CORS(app, supports_credentials=True)
    
    # Load config
    app.config.from_object(Config)
    
    # Import and register the blueprint
    from .routes import routes
    app.register_blueprint(routes)
    
    return app