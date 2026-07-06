// API del Registro de Control de Mensura (endpoints anidados bajo el cato)
import api from './api';

export const controlesPorCato = (idCato) =>
  api.get(`/catos/${idCato}/controles`).then((r) => r.data);

export const crearControl = (idCato, data) =>
  api.post(`/catos/${idCato}/controles`, data).then((r) => r.data);

export const actualizarControl = (idCato, idCont, data) =>
  api.put(`/catos/${idCato}/controles/${idCont}`, data).then((r) => r.data);

export const eliminarControl = (idCato, idCont) =>
  api.delete(`/catos/${idCato}/controles/${idCont}`).then((r) => r.data);

export const estadoRenovacion = (idCato) =>
  api.get(`/catos/${idCato}/renovacion`).then((r) => r.data);

// data: { estado: 'RENOVADO', hruta_nro, fecha_destruccion } | { estado: 'EN_CURSO' }
export const actualizarRenovacion = (idCato, idCont, data) =>
  api.put(`/catos/${idCato}/controles/${idCont}/renovacion`, data)
    .then((r) => r.data);
