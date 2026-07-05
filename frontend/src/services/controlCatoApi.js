import api from './api';

export const listarControles = (params) =>
  api.get('/controles', { params }).then((r) => r.data);

export const controlesPorCato = (idCato) =>
  api.get(`/controles/cato/${idCato}`).then((r) => r.data);

export const ultimoControl = (idCato) =>
  api.get(`/controles/cato/${idCato}/ultimo`).then((r) => r.data);

export const crearControl = (data) =>
  api.post('/controles', data).then((r) => r.data);

export const actualizarControl = (idCont, data) =>
  api.put(`/controles/${idCont}`, data).then((r) => r.data);

export const eliminarControl = (idCont) =>
  api.delete(`/controles/${idCont}`).then((r) => r.data);
