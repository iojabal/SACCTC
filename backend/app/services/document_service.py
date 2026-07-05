"""Generacion dinamica de documentos Word (docxtpl + python-docx).

Cada funcion generar_* carga la plantilla correspondiente de
backend/templates/, la rellena con datos reales de la base de datos
(modelos SQLAlchemy + relaciones) y devuelve un io.BytesIO listo para
enviarse con flask.send_file (sin archivos temporales).

Plantillas (placeholders Jinja2 {{campo}}):
  01_Registro_de_Afiliados.docx            -> generar_registro_afiliados
  02_Registro_Catastral.docx               -> generar_registro_catastral
  03_Comprobante_Cambio_Titularidad.docx   -> generar_comprobante_cambio
  04_Solicitud_de_Renovacion.docx          -> generar_solicitud_renovacion
  05_Informe_de_Visita_Tecnica.docx        -> generar_informe_visita_tecnica
  06_Resolucion_de_Renovacion.docx         -> generar_resolucion_renovacion
  07_Informe_Legal.docx                    -> generar_informe_legal
  08_Resolucion_Administrativa.docx        -> generar_resolucion_administrativa
  09_Observaciones_Legales.docx            -> generar_observaciones_legales
  10_Certificado_de_Plano.docx             -> generar_certificado_plano
  11_Acta_de_Revision_Tecnica_de_Planos.docx -> generar_acta_revision_planos
"""
import io
import logging
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from docxtpl import DocxTemplate

from app.models import (
    Afiliado, Cato, Cambio, RenovacionProgramada, InformeVisitaTecnica,
    ActuacionLegal, Plano, PlanoRevision,
)
from app.models.legal import (
    TIPO_INFORME_LEGAL, TIPO_OBSERVACION_LEGAL, TIPO_RESOLUCION,
)

logger = logging.getLogger(__name__)

# backend/app/services/ -> backend/templates/
TEMPLATES_DIR = Path(__file__).resolve().parents[2] / 'templates'

PLANTILLAS = {
    'registro_afiliados': '01_Registro_de_Afiliados.docx',
    'registro_catastral': '02_Registro_Catastral.docx',
    'comprobante_cambio': '03_Comprobante_Cambio_Titularidad.docx',
    'solicitud_renovacion': '04_Solicitud_de_Renovacion.docx',
    'informe_visita_tecnica': '05_Informe_de_Visita_Tecnica.docx',
    'resolucion_renovacion': '06_Resolucion_de_Renovacion.docx',
    'informe_legal': '07_Informe_Legal.docx',
    'resolucion_administrativa': '08_Resolucion_Administrativa.docx',
    'observaciones_legales': '09_Observaciones_Legales.docx',
    'certificado_plano': '10_Certificado_de_Plano.docx',
    'acta_revision_planos': '11_Acta_de_Revision_Tecnica_de_Planos.docx',
}

MIME_DOCX = ('application/vnd.openxmlformats-officedocument'
             '.wordprocessingml.document')


class DocumentoNoEncontrado(Exception):
    """El registro solicitado no existe en la base de datos (HTTP 404)."""


class PlantillaNoEncontrada(Exception):
    """La plantilla .docx no existe en backend/templates/ (HTTP 400)."""


# ---------------------------------------------------------------------------
# Helpers de formato y render
# ---------------------------------------------------------------------------

def _fmt(valor):
    """Formatea un valor para insertarlo en el documento.

    None -> '' (nunca imprime "None"), fechas -> dd/mm/aaaa,
    Decimal -> texto sin ceros sobrantes.
    """
    if valor is None:
        return ''
    if isinstance(valor, datetime):
        return valor.strftime('%d/%m/%Y %H:%M')
    if isinstance(valor, date):
        return valor.strftime('%d/%m/%Y')
    if isinstance(valor, Decimal):
        texto = f'{valor:.4f}'.rstrip('0').rstrip('.')
        return texto or '0'
    return str(valor)


def _contexto_base(usuario=None):
    """Campos comunes de cabecera: fecha de emision + usuario emisor."""
    return {
        'fecha': date.today(),
        'usuario_nombre': usuario.nombre_apellido if usuario else '',
        'usuario_ci': usuario.id_usr if usuario else '',
        'usuario_cargo': usuario.cargo if usuario else '',
    }


def _render(clave_plantilla, contexto, nombre_archivo):
    """Rellena la plantilla y devuelve (BytesIO, nombre_archivo).

    Todo en memoria (BytesIO): sin archivos temporales.
    """
    ruta = TEMPLATES_DIR / PLANTILLAS[clave_plantilla]
    if not ruta.is_file():
        logger.error('Plantilla no encontrada: %s', ruta)
        raise PlantillaNoEncontrada(
            f'No existe la plantilla {PLANTILLAS[clave_plantilla]} '
            'en backend/templates/')

    doc = DocxTemplate(str(ruta))
    doc.render({clave: _fmt(valor) for clave, valor in contexto.items()})
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    logger.info('Documento generado: %s (%s)', nombre_archivo,
                PLANTILLAS[clave_plantilla])
    return buffer, nombre_archivo


def _org_de_cato(cato):
    """Jerarquia sindical del cato: Sindicato -> Central -> Federacion."""
    org = {'sindicato': '', 'central': '', 'federacion': '',
           'departamento': '', 'provincia': '', 'municipio': ''}
    if cato is None or cato.sindicato is None:
        return org
    sind = cato.sindicato
    org['sindicato'] = sind.nombre
    if sind.central:
        org['central'] = sind.central.nombre
        fede = sind.central.federacion
        if fede:
            org['federacion'] = fede.sigla
            org['departamento'] = fede.dpto
            org['provincia'] = fede.prov
            org['municipio'] = fede.mun
    return org


def _nombre_afiliado(id_afi):
    """(nombre_completo, ext) del afiliado o ('', '') si no existe."""
    if not id_afi:
        return '', ''
    afi = Afiliado.query.filter_by(id_afi=id_afi).first()
    if afi is None:
        return '', ''
    return afi.nombre_completo, afi.ext or ''


def _ultima_actuacion(id_renovacion, tipo):
    """Ultima actuacion legal del tipo dado (o None)."""
    return (ActuacionLegal.query
            .filter_by(id_renovacion=id_renovacion, tipo=tipo)
            .order_by(ActuacionLegal.creado_en.desc())
            .first())


# ---------------------------------------------------------------------------
# 01 - Registro de Afiliados
# ---------------------------------------------------------------------------

def generar_registro_afiliados(id_afi, usuario=None):
    """Ficha de registro del afiliado + su primer cato y org sindical."""
    afiliado = Afiliado.query.filter_by(id_afi=str(id_afi)).first()
    if afiliado is None:
        raise DocumentoNoEncontrado(f'No existe el afiliado {id_afi}')

    contexto = _contexto_base(usuario)
    contexto.update(afiliado.to_dict())
    contexto['fecha_nac'] = afiliado.fecha_nac  # date, no isoformat

    # Primer cato del afiliado (fila de la tabla de parcelas)
    cato = afiliado.catos.first()
    contexto.update(_org_de_cato(cato))
    contexto.update({
        'id_cato': cato.id_cato if cato else '',
        'cato_sindicato': cato.sindicato.nombre
            if cato and cato.sindicato else '',
        'tipo_aut': cato.tipo_aut if cato else '',
        'cato_estado': cato.estado if cato else '',
        'fecha_aut': cato.fecha_aut if cato else '',
    })
    return _render('registro_afiliados', contexto,
                   f'Registro_Afiliado_{afiliado.id_afi}.docx')


# ---------------------------------------------------------------------------
# 02 - Registro Catastral
# ---------------------------------------------------------------------------

def generar_registro_catastral(id_cato, usuario=None):
    """Ficha catastral de la parcela + titular y org sindical."""
    cato = Cato.query.filter_by(id_cato=id_cato).first()
    if cato is None:
        raise DocumentoNoEncontrado(f'No existe el cato {id_cato}')

    contexto = _contexto_base(usuario)
    contexto.update(cato.to_dict())
    contexto['fecha_aut'] = cato.fecha_aut
    contexto.update(_org_de_cato(cato))

    nombre_completo, _ = _nombre_afiliado(cato.id_afi)
    contexto.update({
        'nombre_completo': nombre_completo,
        # El modelo Cato no registra datos tecnicos propios
        'superficie': '',
        'coordenadas': '',
        'observacion': cato.descripcion or '',
        'responsable_nombre': usuario.nombre_apellido if usuario else '',
    })
    return _render('registro_catastral', contexto,
                   f'Registro_Catastral_{cato.id_cato}.docx')


# ---------------------------------------------------------------------------
# 03 - Comprobante de Cambio de Titularidad
# ---------------------------------------------------------------------------

def generar_comprobante_cambio(id_trf, usuario=None):
    """Comprobante de transferencia de la parcela entre afiliados."""
    cambio = Cambio.query.get(id_trf)
    if cambio is None:
        raise DocumentoNoEncontrado(f'No existe el cambio {id_trf}')

    contexto = _contexto_base(usuario)
    contexto.update(cambio.to_dict())
    contexto['fecha_cambio'] = cambio.fecha_cambio
    contexto['resol_fecha'] = cambio.resol_fecha
    return _render('comprobante_cambio', contexto,
                   f'Comprobante_Cambio_{cambio.id_trf}.docx')


# ---------------------------------------------------------------------------
# Renovaciones (04, 05 y 06)
# ---------------------------------------------------------------------------

def _obtener_renovacion(id_renov):
    renov = RenovacionProgramada.query.get(id_renov)
    if renov is None:
        raise DocumentoNoEncontrado(f'No existe la renovacion {id_renov}')
    return renov


def _contexto_renovacion(renov, usuario):
    """Campos comunes de las plantillas del area Renovaciones."""
    nombre_completo, _ = _nombre_afiliado(renov.id_afi)
    contexto = _contexto_base(usuario)
    contexto.update({
        'id_renov': renov.id_renov if renov.id_renov is not None else renov.id,
        'id_cato': renov.id_cato,
        'id_afi': renov.id_afi,
        'nombre_completo': nombre_completo,
        'nro_solicitud': renov.nro_solicitud,
        'estado': renov.estado,
        'federacion': renov.federacion,
        'central': renov.central,
        'sindicato': renov.sindicato,
        'departamento': renov.departamento,
        'provincia': renov.provincia,
        'municipio': renov.municipio,
    })
    return contexto


def generar_solicitud_renovacion(id_renov, usuario=None):
    """Solicitud de renovacion programada (DS 3318)."""
    renov = _obtener_renovacion(id_renov)
    contexto = _contexto_renovacion(renov, usuario)
    contexto.update({
        'hruta_fecha': renov.hruta_fecha,
        'cato_sup': renov.cato_sup,
        'cato_utm_xy': renov.cato_utm_xy,
        'cato_frec': renov.cato_frec,
        'cato_edad_anio': renov.cato_edad_anio,
        'cato_edad_mes': renov.cato_edad_mes,
        'observacion': renov.observacion,
    })
    return _render('solicitud_renovacion', contexto,
                   f'Solicitud_Renovacion_{renov.id}.docx')


def generar_informe_visita_tecnica(id_informe, usuario=None):
    """Informe de inspeccion de campo (visita tecnica)."""
    informe = InformeVisitaTecnica.query.get(id_informe)
    if informe is None:
        raise DocumentoNoEncontrado(
            f'No existe el informe de visita {id_informe}')

    renov = informe.renovacion
    nombre_completo, _ = _nombre_afiliado(renov.id_afi if renov else None)
    contexto = _contexto_base(usuario)
    contexto.update(informe.to_dict())
    contexto.update({
        'fecha_visita': informe.fecha_visita,
        'id_cato': renov.id_cato if renov else '',
        'id_afi': renov.id_afi if renov else '',
        'nombre_completo': nombre_completo,
        'responsable_nombre': usuario.nombre_apellido if usuario else '',
    })
    return _render('informe_visita_tecnica', contexto,
                   f'Informe_Visita_Tecnica_{informe.id_informe}.docx')


def generar_resolucion_renovacion(id_renov, usuario=None):
    """Resolucion de renovacion (parcela nueva autorizada + vigencia)."""
    renov = _obtener_renovacion(id_renov)
    contexto = _contexto_renovacion(renov, usuario)

    # Responsable legal: ultima resolucion administrativa archivada
    resolucion = _ultima_actuacion(renov.id, TIPO_RESOLUCION)
    contexto.update({
        'resol_nro': renov.resol_nro,
        'resol_fecha': renov.resol_fecha,
        'resol_obs': renov.resol_obs,
        'resultado': renov.resultado,
        'tecnico_info_nro': renov.tecnico_info_nro,
        'legal_info_nro': renov.legal_info_nro,
        'renov_sup': renov.renov_sup,
        'renov_utm_xy': renov.renov_utm_xy,
        'renov_frec': renov.renov_frec,
        'renov_edad_mes': renov.renov_edad_mes,
        'vigencia_inicio': renov.vigencia_inicio,
        'fecha_vencimiento': renov.fecha_vencimiento,
        'responsable_nombre': resolucion.responsable_nombre
            if resolucion else '',
        'responsable_cargo': resolucion.responsable_cargo
            if resolucion else '',
    })
    return _render('resolucion_renovacion', contexto,
                   f'Resolucion_Renovacion_{renov.id}.docx')


# ---------------------------------------------------------------------------
# Area Legal (07, 08 y 09)
# ---------------------------------------------------------------------------

def _obtener_actuacion(id_actuacion, tipo_esperado):
    actuacion = ActuacionLegal.query.get(id_actuacion)
    if actuacion is None:
        raise DocumentoNoEncontrado(
            f'No existe la actuacion legal {id_actuacion}')
    if actuacion.tipo != tipo_esperado:
        raise DocumentoNoEncontrado(
            f'La actuacion {id_actuacion} es de tipo {actuacion.tipo}, '
            f'no {tipo_esperado}')
    return actuacion


def _contexto_actuacion(actuacion, usuario):
    """Campos comunes de las plantillas del area Legal."""
    renov = actuacion.renovacion
    nombre_completo, _ = _nombre_afiliado(renov.id_afi if renov else None)
    contexto = _contexto_base(usuario)
    contexto.update(actuacion.to_dict())
    contexto.update({
        'fecha': actuacion.fecha,          # fecha del documento legal
        'id_cato': renov.id_cato if renov else '',
        'id_afi': renov.id_afi if renov else '',
        'nombre_completo': nombre_completo,
    })
    return contexto


def generar_informe_legal(id_actuacion, usuario=None):
    """Informe legal (dictamen PROCEDENTE / IMPROCEDENTE)."""
    actuacion = _obtener_actuacion(id_actuacion, TIPO_INFORME_LEGAL)
    contexto = _contexto_actuacion(actuacion, usuario)
    return _render('informe_legal', contexto,
                   f'Informe_Legal_{actuacion.id_actuacion}.docx')


def generar_resolucion_administrativa(id_actuacion, usuario=None):
    """Resolucion administrativa (APROBADA / RECHAZADA)."""
    actuacion = _obtener_actuacion(id_actuacion, TIPO_RESOLUCION)
    contexto = _contexto_actuacion(actuacion, usuario)
    return _render('resolucion_administrativa', contexto,
                   f'Resolucion_Administrativa_{actuacion.id_actuacion}.docx')


def generar_observaciones_legales(id_actuacion, usuario=None):
    """Nota de observaciones legales del tramite."""
    actuacion = _obtener_actuacion(id_actuacion, TIPO_OBSERVACION_LEGAL)
    contexto = _contexto_actuacion(actuacion, usuario)
    return _render('observaciones_legales', contexto,
                   f'Observaciones_Legales_{actuacion.id_actuacion}.docx')


def generar_documento_actuacion(id_actuacion, usuario=None):
    """Despacha segun el tipo de la actuacion (informe / obs / resolucion)."""
    actuacion = ActuacionLegal.query.get(id_actuacion)
    if actuacion is None:
        raise DocumentoNoEncontrado(
            f'No existe la actuacion legal {id_actuacion}')
    generadores = {
        TIPO_INFORME_LEGAL: generar_informe_legal,
        TIPO_OBSERVACION_LEGAL: generar_observaciones_legales,
        TIPO_RESOLUCION: generar_resolucion_administrativa,
    }
    generador = generadores.get(actuacion.tipo)
    if generador is None:
        raise DocumentoNoEncontrado(
            f'La actuacion {id_actuacion} tiene un tipo desconocido: '
            f'{actuacion.tipo}')
    return generador(id_actuacion, usuario)


# ---------------------------------------------------------------------------
# Area Planos (10 y 11)
# ---------------------------------------------------------------------------

def generar_certificado_plano(id_plano, usuario=None):
    """Certificado del registro topografico del plano."""
    plano = Plano.query.get(id_plano)
    if plano is None:
        raise DocumentoNoEncontrado(f'No existe el plano {id_plano}')

    nombre_completo, _ = _nombre_afiliado(plano.id_afi)
    contexto = _contexto_base(usuario)
    contexto.update(plano.to_dict())
    contexto.update({
        'fecha_registro': plano.fecha_registro,
        'fecha_plano': plano.fecha_plano,
        'superficie': plano.superficie,
        'nombre_completo': nombre_completo,
    })
    return _render('certificado_plano', contexto,
                   f'Certificado_Plano_{plano.nro_plano}.docx')


def generar_acta_revision_planos(id_revision, usuario=None):
    """Acta de revision tecnica de la documentacion del plano."""
    revision = PlanoRevision.query.get(id_revision)
    if revision is None:
        raise DocumentoNoEncontrado(
            f'No existe la revision de plano {id_revision}')

    plano = revision.plano
    contexto = _contexto_base(usuario)
    contexto.update(revision.to_dict())
    contexto.update({
        'fecha_revision': revision.fecha_revision,
        'nro_plano': plano.nro_plano if plano else '',
        'municipio': _org_de_cato(plano.cato)['municipio']
            if plano and plano.cato else '',
    })
    return _render('acta_revision_planos', contexto,
                   f'Acta_Revision_Plano_{revision.id_revision}.docx')
