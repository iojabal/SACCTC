// Barra de navegacion superior con menu de modulos y sesion
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem,
  Chip, Tooltip,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';

const ENLACES = [
  { etiqueta: 'Inicio', ruta: '/' },
  { etiqueta: 'Afiliados', ruta: '/afiliados' },
  { etiqueta: 'Cambios', ruta: '/cambios' },
  { etiqueta: 'Catos', ruta: '/catos' },
  { etiqueta: 'Controles', ruta: '/controles' },
  { etiqueta: 'Renovaciones', ruta: '/renovaciones' },
  { etiqueta: 'Legal', ruta: '/legal' },
  { etiqueta: 'Planos', ruta: '/planos' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const salir = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  const esActiva = (ruta) =>
    ruta === '/' ? location.pathname === '/' : location.pathname.startsWith(ruta);

  return (
    <AppBar position="sticky">
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ mr: 3, cursor: 'pointer' }}
          onClick={() => navigate('/')}>
          SACCTC
        </Typography>
        <Box sx={{ flexGrow: 1, display: 'flex', gap: 0.5 }}>
          {ENLACES.map(({ etiqueta, ruta }) => (
            <Button key={ruta} color="inherit" size="small"
              onClick={() => navigate(ruta)}
              sx={esActiva(ruta)
                ? { borderBottom: '2px solid white', borderRadius: 0 }
                : undefined}>
              {etiqueta}
            </Button>
          ))}
        </Box>
        {usuario && (
          <>
            <Chip size="small" label={usuario.tipo}
              sx={{ color: 'white', borderColor: 'white', mr: 1 }}
              variant="outlined" />
            <Tooltip title={usuario.nombre_apellido}>
              <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <AccountCircleIcon />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}>
              <MenuItem disabled>
                {usuario.nombre_apellido} ({usuario.login_usr})
              </MenuItem>
              <MenuItem onClick={salir}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Cerrar sesion
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
