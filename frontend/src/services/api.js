// Cliente Axios con JWT (interceptors) - sin IPs hardcodeadas (env var)
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'sacctc_token';

export const guardarToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const obtenerToken = () => localStorage.getItem(TOKEN_KEY);
export const eliminarToken = () => localStorage.removeItem(TOKEN_KEY);

// Adjunta el JWT a cada peticion
api.interceptors.request.use((config) => {
  const token = obtenerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Sesion expirada -> volver al login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 &&
        !error.config?.url?.includes('/usuarios/login')) {
      eliminarToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** Extrae un mensaje legible de un error Axios */
export function mensajeDeError(error) {
  const data = error.response?.data;
  if (data?.detalles?.length) return data.detalles.join('. ');
  if (data?.error) return data.error;
  if (error.message === 'Network Error') return 'Sin conexion con el servidor';
  return 'Error inesperado';
}

export default api;
