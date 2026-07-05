"""Logica de negocio: Afiliados.

Replica DAfiliados/NAfiliados + procedures (ProcAfiNuevo, ProcAfiActualizar,
ProcHistAfi, ProcAfiBuscar) con validacion server-side y sin SQL dinamico
(el legacy concatenaba el criterio de busqueda: SQL injection).
"""
from sqlalchemy import or_, func

from app import db
from app.models import Afiliado, Cambio, ControlCato, Observado, Cato
from app.models.afiliados import ESTADOS_AFILIADO
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha, validar_ci,
)
from app.services import validaciones


def buscar_afiliados(criterio=None, page=1, per_page=25):
    """Busqueda paginada por CI o nombre (parametrizada, indices trigram)."""
    query = Afiliado.query
    criterio = limpiar(criterio)
    if criterio:
        like = f'%{criterio}%'
        nombre_completo = func.concat_ws(
            ' ', Afiliado.apellido1, Afiliado.apellido2, Afiliado.nombres)
        query = query.filter(or_(
            Afiliado.id_afi.ilike(like),
            nombre_completo.ilike(like),
        ))
    paginado = query.order_by(Afiliado.apellido1, Afiliado.apellido2,
                              Afiliado.nombres).paginate(
        page=page, per_page=min(per_page, 100), error_out=False)
    return {
        'items': [a.to_dict() for a in paginado.items],
        'total': paginado.total,
        'page': paginado.page,
        'pages': paginado.pages,
    }


def obtener_afiliado(id_afi):
    """ProcAfiGetDatos + organizacion (ProcGetAfiOrg)."""
    afiliado = Afiliado.query.filter_by(id_afi=id_afi).first()
    if afiliado is None:
        return None
    data = afiliado.to_dict()
    data['catos'] = [c.to_dict(incluir_org=True)
                     for c in Cato.query.filter_by(id_afi=id_afi).all()]
    data['tiene_cato_vigente'] = len(data['catos']) > 0
    data['observaciones_pendientes'] = Observado.query.filter_by(
        id_afi=id_afi, aclarado='NO').count()
    return data


def _validar_datos(data, requiere_ci=True):
    errores = []
    ci = validar_ci(data.get('id_afi'), 'id_afi', errores, obligatorio=requiere_ci)
    fecha_nac = parsear_fecha(data.get('fecha_nac'), 'fecha_nac', errores)
    estado = limpiar(data.get('estado'))
    if estado and estado not in ESTADOS_AFILIADO:
        errores.append(f'estado invalido: {estado}')
    nombres = limpiar(data.get('nombres'))
    apellido1 = limpiar(data.get('apellido1'))
    apellido2 = limpiar(data.get('apellido2'))
    if not (nombres or apellido1 or apellido2):
        errores.append('Debe registrar al menos nombres o un apellido')
    if errores:
        raise ValidationError(errores)
    return {
        'id_afi': ci,
        'ext': limpiar(data.get('ext')),
        'apellido1': apellido1,
        'apellido2': apellido2,
        'nombres': nombres,
        'fecha_nac': fecha_nac,
        'genero': limpiar(data.get('genero')),
        'estado': estado,
        'obs': limpiar(data.get('obs')),
    }


def crear_afiliado(data):
    """ProcAfiNuevo + verificacion ProcAfiCiExiste."""
    campos = _validar_datos(data)
    if validaciones.existe_afiliado(campos['id_afi']):
        raise ValidationError(f"Ya existe un afiliado con CI {campos['id_afi']}")
    afiliado = Afiliado(**campos)
    db.session.add(afiliado)
    db.session.commit()
    return afiliado.to_dict()


def actualizar_afiliado(id_afi_old, data):
    """ProcAfiActualizar: actualiza y propaga el CI a tablas relacionadas."""
    afiliado = Afiliado.query.filter_by(id_afi=id_afi_old).first()
    if afiliado is None:
        raise ValidationError(f'No existe el afiliado {id_afi_old}')

    campos = _validar_datos(data)
    nuevo_ci = campos['id_afi']

    if nuevo_ci != id_afi_old and validaciones.existe_afiliado(nuevo_ci):
        raise ValidationError(f'Ya existe otro afiliado con CI {nuevo_ci}')

    for campo, valor in campos.items():
        if campo != 'estado' or valor is not None:
            setattr(afiliado, campo, valor)

    # Propagacion del cambio de CI (mismo comportamiento que ProcAfiActualizar)
    if nuevo_ci != id_afi_old:
        Cambio.query.filter_by(id_afi_titular=id_afi_old).update(
            {'id_afi_titular': nuevo_ci})
        Cambio.query.filter_by(id_afi_nuevo=id_afi_old).update(
            {'id_afi_nuevo': nuevo_ci})
        ControlCato.query.filter_by(id_afi=id_afi_old).update({'id_afi': nuevo_ci})
        Observado.query.filter_by(id_afi=id_afi_old).update({'id_afi': nuevo_ci})
        Cato.query.filter_by(id_afi=id_afi_old).update({'id_afi': nuevo_ci})

    db.session.commit()
    return afiliado.to_dict()


def historial_afiliado(id_afi):
    """ProcHistAfi: cambios donde participo como titular o nuevo."""
    cambios = Cambio.query.filter(or_(
        Cambio.id_afi_titular == id_afi,
        Cambio.id_afi_nuevo == id_afi,
    )).order_by(Cambio.id_cato, Cambio.fecha_cambio.asc()).all()

    historial = []
    for c in cambios:
        item = c.to_dict()
        cato = Cato.query.filter_by(id_cato=c.id_cato).first()
        if cato is not None:
            org = cato.to_dict(incluir_org=True)
            item['federacion'] = org.get('federacion')
            item['central'] = org.get('central')
            item['sindicato'] = org.get('sindicato')
        historial.append(item)
    return historial
