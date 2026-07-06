"""Rutas: Afiliados - CRUD + busqueda + historial."""
from flask import Blueprint, jsonify, request

from app.middleware.auth import requiere_roles
from app.middleware.validators import ValidationError
from app.models.usuarios import (
    ROLES_VENTANILLA_LECTURA, ROLES_VENTANILLA_ESCRITURA,
)
from app.services import afiliados_service, validaciones

afiliados_bp = Blueprint('afiliados', __name__, url_prefix='/api/afiliados')


@afiliados_bp.route('', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def buscar():
    """Busqueda paginada por CI o nombre. ?q=&page=&per_page=&tiene_cato="""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
    except ValueError:
        return jsonify({'error': 'page/per_page invalidos'}), 400
    # Filtro opcional: tiene_cato=true|false (null = sin filtro)
    tiene_cato_str = request.args.get('tiene_cato')
    tiene_cato = None
    if tiene_cato_str:
        tiene_cato = tiene_cato_str.lower() == 'true'
    resultado = afiliados_service.buscar_afiliados(
        criterio=request.args.get('q'), page=page, per_page=per_page,
        tiene_cato=tiene_cato)
    return jsonify(resultado)


@afiliados_bp.route('/<id_afi>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def detalle(id_afi):
    """ProcAfiGetDatos + catos + observaciones."""
    data = afiliados_service.obtener_afiliado(id_afi)
    if data is None:
        return jsonify({'error': f'No existe el afiliado {id_afi}'}), 404
    return jsonify(data)


@afiliados_bp.route('/<id_afi>/catos', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def catos(id_afi):
    """Grid 'Afiliaciones Registradas' (Cato JOIN Sindicatos/Centrales/
    Federaciones) del detalle de afiliado legacy."""
    data = afiliados_service.catos_de_afiliado(id_afi)
    if data is None:
        return jsonify({'error': f'No existe el afiliado {id_afi}'}), 404
    return jsonify(data)


@afiliados_bp.route('/<id_afi>/existe', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def existe(id_afi):
    """ProcAfiCiExiste."""
    return jsonify({'id_afi': id_afi,
                    'existe': validaciones.existe_afiliado(id_afi)})


@afiliados_bp.route('/<id_afi>/historial', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def historial(id_afi):
    """ProcHistAfi."""
    return jsonify(afiliados_service.historial_afiliado(id_afi))


@afiliados_bp.route('/<id_afi>/cato-vigente', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def cato_vigente(id_afi):
    """ProcTieneCatoVigenteAfi + ProcAfiNewGetIdCatoVigente."""
    return jsonify({
        'id_afi': id_afi,
        'tiene_cato': validaciones.tiene_cato_vigente(id_afi),
        'id_cato': validaciones.id_cato_vigente(id_afi),
    })


@afiliados_bp.route('', methods=['POST'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def crear():
    """ProcAfiNuevo."""
    try:
        data = afiliados_service.crear_afiliado(request.get_json(silent=True) or {})
        return jsonify(data), 201
    except ValidationError as e:
        return e.respuesta()


@afiliados_bp.route('/<id_afi>', methods=['PUT'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def actualizar(id_afi):
    """ProcAfiActualizar (propaga CI a tablas relacionadas)."""
    try:
        data = afiliados_service.actualizar_afiliado(
            id_afi, request.get_json(silent=True) or {})
        return jsonify(data)
    except ValidationError as e:
        return e.respuesta()
