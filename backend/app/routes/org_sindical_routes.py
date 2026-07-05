"""Rutas: organizacion sindical (Federaciones -> Centrales -> Sindicatos).

Replica ProcFederaciones, ProcCentCargar, ProcSindCargar, ProcGetOrg_Seleccion.
"""
from flask import Blueprint, jsonify

from app.models import Federacion, Central, Sindicato
from app.middleware.auth import requiere_roles
from app.models.usuarios import ROLES_VENTANILLA_LECTURA

org_bp = Blueprint('org_sindical', __name__, url_prefix='/api/org')


@org_bp.route('/federaciones', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def federaciones():
    """ProcFederaciones."""
    items = Federacion.query.order_by(Federacion.sigla.asc()).all()
    return jsonify([f.to_dict() for f in items])


@org_bp.route('/federaciones/<int:id_fed>/centrales', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def centrales(id_fed):
    """ProcCentCargar."""
    items = Central.query.filter_by(id_fed=id_fed)\
        .order_by(Central.nombre.asc()).all()
    return jsonify([c.to_dict() for c in items])


@org_bp.route('/centrales/<int:id_cent>/sindicatos', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def sindicatos(id_cent):
    """ProcSindCargar."""
    items = Sindicato.query.filter_by(id_cent=id_cent)\
        .order_by(Sindicato.nombre.asc()).all()
    return jsonify([s.to_dict() for s in items])


@org_bp.route('/sindicatos/<int:id_sind>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def seleccion(id_sind):
    """ProcGetOrg_Seleccion2: jerarquia completa del sindicato."""
    sind = Sindicato.query.get(id_sind)
    if sind is None:
        return jsonify({'error': f'No existe el sindicato {id_sind}'}), 404
    return jsonify(sind.to_dict(incluir_jerarquia=True))
