"""Rutas: area Planos (registro, revision, consulta y archivo de planos).

RBAC (FormRegistroMensura legacy):
- Lectura (consulta de planos): todos los roles vigentes.
- Gestion (registro, actualizacion, archivo): ADMINSIS y USR_PLANOS.
- Revision de documentacion tecnica: ADMINSIS, USR_PLANOS y
  USR_INSPECCIONES.
"""
from flask import Blueprint, jsonify, request

from app.middleware.auth import requiere_roles, usuario_actual
from app.middleware.validators import ValidationError
from app.models.planos import ESTADOS_PLANO, TIPOS_PLANO
from app.models.usuarios import (
    ROLES_PLANOS_LECTURA, ROLES_PLANOS_GESTION, ROLES_PLANOS_REVISION,
)
from app.services import planos_service

planos_bp = Blueprint('planos', __name__, url_prefix='/api/planos')


@planos_bp.route('', methods=['GET'])
@requiere_roles(*ROLES_PLANOS_LECTURA)
def listar():
    """?estado=&tipo=&id_afi=&id_cato=&nro_plano=&page=&per_page="""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        id_cato = request.args.get('id_cato', type=int)
    except ValueError:
        return jsonify({'error': 'Parametros invalidos'}), 400
    estado = request.args.get('estado')
    if estado and estado not in ESTADOS_PLANO:
        return jsonify({
            'error': f'estado invalido: {estado}',
            'validos': list(ESTADOS_PLANO),
        }), 400
    tipo = request.args.get('tipo')
    if tipo and tipo not in TIPOS_PLANO:
        return jsonify({
            'error': f'tipo invalido: {tipo}',
            'validos': list(TIPOS_PLANO),
        }), 400
    return jsonify(planos_service.listar_planos(
        page=page, per_page=per_page, estado=estado, tipo=tipo,
        id_afi=request.args.get('id_afi'), id_cato=id_cato,
        nro_plano=request.args.get('nro_plano')))


@planos_bp.route('/<int:id_plano>', methods=['GET'])
@requiere_roles(*ROLES_PLANOS_LECTURA)
def detalle(id_plano):
    """Detalle del plano + afiliado, cato y revisiones."""
    data = planos_service.obtener_plano(id_plano)
    if data is None:
        return jsonify({'error': f'No existe el plano {id_plano}'}), 404
    return jsonify(data)


@planos_bp.route('/cato/<int:id_cato>', methods=['GET'])
@requiere_roles(*ROLES_PLANOS_LECTURA)
def por_cato(id_cato):
    """Consulta rapida: planos registrados del cato."""
    return jsonify(planos_service.planos_por_cato(id_cato))


@planos_bp.route('', methods=['POST'])
@requiere_roles(*ROLES_PLANOS_GESTION)
def crear():
    """Registro de un plano nuevo."""
    try:
        data = planos_service.crear_plano(
            request.get_json(silent=True) or {}, usuario_actual())
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@planos_bp.route('/<int:id_plano>', methods=['PUT'])
@requiere_roles(*ROLES_PLANOS_GESTION)
def actualizar(id_plano):
    """Actualizacion de datos tecnicos y de archivo del plano."""
    try:
        data = planos_service.actualizar_plano(
            id_plano, request.get_json(silent=True) or {}, usuario_actual())
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()


@planos_bp.route('/<int:id_plano>/revisiones', methods=['GET'])
@requiere_roles(*ROLES_PLANOS_LECTURA)
def listar_revisiones(id_plano):
    """Historial de revisiones de documentacion tecnica del plano."""
    data = planos_service.listar_revisiones(id_plano)
    if data is None:
        return jsonify({'error': f'No existe el plano {id_plano}'}), 404
    return jsonify(data)


@planos_bp.route('/<int:id_plano>/revisiones', methods=['POST'])
@requiere_roles(*ROLES_PLANOS_REVISION)
def registrar_revision(id_plano):
    """Recepcion y revision de la documentacion tecnica del plano."""
    try:
        data = planos_service.registrar_revision(
            id_plano, request.get_json(silent=True) or {}, usuario_actual())
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@planos_bp.route('/<int:id_plano>/archivar', methods=['POST'])
@requiere_roles(*ROLES_PLANOS_GESTION)
def archivar(id_plano):
    """Archivo fisico y digital del plano (solo planos APROBADOS)."""
    try:
        data = planos_service.archivar_plano(
            id_plano, request.get_json(silent=True) or {}, usuario_actual())
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()
