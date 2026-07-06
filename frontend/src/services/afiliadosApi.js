import api from './api';

export const buscarAfiliados = (q, page = 1, perPage = 25, tieneCATO = null) => {
  const params = { q, page, per_page: perPage };
  if (tieneCATO !== null) {
    params.tiene_cato = tieneCATO;
  }
  return api.get('/afiliados', { params })
    .then((r) => r.data);
};

export const obtenerAfiliado = (idAfi) =>
  api.get(`/afiliados/${encodeURIComponent(idAfi)}`).then((r) => r.data);

export const catosDeAfiliado = (idAfi) =>
  api.get(`/afiliados/${encodeURIComponent(idAfi)}/catos`).then((r) => r.data);

export const existeAfiliado = (idAfi) =>
  api.get(`/afiliados/${encodeURIComponent(idAfi)}/existe`).then((r) => r.data);

export const historialAfiliado = (idAfi) =>
  api.get(`/afiliados/${encodeURIComponent(idAfi)}/historial`).then((r) => r.data);

export const catoVigente = (idAfi) =>
  api.get(`/afiliados/${encodeURIComponent(idAfi)}/cato-vigente`).then((r) => r.data);

export const verificarCatoVigente = (idAfi) =>
  api.get(`/afiliados/${encodeURIComponent(idAfi)}/cato-vigente`).then((r) => r.data);

export const crearAfiliado = (data) =>
  api.post('/afiliados', data).then((r) => r.data);

export const actualizarAfiliado = (idAfi, data) =>
  api.put(`/afiliados/${encodeURIComponent(idAfi)}`, data).then((r) => r.data);
