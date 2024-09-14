from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config
from app.utils import custom_json_encoder

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)

    # Import and register blueprints
    from app.views.slots import slots as slots_blueprint
    from app.views.bonus_hunts import bonus_hunts as bonus_hunts_blueprint
    from app.views.main import main as main_blueprint

    app.register_blueprint(slots_blueprint, url_prefix='/slots')
    app.register_blueprint(bonus_hunts_blueprint, url_prefix='/bonus-hunts')
    app.register_blueprint(main_blueprint)

    # Set up custom JSON encoding
    app.json.encoder = custom_json_encoder

    return app