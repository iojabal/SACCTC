"""Logica de negocio: Registro de Control de Mensura (FormRegistroMensura).

Complementa control_cato_service con:
- Controles de un cato con datos del afiliado (JOIN ControlCato x Afiliados).
- Estado de renovacion del cato (radio buttons del legacy):
    * "Renovacion en curso" -> ControlCato.hruta_nro IS NULL
    * "Renovado"            -> ControlCato.hruta_nro = <valor> y
                               RenovacionProgramada.fecha_destruida seteada.
"""
from datetime import date

from app import db
from app.models import ControlCato, RenovacionProgramada
from app.models.renovaciones import (
    ESTADO_DESTRUIDA, ESTADO_PENDIENTE, ESTADOS_RENOVACION_ACTIVA,
)
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha,
)

# Estados en los que la renovacion se considera "vigente" para el registro
# de mensura (aun no destruida): tramite activo o ya aprobado.
_ESTADOS_RENOV_VIGENTE = tuple(ESTADOS_RENOVACION_ACTIVA) + ('APROBADA',)


def _fila_control(control):
    """Fila del grid legacy 'Cantidad de Controles Registrados'."""
    afi = control.afiliado
    return {
        'id_cont': control.id_cont,
        'id_cato': control.id_cato,
        'fecha_control': (control.fecha_control.isoformat()
                          if control.fecha_control else None),
        # CIN = id_afi; NOMBRES = apellido1 + apellido2 + nombres
        'id_afi': control.id_afi,
        'nombres': afi.nombre_completo if afi else None,
        'control_numero': control.control_numero,
        'coordenadas': control.coordenadas,          # COORDXYUTM
        'sup_mensura': (float(control.sup_mensura)
                        if control.sup_mensura is not None else None),  # SUP
        'frecuencia': control.frecuencia,            # Frec
        'edad_anio': control.edad_anio,              # Ed. anio
        'edad_mes': control.edad_mes,                # Ed. mes
        'num_lote': control.num_lote,                # #lote
        'sup_lote': control.sup_lote,                # S.lote
        'tecnico': control.tecnico,
        'descripcion': control.descripcion,
        'usuario': control.usuario,
        'hruta_nro': control.hruta_nro,
    }


def controles_por_cato(id_cato):
    """GET /api/catos/{id_cato}/controles (ProcGetControlCato + JOIN Afiliados)."""
    controles = ControlCato.query.filter_by(id_cato=id_cato)\
        .order_by(ControlCato.fecha_control.asc(),
                  ControlCato.id_cont.asc()).all()
    return {
        'id_cato': id_cato,
        'total': len(controles),
        'items': [_fila_control(c) for c in controles],
    }


def _renovacion_vigente(id_cato):
    """Ultima renovacion no destruida del cato (o None)."""
    return RenovacionProgramada.query\
        .filter(RenovacionProgramada.id_cato == id_cato,
                RenovacionProgramada.fecha_destruida.is_(None),
                RenovacionProgramada.estado.in_(_ESTADOS_RENOV_VIGENTE))\
        .order_by(RenovacionProgramada.id.desc()).first()


def _ultimo_control(id_cato):
    return ControlCato.query.filter_by(id_cato=id_cato)\
        .order_by(ControlCato.fecha_control.desc(),
                  ControlCato.id_cont.desc()).first()


def estado_renovacion(id_cato):
    """Estado de los radio buttons del legacy para el cato.

    - 'RENOVADO'  si el ultimo control tiene hruta_nro (hoja de ruta asociada)
    - 'EN_CURSO'  si existe renovacion vigente y el control no fue marcado
    - 'SIN_RENOVACION' si el cato no tiene renovacion vigente ni marca
    """
    renov = _renovacion_vigente(id_cato)
    ultimo = _ultimo_control(id_cato)

    if ultimo is not None and ultimo.hruta_nro:
        estado = 'RENOVADO'
    elif renov is not None:
        estado = 'EN_CURSO'
    else:
        estado = 'SIN_RENOVACION'

    return {
        'id_cato': id_cato,
        'estado': estado,
        'tiene_renovacion_vigente': renov is not None,
        'renovacion': renov.to_dict_resumen() if renov else None,
        'ultimo_control': _fila_control(ultimo) if ultimo else None,
    }


def marcar_renovado(id_cato, id_cont, data, usuario_login):
    """Radio 'Renovado': setea hruta_nro en el control y la fecha de
    destruccion en la renovacion vigente del cato."""
    control = ControlCato.query.get(id_cont)
    if control is None or control.id_cato != id_cato:
        raise ValidationError(
            f'No existe el control {id_cont} del cato {id_cato}')

    errores = []
    hruta_nro = limpiar(data.get('hruta_nro'))
    fecha_destruccion = parsear_fecha(
        data.get('fecha_destruccion'), 'fecha_destruccion', errores)
    if errores:
        raise ValidationError(errores)

    renov = _renovacion_vigente(id_cato)
    if renov is None:
        raise ValidationError(
            f'El cato {id_cato} no tiene una renovacion vigente')

    # Si no envian hoja de ruta, usa el nro. de solicitud de la renovacion
    hruta_nro = hruta_nro or renov.nro_solicitud
    if not hruta_nro:
        raise ValidationError('Debe indicar el numero de hoja de ruta '
                              '(hruta_nro)')

    control.hruta_nro = hruta_nro
    control.usuario = usuario_login
    renov.fecha_destruida = fecha_destruccion or date.today()
    renov.estado = ESTADO_DESTRUIDA
    db.session.commit()
    return estado_renovacion(id_cato)


def marcar_en_curso(id_cato, id_cont, usuario_login):
    """Radio 'Renovacion en curso': limpia hruta_nro del control y revierte
    la fecha de destruccion de la renovacion asociada."""
    control = ControlCato.query.get(id_cont)
    if control is None or control.id_cato != id_cato:
        raise ValidationError(
            f'No existe el control {id_cont} del cato {id_cato}')

    hruta_anterior = control.hruta_nro
    control.hruta_nro = None
    control.usuario = usuario_login

    # Revertir la renovacion destruida vinculada (por hoja de ruta o la
    # ultima destruida del cato)
    renov = None
    if hruta_anterior:
        renov = RenovacionProgramada.query.filter_by(
            id_cato=id_cato, nro_solicitud=hruta_anterior).first()
    if renov is None:
        renov = RenovacionProgramada.query\
            .filter(RenovacionProgramada.id_cato == id_cato,
                    RenovacionProgramada.fecha_destruida.isnot(None))\
            .order_by(RenovacionProgramada.id.desc()).first()
    if renov is not None:
        renov.fecha_destruida = None
        if renov.estado == ESTADO_DESTRUIDA:
            renov.estado = ESTADO_PENDIENTE

    db.session.commit()
    return estado_renovacion(id_cato)
