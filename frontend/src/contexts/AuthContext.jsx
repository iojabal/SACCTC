// Contexto de autenticacion: usuario, rol y permisos
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as usuariosApi from '../services/usuariosApi';
import { guardarToken, obtenerToken, eliminarToken } from '../services/api';
import { puedeEscribir, puedeEliminar, esAdmin } from '../utils/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Restaurar sesion al montar
  useEffect(() => {
    const restaurar = async () => {
      if (!obtenerToken()) {
        setCargando(false);
        return;
      }
      try {
        setUsuario(await usuariosApi.perfil());
      } catch {
        eliminarToken();
      } finally {
        setCargando(false);
      }
    };
    restaurar();
  }, []);

  const login = useCallback(async (loginUsr, claveUsr) => {
    const data = await usuariosApi.login(loginUsr, claveUsr);
    guardarToken(data.access_token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(() => {
    eliminarToken();
    setUsuario(null);
  }, []);

  const valor = {
    usuario,
    cargando,
    autenticado: Boolean(usuario),
    rol: usuario?.tipo || null,
    puedeEscribir: puedeEscribir(usuario?.tipo),
    puedeEliminar: puedeEliminar(usuario?.tipo),
    esAdmin: esAdmin(usuario?.tipo),
    login,
    logout,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
