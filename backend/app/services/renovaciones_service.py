"""Logica de negocio: Renovaciones (RenovacionProgramada0).

Replica D_RenovacionProgramada/N_RenovacionProgramada + procedures del
legacy SQL Server sobre PostgreSQL/SQLAlchemy:

- ProcGetHistorialRenovSol2  -> listar_renovaciones / historial por cato
- ProcRenovGetUltima         -> obtener_renovacion (detalle)
- ProcRenovInsertRenovProg2  -> crear_renovacion
- ProcRenovUpdate2 /
  ProcRenovUpdateFechaVen    -> actualizar_vigencia
- ProcRenovUpdateDatosInfTec -> registrar_informe (sincroniza tecnico_info_*)
- ProcRenovExisteDocuNro     -> validacion de hoja de ruta duplicada
- ProcGetUltimoControl       -> snapshot de la parcela actual al crear

Reglas de negocio legacy (AREA_RENOVACIONES_DETALLE.md):
1. No se crea renovacion si el cato no existe, ya tiene renovacion activa
   o la hoja de ruta esta duplicada.
2. La remision a legal exige informe tecnico previo.
3. Elegibilidad del afiliado: vigente, con cato vigente y sin
   observaciones pendientes (observados.aclarado = 'NO').
"""
from datetime import date

from sqlalchemy import func, or_

from app import db
from app.models import Cato, ControlCato, RenovacionProgramada, \
    InformeVisitaTecnica
from app.models.renovaciones import (
    ESTADO_PENDIENTE, ESTADO_REMITIDA_LEGAL, ESTADOS_RENOVACION_ACTIVA,
    RESULTADOS_INFORME, CAUSALES_INCISO,
)
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha, parsear_entero, parsear_decimal,
    validar_ci, validar_en_lista,
)
from app.services import validaciones

# Estados del afiliado que bloquean la renovacion. Los datos migrados de
# SQL Server traen estado NULL (= sin observacion); VIGENTE/SIN_OBSERVACION
# tambien habilitan.
_ESTADOS_AFILIADO_ELEGIBLE = (None, '', 'VIGENTE', 'SIN_OBSERVACION')


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------

def listar_renovaciones(page=1, per_page=25, estado=None, id_afi=None,
                        id_cato=None):
    """ProcGetHistorialRenovSol2 con paginacion y filtros."""
    query = RenovacionProgramada.query
    if estado:
        query = query.filter_by(estado=estado)
    if id_afi:
        query = query.filter_by(id_afi=id_afi)
    if id_cato is not None:
        query = query.filter_by(id_cato=id_cato)
    paginado = query.order_by(RenovacionProgramada.id.desc())\
        .paginate(page=page, per_page=min(per_page, 100), error_out=False)
    return {
        'items': [r.to_dict_resumen() for r in paginado.items],
        'total': paginado.total,
        'page': paginado.page,
        'pages': paginado.pages,
    }


def obtener_renovacion(id_renovacion):
    """ProcRenovGetUltima: detalle completo + datos relacionados, o None."""
    renov = RenovacionProgramada.query.get(id_renovacion)
    if renov is None:
        return None
    data = renov.to_dict()
    data['afiliado'] = renov.afiliado.to_dict() if renov.afiliado else None
    data['cato'] = renov.cato.to_dict(incluir_org=True) if renov.cato else None
    data['informes'] = [i.to_dict() for i in renov.informes]
    return data


# ---------------------------------------------------------------------------
# Elegibilidad
# ---------------------------------------------------------------------------

def _cato_vigente(id_afi):
    """Primer cato no bloqueado del afiliado (ProcAfiNewGetIdCatoVigente)."""
    return Cato.query.filter_by(id_afi=id_afi)\
        .filter(or_(Cato.estado.is_(None), Cato.estado != 'BLOQUEADO'))\
        .first()


def elegibilidad_afiliado(id_afi):
    """Verifica si el afiliado puede iniciar una renovacion.

    Requisitos: afiliado vigente, cato vigente (no BLOQUEADO), sin
    observaciones pendientes y sin otra renovacion activa del cato.
    Devuelve None si el afiliado no existe.
    """
    afiliado = validaciones.obtener_afiliado(id_afi)
    if afiliado is None:
        return None

    cato = _cato_vigente(id_afi)
    estado_vigente = afiliado.estado in _ESTADOS_AFILIADO_ELEGIBLE
    sin_observaciones = not validaciones.tiene_observaciones_pendientes(id_afi)
    sin_renovacion_activa = True
    if cato is not None:
        sin_renovacion_activa = RenovacionProgramada.query\
            .filter_by(id_cato=cato.id_cato)\
            .filter(RenovacionProgramada.estado.in_(ESTADOS_RENOVACION_ACTIVA))\
            .count() == 0

    checks = {
        'estado_vigente': estado_vigente,
        'tiene_cato_vigente': cato is not None,
        'sin_observaciones_pendientes': sin_observaciones,
        'sin_renovacion_activa': sin_renovacion_activa,
    }
    return {
        'id_afi': afiliado.id_afi,
        'nombre_completo': afiliado.nombre_completo,
        'estado_afiliado': afiliado.estado,
        'id_cato_vigente': cato.id_cato if cato else None,
        'checks': checks,
        'elegible': all(checks.values()),
    }


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------

def crear_renovacion(data, usuario):
    """ProcRenovInsertRenovProg2: nueva solicitud de renovacion.

    Valida elegibilidad, hoja de ruta unica y renovacion activa; toma
    snapshot del ultimo control tecnico (ProcGetUltimoControl) y de la
    organizacion sindical del cato, como hacia el formulario legacy.
    """
    errores = []
    id_afi = validar_ci(data.get('id_afi'), 'id_afi', errores)
    nro_solicitud = limpiar(data.get('nro_solicitud'))
    if not nro_solicitud:
        errores.append('El campo nro_solicitud (hoja de ruta) es requerido')
    hruta_fecha = parsear_fecha(data.get('hruta_fecha'), 'hruta_fecha',
                                errores) or date.today()
    id_cato = parsear_entero(data.get('id_cato'), 'id_cato', errores)
    vigencia_inicio = parsear_fecha(data.get('vigencia_inicio'),
                                    'vigencia_inicio', errores)
    fecha_vencimiento = parsear_fecha(data.get('fecha_vencimiento'),
                                      'fecha_vencimiento', errores)
    if errores:
        raise ValidationError(errores)

    eleg = elegibilidad_afiliado(id_afi)
    if eleg is None:
        raise ValidationError(f'No existe el afiliado {id_afi}')
    if not eleg['elegible']:
        motivos = [nombre for nombre, ok in eleg['checks'].items() if not ok]
        raise ValidationError(
            f"El afiliado {id_afi} no es elegible para renovacion: "
            f"{', '.join(motivos)}")

    if id_cato is None:
        id_cato = eleg['id_cato_vigente']
    else:
        cato = Cato.query.filter_by(id_cato=id_cato).first()
        if cato is None:
            raise ValidationError(f'No existe el cato {id_cato}')
        if cato.id_afi != id_afi:
            raise ValidationError(
                f'El cato {id_cato} no pertenece al afiliado {id_afi}')
        if cato.estado == 'BLOQUEADO':
            raise ValidationError(f'El cato {id_cato} esta BLOQUEADO')

    # ProcRenovExisteDocuNro: hoja de ruta duplicada
    if RenovacionProgramada.query.filter_by(nro_solicitud=nro_solicitud)\
            .count() > 0:
        raise ValidationError(
            f'Ya existe una renovacion con hoja de ruta {nro_solicitud}')

    # El cato no debe tener otra renovacion activa (regla legacy 1)
    if RenovacionProgramada.query.filter_by(id_cato=id_cato)\
            .filter(RenovacionProgramada.estado.in_(ESTADOS_RENOVACION_ACTIVA))\
            .count() > 0:
        raise ValidationError(
            f'El cato {id_cato} ya tiene una renovacion en curso')

    if vigencia_inicio and fecha_vencimiento \
            and fecha_vencimiento < vigencia_inicio:
        raise ValidationError(
            'fecha_vencimiento no puede ser anterior a vigencia_inicio')

    # Snapshot parcela actual: ProcGetUltimoControl
    ultimo = ControlCato.query.filter_by(id_cato=id_cato)\
        .order_by(ControlCato.fecha_control.desc()).first()

    # Snapshot organizacion sindical del cato
    org = {}
    cato_obj = Cato.query.filter_by(id_cato=id_cato).first()
    if cato_obj and cato_obj.sindicato:
        sind = cato_obj.sindicato
        org['sindicato'] = (sind.nombre or '')[:30] or None
        if sind.central:
            org['central'] = (sind.central.nombre or '')[:30] or None
            fede = sind.central.federacion
            if fede:
                org['federacion'] = (fede.sigla or '')[:30] or None
                org['departamento'] = (fede.dpto or '')[:30] or None
                org['provincia'] = (fede.prov or '')[:30] or None
                org['municipio'] = (fede.mun or '')[:30] or None

    # id_renov de negocio: continua la numeracion legacy (max + 1)
    siguiente = (db.session.query(func.max(RenovacionProgramada.id_renov))
                 .scalar() or 0) + 1

    renov = RenovacionProgramada(
        id_renov=siguiente,
        id_cato=id_cato,
        id_afi=id_afi,
        nro_solicitud=nro_solicitud,
        hruta_fecha=hruta_fecha,
        estado=ESTADO_PENDIENTE,
        resultado='NINGUNO',
        vigencia_inicio=vigencia_inicio,
        fecha_vencimiento=fecha_vencimiento,
        observacion=limpiar(data.get('observacion')),
        cato_sup=ultimo.sup_mensura if ultimo else None,
        cato_utm_xy=ultimo.coordenadas if ultimo else None,
        cato_frec=ultimo.frecuencia if ultimo else None,
        cato_edad_anio=ultimo.edad_anio if ultimo else None,
        cato_edad_mes=ultimo.edad_mes if ultimo else None,
        usuario_ci=str(usuario.id_usr)[:20],
        usuario_nombre=(usuario.nombre_apellido or '')[:50],
        usuario_cargo=(usuario.cargo or '')[:20],
        **org,
    )
    db.session.add(renov)
    db.session.commit()
    return renov.to_dict()


def actualizar_vigencia(id_renovacion, data, usuario):
    """ProcRenovUpdateFechaVen: actualiza las fechas de vigencia."""
    renov = RenovacionProgramada.query.get(id_renovacion)
    if renov is None:
        raise ValidationError(f'No existe la renovacion {id_renovacion}')
    if renov.estado not in ESTADOS_RENOVACION_ACTIVA:
        raise ValidationError(
            f'La renovacion {id_renovacion} esta {renov.estado}; '
            'solo se modifican renovaciones en curso')

    errores = []
    vigencia_inicio = parsear_fecha(data.get('vigencia_inicio'),
                                    'vigencia_inicio', errores)
    fecha_vencimiento = parsear_fecha(data.get('fecha_vencimiento'),
                                      'fecha_vencimiento', errores)
    if errores:
        raise ValidationError(errores)
    if vigencia_inicio is None and fecha_vencimiento is None \
            and 'observacion' not in data:
        raise ValidationError(
            'Debe enviar vigencia_inicio y/o fecha_vencimiento')

    if vigencia_inicio is not None:
        renov.vigencia_inicio = vigencia_inicio
    if fecha_vencimiento is not None:
        renov.fecha_vencimiento = fecha_vencimiento
    if renov.vigencia_inicio and renov.fecha_vencimiento \
            and renov.fecha_vencimiento < renov.vigencia_inicio:
        db.session.rollback()
        raise ValidationError(
            'fecha_vencimiento no puede ser anterior a vigencia_inicio')

    if 'observacion' in data:
        renov.observacion = limpiar(data.get('observacion'))
    renov.usuario_ci = str(usuario.id_usr)[:20]
    renov.usuario_nombre = (usuario.nombre_apellido or '')[:50]
    db.session.commit()
    return renov.to_dict()


def remitir_legal(id_renovacion, data, usuario):
    """Remite el tramite al area legal (estado -> REMITIDA_LEGAL).

    Regla legacy: el informe legal exige informe tecnico previo, por lo
    que solo se remite si existe al menos un informe de visita tecnica
    (o el CITE tecnico legacy tecnico_info_nro).
    """
    renov = RenovacionProgramada.query.get(id_renovacion)
    if renov is None:
        raise ValidationError(f'No existe la renovacion {id_renovacion}')

    nota = limpiar(data.get('nota'))
    if not nota:
        raise ValidationError('El campo nota es requerido')

    if renov.estado == ESTADO_REMITIDA_LEGAL:
        raise ValidationError(
            f'La renovacion {id_renovacion} ya fue remitida a legal')
    if renov.estado != ESTADO_PENDIENTE:
        raise ValidationError(
            f'La renovacion {id_renovacion} esta {renov.estado}; '
            'solo se remiten renovaciones PENDIENTES')

    tiene_informe = renov.informes.count() > 0 or bool(renov.tecnico_info_nro)
    if not tiene_informe:
        raise ValidationError(
            'No se puede remitir a legal sin informe tecnico registrado')

    hoy = date.today()
    renov.estado = ESTADO_REMITIDA_LEGAL
    renov.remitida_legal_fecha = hoy
    renov.remitida_legal_por = usuario.login_usr
    entrada = f'[{hoy.isoformat()} {usuario.login_usr}] {nota}'
    renov.nota_legal = f'{renov.nota_legal}\n{entrada}' \
        if renov.nota_legal else entrada
    db.session.commit()
    return renov.to_dict()


# ---------------------------------------------------------------------------
# Informes de visita tecnica
# ---------------------------------------------------------------------------

def listar_informes(id_renovacion):
    """Historial de inspecciones de la renovacion, o None si no existe."""
    renov = RenovacionProgramada.query.get(id_renovacion)
    if renov is None:
        return None
    return [i.to_dict() for i in renov.informes]


def registrar_informe(id_renovacion, data, usuario):
    """ProcRenovUpdateDatosInfTec: registra la inspeccion de campo y
    sincroniza las columnas legacy tecnico_info_* con el ultimo informe."""
    renov = RenovacionProgramada.query.get(id_renovacion)
    if renov is None:
        raise ValidationError(f'No existe la renovacion {id_renovacion}')
    if renov.estado not in ESTADOS_RENOVACION_ACTIVA:
        raise ValidationError(
            f'La renovacion {id_renovacion} esta {renov.estado}; '
            'no admite nuevos informes')

    errores = []
    fecha_visita = parsear_fecha(data.get('fecha_visita'), 'fecha_visita',
                                 errores, obligatorio=True)
    resultado = validar_en_lista(data.get('resultado'), 'resultado',
                                 RESULTADOS_INFORME, errores, obligatorio=True)
    causal = validar_en_lista(data.get('causal_inciso'), 'causal_inciso',
                              CAUSALES_INCISO, errores)
    superficie = parsear_decimal(data.get('superficie'), 'superficie',
                                 errores, minimo=0, maximo=9999)
    if errores:
        raise ValidationError(errores)

    # Evita dos informes de la misma renovacion en la misma fecha
    # (equivalente a ProcExisteFechaControl del area Ventanilla)
    if InformeVisitaTecnica.query.filter_by(
            id_renovacion=id_renovacion, fecha_visita=fecha_visita).count() > 0:
        raise ValidationError(
            f'Ya existe un informe de la renovacion {id_renovacion} '
            f'con fecha {fecha_visita.isoformat()}')

    informe = InformeVisitaTecnica(
        id_renovacion=id_renovacion,
        fecha_visita=fecha_visita,
        resultado=resultado,
        nro_informe=limpiar(data.get('nro_informe')),
        coordenadas=limpiar(data.get('coordenadas')),
        superficie=superficie,
        edad_anio=limpiar(data.get('edad_anio')),
        edad_mes=limpiar(data.get('edad_mes')),
        causal_inciso=causal,
        observaciones=limpiar(data.get('observaciones')),
        tecnico_nombre=limpiar(data.get('tecnico_nombre'))
            or (usuario.nombre_apellido or '')[:100],
        tecnico_ci=limpiar(data.get('tecnico_ci')) or str(usuario.id_usr)[:20],
        usuario=usuario.login_usr,
    )
    db.session.add(informe)

    # Sincronizacion legacy (ProcRenovUpdateDatosInfTec + FechaVen)
    renov.tecnico = (informe.tecnico_nombre or '')[:50] or None
    renov.tecnico_info_fecha = fecha_visita
    renov.tecnico_val_fecha = fecha_visita
    if informe.nro_informe:
        renov.tecnico_info_nro = informe.nro_informe
    if causal:
        renov.tecnico_info_causal_inciso = causal
    if informe.observaciones:
        renov.tecnico_info_obs = informe.observaciones

    db.session.commit()
    return informe.to_dict()
