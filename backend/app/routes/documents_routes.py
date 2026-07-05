"""Rutas: generacion dinamica de documentos Word (.docx).

- /api/documentos/afiliado/<id_afi>            Registro de Afiliados
- /api/documentos/cato/<id_cato>               Registro Catastral
- /api/documentos/cambio/<id_trf>              Comprobante de Cambio
- /api/documentos/renovacion/<id_renov>        ?tipo=solicitud (defecto)
                                               ?tipo=informe[&id_informe=]
                                               ?tipo=resolucion
- /api/documentos/legal/<id_actuacion>         Informe / Observacion /
                                               Resolucion (segun el tipo
                                               de la actuacion)
- /api/documentos/plano/<id_plano>             Certificado de Plano
- /api/documentos/plano-revision/<id_revision> Acta de Revision Tecnica

RBAC: mismos roles de lectura de cada area (el documento solo expone
datos que ya son visibles en los endpoints de consulta).
Errores: 404 registro inexistente, 400 plantilla faltante o tipo invalido.
"""
from flask import Blueprint, current_app, jsonify, request, send_file

from app.middleware.auth import requiere_roles, usuario_actual
from app.models import InformeVisitaTecnica, RenovacionProgramada
from app.models.usuarios import (
    ROLES_VENTANILLA_LECTURA, ROLES_RENOV_LECTURA, ROLES_LEGAL_LECTURA,
    ROLES_PLANOS_LECTURA,
)
from app.services import document_service
from app.services.document_service import (
    MIME_DOCX, DocumentoNoEncontrado, PlantillaNoEncontrada,
)

documentos_bp = Blueprint('documentos', __name__,
                          url_prefix='/api/documentos')

TIPOS_DOC_RENOVACION = ('solicitud', 'informe', 'resolucion')


def _generar(generador, *args):
    """Ejecuta el generador y arma la respuesta (o el error HTTP)."""
    usuario = usuario_actual()
    current_app.logger.info(
        'Solicitud de documento: %s(%s) por %s',
        generador.__name__, ', '.join(str(a) for a in args),
        usuario.login_usr if usuario else 'desconocido')
    try:
        buffer, nombre = generador(*args, usuario=usuario)
    except DocumentoNoEncontrado as e:
        return jsonify({'error': str(e)}), 404
    except PlantillaNoEncontrada as e:
        return jsonify({'error': str(e)}), 400
    return send_file(buffer, mimetype=MIME_DOCX, as_attachment=True,
                     download_name=nombre)


@documentos_bp.route('/afiliado/<id_afi>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def doc_afiliado(id_afi):
    """Registro de Afiliados (plantilla 01)."""
    return _generar(document_service.generar_registro_afiliados, id_afi)


@documentos_bp.route('/cato/<int:id_cato>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def doc_cato(id_cato):
    """Registro Catastral (plantilla 02)."""
    return _generar(document_service.generar_registro_catastral, id_cato)


@documentos_bp.route('/cambio/<int:id_trf>', methods=['GET'])
@requiere_roles(*ROLES_VENTANILLA_LECTURA)
def doc_cambio(id_trf):
    """Comprobante de Cambio de Titularidad (plantilla 03)."""
    return _generar(document_service.generar_comprobante_cambio, id_trf)


@documentos_bp.route('/renovacion/<int:id_renov>', methods=['GET'])
@requiere_roles(*ROLES_RENOV_LECTURA)
def doc_renovacion(id_renov):
    """Documentos del tramite de renovacion.

    ?tipo=solicitud  Solicitud de Renovacion (defecto, plantilla 04)
    ?tipo=informe    Informe de Visita Tecnica (plantilla 05); usa el
                     ultimo informe o ?id_informe=<id> para uno concreto
    ?tipo=resolucion Resolucion de Renovacion (plantilla 06)
    """
    tipo = request.args.get('tipo', 'solicitud')
    if tipo not in TIPOS_DOC_RENOVACION:
        return jsonify({
            'error': f'tipo invalido: {tipo}',
            'validos': list(TIPOS_DOC_RENOVACION),
        }), 400

    if tipo == 'solicitud':
        return _generar(document_service.generar_solicitud_renovacion,
                        id_renov)
    if tipo == 'resolucion':
        return _generar(document_service.generar_resolucion_renovacion,
                        id_renov)

    # tipo == 'informe': ultimo informe de la renovacion o el indicado
    id_informe = request.args.get('id_informe', type=int)
    if id_informe is None:
        renov = RenovacionProgramada.query.get(id_renov)
        if renov is None:
            return jsonify(
                {'error': f'No existe la renovacion {id_renov}'}), 404
        ultimo = (InformeVisitaTecnica.query
                  .filter_by(id_renovacion=renov.id)
                  .order_by(InformeVisitaTecnica.fecha_visita.desc())
                  .first())
        if ultimo is None:
            return jsonify({
                'error': f'La renovacion {id_renov} no tiene informes '
                         'de visita tecnica',
            }), 404
        id_informe = ultimo.id_informe
    return _generar(document_service.generar_informe_visita_tecnica,
                    id_informe)


@documentos_bp.route('/legal/<int:id_actuacion>', methods=['GET'])
@requiere_roles(*ROLES_LEGAL_LECTURA)
def doc_legal(id_actuacion):
    """Documento de la actuacion legal segun su tipo:

    INFORME_LEGAL     -> Informe Legal (plantilla 07)
    RESOLUCION        -> Resolucion Administrativa (plantilla 08)
    OBSERVACION_LEGAL -> Observaciones Legales (plantilla 09)
    """
    return _generar(document_service.generar_documento_actuacion,
                    id_actuacion)


@documentos_bp.route('/plano/<int:id_plano>', methods=['GET'])
@requiere_roles(*ROLES_PLANOS_LECTURA)
def doc_plano(id_plano):
    """Certificado de Plano (plantilla 10)."""
    return _generar(document_service.generar_certificado_plano, id_plano)


@documentos_bp.route('/plano-revision/<int:id_revision>', methods=['GET'])
@requiere_roles(*ROLES_PLANOS_LECTURA)
def doc_plano_revision(id_revision):
    """Acta de Revision Tecnica de Planos (plantilla 11)."""
    return _generar(document_service.generar_acta_revision_planos,
                    id_revision)
