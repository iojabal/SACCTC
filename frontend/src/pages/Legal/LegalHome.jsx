// Panel principal del area Legal: bandeja de casos y seguimiento
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardActionArea, CardContent, Typography, Box, Paper,
  Stack, Chip, CircularProgress,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import * as legalApi from '../../services/legalApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { COLORES_ESTADO_CASO_LEGAL } from '../../utils/constants';

export default function LegalHome() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { error } = useNotification();
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setResumen(await legalApi.obtenerResumen());
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [error]);

  useEffect(() => { cargar(); }, [cargar]);

  const MODULOS = [
    {
      titulo: 'Bandeja de Casos',
      desc: 'Recepcion de informes tecnicos remitidos por el area de '
        + 'Renovaciones, revision y analisis legal de cada caso',
      Icono: GavelIcon,
      accion: () => navigate('/legal/casos'),
    },
    {
      titulo: 'Seguimiento de Tramites',
      desc: 'Estado legal de cada tramite: informes legales, observaciones '
        + 'y resoluciones administrativas archivadas',
      Icono: FactCheckIcon,
      accion: () => navigate('/legal/casos?estado=APROBADA'),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Area Legal</Typography>
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

      {cargando && (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {resumen && (
        <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" mb={1}>
            Seguimiento del estado legal ({resumen.total} tramites)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(resumen.estados || {}).map(([estado, total]) => (
              <Chip key={estado}
                label={`${estado}: ${total}`}
                color={COLORES_ESTADO_CASO_LEGAL[estado] || 'default'}
                variant={estado === 'REMITIDA_LEGAL' ? 'filled' : 'outlined'}
                onClick={() => navigate(`/legal/casos?estado=${estado}`)} />
            ))}
          </Stack>
          {resumen.pendientes_legal > 0 && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              Hay {resumen.pendientes_legal} caso(s) pendiente(s) de revision legal.
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
}
