import api from './api';

export const listarCatos = (params) =>
  api.get('/catos', { params }).then((r) => r.data);

export const obtenerCato = (idCato) =>
  api.get(`/catos/${idCato}`).then((r) => r.data);

export const ultimoCodigoCato = (prefijo) =>
  api.get(`/catos/ultimo-codigo/${prefijo}`).then((r) => r.data);

export const crearCato = (data) =>
  api.post('/catos', data).then((r) => r.data);

export const actualizarCato = (idCato, data) =>
  api.put(`/catos/${idCato}`, data).then((r) => r.data);

export const eliminarCato = (idCato) =>
  api.delete(`/catos/${idCato}`).then((r) => r.data);
