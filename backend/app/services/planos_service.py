"""Logica de negocio: area Planos.

Migra el modulo legacy FormRegistroMensura.cs / D_RegistroMensura.cs
(rol USR_PLANOS) que trabajaba sobre ControlCato y los registros
topograficos (REGTOP) de los shapefiles:

- ProcGetControlCato / GetRegTops   -> listar_planos / consulta
- ProcControlCato_New (mensura)     -> crear_plano (registro de planos)
- ProcUpdateControlCato             -> actualizar_plano
- ProcExisteFechaControl            -> revision duplicada por fecha
- Validacion "superficie = 0.1600"  -> superficie de mensura estandar

Funciones del area (requerimientos):
1. Registro de planos                       -> crear_plano
2. Recepcion y revision de doc. tecnica     -> registrar_revision
3. Actualizacion de planos                  -> actualizar_plano
4. Consulta de planos                       -> listar_planos/obtener_plano
5. Archivo fisico y digital de planos       -> archivar_plano + archivo_*
"""
from datetime import date

from app import db
from app.models import Cato, Plano, PlanoRevision
from app.models.planos import (
    ESTADO_REGISTRADO, ESTADO_EN_REVISION, ESTADO_APROBADO,
    ESTADO_OBSERVADO, ESTADO_ARCHIVADO, ESTADOS_PLANO_EDITABLES,
    TIPOS_PLANO, RESULTADOS_REVISION, REVISION_APROBADO, REVISION_OBSERVADO,
    FORMATOS_ARCHIVO,
)
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha, parsear_entero, parsear_decimal,
    validar_en_lista,
)

# Superficie estandar de la mensura (FormRegistroMensura legacy:
# "La superficie de la mensura debe ser igual a 0.1600 has")
SUPERFICIE_MENSURA = 0.16


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------

def listar_planos(page=1, per_page=25, estado=None, tipo=None, id_afi=None,
                  id_cato=None, nro_plano=None):
    """Consulta de planos con filtros y paginacion."""
    query = Plano.query
    if estado:
        query = query.filter_by(estado=estado)
    if tipo:
        query = query.filter_by(tipo=tipo)
    if id_afi:
        query = query.filter_by(id_afi=id_afi)
    if id_cato is not None:
        query = query.filter_by(id_cato=id_cato)
    if nro_plano:
        query = query.filter(Plano.nro_plano.ilike(f'%{nro_plano}%'))
    paginado = query.order_by(Plano.id_plano.desc())\
        .paginate(page=page, per_page=min(per_page, 100), error_out=False)
    return {
        'items': [p.to_dict_resumen() for p in paginado.items],
        'total': paginado.total,
        'page': paginado.page,
        'pages': paginado.pages,
    }


def obtener_plano(id_plano):
    """Detalle del plano + afiliado, cato y revisiones, o None."""
    plano = Plano.query.get(id_plano)
    if plano is None:
        return None
    data = plano.to_dict()
    data['afiliado'] = plano.afiliado.to_dict() if plano.afiliado else None
    data['cato'] = plano.cato.to_dict(incluir_org=True) if plano.cato else None
    data['revisiones'] = [r.to_dict() for r in plano.revisiones]
    return data


def listar_revisiones(id_plano):
    """Historial de revisiones del plano, o None si no existe."""
    plano = Plano.query.get(id_plano)
    if plano is None:
        return None
    return [r.to_dict() for r in plano.revisiones]


def planos_por_cato(id_cato):
    """Consulta rapida: planos del cato (GetRegTops legacy)."""
    return [p.to_dict_resumen() for p in Plano.query
            .filter_by(id_cato=id_cato)
            .order_by(Plano.id_plano.desc()).all()]


# ---------------------------------------------------------------------------
# Helpers de validacion
# ---------------------------------------------------------------------------

def _validar_datos(data, errores, plano=None):
    """Campos comunes de registro/actualizacion. Devuelve dict de valores."""
    valores = {}
    if 'tipo' in data or plano is None:
        valores['tipo'] = validar_en_lista(
            data.get('tipo'), 'tipo', TIPOS_PLANO, errores) or 'MENSURA'
    if 'fecha_plano' in data:
        valores['fecha_plano'] = parsear_fecha(data.get('fecha_plano'),
                                               'fecha_plano', errores)
    if 'superficie' in data:
        valores['superficie'] = parsear_decimal(
            data.get('superficie'), 'superficie', errores,
            minimo=0, maximo=9999)
    if 'archivo_formato' in data and limpiar(data.get('archivo_formato')):
        valores['archivo_formato'] = validar_en_lista(
            (data.get('archivo_formato') or '').upper(), 'archivo_formato',
            FORMATOS_ARCHIVO, errores)
    for campo in ('coordenadas', 'escala', 'zona_utm', 'dibujante',
                  'archivo_nombre', 'archivo_ruta', 'ubicacion_fisica',
                  'observaciones'):
        if campo in data:
            valores[campo] = limpiar(data.get(campo))
    return valores


def _obtener_plano(id_plano):
    plano = Plano.query.get(id_plano)
    if plano is None:
        raise ValidationError(f'No existe el plano {id_plano}')
    return plano


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------

def crear_plano(data, usuario):
    """Registro de un plano nuevo (recepcion de documentacion tecnica).

    Valida nro_plano unico (REGTOP legacy), cato existente si se envia,
    y para tipo MENSURA la superficie estandar de 0.1600 ha.
    """
    errores = []
    nro_plano = limpiar(data.get('nro_plano'))
    if not nro_plano:
        errores.append('El campo nro_plano es requerido')
    fecha_registro = parsear_fecha(data.get('fecha_registro'),
                                   'fecha_registro', errores) or date.today()
    id_cato = parsear_entero(data.get('id_cato'), 'id_cato', errores)
    valores = _validar_datos(data, errores)
    if errores:
        raise ValidationError(errores)

    if Plano.query.filter_by(nro_plano=nro_plano).count() > 0:
        raise ValidationError(f'Ya existe un plano con numero {nro_plano}')

    id_afi = limpiar(data.get('id_afi'))
    if id_cato is not None:
        cato = Cato.query.filter_by(id_cato=id_cato).first()
        if cato is None:
            raise ValidationError(f'No existe el cato {id_cato}')
        if id_afi and cato.id_afi != id_afi:
            raise ValidationError(
                f'El cato {id_cato} no pertenece al afiliado {id_afi}')
        id_afi = id_afi or cato.id_afi

    # Regla legacy: la mensura estandar es de 0.1600 ha
    superficie = valores.get('superficie')
    if valores.get('tipo') == 'MENSURA' and superficie is not None \
            and abs(superficie - SUPERFICIE_MENSURA) > 1e-9:
        raise ValidationError(
            f'La superficie de la mensura debe ser igual a '
            f'{SUPERFICIE_MENSURA:.4f} ha')

    plano = Plano(
        nro_plano=nro_plano,
        id_cato=id_cato,
        id_afi=id_afi,
        fecha_registro=fecha_registro,
        estado=ESTADO_REGISTRADO,
        usuario=usuario.login_usr,
        **valores,
    )
    db.session.add(plano)
    db.session.commit()
    return plano.to_dict()


def actualizar_plano(id_plano, data, usuario):
    """Actualizacion del plano (ProcUpdateControlCato legacy).

    Solo se actualizan planos en estados editables; un plano OBSERVADO
    que se corrige vuelve al estado EN_REVISION.
    """
    plano = _obtener_plano(id_plano)
    if plano.estado not in ESTADOS_PLANO_EDITABLES:
        raise ValidationError(
            f'El plano {id_plano} esta {plano.estado}; solo se actualizan '
            f"planos {', '.join(ESTADOS_PLANO_EDITABLES)}")

    errores = []
    nro_plano = limpiar(data.get('nro_plano'))
    if nro_plano and nro_plano != plano.nro_plano:
        if Plano.query.filter_by(nro_plano=nro_plano).count() > 0:
            errores.append(f'Ya existe un plano con numero {nro_plano}')
    valores = _validar_datos(data, errores, plano=plano)
    if errores:
        raise ValidationError(errores)

    if nro_plano:
        plano.nro_plano = nro_plano
    for campo, valor in valores.items():
        setattr(plano, campo, valor)

    # Un plano observado que se corrige vuelve a revision
    if plano.estado == ESTADO_OBSERVADO:
        plano.estado = ESTADO_EN_REVISION
    plano.usuario = usuario.login_usr
    db.session.commit()
    return plano.to_dict()


def registrar_revision(id_plano, data, usuario):
    """Recepcion y revision de la documentacion tecnica del plano.

    El resultado de la revision actualiza el estado del plano:
    APROBADO -> APROBADO, OBSERVADO -> OBSERVADO, RECHAZADO -> OBSERVADO.
    """
    plano = _obtener_plano(id_plano)
    if plano.estado == ESTADO_ARCHIVADO:
        raise ValidationError(
            f'El plano {id_plano} esta ARCHIVADO; no admite revisiones')

    errores = []
    fecha_revision = parsear_fecha(data.get('fecha_revision'),
                                   'fecha_revision', errores,
                                   obligatorio=True)
    resultado = validar_en_lista(data.get('resultado'), 'resultado',
                                 RESULTADOS_REVISION, errores,
                                 obligatorio=True)
    if errores:
        raise ValidationError(errores)

    # ProcExisteFechaControl: no dos revisiones el mismo dia
    if PlanoRevision.query.filter_by(
            id_plano=id_plano, fecha_revision=fecha_revision).count() > 0:
        raise ValidationError(
            f'Ya existe una revision del plano {id_plano} con fecha '
            f'{fecha_revision.isoformat()}')

    revision = PlanoRevision(
        id_plano=id_plano,
        fecha_revision=fecha_revision,
        resultado=resultado,
        documentacion=limpiar(data.get('documentacion')),
        observaciones=limpiar(data.get('observaciones')),
        revisor_nombre=limpiar(data.get('revisor_nombre'))
            or (usuario.nombre_apellido or '')[:100],
        usuario=usuario.login_usr,
    )
    db.session.add(revision)

    if resultado == REVISION_APROBADO:
        plano.estado = ESTADO_APROBADO
    elif resultado == REVISION_OBSERVADO:
        plano.estado = ESTADO_OBSERVADO
    else:  # RECHAZADO: requiere correccion y nueva revision
        plano.estado = ESTADO_OBSERVADO

    db.session.commit()
    return revision.to_dict()


def archivar_plano(id_plano, data, usuario):
    """Archivo fisico y digital del plano (cierre del ciclo).

    Solo se archivan planos APROBADOS; exige la ubicacion fisica o el
    archivo digital (nombre + ruta) para dejar constancia del archivo.
    """
    plano = _obtener_plano(id_plano)
    if plano.estado == ESTADO_ARCHIVADO:
        raise ValidationError(f'El plano {id_plano} ya esta ARCHIVADO')
    if plano.estado != ESTADO_APROBADO:
        raise ValidationError(
            f'El plano {id_plano} esta {plano.estado}; solo se archivan '
            'planos APROBADOS')

    errores = []
    valores = _validar_datos(data, errores, plano=plano)
    if errores:
        raise ValidationError(errores)
    for campo, valor in valores.items():
        setattr(plano, campo, valor)

    tiene_fisico = bool(plano.ubicacion_fisica)
    tiene_digital = bool(plano.archivo_nombre or plano.archivo_ruta)
    if not (tiene_fisico or tiene_digital):
        db.session.rollback()
        raise ValidationError(
            'Para archivar debe indicar la ubicacion fisica y/o el '
            'archivo digital (archivo_nombre / archivo_ruta)')

    plano.estado = ESTADO_ARCHIVADO
    plano.usuario = usuario.login_usr
    db.session.commit()
    return plano.to_dict()
