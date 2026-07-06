// Panel principal del area Renovaciones
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardActionArea, CardContent, Typography, Box, Paper,
  Alert, AlertTitle, Stack, CircularProgress, Chip,
} from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AfiliadoSelector from '../../components/AfiliadoSelector';
import * as renovacionesApi from '../../services/renovacionesApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearCI } from '../../utils/formatters';
import { motivosNoElegible } from '../../utils/constants';

export default function RenovacionesHome() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { error } = useNotification();
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [afiliado, setAfiliado] = useState(null);
  const [elegibilidad, setElegibilidad] = useState(null);
  const [verificando, setVerificando] = useState(false);

  const verificar = async (a) => {
    setAfiliado(a);
    setElegibilidad(null);
    setVerificando(true);
    try {
      setElegibilidad(await renovacionesApi.verificarElegibilidad(a.id_afi));
    } catch (e) {
      error(mensajeDeError(e));
      setAfiliado(null);
    } finally {
      setVerificando(false);
    }
  };

  const MODULOS = [
    {
      titulo: 'Solicitudes de Renovacion',
      desc: 'Registro, seguimiento e informes de visita tecnica',
      Icono: ListAltIcon,
      accion: () => navigate('/renovaciones/solicitudes'),
    },
    {
      titulo: 'Verificar Elegibilidad',
      desc: 'Comprueba si un afiliado puede renovar (estado, cato vigente, observaciones)',
      Icono: HowToRegIcon,
      accion: () => setSelectorAbierto(true),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Area Renovaciones</Typography>
      <Typography color="text.secondary" mb={3}>
        Bienvenido(a), {usuario?.nombre_apellido} ({usuario?.tipo})
      </Typography>
      <Grid container spacing={2}>
        {MODULOS.map(({ titulo, desc, Icono, accion }) => (
          <Grid item xs={12} sm={6} md={4} key={titulo}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea sx={{ height: '100%' }} onClick={accion}>
                <CardContent>
                  <Icono color="primary" fontSize="large" />
                  <Typography variant="h6" mt={1}>{titulo}</Typography>
                  <Typography variant="body2" color="text.secondary">{desc}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {verificando && (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {afiliado && elegibilidad && (
        <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <Typography variant="h6">
              {formatearCI(afiliado.id_afi, afiliado.ext)} - {afiliado.nombre_completo}
            </Typography>
            <Chip size="small" label={afiliado.estado || '-'} />
          </Stack>
          {elegibilidad.elegible ? (
            <Alert severity="success">
              <AlertTitle>Elegible para renovacion</AlertTitle>
              {elegibilidad.id_cato_vigente && (
                <>Cato vigente: {elegibilidad.id_cato_vigente}</>
              )}
            </Alert>
          ) : (
            <Alert severity="warning">
              <AlertTitle>No elegible para renovacion</AlertTitle>
              {motivosNoElegible(elegibilidad).join('. ')
                || 'El afiliado no cumple los requisitos para renovar.'}
            </Alert>
          )}
        </Paper>
      )}

      <AfiliadoSelector
        abierto={selectorAbierto}
        titulo="Verificar Elegibilidad de Afiliado"
        onCerrar={() => setSelectorAbierto(false)}
        onSeleccionar={verificar}
      />
    </Box>
  );
}
