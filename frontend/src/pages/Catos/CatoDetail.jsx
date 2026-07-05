// Detalle de cato: datos, titular, historial de cambios y controles tecnicos
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Stack, Button, Chip, Divider,
  CircularProgress, Link, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import DataTable from '../../components/DataTable';
import CatoForm from './CatoForm';
import * as catoApi from '../../services/catoApi';
import { descargarRegistroCatastral } from '../../services/documentosApi';
import * as cambiosApi from '../../services/cambiosApi';
import * as controlCatoApi from '../../services/controlCatoApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import api, { mensajeDeError } from '../../services/api';
import {
  formatearFecha, formatearNumero, formatearCI, textoODefecto,
} from '../../utils/formatters';

const COLS_CAMBIOS = [
  { id: 'fecha_cambio', etiqueta: 'Fecha', render: (f) => formatearFecha(f.fecha_cambio) },
  { id: 'tipo_cambio', etiqueta: 'Tipo' },
  { id: 'id_afi_titular', etiqueta: 'Titular (anterior)' },
  { id: 'id_afi_nuevo', etiqueta: 'Nuevo afiliado' },
  { id: 'codigo_docu', etiqueta: 'Documento', render: (f) => textoODefecto(f.codigo_docu) },
];

const COLS_CONTROLES = [
  { id: 'control_numero', etiqueta: 'Nro.', align: 'right' },
  { id: 'fecha_control', etiqueta: 'Fecha', render: (f) => formatearFecha(f.fecha_control) },
  {
    id: 'sup_mensura', etiqueta: 'Sup. mensura (ha)', align: 'right',
    render: (f) => formatearNumero(f.sup_mensura),
  },
  { id: 'tecnico', etiqueta: 'Tecnico', render: (f) => textoODefecto(f.tecnico) },
  { id: 'descripcion', etiqueta: 'Descripcion', render: (f) => textoODefecto(f.descripcion) },
];

function Dato({ etiqueta, children }) {
  return (
    <Grid item xs={6} sm={4} md={3}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2">{children ?? '-'}</Typography>
    </Grid>
  );
}

export default function CatoDetail() {
  const { idCato } = useParams();
  const navigate = useNavigate();
  const { puedeEscribir, puedeEliminar } = useAuth();
  const { exito, error } = useNotification();
  const [cato, setCato] = useState(null);
  const [cambios, setCambios] = useState([]);
  const [controles, setControles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datosCato, historial, listaControles] = await Promise.all([
        catoApi.obtenerCato(idCato),
        cambiosApi.historialCato(idCato).catch(() => []),
        controlCatoApi.controlesPorCato(idCato).catch(() => []),
      ]);
      setCato(datosCato);
      setCambios(Array.isArray(historial) ? historial : historial.items || []);
      setControles(Array.isArray(listaControles) ? listaControles : []);
    } catch (e) {
      error(mensajeDeError(e));
      setCato(null);
    } finally {
      setCargando(false);
    }
  }, [idCato, error]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async () => {
    setEliminando(true);
    try {
      await catoApi.eliminarCato(cato.id_cato);
      exito(`Cato ${cato.id_cato} eliminado`);
      navigate('/catos');
    } catch (e) {
      error(mensajeDeError(e));
      setConfirmando(false);
    } finally {
      setEliminando(false);
    }
  };

  const abrirPdf = async () => {
    try {
      const r = await api.get(`/reportes/cato/${idCato}/historial`,
        { responseType: 'blob' });
      window.open(URL.createObjectURL(r.data), '_blank');
    } catch (e) {
      error(mensajeDeError(e));
    }
  };

  if (cargando) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  }
  if (!cato) {
    return (
      <Box>
        <Typography color="text.secondary">No se encontro el cato {idCato}.</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/catos')} sx={{ mt: 2 }}>
          Volver a la lista
        </Button>
      </Box>
    );
  }

  const bloqueadoParaEliminar = cato.tiene_cambios || cato.tiene_controles;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/catos')}>
            Catos
          </Button>
          <Typography variant="h5">Cato {cato.id_cato}</Typography>
          <Chip size="small" label={cato.estado || 'NORMAL'}
            color={cato.estado === 'BLOQUEADO' ? 'error' : 'success'} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={abrirPdf}>
            Historial PDF
          </Button>
          <Button variant="outlined" startIcon={<DescriptionIcon />}
            onClick={() => descargarRegistroCatastral(idCato)
              .catch((e) => error(mensajeDeError(e)))}>
            Descargar Registro Catastral
          </Button>
          {puedeEscribir && (
            <Button variant="outlined" startIcon={<EditIcon />}
              onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
          {puedeEliminar && (
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />}
              disabled={bloqueadoParaEliminar}
              title={bloqueadoParaEliminar
                ? 'Tiene cambios o controles asociados' : undefined}
              onClick={() => setConfirmando(true)}>
              Eliminar
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Dato etiqueta="Titular">
            {cato.afiliado ? (
              <Link component={RouterLink}
                to={`/afiliados/${encodeURIComponent(cato.afiliado.id_afi)}`}>
                {formatearCI(cato.afiliado.id_afi, cato.afiliado.ext)}{' - '}
                {cato.afiliado.nombre_completo}
              </Link>
            ) : textoODefecto(cato.id_afi)}
          </Dato>
          <Dato etiqueta="Federacion">{textoODefecto(cato.federacion)}</Dato>
          <Dato etiqueta="Central">{textoODefecto(cato.central)}</Dato>
          <Dato etiqueta="Sindicato">{textoODefecto(cato.sindicato)}</Dato>
          <Dato etiqueta="Tipo autorizacion">{textoODefecto(cato.tipo_aut)}</Dato>
          <Dato etiqueta="Fecha autorizacion">{formatearFecha(cato.fecha_aut)}</Dato>
          <Dato etiqueta="Nro. solicitud">{textoODefecto(cato.solicitud_num)}</Dato>
          <Dato etiqueta="Registrado por">{textoODefecto(cato.nombre_usr)}</Dato>
          {cato.descripcion && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Descripcion</Typography>
              <Typography variant="body2">{cato.descripcion}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Historial de cambios ({cambios.length})
      </Typography>
      <Box mb={3}>
        <DataTable columnas={COLS_CAMBIOS} datos={cambios}
          vacio="El cato no tiene cambios registrados" />
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" gutterBottom>
        Controles tecnicos ({controles.length})
      </Typography>
      <DataTable columnas={COLS_CONTROLES} datos={controles}
        vacio="El cato no tiene controles registrados" />

      <CatoForm
        abierto={editando}
        cato={cato}
        onCerrar={() => setEditando(false)}
        onGuardado={(c) => {
          setEditando(false);
          if (String(c.id_cato) !== String(idCato)) {
            navigate(`/catos/${c.id_cato}`, { replace: true });
          } else {
            cargar();
          }
        }}
      />

      <Dialog open={confirmando} onClose={() => setConfirmando(false)}>
        <DialogTitle>Eliminar cato {cato.id_cato}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta accion elimina la asignacion organica del cato. No puede deshacerse.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={eliminar}
            disabled={eliminando}>
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
