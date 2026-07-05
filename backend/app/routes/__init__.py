"""Blueprints de las areas Ventanilla, Renovaciones, Legal y Planos."""
from app.routes.usuarios_routes import usuarios_bp
from app.routes.afiliados_routes import afiliados_bp
from app.routes.cambios_routes import cambios_bp
from app.routes.cato_routes import cato_bp
from app.routes.control_cato_routes import control_cato_bp
from app.routes.org_sindical_routes import org_bp
from app.routes.reports_routes import reports_bp
from app.routes.renovaciones_routes import renovaciones_bp
from app.routes.legal_routes import legal_bp
from app.routes.planos_routes import planos_bp
from app.routes.documents_routes import documentos_bp

TODOS_BLUEPRINTS = (
    usuarios_bp, afiliados_bp, cambios_bp, cato_bp,
    control_cato_bp, org_bp, reports_bp, renovaciones_bp,
    legal_bp, planos_bp, documentos_bp,
)
