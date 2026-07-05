// Panel principal del area Ventanilla
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardActionArea, CardContent, Typography, Box,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import MapIcon from '@mui/icons-material/Map';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useAuth } from '../contexts/AuthContext';

const MODULOS = [
  { titulo: 'Afiliados', desc: 'Gestion de afiliados: registro, edicion, historial', ruta: '/afiliados', Icono: PeopleIcon },
  { titulo: 'Cambios / Traslados', desc: 'Transferencias de catos entre afiliados', ruta: '/cambios', Icono: SwapHorizIcon },
  { titulo: 'Catastro (Catos)', desc: 'Propiedades: asignacion organica y busqueda', ruta: '/catos', Icono: MapIcon },
  { titulo: 'Control Tecnico', desc: 'Registro de mensuras y controles de cato', ruta: '/controles', Icono: FactCheckIcon },
];

export default function VentanillaHome() {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Area Ventanilla</Typography>
      <Typography color="text.secondary" mb={3}>
        Bienvenido(a), {usuario?.nombre_apellido} ({usuario?.tipo})
      </Typography>
      <Grid container spacing={2}>
        {MODULOS.map(({ titulo, desc, ruta, Icono }) => (
          <Grid item xs={12} sm={6} md={4} key={ruta}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea sx={{ height: '100%' }} onClick={() => navigate(ruta)}>
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
    </Box>
  );
}
