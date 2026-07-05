import api from './api';

export const login = (loginUsr, claveUsr) =>
  api.post('/usuarios/login', { login_usr: loginUsr, clave_usr: claveUsr })
    .then((r) => r.data);

export const perfil = () => api.get('/usuarios/me').then((r) => r.data);

export const listarUsuarios = (nombre) =>
  api.get('/usuarios', { params: { nombre } }).then((r) => r.data);

export const crearUsuario = (data) =>
  api.post('/usuarios', data).then((r) => r.data);

export const editarUsuario = (loginUsr, data) =>
  api.put(`/usuarios/${encodeURIComponent(loginUsr)}`, data).then((r) => r.data);

// Reportes PDF (se abren en nueva pestania con el token via blob)
export const abrirReporte = async (ruta) => {
  const r = await api.get(`/reportes/${ruta}`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
  window.open(url, '_blank');
};
