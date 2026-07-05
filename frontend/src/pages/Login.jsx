import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography, Alert, Stack,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '../contexts/AuthContext';
import { mensajeDeError } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginUsr, setLoginUsr] = useState('');
  const [clave, setClave] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!loginUsr.trim() || !clave) {
      setErrorMsg('Ingrese usuario y clave');
      return;
    }
    setEnviando(true);
    try {
      await login(loginUsr.trim(), clave);
      navigate('/');
    } catch (err) {
      setErrorMsg(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"
      sx={{ bgcolor: 'grey.100' }}>
      <Paper elevation={4} sx={{ p: 4, width: 380 }}>
        <form onSubmit={enviar}>
          <Stack spacing={2} alignItems="center">
            <LockIcon color="primary" fontSize="large" />
            <Typography variant="h5">SACCTC</Typography>
            <Typography variant="body2" color="text.secondary">
              Sistema de Administracion de Catos - UDESTRO
            </Typography>
            {errorMsg && <Alert severity="error" sx={{ width: '100%' }}>{errorMsg}</Alert>}
            <TextField fullWidth size="small" label="Usuario" value={loginUsr}
              onChange={(e) => setLoginUsr(e.target.value)} autoFocus />
            <TextField fullWidth size="small" label="Clave" type="password" value={clave}
              onChange={(e) => setClave(e.target.value)} />
            <Button fullWidth type="submit" variant="contained" disabled={enviando}>
              {enviando ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
