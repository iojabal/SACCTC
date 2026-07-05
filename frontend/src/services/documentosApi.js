// Descarga de documentos Word generados por el backend (docxtpl)
import api from './api';

const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Nombre de archivo del header Content-Disposition (o el de respaldo) */
function nombreDeCabecera(headers, respaldo) {
  const cd = headers?.['content-disposition'] || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return match ? decodeURIComponent(match[1]) : respaldo;
}

/**
 * Descarga un .docx de /api/documentos/<ruta> y dispara el guardado
 * en el navegador (con el JWT del interceptor de axios).
 */
export async function descargarDocumento(ruta, nombreRespaldo = 'documento.docx') {
  const r = await api.get(`/documentos/${ruta}`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([r.data], { type: MIME_DOCX }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreDeCabecera(r.headers, nombreRespaldo);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

// Atajos por tipo de documento
export const descargarRegistroAfiliado = (idAfi) =>
  descargarDocumento(`afiliado/${encodeURIComponent(idAfi)}`,
    `Registro_Afiliado_${idAfi}.docx`);

export const descargarRegistroCatastral = (idCato) =>
  descargarDocumento(`cato/${idCato}`, `Registro_Catastral_${idCato}.docx`);

export const descargarComprobanteCambio = (idTrf) =>
  descargarDocumento(`cambio/${idTrf}`, `Comprobante_Cambio_${idTrf}.docx`);

export const descargarSolicitudRenovacion = (idRenov) =>
  descargarDocumento(`renovacion/${idRenov}?tipo=solicitud`,
    `Solicitud_Renovacion_${idRenov}.docx`);

export const descargarInformeVisita = (idRenov, idInforme) =>
  descargarDocumento(
    `renovacion/${idRenov}?tipo=informe${idInforme ? `&id_informe=${idInforme}` : ''}`,
    `Informe_Visita_Tecnica_${idInforme || idRenov}.docx`);

export const descargarResolucionRenovacion = (idRenov) =>
  descargarDocumento(`renovacion/${idRenov}?tipo=resolucion`,
    `Resolucion_Renovacion_${idRenov}.docx`);

export const descargarDocumentoLegal = (idActuacion) =>
  descargarDocumento(`legal/${idActuacion}`,
    `Documento_Legal_${idActuacion}.docx`);

export const descargarCertificadoPlano = (idPlano) =>
  descargarDocumento(`plano/${idPlano}`, `Certificado_Plano_${idPlano}.docx`);

export const descargarActaRevision = (idRevision) =>
  descargarDocumento(`plano-revision/${idRevision}`,
    `Acta_Revision_Plano_${idRevision}.docx`);
