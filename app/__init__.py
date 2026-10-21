import os
from flask import Flask
from dotenv import load_dotenv
from app.models import db, login_manager
from flask_migrate import Migrate

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
migrate = Migrate()

def get_skill_icon(skill_id):
    icons = {
        'welder': 'flame',
        'construction': 'hard-hat',
        'loader': 'package',
        'electrician': 'zap',
        'painter': 'paint-roller',
        'helper': 'hand',
    }
    return icons.get(skill_id, 'help-circle')

def create_app():
    app = Flask(__name__, 
                template_folder=os.path.join(BASE_DIR, 'templates'),
                static_folder=os.path.join(BASE_DIR, 'static'))
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'shramlink-dev-secret-change-in-production')
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = False  # Set True in production with HTTPS
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    
    # Database configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'shramlink.db'))
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    
    # Jinja globals
    app.jinja_env.globals['get_skill_icon'] = get_skill_icon
    
    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.auth import auth_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.admin import admin_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(admin_bp)
    
    # Template context processors
    @app.context_processor
    def inject_globals():
        return {
            'DAILY_APPLY_LIMIT': 15,
        }
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app