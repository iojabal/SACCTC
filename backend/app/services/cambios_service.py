"""Logica de negocio: Cambios (traslados/transferencias de catos).

Replica D_Cambios/N_Cambios + FormCambios:
- Registrar cambio transfiere el cato al nuevo afiliado
  (ProcNewCambio + ProcUpdateCodAfiNew_TabCato).
- No se permite transferir si el afiliado entrante tiene observaciones
  pendientes (ProcTieneObsAfi) ni si ya tiene cato vigente.
- Eliminar el ultimo cambio revierte el cato al titular anterior
  (ProcDeleteCambio + ProcUpdateCodAfiNew_TabCato/ProcGetIdAfi_Comprador).
"""
from app import db
from app.models import Afiliado, Cambio, Cato
from app.models.cambio import TIPOS_CAMBIO
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha, parsear_entero, validar_ci,
)
from app.services import validaciones


def historial_cambios_cato(id_cato):
    """ProcGetHistorialCambios."""
    cambios = Cambio.query.filter_by(id_cato=id_cato)\
        .order_by(Cambio.fecha_cambio.asc(), Cambio.id_trf.asc()).all()
    return [c.to_dict() for c in cambios]


def primer_titular_cato(id_cato):
    """ProcGetIdAfi_Comprador: primer duenio historico del cato."""
    primero = Cambio.query.filter_by(id_cato=id_cato)\
        .order_by(Cambio.fecha_cambio.asc(), Cambio.id_trf.asc()).first()
    if primero is None:
        cato = Cato.query.filter_by(id_cato=id_cato).first()
        return cato.id_afi if cato else None
    return primero.id_afi_titular


def _validar_datos(data):
    errores = []
    id_cato = parsear_entero(data.get('id_cato'), 'id_cato', errores, obligatorio=True)
    titular = validar_ci(data.get('id_afi_titular'), 'id_afi_titular', errores)
    nuevo = validar_ci(data.get('id_afi_nuevo'), 'id_afi_nuevo', errores)
    tipo = limpiar(data.get('tipo_cambio'))
    if tipo and tipo not in TIPOS_CAMBIO:
        errores.append(f'tipo_cambio invalido: {tipo}')
    fecha = parsear_fecha(data.get('fecha_cambio'), 'fecha_cambio', errores,
                          obligatorio=True)
    resol_fecha = parsear_fecha(data.get('resol_fecha'), 'resol_fecha', errores)
    if titular and nuevo and titular == nuevo:
        errores.append('El titular y el nuevo afiliado no pueden ser el mismo')
    if errores:
        raise ValidationError(errores)
    return {
        'id_cato': id_cato,
        'id_afi_titular': titular,
        'id_afi_nuevo': nuevo,
        'tipo_cambio': tipo,
        'codigo_docu': limpiar(data.get('codigo_docu')),
        'fecha_cambio': fecha,
        'obs': limpiar(data.get('obs')),
        'resol_nro': limpiar(data.get('resol_nro')),
        'resol_fecha': resol_fecha,
    }


def registrar_cambio(data):
    """ProcNewCambio + transferencia del cato (transaccional)."""
    campos = _validar_datos(data)

    errores = []
    if not validaciones.existe_cato(campos['id_cato']):
        errores.append(f"No existe el cato {campos['id_cato']}")
    if not validaciones.existe_afiliado(campos['id_afi_titular']):
        errores.append(f"No existe el afiliado titular {campos['id_afi_titular']}")
    if not validaciones.existe_afiliado(campos['id_afi_nuevo']):
        errores.append(f"No existe el afiliado nuevo {campos['id_afi_nuevo']}")
    if errores:
        raise ValidationError(errores)

    # Reglas de negocio del FormCambios (ahora en servidor):
    if validaciones.tiene_observaciones_pendientes(campos['id_afi_nuevo']):
        raise ValidationError(
            'El afiliado entrante tiene observaciones pendientes de aclaracion')
    cato = Cato.query.filter_by(id_cato=campos['id_cato']).first()
    if cato.id_afi != campos['id_afi_titular']:
        raise ValidationError(
            f"El titular registrado del cato {campos['id_cato']} es "
            f"{cato.id_afi}, no {campos['id_afi_titular']}")
    if validaciones.tiene_cato_vigente(campos['id_afi_nuevo']):
        raise ValidationError(
            'El afiliado entrante ya tiene un cato vigente '
            f"({validaciones.id_cato_vigente(campos['id_afi_nuevo'])})")

    cambio = Cambio(**campos)
    db.session.add(cambio)
    # ProcUpdateCodAfiNew_TabCato: transfiere la propiedad
    cato.id_afi = campos['id_afi_nuevo']
    # Marcar al titular antiguo como TRANSFERIDO si se quedo sin ningun otro
    # cato vigente. Se evalua DESPUES de reasignar el cato (ya con el flush
    # implicito de la query, tiene_cato_vigente no cuenta este cato porque
    # su id_afi ya apunta al comprador).
    db.session.flush()
    if not validaciones.tiene_cato_vigente(campos['id_afi_titular']):
        titular = Afiliado.query.filter_by(
            id_afi=campos['id_afi_titular']).first()
        if titular is not None:
            titular.estado = 'TRANSFERIDO'
    db.session.commit()
    return cambio.to_dict()


def actualizar_cambio(id_trf, data):
    """ProcUpdateCambio."""
    cambio = Cambio.query.get(id_trf)
    if cambio is None:
        raise ValidationError(f'No existe el cambio {id_trf}')
    campos = _validar_datos({**cambio.to_dict(), **data,
                             'id_cato': cambio.id_cato})

    # Si este es el ultimo cambio del cato y el afiliado entrante cambia,
    # revalidar las mismas reglas de negocio que registrar_cambio.
    ultimo = Cambio.query.filter_by(id_cato=cambio.id_cato)\
        .order_by(Cambio.fecha_cambio.desc(), Cambio.id_trf.desc()).first()
    es_ultimo = ultimo is not None and ultimo.id_trf == cambio.id_trf
    if es_ultimo and campos['id_afi_nuevo'] != cambio.id_afi_nuevo:
        if validaciones.tiene_observaciones_pendientes(campos['id_afi_nuevo']):
            raise ValidationError(
                'El afiliado entrante tiene observaciones pendientes '
                'de aclaracion')
        if validaciones.tiene_cato_vigente(campos['id_afi_nuevo']) and \
                validaciones.id_cato_vigente(campos['id_afi_nuevo']) \
                != cambio.id_cato:
            raise ValidationError(
                'El afiliado entrante ya tiene un cato vigente '
                f"({validaciones.id_cato_vigente(campos['id_afi_nuevo'])})")

    for campo in ('id_afi_titular', 'id_afi_nuevo', 'tipo_cambio',
                  'codigo_docu', 'fecha_cambio', 'obs', 'resol_nro',
                  'resol_fecha'):
        setattr(cambio, campo, campos[campo])

    # Si este es el ultimo cambio del cato, sincronizar el titular del cato
    if es_ultimo:
        cato = Cato.query.filter_by(id_cato=cambio.id_cato).first()
        if cato is not None:
            cato.id_afi = campos['id_afi_nuevo']

    db.session.commit()
    return cambio.to_dict()


def eliminar_cambio(id_trf):
    """ProcDeleteCambio + reversion del titular del cato.

    Solo se permite eliminar el ULTIMO cambio del cato (regla legacy:
    ProcGetMaxIdTrf_Cambio); el cato vuelve al titular del cambio eliminado.
    """
    cambio = Cambio.query.get(id_trf)
    if cambio is None:
        raise ValidationError(f'No existe el cambio {id_trf}')

    ultimo = Cambio.query.filter_by(id_cato=cambio.id_cato)\
        .order_by(Cambio.fecha_cambio.desc(), Cambio.id_trf.desc()).first()
    if ultimo is None or ultimo.id_trf != cambio.id_trf:
        raise ValidationError(
            'Solo puede eliminarse el ultimo cambio registrado del cato')

    cato = Cato.query.filter_by(id_cato=cambio.id_cato).first()
    titular_revertir = cambio.id_afi_titular
    db.session.delete(cambio)
    if cato is not None and titular_revertir:
        cato.id_afi = titular_revertir  # reversion (ProcUpdateCodAfiNew_TabCato)
        # Al recuperar el cato, el titular vuelve a ser titular activo: si
        # habia quedado marcado como TRANSFERIDO por la transferencia que
        # ahora se deshace, revertimos ese estado a SIN_OBSERVACION (default
        # de afiliado activo). No tocamos otros estados (obs, poza, etc.).
        titular = Afiliado.query.filter_by(id_afi=titular_revertir).first()
        if titular is not None and titular.estado == 'TRANSFERIDO':
            titular.estado = 'SIN_OBSERVACION'
    db.session.commit()
    return {'eliminado': id_trf, 'cato_revertido_a': titular_revertir}


def listar_cambios(page=1, per_page=25, id_cato=None, id_afi=None):
    query = Cambio.query
    if id_cato is not None:
        query = query.filter_by(id_cato=id_cato)
    if id_afi:
        query = query.filter(db.or_(Cambio.id_afi_titular == id_afi,
                                    Cambio.id_afi_nuevo == id_afi))
    paginado = query.order_by(Cambio.fecha_cambio.desc(), Cambio.id_trf.desc())\
        .paginate(page=page, per_page=min(per_page, 100), error_out=False)
    return {
        'items': [c.to_dict() for c in paginado.items],
        'total': paginado.total,
        'page': paginado.page,
        'pages': paginado.pages,
    }
