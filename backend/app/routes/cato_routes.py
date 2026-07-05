"""Rutas: Cato (catastro) - CRUD + busqueda.

Replica D_OrgSindical (ProcNewAsigOrg, ProcUpdateAfiOrg, ProcDeleteAsigOrg,
ProcGetAfiOrg, ProcGetUltimoCodCato) con RBAC y validacion server-side.
"""
from flask import Blueprint, jsonify, request

from app import db
from app.models import Cato, Afiliado, Sindicato
from app.models.cato import TIPOS_AUT
from app.middleware.auth import requiere_roles
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha, parsear_entero,
)
from app.models.usuarios import (
    ROLES_VENTANILLA_LECTURA, ROLES_VENTANILLA_ESCRITURA,
    ROLES_VENTANILLA_ELIMINAR,
)
from app.services import validaciones

cato_bp = Blueprint('cato', __name__, url_prefix='/api/catos')


@cato_bp.route('', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def listar():
    """Busqueda paginada. ?id_cato=&id_afi=&id_sind=&page=&per_page="""
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 25)), 100)
        id_cato = request.args.get('id_cato', type=int)
        id_sind = request.args.get('id_sind', type=int)
    except ValueError:
        return jsonify({'error': 'Parametros invalidos'}), 400

    query = Cato.query
    if id_cato is not None:
        query = query.filter(Cato.id_cato == id_cato)
    id_afi = limpiar(request.args.get('id_afi'))
    if id_afi:
        query = query.filter(Cato.id_afi == id_afi)
    if id_sind is not None:
        query = query.filter(Cato.id_sind == id_sind)

    paginado = query.order_by(Cato.id_cato.asc()).paginate(
        page=page, per_page=per_page, error_out=False)
    return jsonify({
        'items': [c.to_dict(incluir_org=True) for c in paginado.items],
        'total': paginado.total,
        'page': paginado.page,
        'pages': paginado.pages,
    })


@cato_bp.route('/<int:id_cato>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def detalle(id_cato):
    cato = Cato.query.filter_by(id_cato=id_cato).first()
    if cato is None:
        return jsonify({'error': f'No existe el cato {id_cato}'}), 404
    data = cato.to_dict(incluir_org=True)
    afiliado = Afiliado.query.filter_by(id_afi=cato.id_afi).first()
    data['afiliado'] = afiliado.to_dict() if afiliado else None
    data['tiene_cambios'] = validaciones.cato_tiene_cambios(id_cato)
    data['tiene_controles'] = validaciones.cato_tiene_controles(id_cato)
    return jsonify(data)


@cato_bp.route('/ultimo-codigo/<int:prefijo>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def ultimo_codigo(prefijo):
    """ProcGetUltimoCodCato: ultimo id_cato que empieza con el prefijo."""
    ultimo = db.session.query(db.func.max(Cato.id_cato)).filter(
        db.cast(Cato.id_cato, db.String).like(f'{prefijo}%')).scalar()
    return jsonify({'prefijo': prefijo, 'ultimo_id_cato': ultimo})


def _validar_cato(data, es_nuevo=True):
    errores = []
    id_cato = parsear_entero(data.get('id_cato'), 'id_cato', errores,
                             obligatorio=True, minimo=1)
    id_sind = parsear_entero(data.get('id_sind'), 'id_sind', errores,
                             obligatorio=True, minimo=1)
    tipo_aut = limpiar(data.get('tipo_aut'))
    if tipo_aut and tipo_aut not in TIPOS_AUT:
        errores.append(f'tipo_aut invalido: {tipo_aut}')
    fecha_aut = parsear_fecha(data.get('fecha_aut'), 'fecha_aut', errores,
                              obligatorio=(tipo_aut == 'ADICIONAL_LEY906'))
    id_afi = limpiar(data.get('id_afi'))
    if es_nuevo and not id_afi:
        errores.append('id_afi es requerido')
    if errores:
        raise ValidationError(errores)
    if id_sind and Sindicato.query.get(id_sind) is None:
        raise ValidationError(f'No existe el sindicato {id_sind}')
    if id_afi and not validaciones.existe_afiliado(id_afi):
        raise ValidationError(f'No existe el afiliado {id_afi}')
    return {
        'id_cato': id_cato,
        'id_afi': id_afi,
        'id_sind': id_sind,
        'tipo_aut': tipo_aut,
        'descripcion': limpiar(data.get('descripcion')),
        # ProcNewAsigOrg: fecha_aut/solicitud solo aplican a ADICIONAL_LEY906
        'fecha_aut': fecha_aut if tipo_aut == 'ADICIONAL_LEY906' else None,
        'solicitud_num': (limpiar(data.get('solicitud_num'))
                          if tipo_aut == 'ADICIONAL_LEY906' else None),
        'nombre_usr': limpiar(data.get('nombre_usr')),
    }


@cato_bp.route('', methods=['POST'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def crear():
    """ProcNewAsigOrg."""
    try:
        campos = _validar_cato(request.get_json(silent=True) or {})
    except ValidationError as e:
        return e.respuesta()
    if validaciones.existe_cato(campos['id_cato']):
        return jsonify({'error': f"Ya existe el cato {campos['id_cato']}"}), 409
    if validaciones.tiene_cato_vigente(campos['id_afi']):
        return jsonify({'error': 'El afiliado ya tiene un cato vigente '
                       f"({validaciones.id_cato_vigente(campos['id_afi'])})"}), 409
    cato = Cato(estado='NORMAL', **campos)
    db.session.add(cato)
    db.session.commit()
    return jsonify(cato.to_dict(incluir_org=True)), 201


@cato_bp.route('/<int:id_cato>', methods=['PUT'])
@requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
def actualizar(id_cato):
    """ProcUpdateAfiOrg (permite renumerar el cato)."""
    cato = Cato.query.filter_by(id_cato=id_cato).first()
    if cato is None:
        return jsonify({'error': f'No existe el cato {id_cato}'}), 404
    data = request.get_json(silent=True) or {}
    base = cato.to_dict()
    base.update(data)
    try:
        campos = _validar_cato(base, es_nuevo=False)
        # La transferencia de titularidad debe pasar SIEMPRE por la tabla
        # cambio (historico); no se permite pisar id_afi por este endpoint.
        if campos['id_afi'] != cato.id_afi:
            raise ValidationError(
                'Para cambiar el titular de un cato usa POST /api/cambios '
                '(registra el historico de transferencias)')
    except ValidationError as e:
        return e.respuesta()
    nuevo_id = campos['id_cato']
    if nuevo_id != id_cato and validaciones.existe_cato(nuevo_id):
        return jsonify({'error': f'Ya existe el cato {nuevo_id}'}), 409
    if nuevo_id != id_cato and validaciones.cato_tiene_cambios(id_cato):
        return jsonify({'error': f'El cato {id_cato} tiene cambios registrados; '
                                 'no puede renumerarse'}), 409
    for campo, valor in campos.items():
        setattr(cato, campo, valor)
    db.session.commit()
    return jsonify(cato.to_dict(incluir_org=True))


@cato_bp.route('/<int:id_cato>', methods=['DELETE'])
@requiere_roles(*ROLES_VENTANILLA_ELIMINAR)
def eliminar(id_cato):
    """ProcDeleteAsigOrg. Bloquea si tiene cambios o controles asociados
    (regla del FormOrgSindical: ProcExisteRegCato_TabCambio/TabControlCato)."""
    cato = Cato.query.filter_by(id_cato=id_cato).first()
    if cato is None:
        return jsonify({'error': f'No existe el cato {id_cato}'}), 404
    if validaciones.cato_tiene_cambios(id_cato):
        return jsonify({'error': 'El cato tiene cambios registrados; '
                                 'no puede eliminarse'}), 409
    if validaciones.cato_tiene_controles(id_cato):
        return jsonify({'error': 'El cato tiene controles tecnicos registrados; '
                                 'no puede eliminarse'}), 409
    db.session.delete(cato)
    db.session.commit()
    return jsonify({'eliminado': id_cato})
