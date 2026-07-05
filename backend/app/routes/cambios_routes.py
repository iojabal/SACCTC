"""Rutas: Cambios (traslados/transferencias) - CRUD + historial."""
from flask import Blueprint, jsonify, request

from app.middleware.auth import requiere_roles
from app.middleware.validators import ValidationError
from app.models.usuarios import (
    ROLES_VENTANILLA_LECTURA, ROLES_VENTANILLA_ESCRITURA,
    ROLES_VENTANILLA_ELIMINAR,
)
from app.services import cambios_service

cambios_bp = Blueprint('cambios', __name__, url_prefix='/api/cambios')


@cambios_bp.route('', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def listar():
    """?id_cato=&id_afi=&page=&per_page="""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        id_cato = request.args.get('id_cato', type=int)
    except ValueError:
        return jsonify({'error': 'Parametros invalidos'}), 400
    return jsonify(cambios_service.listar_cambios(
        page=page, per_page=per_page, id_cato=id_cato,
        id_afi=request.args.get('id_afi')))


@cambios_bp.route('/cato/<int:id_cato>/historial', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def historial_cato(id_cato):
    """ProcGetHistorialCambios / ProcGetHistTrfCato."""
    return jsonify(cambios_service.historial_cambios_cato(id_cato))


@cambios_bp.route('/cato/<int:id_cato>/primer-titular', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def primer_titular(id_cato):
    """ProcGetIdAfi_Comprador."""
    return jsonify({'id_cato': id_cato,
                    'primer_titular': cambios_service.primer_titular_cato(id_cato)})


@cambios_bp.route('', methods=['POST'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def crear():
    """ProcNewCambio + transferencia del cato (transaccional)."""
    try:
        data = cambios_service.registrar_cambio(request.get_json(silent=True) or {})
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@cambios_bp.route('/<int:id_trf>', methods=['PUT'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def actualizar(id_trf):
    """ProcUpdateCambio."""
    try:
        data = cambios_service.actualizar_cambio(
            id_trf, request.get_json(silent=True) or {})
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()


@cambios_bp.route('/<int:id_trf>', methods=['DELETE'])
@requiere_roles(*ROLES_VENTANILLA_ELIMINAR)
def eliminar(id_trf):
    """ProcDeleteCambio (solo el ultimo cambio; revierte titular)."""
    try:
        return jsonify(cambios_service.eliminar_cambio(id_trf))
    except ValidationError as e:
        return e.respuesta()
