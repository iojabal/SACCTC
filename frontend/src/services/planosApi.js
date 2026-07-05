import api from './api';

export const listarPlanos = (params) =>
  api.get('/planos', { params }).then((r) => r.data);

export const obtenerPlano = (idPlano) =>
  api.get(`/planos/${idPlano}`).then((r) => r.data);

export const planosPorCato = (idCato) =>
  api.get(`/planos/cato/${idCato}`).then((r) => r.data);

export const crearPlano = (data) =>
  api.post('/planos', data).then((r) => r.data);

export const actualizarPlano = (idPlano, data) =>
  api.put(`/planos/${idPlano}`, data).then((r) => r.data);

export const listarRevisiones = (idPlano) =>
  api.get(`/planos/${idPlano}/revisiones`).then((r) => r.data);

export const registrarRevision = (idPlano, data) =>
  api.post(`/planos/${idPlano}/revisiones`, data).then((r) => r.data);

export const archivarPlano = (idPlano, data = {}) =>
  api.post(`/planos/${idPlano}/archivar`, data).then((r) => r.data);
