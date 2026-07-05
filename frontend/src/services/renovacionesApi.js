import api from './api';

export const listarRenovaciones = (params) =>
  api.get('/renovaciones', { params }).then((r) => r.data);

export const obtenerRenovacion = (idRenov) =>
  api.get(`/renovaciones/${idRenov}`).then((r) => r.data);

export const verificarElegibilidad = (idAfi) =>
  api.get(`/renovaciones/afiliado/${encodeURIComponent(idAfi)}/elegibilidad`)
    .then((r) => r.data);

export const crearRenovacion = (data) =>
  api.post('/renovaciones', data).then((r) => r.data);

export const actualizarRenovacion = (idRenov, data) =>
  api.put(`/renovaciones/${idRenov}`, data).then((r) => r.data);

export const remitirALegal = (idRenov, data = {}) =>
  api.post(`/renovaciones/${idRenov}/remitir-legal`, data).then((r) => r.data);

export const listarInformes = (idRenov) =>
  api.get(`/renovaciones/${idRenov}/informes`).then((r) => r.data);

export const crearInforme = (idRenov, data) =>
  api.post(`/renovaciones/${idRenov}/informes`, data).then((r) => r.data);
