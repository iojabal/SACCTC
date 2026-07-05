"""Validaciones de negocio compartidas del area Ventanilla.

Replica las reglas que en el legacy estaban dispersas entre los WinForms
y los stored procedures, ahora centralizadas y SIEMPRE en servidor.
"""
from app.models import Afiliado, Cato, Cambio, ControlCato, Observado


def existe_afiliado(id_afi):
    """ProcAfiCiExiste."""
    return Afiliado.query.filter_by(id_afi=id_afi).count() > 0


def obtener_afiliado(id_afi):
    """ProcAfiGetDatos."""
    return Afiliado.query.filter_by(id_afi=id_afi).first()


def tiene_cato_vigente(id_afi):
    """ProcTieneCatoVigenteAfi > 0."""
    return Cato.query.filter_by(id_afi=id_afi).count() > 0


def id_cato_vigente(id_afi):
    """ProcAfiNewGetIdCatoVigente: 0 si no tiene."""
    cato = Cato.query.filter_by(id_afi=id_afi).first()
    return cato.id_cato if cato else 0


def existe_cato(id_cato):
    return Cato.query.filter_by(id_cato=id_cato).count() > 0


def tiene_observaciones_pendientes(id_afi):
    """ProcTieneObsAfi: observaciones con aclarado = 'NO'."""
    return Observado.query.filter_by(id_afi=id_afi, aclarado='NO').count() > 0


def existe_fecha_control(id_cato, fecha_control, excluir_id_cont=None):
    """ProcExisteFechaControl: evita controles duplicados en la misma fecha."""
    q = ControlCato.query.filter_by(id_cato=id_cato, fecha_control=fecha_control)
    if excluir_id_cont is not None:
        q = q.filter(ControlCato.id_cont != excluir_id_cont)
    return q.count() > 0


def cato_tiene_cambios(id_cato):
    """ProcExisteRegCato_TabCambio."""
    return Cambio.query.filter_by(id_cato=id_cato).count() > 0


def cato_tiene_controles(id_cato):
    """ProcExisteRegCato_TabControlCato."""
    return ControlCato.query.filter_by(id_cato=id_cato).count() > 0
