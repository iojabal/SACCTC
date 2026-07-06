from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy

from config import get_config

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()


def create_app(config_name='development'):
    """Application factory"""

    app = Flask(__name__)

    # Load configuration
    config = get_config()
    app.config.from_object(config)

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, origins=config.CORS_ORIGINS)


    with app.app_context():
        # Importar modelos para que esten registrados en el metadata
        from app import models  # noqa: F401

        # En desarrollo crea tablas faltantes; en produccion usar los .sql
        # de /migracion/POSTGRESQL (10_ventanilla_schema.sql, etc.)
        # COMENTADO: Las migrations SQL ya crearon todas las tablas.
        # Descomenta cuando uses Alembic/Flask-Migrate (no mezclar con SQL puro)
        # if app.config.get('DEBUG') or app.config.get('TESTING'):
        #     db.create_all()

        # Registrar blueprints del area Ventanilla
        from app.routes import TODOS_BLUEPRINTS
        for bp in TODOS_BLUEPRINTS:
            app.register_blueprint(bp)

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return {'error': 'Internal server error'}, 500

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health():
        return {'status': 'OK', 'message': 'SACCTC PostgreSQL Backend is running'}

    return app
