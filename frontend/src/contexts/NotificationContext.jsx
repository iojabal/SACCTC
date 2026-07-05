// Notificaciones globales (snackbar MUI)
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [estado, setEstado] = useState({ abierto: false, mensaje: '', tipo: 'info' });

  const notificar = useCallback((mensaje, tipo = 'info') => {
    setEstado({ abierto: true, mensaje, tipo });
  }, []);

  const exito = useCallback((m) => notificar(m, 'success'), [notificar]);
  const error = useCallback((m) => notificar(m, 'error'), [notificar]);
  const aviso = useCallback((m) => notificar(m, 'warning'), [notificar]);

  const cerrar = (_e, razon) => {
    if (razon === 'clickaway') return;
    setEstado((s) => ({ ...s, abierto: false }));
  };

  return (
    <NotificationContext.Provider value={{ notificar, exito, error, aviso }}>
      {children}
      <Snackbar
        open={estado.abierto}
        autoHideDuration={5000}
        onClose={cerrar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={cerrar} severity={estado.tipo} variant="filled" sx={{ width: '100%' }}>
          {estado.mensaje}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification debe usarse dentro de <NotificationProvider>');
  return ctx;
}
