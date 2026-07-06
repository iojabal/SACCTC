"""Rutas: Registro de Control de Mensura (FormRegistroMensura).

Endpoints anidados bajo el cato:
  GET    /api/catos/{id_cato}/controles            lista con datos del afiliado
  POST   /api/catos/{id_cato}/controles            nuevo control
  PUT    /api/catos/{id_cato}/controles/{id_cont}  actualizar control
  DELETE /api/catos/{id_cato}/controles/{id_cont}  eliminar control
  GET    /api/catos/{id_cato}/renovacion           estado de renovacion
  PUT    /api/catos/{id_cato}/controles/{id_cont}/renovacion  radio buttons
"""
from flask import Blueprint, jsonify, request

from app.middleware.auth import requiere_roles, usuario_actual
from app.middleware.validators import ValidationError
from app.models.usuarios import (
    ROLES_VENTANILLA_LECTURA, ROLES_VENTANILLA_ESCRITURA,
    ROLES_VENTANILLA_ELIMINAR, ROLES_MENSURA_RENOVACION,
)
from app.services import control_cato_service, mensura_service

mensura_bp = Blueprint('mensura', __name__, url_prefix='/api/catos')


@mensura_bp.route('/<int:id_cato>/controles', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def listar_controles(id_cato):
    """Grid 'Cantidad de Controles Registrados' (ControlCato JOIN Afiliados)."""
    return jsonify(mensura_service.controles_por_cato(id_cato))


@mensura_bp.route('/<int:id_cato>/controles', methods=['POST'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def crear_control(id_cato):
    """ProcControlCato_New (el id_cato de la URL manda sobre el del body)."""
    body = request.get_json(silent=True) or {}
    body['id_cato'] = id_cato
    try:
        data = control_cato_service.registrar_control(
            body, usuario_actual().login_usr)
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@mensura_bp.route('/<int:id_cato>/controles/<int:id_cont>', methods=['PUT'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def actualizar_control(id_cato, id_cont):
    """ProcUpdateControlCato."""
    body = request.get_json(silent=True) or {}
    body['id_cato'] = id_cato
    try:
        data = control_cato_service.actualizar_control(
            id_cont, body, usuario_actual().login_usr)
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()


@mensura_bp.route('/<int:id_cato>/controles/<int:id_cont>', methods=['DELETE'])
@requiere_roles(*ROLES_VENTANILLA_ELIMINAR)
def eliminar_control(id_cato, id_cont):
    """ProcDeleteControlCato."""
    try:
        return jsonify(control_cato_service.eliminar_control(id_cont))
    except ValidationError as e:
        return e.respuesta()


@mensura_bp.route('/<int:id_cato>/renovacion', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def estado_renovacion(id_cato):
    """Estado de los radio buttons: EN_CURSO / RENOVADO / SIN_RENOVACION."""
    return jsonify(mensura_service.estado_renovacion(id_cato))


@mensura_bp.route('/<int:id_cato>/controles/<int:id_cont>/renovacion',
                  methods=['PUT'])
@requiere_roles(*ROLES_MENSURA_RENOVACION)
def actualizar_renovacion(id_cato, id_cont):
    """Radio buttons del legacy (solo ADMINSIS/PLANOS/INSPECCIONES):
    body {"estado": "RENOVADO", "hruta_nro": "...", "fecha_destruccion": "..."}
    o    {"estado": "EN_CURSO"}
    """
    body = request.get_json(silent=True) or {}
    estado = (body.get('estado') or '').upper()
    usuario = usuario_actual().login_usr
    try:
        if estado == 'RENOVADO':
            return jsonify(mensura_service.marcar_renovado(
                id_cato, id_cont, body, usuario))
        if estado == 'EN_CURSO':
            return jsonify(mensura_service.marcar_en_curso(
                id_cato, id_cont, usuario))
        return jsonify({'error': "estado debe ser 'RENOVADO' o 'EN_CURSO'"}), 400
    except ValidationError as e:
        return e.respuesta()
