"""Logica de negocio: Control tecnico (ControlCato / Registro de Mensura).

Replica D_RegistroMensura + procedures ProcControlCato_New,
ProcUpdateControlCato, ProcDeleteControlCato, ProcExisteFechaControl,
ProcGetControlCato, ProcGetNumContCato, ProcGetUltimoControl.
"""
from app import db
from app.models import ControlCato, TramHojaDeRuta
from app.middleware.validators import (
    ValidationError, limpiar, parsear_fecha, parsear_entero, parsear_decimal,
    validar_ci,
)
from app.services import validaciones


def controles_por_cato(id_cato):
    """ProcGetControlCato: historial ordenado por fecha."""
    controles = ControlCato.query.filter_by(id_cato=id_cato)\
        .order_by(ControlCato.fecha_control.asc()).all()
    return [c.to_dict() for c in controles]


def ultimo_control(id_cato):
    """ProcGetUltimoControl: ultimo control del cato o None (sin crash si
    la tabla esta vacia - bug legacy de acceso por indice)."""
    control = ControlCato.query.filter_by(id_cato=id_cato)\
        .order_by(ControlCato.fecha_control.desc()).first()
    return control.to_dict() if control else None


def _validar_datos(data, excluir_id_cont=None):
    errores = []
    id_cato = parsear_entero(data.get('id_cato'), 'id_cato', errores, obligatorio=True)
    id_afi = validar_ci(data.get('id_afi'), 'id_afi', errores)
    fecha = parsear_fecha(data.get('fecha_control'), 'fecha_control', errores,
                          obligatorio=True)
    sup_mensura = parsear_decimal(data.get('sup_mensura'), 'sup_mensura',
                                  errores, obligatorio=True, minimo=0, maximo=9999)
    frecuencia = parsear_entero(data.get('frecuencia'), 'frecuencia', errores, minimo=0)
    num_lote = parsear_entero(data.get('num_lote'), 'num_lote', errores, minimo=0)
    sup_lote = parsear_entero(data.get('sup_lote'), 'sup_lote', errores, minimo=0)
    if errores:
        raise ValidationError(errores)
    return {
        'id_cato': id_cato,
        'id_afi': id_afi,
        'fecha_control': fecha,
        'sup_mensura': sup_mensura,
        'frecuencia': frecuencia,
        'num_lote': num_lote,
        'sup_lote': sup_lote,
        'coordenadas': limpiar(data.get('coordenadas')),
        'tecnico': limpiar(data.get('tecnico')),
        'descripcion': limpiar(data.get('descripcion')),
        'edad_anio': limpiar(data.get('edad_anio')),
        'edad_mes': limpiar(data.get('edad_mes')),
        'hruta_nro': limpiar(data.get('hruta_nro')),
    }


def registrar_control(data, usuario_login):
    """ProcControlCato_New + control_numero = ProcGetNumContCato + 1."""
    campos = _validar_datos(data)

    errores = []
    if not validaciones.existe_cato(campos['id_cato']):
        errores.append(f"No existe el cato {campos['id_cato']}")
    if not validaciones.existe_afiliado(campos['id_afi']):
        errores.append(f"No existe el afiliado {campos['id_afi']}")
    if errores:
        raise ValidationError(errores)

    if validaciones.existe_fecha_control(campos['id_cato'], campos['fecha_control']):
        raise ValidationError(
            f"Ya existe un control del cato {campos['id_cato']} con fecha "
            f"{campos['fecha_control'].isoformat()}")

    numero = ControlCato.query.filter_by(id_cato=campos['id_cato']).count() + 1
    control = ControlCato(control_numero=numero, usuario=usuario_login,
                          id_renov=0, **campos)
    db.session.add(control)
    db.session.commit()
    return control.to_dict()


def actualizar_control(id_cont, data, usuario_login):
    """ProcUpdateControlCato."""
    control = ControlCato.query.get(id_cont)
    if control is None:
        raise ValidationError(f'No existe el control {id_cont}')

    base = control.to_dict()
    base.update(data)
    campos = _validar_datos(base, excluir_id_cont=id_cont)

    if validaciones.existe_fecha_control(campos['id_cato'],
                                         campos['fecha_control'],
                                         excluir_id_cont=id_cont):
        raise ValidationError(
            'Ya existe otro control del cato con esa fecha')

    for campo in ('fecha_control', 'sup_mensura', 'frecuencia', 'num_lote',
                  'sup_lote', 'coordenadas', 'tecnico', 'descripcion',
                  'edad_anio', 'edad_mes', 'hruta_nro'):
        setattr(control, campo, campos[campo])
    control.usuario = usuario_login
    db.session.commit()
    return control.to_dict()


def eliminar_control(id_cont):
    """ProcDeleteControlCato: si tiene hoja de ruta de renovacion asociada,
    revierte la fecha de destruccion en el tramite."""
    control = ControlCato.query.get(id_cont)
    if control is None:
        raise ValidationError(f'No existe el control {id_cont}')

    hruta_nro = control.hruta_nro
    db.session.delete(control)

    if hruta_nro:
        # Equivalente a: UPDATE TramHojaDeRutaRenov SET renov_destruida_fecha=NULL
        # La tabla pertenece al area Renovaciones: usar savepoint para tolerar
        # que aun no exista en esta base.
        try:
            with db.session.begin_nested():
                db.session.execute(
                    db.text('UPDATE tramhojaderutarenov '
                            'SET renov_destruida_fecha = NULL '
                            'WHERE hruta_nro = :hr'),
                    {'hr': hruta_nro})
        except Exception:
            pass  # tabla inexistente: solo se elimina el control

    db.session.commit()
    return {'eliminado': id_cont, 'hruta_revertida': hruta_nro}


def listar_controles(page=1, per_page=25, id_cato=None, id_afi=None):
    query = ControlCato.query
    if id_cato is not None:
        query = query.filter_by(id_cato=id_cato)
    if id_afi:
        query = query.filter_by(id_afi=id_afi)
    paginado = query.order_by(ControlCato.fecha_control.desc(),
                              ControlCato.id_cont.desc())\
        .paginate(page=page, per_page=min(per_page, 100), error_out=False)
    return {
        'items': [c.to_dict() for c in paginado.items],
        'total': paginado.total,
        'page': paginado.page,
        'pages': paginado.pages,
    }
