import api from './api';

export const listarCambios = (params) =>
  api.get('/cambios', { params }).then((r) => r.data);

export const historialCato = (idCato) =>
  api.get(`/cambios/cato/${idCato}/historial`).then((r) => r.data);

export const primerTitular = (idCato) =>
  api.get(`/cambios/cato/${idCato}/primer-titular`).then((r) => r.data);

export const crearCambio = (data) =>
  api.post('/cambios', data).then((r) => r.data);

export const actualizarCambio = (idTrf, data) =>
  api.put(`/cambios/${idTrf}`, data).then((r) => r.data);

export const eliminarCambio = (idTrf) =>
  api.delete(`/cambios/${idTrf}`).then((r) => r.data);
