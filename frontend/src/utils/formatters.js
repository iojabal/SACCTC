// Formateadores de presentacion

export function formatearFecha(iso) {
  if (!iso) return '-';
  const [anio, mes, dia] = iso.split('T')[0].split('-');
  if (!anio || !mes || !dia) return iso;
  return `${dia}/${mes}/${anio}`;
}

export function formatearNumero(valor, decimales = 4) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toLocaleString('es-BO', {
    maximumFractionDigits: decimales,
  });
}

export function formatearCI(idAfi, ext) {
  if (!idAfi) return '-';
  return ext ? `${idAfi} ${ext}` : idAfi;
}

export function textoODefecto(valor, defecto = '-') {
  return valor === null || valor === undefined || valor === '' ? defecto : valor;
}
