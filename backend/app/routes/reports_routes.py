"""Rutas: reportes PDF del area Ventanilla (reportlab).

- /api/reportes/afiliado/<id_afi>          Ficha del afiliado
- /api/reportes/cato/<id_cato>/historial   Historial de transferencias
- /api/reportes/cato/<id_cato>/controles   Historial de controles tecnicos
"""
import io
from datetime import date

from flask import Blueprint, jsonify, send_file
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)

from app.middleware.auth import requiere_roles
from app.models.usuarios import ROLES_VENTANILLA_LECTURA
from app.services import afiliados_service, cambios_service, control_cato_service

reports_bp = Blueprint('reportes', __name__, url_prefix='/api/reportes')

_ESTILOS = getSampleStyleSheet()


def _pdf_response(elementos, nombre, apaisado=False):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(letter) if apaisado else letter,
        title=nombre, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    doc.build(elementos)
    buffer.seek(0)
    return send_file(buffer, mimetype='application/pdf',
                     as_attachment=False, download_name=f'{nombre}.pdf')


def _titulo(texto):
    return [
        Paragraph('SACCTC - UDESTRO', _ESTILOS['Title']),
        Paragraph(texto, _ESTILOS['Heading2']),
        Paragraph(f'Fecha de emision: {date.today().isoformat()}',
                  _ESTILOS['Normal']),
        Spacer(1, 12),
    ]


def _tabla(cabeceras, filas, anchos=None):
    datos = [cabeceras] + filas
    tabla = Table(datos, colWidths=anchos, repeatRows=1)
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2e7d32')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white,
                                              colors.HexColor('#f1f8e9')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return tabla


@reports_bp.route('/afiliado/<id_afi>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def ficha_afiliado(id_afi):
    data = afiliados_service.obtener_afiliado(id_afi)
    if data is None:
        return jsonify({'error': f'No existe el afiliado {id_afi}'}), 404

    elementos = _titulo(f'Ficha de Afiliado - CI {id_afi}')
    filas = [
        ['CI', f"{data['id_afi']} {data['ext'] or ''}"],
        ['Nombre completo', data['nombre_completo']],
        ['Fecha de nacimiento', data['fecha_nac'] or '-'],
        ['Genero', data['genero'] or '-'],
        ['Estado', data['estado'] or '-'],
        ['Observaciones', data['obs'] or '-'],
        ['Observaciones pendientes', str(data['observaciones_pendientes'])],
    ]
    elementos.append(_tabla(['Campo', 'Valor'], filas, [5 * cm, 11 * cm]))

    if data['catos']:
        elementos.append(Spacer(1, 14))
        elementos.append(Paragraph('Catos registrados', _ESTILOS['Heading3']))
        filas_catos = [[str(c['id_cato']), c.get('federacion', '-') or '-',
                        c.get('central', '-') or '-',
                        c.get('sindicato', '-') or '-', c['tipo_aut'] or '-']
                       for c in data['catos']]
        elementos.append(_tabla(
            ['Cod. Cato', 'Federacion', 'Central', 'Sindicato', 'Tipo Aut.'],
            filas_catos, [2.5 * cm, 3.5 * cm, 3.5 * cm, 4 * cm, 3 * cm]))

    return _pdf_response(elementos, f'ficha_afiliado_{id_afi}')


@reports_bp.route('/cato/<int:id_cato>/historial', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def historial_cato(id_cato):
    """ProcGetExtractoTrf / ProcGetHistTrfCato en PDF."""
    historial = cambios_service.historial_cambios_cato(id_cato)
    elementos = _titulo(f'Historial de Transferencias - Cato {id_cato}')
    if not historial:
        elementos.append(Paragraph('El cato no registra transferencias.',
                                   _ESTILOS['Normal']))
    else:
        filas = [[h['fecha_cambio'] or '-', h['id_afi_titular'] or '-',
                  h['titular_nombre'] or '-', h['id_afi_nuevo'] or '-',
                  h['nuevo_nombre'] or '-', h['tipo_cambio'] or '-',
                  h['codigo_docu'] or '-'] for h in historial]
        elementos.append(_tabla(
            ['Fecha', 'CI Vendedor', 'Vendedor', 'CI Comprador',
             'Comprador', 'Tipo', 'Documento'],
            filas, [2.2 * cm, 2.5 * cm, 5.5 * cm, 2.5 * cm,
                    5.5 * cm, 3 * cm, 2.8 * cm]))
    return _pdf_response(elementos, f'historial_cato_{id_cato}', apaisado=True)


@reports_bp.route('/cato/<int:id_cato>/controles', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def controles_cato(id_cato):
    controles = control_cato_service.controles_por_cato(id_cato)
    elementos = _titulo(f'Controles Tecnicos - Cato {id_cato}')
    if not controles:
        elementos.append(Paragraph('El cato no registra controles tecnicos.',
                                   _ESTILOS['Normal']))
    else:
        filas = [[c['fecha_control'] or '-', c['id_afi'],
                  str(c['sup_mensura'] if c['sup_mensura'] is not None else '-'),
                  str(c['frecuencia'] or '-'), str(c['num_lote'] or '-'),
                  c['coordenadas'] or '-', c['tecnico'] or '-']
                 for c in controles]
        elementos.append(_tabla(
            ['Fecha', 'CI Afiliado', 'Sup. Mensura', 'Frec.', 'Lote',
             'Coordenadas', 'Tecnico'],
            filas, [2.4 * cm, 2.8 * cm, 2.6 * cm, 1.6 * cm, 1.6 * cm,
                    7 * cm, 5 * cm]))
    return _pdf_response(elementos, f'controles_cato_{id_cato}', apaisado=True)
