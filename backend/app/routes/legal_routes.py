"""Rutas: area Legal (revision legal de tramites de renovacion).

RBAC:
- Lectura (bandeja, detalle, actuaciones, seguimiento): todos los roles.
- Gestion legal (informes legales, observaciones, resoluciones):
  ADMINSIS y USR_LEGAL.
"""
from flask import Blueprint, jsonify, request

from app.middleware.auth import requiere_roles, usuario_actual
from app.middleware.validators import ValidationError
from app.models.renovaciones import ESTADOS_RENOVACION
from app.models.usuarios import ROLES_LEGAL_LECTURA, ROLES_LEGAL_GESTION
from app.services import legal_service

legal_bp = Blueprint('legal', __name__, url_prefix='/api/legal')


@legal_bp.route('/casos', methods=['GET'])
@requiere_roles(*ROLES_LEGAL_LECTURA)
def listar_casos():
    """?estado=&id_afi=&id_cato=&nro_cite=&page=&per_page=

    Sin estado devuelve la bandeja: casos REMITIDA_LEGAL (recepcion de
    informes tecnicos del area Renovaciones).
    """
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        id_cato = request.args.get('id_cato', type=int)
    except ValueError:
        return jsonify({'error': 'Parametros invalidos'}), 400
    estado = request.args.get('estado')
    if estado and estado not in ESTADOS_RENOVACION:
        return jsonify({
            'error': f'estado invalido: {estado}',
            'validos': list(ESTADOS_RENOVACION),
        }), 400
    return jsonify(legal_service.listar_casos(
        page=page, per_page=per_page, estado=estado,
        id_afi=request.args.get('id_afi'), id_cato=id_cato,
        nro_cite=request.args.get('nro_cite')))


@legal_bp.route('/casos/<int:id_renovacion>', methods=['GET'])
@requiere_roles(*ROLES_LEGAL_LECTURA)
def detalle_caso(id_renovacion):
    """Detalle del caso: renovacion + informes tecnicos + actuaciones."""
    data = legal_service.obtener_caso(id_renovacion)
    if data is None:
        return jsonify({'error': f'No existe el caso {id_renovacion}'}), 404
    return jsonify(data)


@legal_bp.route('/resumen', methods=['GET'])
@requiere_roles(*ROLES_LEGAL_LECTURA)
def resumen():
    """Seguimiento del estado legal de los tramites (conteo por estado)."""
    return jsonify(legal_service.resumen_estados())


@legal_bp.route('/casos/<int:id_renovacion>/actuaciones', methods=['GET'])
@requiere_roles(*ROLES_LEGAL_LECTURA)
def listar_actuaciones(id_renovacion):
    """Archivo de actuaciones legales del caso."""
    data = legal_service.listar_actuaciones(id_renovacion)
    if data is None:
        return jsonify({'error': f'No existe el caso {id_renovacion}'}), 404
    return jsonify(data)


@legal_bp.route('/casos/<int:id_renovacion>/informe', methods=['POST'])
@requiere_roles(*ROLES_LEGAL_GESTION)
def registrar_informe(id_renovacion):
    """Elabora el informe legal (exige informe tecnico previo)."""
    try:
        data = legal_service.registrar_informe_legal(
            id_renovacion, request.get_json(silent=True) or {},
            usuario_actual())
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@legal_bp.route('/casos/<int:id_renovacion>/observacion', methods=['POST'])
@requiere_roles(*ROLES_LEGAL_GESTION)
def registrar_observacion(id_renovacion):
    """Registra una observacion legal (cuando corresponda)."""
    try:
        data = legal_service.registrar_observacion(
            id_renovacion, request.get_json(silent=True) or {},
            usuario_actual())
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@legal_bp.route('/casos/<int:id_renovacion>/resolucion', methods=['POST'])
@requiere_roles(*ROLES_LEGAL_GESTION)
def emitir_resolucion(id_renovacion):
    """Emite la resolucion administrativa (exige informe legal previo)."""
    try:
        data = legal_service.emitir_resolucion(
            id_renovacion, request.get_json(silent=True) or {},
            usuario_actual())
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()
