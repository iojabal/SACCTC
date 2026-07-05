"""Rutas: area Renovaciones (RenovacionProgramada + informes tecnicos).

RBAC:
- Lectura: todos los roles vigentes.
- Gestion del tramite (crear, vigencia, remitir a legal):
  ADMINSIS y USR_OPERACIONES.
- Registro de inspecciones: ADMINSIS, USR_TECNICO y USR_INSPECCIONES.
"""
from flask import Blueprint, jsonify, request

from app.middleware.auth import requiere_roles, usuario_actual
from app.middleware.validators import ValidationError
from app.models.renovaciones import ESTADOS_RENOVACION
from app.models.usuarios import (
    ROLES_RENOV_LECTURA, ROLES_RENOV_GESTION, ROLES_RENOV_INSPECCION,
)
from app.services import renovaciones_service

renovaciones_bp = Blueprint('renovaciones', __name__,
                            url_prefix='/api/renovaciones')


@renovaciones_bp.route('', methods=['GET'])
@requiere_roles(*ROLES_RENOV_LECTURA)
def listar():
    """?estado=&id_afi=&id_cato=&page=&per_page= (ProcGetHistorialRenovSol2)."""
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
    return jsonify(renovaciones_service.listar_renovaciones(
        page=page, per_page=per_page, estado=estado,
        id_afi=request.args.get('id_afi'), id_cato=id_cato))


@renovaciones_bp.route('/<int:id_renovacion>', methods=['GET'])
@requiere_roles(*ROLES_RENOV_LECTURA)
def detalle(id_renovacion):
    """ProcRenovGetUltima: detalle con afiliado, cato e informes."""
    data = renovaciones_service.obtener_renovacion(id_renovacion)
    if data is None:
        return jsonify({'error': f'No existe la renovacion {id_renovacion}'}), 404
    return jsonify(data)


@renovaciones_bp.route('/afiliado/<id_afi>/elegibilidad', methods=['GET'])
@requiere_roles(*ROLES_RENOV_LECTURA)
def elegibilidad(id_afi):
    """Afiliado vigente + cato vigente + sin observaciones pendientes."""
    data = renovaciones_service.elegibilidad_afiliado(id_afi)
    if data is None:
        return jsonify({'error': f'No existe el afiliado {id_afi}'}), 404
    return jsonify(data)


@renovaciones_bp.route('', methods=['POST'])
@requiere_roles(*ROLES_RENOV_GESTION)
def crear():
    """ProcRenovInsertRenovProg2."""
    try:
        data = renovaciones_service.crear_renovacion(
            request.get_json(silent=True) or {}, usuario_actual())
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@renovaciones_bp.route('/<int:id_renovacion>', methods=['PUT'])
@requiere_roles(*ROLES_RENOV_GESTION)
def actualizar(id_renovacion):
    """ProcRenovUpdateFechaVen: fechas de vigencia."""
    try:
        data = renovaciones_service.actualizar_vigencia(
            id_renovacion, request.get_json(silent=True) or {},
            usuario_actual())
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()


@renovaciones_bp.route('/<int:id_renovacion>/remitir-legal', methods=['POST'])
@requiere_roles(*ROLES_RENOV_GESTION)
def remitir_legal(id_renovacion):
    """Cambia el estado a REMITIDA_LEGAL y registra la nota."""
    try:
        data = renovaciones_service.remitir_legal(
            id_renovacion, request.get_json(silent=True) or {},
            usuario_actual())
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()


@renovaciones_bp.route('/<int:id_renovacion>/informes', methods=['GET'])
@requiere_roles(*ROLES_RENOV_LECTURA)
def listar_informes(id_renovacion):
    """Historial de visitas tecnicas de la renovacion."""
    data = renovaciones_service.listar_informes(id_renovacion)
    if data is None:
        return jsonify({'error': f'No existe la renovacion {id_renovacion}'}), 404
    return jsonify(data)


@renovaciones_bp.route('/<int:id_renovacion>/informes', methods=['POST'])
@requiere_roles(*ROLES_RENOV_INSPECCION)
def crear_informe(id_renovacion):
    """ProcRenovUpdateDatosInfTec: registra inspeccion de campo."""
    try:
        data = renovaciones_service.registrar_informe(
            id_renovacion, request.get_json(silent=True) or {},
            usuario_actual())
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()
