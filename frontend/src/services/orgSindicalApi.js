import api from './api';

export const listarFederaciones = () =>
  api.get('/org/federaciones').then((r) => r.data);

export const listarCentrales = (idFed) =>
  api.get(`/org/federaciones/${idFed}/centrales`).then((r) => r.data);

export const listarSindicatos = (idCent) =>
  api.get(`/org/centrales/${idCent}/sindicatos`).then((r) => r.data);

export const obtenerSindicato = (idSind) =>
  api.get(`/org/sindicatos/${idSind}`).then((r) => r.data);
