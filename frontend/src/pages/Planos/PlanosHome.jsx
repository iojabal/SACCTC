// Panel principal del area Planos: registro, consulta y archivo de planos
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardActionArea, CardContent, Typography, Box,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PlanosForm from './PlanosForm';
import { useAuth } from '../../contexts/AuthContext';
import { puedeGestionarPlanos } from '../../utils/constants';

export default function PlanosHome() {
  const navigate = useNavigate();
  const { usuario, rol } = useAuth();
  const [formAbierto, setFormAbierto] = useState(false);

  const MODULOS = [
    {
      titulo: 'Consulta de Planos',
      desc: 'Busqueda de planos por numero, afiliado, cato, tipo y estado',
      Icono: MapIcon,
      accion: () => navigate('/planos/lista'),
    },
    ...(puedeGestionarPlanos(rol) ? [{
      titulo: 'Registrar Plano',
      desc: 'Registro de un plano nuevo y recepcion de su documentacion tecnica',
      Icono: AddLocationAltIcon,
      accion: () => setFormAbierto(true),
    }] : []),
    {
      titulo: 'Archivo de Planos',
      desc: 'Planos archivados: archivo fisico (estante/folder) y digital',
      Icono: Inventory2Icon,
      accion: () => navigate('/planos/lista?estado=ARCHIVADO'),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Area de Planos</Typography>
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

      <PlanosForm
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={(p) => {
          setFormAbierto(false);
          if (p?.id_plano) navigate(`/planos/${p.id_plano}`);
        }}
      />
    </Box>
  );
}
