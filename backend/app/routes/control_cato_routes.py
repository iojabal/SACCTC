"""Rutas: Control tecnico (ControlCato)."""
from flask import Blueprint, jsonify, request

from app.middleware.auth import requiere_roles, usuario_actual
from app.middleware.validators import ValidationError
from app.models.usuarios import (
    ROLES_VENTANILLA_LECTURA, ROLES_VENTANILLA_ESCRITURA,
    ROLES_VENTANILLA_ELIMINAR,
)
from app.services import control_cato_service

control_cato_bp = Blueprint('control_cato', __name__,
                            url_prefix='/api/controles')


@control_cato_bp.route('', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def listar():
    """?id_cato=&id_afi=&page=&per_page="""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        id_cato = request.args.get('id_cato', type=int)
    except ValueError:
        return jsonify({'error': 'Parametros invalidos'}), 400
    return jsonify(control_cato_service.listar_controles(
        page=page, per_page=per_page, id_cato=id_cato,
        id_afi=request.args.get('id_afi')))


@control_cato_bp.route('/cato/<int:id_cato>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def por_cato(id_cato):
    """ProcGetControlCato: historial completo del cato."""
    return jsonify(control_cato_service.controles_por_cato(id_cato))


@control_cato_bp.route('/cato/<int:id_cato>/ultimo', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def ultimo(id_cato):
    """ProcGetUltimoControl (404 si el cato no tiene controles)."""
    data = control_cato_service.ultimo_control(id_cato)
    if data is None:
        return jsonify({'error': f'El cato {id_cato} no tiene controles'}), 404
    return jsonify(data)


@control_cato_bp.route('', methods=['POST'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def crear():
    """ProcControlCato_New."""
    try:
        data = control_cato_service.registrar_control(
            request.get_json(silent=True) or {},
            usuario_actual().login_usr)
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@control_cato_bp.route('/<int:id_cont>', methods=['PUT'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def actualizar(id_cont):
    """ProcUpdateControlCato."""
    try:
        data = control_cato_service.actualizar_control(
            id_cont, request.get_json(silent=True) or {},
            usuario_actual().login_usr)
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()


@control_cato_bp.route('/<int:id_cont>', methods=['DELETE'])
@requiere_roles(*ROLES_VENTANILLA_ELIMINAR)
def eliminar(id_cont):
    """ProcDeleteControlCato."""
    try:
        return jsonify(control_cato_service.eliminar_control(id_cont))
    except ValidationError as e:
        return e.respuesta()
