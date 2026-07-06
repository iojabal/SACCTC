// Detalle del afiliado: datos, catos, historial de cambios, reporte PDF
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Grid, Chip, Button, Stack, Divider,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DataTable from '../../components/DataTable';
import AfiliadoForm from './AfiliadoForm';
import RenovacionForm from '../Renovaciones/RenovacionForm';
import * as afiliadosApi from '../../services/afiliadosApi';
import { descargarRegistroAfiliado } from '../../services/documentosApi';
import { abrirReporte } from '../../services/usuariosApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearFecha, formatearCI, textoODefecto } from '../../utils/formatters';

// Grid legacy "Afiliaciones Registradas" (Cato JOIN Sindicatos/Centrales/
// Federaciones); boton "Ir a Reg. Mensura" navega a pagina separada y
// "Tramite Renovacion" abre la solicitud de renovacion precargada
const colsCatos = (navigate, onRenovar) => [
  { id: 'id_cato', etiqueta: 'Cod. Cato' },
  { id: 'federacion', etiqueta: 'Federacion', render: (f) => textoODefecto(f.federacion) },
  { id: 'central', etiqueta: 'Central', render: (f) => textoODefecto(f.central) },
  { id: 'id_sind', etiqueta: 'Cod. Sind.', align: 'right' },
  { id: 'sindicato', etiqueta: 'Sindicato', render: (f) => textoODefecto(f.sindicato) },
  { id: 'tipo_aut', etiqueta: 'Tipo Aut.', render: (f) => textoODefecto(f.tipo_aut) },
  { id: 'solicitud_num', etiqueta: 'Nro. Solicitud', render: (f) => textoODefecto(f.solicitud_num) },
  { id: 'nombre_usr', etiqueta: 'Usuario', render: (f) => textoODefecto(f.nombre_usr) },
  { id: 'descripcion', etiqueta: 'Descripcion', render: (f) => textoODefecto(f.descripcion) },
  {
    id: 'acciones', etiqueta: '', align: 'right',
    render: (f) => (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button size="small" variant="outlined" startIcon={<SquareFootIcon />}
          onClick={(e) => { e.stopPropagation(); navigate(`/reg-mensura/${f.id_cato}`); }}>
          Ir a Reg. Mensura
        </Button>
        <Button size="small" variant="outlined" startIcon={<AutorenewIcon />}
          onClick={(e) => { e.stopPropagation(); onRenovar(f.id_cato); }}>
          Tramite Renovacion
        </Button>
      </Stack>
    ),
  },
];

const COLS_HISTORIAL = [
  { id: 'fecha_cambio', etiqueta: 'Fecha', render: (f) => formatearFecha(f.fecha_cambio) },
  { id: 'id_cato', etiqueta: 'Cato' },
  { id: 'id_afi_titular', etiqueta: 'CI Vendedor' },
  { id: 'id_afi_nuevo', etiqueta: 'CI Comprador' },
  { id: 'tipo_cambio', etiqueta: 'Tipo' },
  { id: 'sindicato', etiqueta: 'Sindicato' },
];

function Dato({ etiqueta, valor }) {
  return (
    <Grid item xs={6} md={4}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography>{textoODefecto(valor)}</Typography>
    </Grid>
  );
}

export default function AfiliadoDetail() {
  const { idAfi } = useParams();
  const navigate = useNavigate();
  const { puedeEscribir } = useAuth();
  const { error } = useNotification();
  const [afiliado, setAfiliado] = useState(null);
  const [catos, setCatos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  // Valores iniciales para "Tramite Renovacion" ({ id_afi, id_cato } o null);
  // en estado para mantener identidad estable mientras el dialogo esta abierto
  const [renovInicial, setRenovInicial] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datos, afiliaciones, hist] = await Promise.all([
        afiliadosApi.obtenerAfiliado(idAfi),
        afiliadosApi.catosDeAfiliado(idAfi),
        afiliadosApi.historialAfiliado(idAfi),
      ]);
      setAfiliado(datos);
      setCatos(afiliaciones.items || []);
      setHistorial(hist);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [idAfi, error]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  }
  if (!afiliado) return <Typography>Afiliado no encontrado</Typography>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/afiliados')}>
            Volver
          </Button>
          <Typography variant="h5">
            {afiliado.nombre_completo} ({formatearCI(afiliado.id_afi, afiliado.ext)})
          </Typography>
          {afiliado.observaciones_pendientes > 0 && (
            <Chip color="warning" size="small"
              label={`${afiliado.observaciones_pendientes} obs. pendiente(s)`} />
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<PictureAsPdfIcon />}
            onClick={() => abrirReporte(`afiliado/${encodeURIComponent(idAfi)}`)
              .catch((e) => error(mensajeDeError(e)))}>
            Ficha PDF
          </Button>
          <Button startIcon={<DescriptionIcon />}
            onClick={() => descargarRegistroAfiliado(idAfi)
              .catch((e) => error(mensajeDeError(e)))}>
            Descargar Registro de Afiliados
          </Button>
          {puedeEscribir && (
            <Button variant="contained" startIcon={<EditIcon />}
              onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Dato etiqueta="CI" valor={formatearCI(afiliado.id_afi, afiliado.ext)} />
          <Dato etiqueta="Fecha de nacimiento" valor={formatearFecha(afiliado.fecha_nac)} />
          <Dato etiqueta="Genero" valor={afiliado.genero} />
          <Dato etiqueta="Estado" valor={afiliado.estado} />
          <Dato etiqueta="Cato vigente" valor={afiliado.tiene_cato_vigente ? 'SI' : 'NO'} />
          <Dato etiqueta="Observaciones" valor={afiliado.obs} />
        </Grid>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Afiliaciones Registradas ({catos.length})
      </Typography>
      <DataTable
        columnas={colsCatos(navigate, (idCato) => setRenovInicial({ id_afi: idAfi, id_cato: idCato }))}
        datos={catos}
        onRowClick={(f) => navigate(`/catos/${f.id_cato}`)}
        vacio="El afiliado no tiene catos registrados" />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>Historial de cambios (ProcHistAfi)</Typography>
      <DataTable columnas={COLS_HISTORIAL} datos={historial}
        vacio="Sin cambios registrados" />

      <AfiliadoForm abierto={editando} afiliado={afiliado}
        onCerrar={() => setEditando(false)}
        onGuardado={(a) => {
          setEditando(false);
          if (a.id_afi !== idAfi) {
            navigate(`/afiliados/${encodeURIComponent(a.id_afi)}`, { replace: true });
          } else {
            cargar();
          }
        }} />

      <RenovacionForm abierto={Boolean(renovInicial)} inicial={renovInicial}
        onCerrar={() => setRenovInicial(null)}
        onGuardado={(r) => {
          setRenovInicial(null);
          if (r?.id) navigate(`/renovaciones/${r.id}`);
        }} />
    </Box>
  );
}
