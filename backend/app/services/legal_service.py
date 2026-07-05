"""Logica de negocio: area Legal.

Replica sobre PostgreSQL/SQLAlchemy la parte legal del legacy
D_RenovacionProgramada/N_RenovacionProgramada (FormRenovacionProgramada):

- ProcGetHistorialRenovSol2 (filtro legal) -> listar_casos (bandeja)
- ProcRenovGetUltima                       -> obtener_caso (detalle)
- ProcRenovUpdate2 (legal_info_*)          -> registrar_informe_legal
- ProcRenovUpdate2 (resol_*, resultado)    -> emitir_resolucion
- ProcRenovTieneInfo2 (INFO_TECNICO/INFO_LEGAL/INFO_RESOL)
                                           -> prerequisitos del flujo
- ProcRenovExisteDocuNro                   -> CITE duplicado

Reglas de negocio legacy:
1. El informe legal exige informe tecnico previo (INFO_TECNICO).
2. La resolucion administrativa exige informe legal previo (INFO_LEGAL).
3. La resolucion define el resultado final del tramite:
   APROBADA -> estado APROBADA + resultado APROBADO (+ vigencia)
   RECHAZADA -> estado RECHAZADA + resultado RECHAZADO
4. Cada actuacion queda registrada y archivada (ActuacionLegal); las
   columnas legacy legal_info_* / resol_* se sincronizan con la ultima.
"""
from datetime import date

from sqlalchemy import func

from app import db
from app.models import ActuacionLegal, RenovacionProgramada
from app.models.legal import (
    TIPO_INFORME_LEGAL, TIPO_OBSERVACION_LEGAL, TIPO_RESOLUCION,
    DICTAMENES_INFORME, RESULTADOS_RESOLUCION, RESOLUCION_APROBADA,
)
from app.models.renovaciones import (
    ESTADO_REMITIDA_LEGAL, ESTADO_APROBADA, ESTADO_RECHAZADA,
    ESTADOS_RENOVACION,
)
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha, validar_en_lista,
)


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------

def listar_casos(page=1, per_page=25, estado=None, id_afi=None, id_cato=None,
                 nro_cite=None):
    """Bandeja del area Legal (ProcGetHistorialRenovSol2 filtrada).

    Sin filtro de estado devuelve la bandeja de trabajo: los casos
    REMITIDA_LEGAL (recepcion de informes tecnicos de Renovaciones).
    """
    query = RenovacionProgramada.query
    query = query.filter_by(estado=estado or ESTADO_REMITIDA_LEGAL)
    if id_afi:
        query = query.filter_by(id_afi=id_afi)
    if id_cato is not None:
        query = query.filter_by(id_cato=id_cato)
    if nro_cite:
        query = query.filter(db.or_(
            RenovacionProgramada.legal_info_nro == nro_cite,
            RenovacionProgramada.resol_nro == nro_cite))
    paginado = query.order_by(RenovacionProgramada.id.desc())\
        .paginate(page=page, per_page=min(per_page, 100), error_out=False)
    return {
        'items': [r.to_dict_resumen() for r in paginado.items],
        'total': paginado.total,
        'page': paginado.page,
        'pages': paginado.pages,
    }


def obtener_caso(id_renovacion):
    """ProcRenovGetUltima + actuaciones legales, o None si no existe."""
    renov = RenovacionProgramada.query.get(id_renovacion)
    if renov is None:
        return None
    data = renov.to_dict()
    data['afiliado'] = renov.afiliado.to_dict() if renov.afiliado else None
    data['cato'] = renov.cato.to_dict(incluir_org=True) if renov.cato else None
    data['informes_tecnicos'] = [i.to_dict() for i in renov.informes]
    data['actuaciones'] = _actuaciones_de(id_renovacion)
    return data


def _actuaciones_de(id_renovacion):
    return [a.to_dict() for a in ActuacionLegal.query
            .filter_by(id_renovacion=id_renovacion)
            .order_by(ActuacionLegal.creado_en.desc()).all()]


def listar_actuaciones(id_renovacion):
    """Archivo de actuaciones legales del caso (mas reciente primero),
    o None si el caso no existe."""
    if RenovacionProgramada.query.get(id_renovacion) is None:
        return None
    return _actuaciones_de(id_renovacion)


def resumen_estados():
    """Seguimiento del estado legal de los tramites (conteo por estado)."""
    filas = db.session.query(
        RenovacionProgramada.estado,
        func.count(RenovacionProgramada.id),
    ).group_by(RenovacionProgramada.estado).all()
    conteos = {estado: total for estado, total in filas}
    return {
        'estados': {e: conteos.get(e, 0) for e in ESTADOS_RENOVACION},
        'pendientes_legal': conteos.get(ESTADO_REMITIDA_LEGAL, 0),
        'total': sum(conteos.values()),
    }


# ---------------------------------------------------------------------------
# Helpers de flujo (ProcRenovTieneInfo2)
# ---------------------------------------------------------------------------

def _obtener_caso_activo(id_renovacion):
    renov = RenovacionProgramada.query.get(id_renovacion)
    if renov is None:
        raise ValidationError(f'No existe el caso {id_renovacion}')
    if renov.estado != ESTADO_REMITIDA_LEGAL:
        raise ValidationError(
            f'El caso {id_renovacion} esta {renov.estado}; el area Legal '
            'solo actua sobre casos REMITIDA_LEGAL')
    return renov


def _tiene_informe_tecnico(renov):
    """ProcRenovTieneInfo2 con info_tipo = INFO_TECNICO."""
    return renov.informes.count() > 0 or bool(renov.tecnico_info_nro)


def _tiene_informe_legal(renov):
    """ProcRenovTieneInfo2 con info_tipo = INFO_LEGAL."""
    if renov.legal_info_nro:
        return True
    return ActuacionLegal.query.filter_by(
        id_renovacion=renov.id, tipo=TIPO_INFORME_LEGAL).count() > 0


def _validar_cite_unico(nro_cite, tipo):
    """ProcRenovExisteDocuNro: CITE duplicado dentro del mismo tipo."""
    if nro_cite and ActuacionLegal.query.filter_by(
            nro_cite=nro_cite, tipo=tipo).count() > 0:
        raise ValidationError(
            f'Ya existe una actuacion {tipo} con CITE {nro_cite}')


def _validar_base(data, requiere_cite=False):
    """Campos comunes de toda actuacion legal."""
    errores = []
    fecha = parsear_fecha(data.get('fecha'), 'fecha', errores) or date.today()
    nro_cite = limpiar(data.get('nro_cite'))
    if requiere_cite and not nro_cite:
        errores.append('El campo nro_cite es requerido')
    contenido = limpiar(data.get('contenido'))
    if not contenido:
        errores.append('El campo contenido es requerido')
    return errores, fecha, nro_cite, contenido


def _nueva_actuacion(renov, tipo, fecha, nro_cite, dictamen, contenido,
                     data, usuario):
    return ActuacionLegal(
        id_renovacion=renov.id,
        tipo=tipo,
        fecha=fecha,
        nro_cite=nro_cite,
        dictamen=dictamen,
        contenido=contenido,
        responsable_nombre=limpiar(data.get('responsable_nombre'))
            or (usuario.nombre_apellido or '')[:100],
        responsable_cargo=limpiar(data.get('responsable_cargo'))
            or (usuario.cargo or '')[:50],
        usuario=usuario.login_usr,
    )


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------

def registrar_informe_legal(id_renovacion, data, usuario):
    """Elabora el informe legal del caso (ProcRenovUpdate2 legal_info_*).

    Regla legacy 1: exige informe tecnico previo (INFO_TECNICO).
    """
    renov = _obtener_caso_activo(id_renovacion)
    if not _tiene_informe_tecnico(renov):
        raise ValidationError(
            'No se puede elaborar el informe legal sin informe tecnico '
            'registrado (INFO_TECNICO)')

    errores, fecha, nro_cite, contenido = _validar_base(data,
                                                        requiere_cite=True)
    dictamen = validar_en_lista(data.get('dictamen'), 'dictamen',
                                DICTAMENES_INFORME, errores, obligatorio=True)
    if errores:
        raise ValidationError(errores)
    _validar_cite_unico(nro_cite, TIPO_INFORME_LEGAL)

    actuacion = _nueva_actuacion(renov, TIPO_INFORME_LEGAL, fecha, nro_cite,
                                 dictamen, contenido, data, usuario)
    db.session.add(actuacion)

    # Sincronizacion legacy (ProcRenovUpdate2: @legal_info_*)
    renov.legal_info_nro = nro_cite
    renov.legal_info_fecha = fecha
    renov.legal_info_obs = contenido

    db.session.commit()
    return actuacion.to_dict()


def registrar_observacion(id_renovacion, data, usuario):
    """Registra una observacion legal del caso (cuando corresponda)."""
    renov = _obtener_caso_activo(id_renovacion)
    errores, fecha, nro_cite, contenido = _validar_base(data)
    if errores:
        raise ValidationError(errores)

    actuacion = _nueva_actuacion(renov, TIPO_OBSERVACION_LEGAL, fecha,
                                 nro_cite, None, contenido, data, usuario)
    db.session.add(actuacion)

    # La observacion queda tambien en la nota legal del tramite
    entrada = f'[{fecha.isoformat()} {usuario.login_usr}] OBS: {contenido}'
    renov.nota_legal = f'{renov.nota_legal}\n{entrada}' \
        if renov.nota_legal else entrada

    db.session.commit()
    return actuacion.to_dict()


def emitir_resolucion(id_renovacion, data, usuario):
    """Emite la resolucion administrativa y cierra el caso.

    Regla legacy 2: exige informe legal previo (INFO_LEGAL).
    ProcRenovUpdate2: @resol_nro/@resol_fecha/@resol_obs + @resultado.
    """
    renov = _obtener_caso_activo(id_renovacion)
    if not _tiene_informe_legal(renov):
        raise ValidationError(
            'No se puede emitir la resolucion sin informe legal '
            'registrado (INFO_LEGAL)')

    errores, fecha, nro_cite, contenido = _validar_base(data,
                                                        requiere_cite=True)
    resultado = validar_en_lista(data.get('resultado'), 'resultado',
                                 RESULTADOS_RESOLUCION, errores,
                                 obligatorio=True)
    fecha_vencimiento = parsear_fecha(data.get('fecha_vencimiento'),
                                      'fecha_vencimiento', errores)
    if errores:
        raise ValidationError(errores)
    _validar_cite_unico(nro_cite, TIPO_RESOLUCION)

    actuacion = _nueva_actuacion(renov, TIPO_RESOLUCION, fecha, nro_cite,
                                 resultado, contenido, data, usuario)
    db.session.add(actuacion)

    # Sincronizacion legacy (ProcRenovUpdate2: @resol_* + @resultado)
    renov.resol_nro = nro_cite
    renov.resol_fecha = fecha
    renov.resol_obs = contenido

    if resultado == RESOLUCION_APROBADA:
        renov.estado = ESTADO_APROBADA
        renov.resultado = 'APROBADO'
        if fecha_vencimiento is not None:
            if renov.vigencia_inicio \
                    and fecha_vencimiento < renov.vigencia_inicio:
                db.session.rollback()
                raise ValidationError(
                    'fecha_vencimiento no puede ser anterior a '
                    'vigencia_inicio')
            renov.fecha_vencimiento = fecha_vencimiento
    else:
        renov.estado = ESTADO_RECHAZADA
        renov.resultado = 'RECHAZADO'

    db.session.commit()
    return {'actuacion': actuacion.to_dict(), 'caso': renov.to_dict()}
