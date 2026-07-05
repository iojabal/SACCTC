import api from './api';

export const listarCasos = (params) =>
  api.get('/legal/casos', { params }).then((r) => r.data);

export const obtenerCaso = (idCaso) =>
  api.get(`/legal/casos/${idCaso}`).then((r) => r.data);

export const obtenerResumen = () =>
  api.get('/legal/resumen').then((r) => r.data);

export const listarActuaciones = (idCaso) =>
  api.get(`/legal/casos/${idCaso}/actuaciones`).then((r) => r.data);

export const registrarInformeLegal = (idCaso, data) =>
  api.post(`/legal/casos/${idCaso}/informe`, data).then((r) => r.data);

export const registrarObservacion = (idCaso, data) =>
  api.post(`/legal/casos/${idCaso}/observacion`, data).then((r) => r.data);

export const emitirResolucion = (idCaso, data) =>
  api.post(`/legal/casos/${idCaso}/resolucion`, data).then((r) => r.data);
