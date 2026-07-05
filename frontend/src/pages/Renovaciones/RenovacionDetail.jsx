// Detalle de renovacion: datos, vigencia, informes de visita tecnica
// y remision al area Legal (workflow de estados)
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Stack, Button, Chip, Divider,
  CircularProgress, Link, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, TextField, MenuItem, Alert, Tooltip,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import GavelIcon from '@mui/icons-material/Gavel';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import DataTable from '../../components/DataTable';
import RenovacionForm from './RenovacionForm';
import * as renovacionesApi from '../../services/renovacionesApi';
import {
  descargarSolicitudRenovacion, descargarInformeVisita,
  descargarResolucionRenovacion,
} from '../../services/documentosApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import {
  formatearFecha, formatearNumero, formatearCI, textoODefecto,
} from '../../utils/formatters';
import {
  COLORES_ESTADO_RENOVACION, ESTADOS_RENOVACION_EDITABLES,
  RECOMENDACIONES_INFORME, puedeGestionarRenovaciones,
  puedeRegistrarInforme, puedeRemitirLegal,
} from '../../utils/constants';
import {
  validarFecha, validarRequerido, validarDecimalPositivo, validarTodo,
} from '../../utils/validators';

const COLOR_RECOMENDACION = {
  FAVORABLE: 'success', DESFAVORABLE: 'error', OBSERVADO: 'warning',
};

const COLS_INFORMES = [
  { id: 'informe_numero', etiqueta: 'Nro.', align: 'right' },
  {
    id: 'fecha_visita', etiqueta: 'F. Visita',
    render: (f) => formatearFecha(f.fecha_visita),
  },
  { id: 'tecnico', etiqueta: 'Tecnico', render: (f) => textoODefecto(f.tecnico) },
  {
    id: 'sup_verificada', etiqueta: 'Sup. verificada (ha)', align: 'right',
    render: (f) => formatearNumero(f.sup_verificada),
  },
  {
    id: 'recomendacion', etiqueta: 'Recomendacion',
    render: (f) => f.recomendacion ? (
      <Chip size="small" label={f.recomendacion}
        color={COLOR_RECOMENDACION[f.recomendacion] || 'default'} />
    ) : '-',
  },
  { id: 'hruta_nro', etiqueta: 'Hoja de ruta', render: (f) => textoODefecto(f.hruta_nro) },
  { id: 'descripcion', etiqueta: 'Descripcion', render: (f) => textoODefecto(f.descripcion) },
];

const INFORME_VACIO = {
  fecha_visita: '', tecnico: '', sup_verificada: '', coordenadas: '',
  hruta_nro: '', recomendacion: '', descripcion: '',
};

function Dato({ etiqueta, children }) {
  return (
    <Grid item xs={6} sm={4} md={3}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2">{children ?? '-'}</Typography>
    </Grid>
  );
}

/** Dialogo de registro de informe de visita tecnica (patron ControlForm) */
function InformeForm({ abierto, onCerrar, onGuardado, idRenov }) {
  const { exito, error } = useNotification();
  const [form, setForm] = useState(INFORME_VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(INFORME_VACIO);
      setErrores([]);
    }
  }, [abierto]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    const errs = validarTodo(
      validarFecha(form.fecha_visita, 'Fecha de visita', true),
      validarRequerido(form.tecnico, 'Tecnico'),
      validarDecimalPositivo(form.sup_verificada, 'Sup. verificada', false, 9999),
      validarRequerido(form.recomendacion, 'Recomendacion'),
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = {
        ...form,
        sup_verificada: form.sup_verificada === '' ? null : Number(form.sup_verificada),
      };
      const data = await renovacionesApi.crearInforme(idRenov, payload);
      exito(`Informe de visita registrado para la renovacion ${idRenov}`);
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Nuevo Informe de Visita Tecnica</DialogTitle>
      <DialogContent>
        {errores.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
        )}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Fecha de visita *" type="date"
              InputLabelProps={{ shrink: true }} value={form.fecha_visita || ''}
              onChange={setCampo('fecha_visita')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Tecnico *"
              value={form.tecnico} onChange={setCampo('tecnico')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Sup. verificada (ha)" type="number"
              inputProps={{ step: '0.0001', min: 0, max: 9999 }}
              value={form.sup_verificada} onChange={setCampo('sup_verificada')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField select fullWidth size="small" label="Recomendacion *"
              value={form.recomendacion || ''} onChange={setCampo('recomendacion')}>
              {RECOMENDACIONES_INFORME.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Coordenadas"
              value={form.coordenadas || ''} onChange={setCampo('coordenadas')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Hoja de ruta Nro."
              value={form.hruta_nro || ''} onChange={setCampo('hruta_nro')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Descripcion" multiline rows={2}
              value={form.descripcion || ''} onChange={setCampo('descripcion')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RenovacionDetail() {
  const { idRenov } = useParams();
  const navigate = useNavigate();
  const { rol } = useAuth();
  const { exito, error } = useNotification();
  const [renovacion, setRenovacion] = useState(null);
  const [informes, setInformes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [informeAbierto, setInformeAbierto] = useState(false);
  const [remitiendo, setRemitiendo] = useState(false);
  const [notaLegal, setNotaLegal] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datosRenov, listaInformes] = await Promise.all([
        renovacionesApi.obtenerRenovacion(idRenov),
        renovacionesApi.listarInformes(idRenov).catch(() => []),
      ]);
      setRenovacion(datosRenov);
      setInformes(Array.isArray(listaInformes)
        ? listaInformes : listaInformes.items || []);
    } catch (e) {
      error(mensajeDeError(e));
      setRenovacion(null);
    } finally {
      setCargando(false);
    }
  }, [idRenov, error]);

  useEffect(() => { cargar(); }, [cargar]);

  const remitir = async () => {
    setEnviando(true);
    try {
      await renovacionesApi.remitirALegal(idRenov, { obs: notaLegal || null });
      exito(`Renovacion ${idRenov} remitida al area Legal`);
      setRemitiendo(false);
      setNotaLegal('');
      cargar();
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  }
  if (!renovacion) {
    return (
      <Box>
        <Typography color="text.secondary">
          No se encontro la renovacion {idRenov}.
        </Typography>
        <Button startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/renovaciones/solicitudes')} sx={{ mt: 2 }}>
          Volver a la lista
        </Button>
      </Box>
    );
  }

  const editable = ESTADOS_RENOVACION_EDITABLES.includes(renovacion.estado);
  const sinInformes = informes.length === 0;

  const colsInformes = [
    ...COLS_INFORMES,
    {
      id: 'documento', etiqueta: '', align: 'right',
      render: (f) => (
        <Tooltip title="Descargar Informe de Visita (Word)">
          <IconButton size="small" color="primary"
            onClick={(e) => {
              e.stopPropagation();
              descargarInformeVisita(idRenov, f.id_informe)
                .catch((err) => error(mensajeDeError(err)));
            }}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/renovaciones/solicitudes')}>
            Renovaciones
          </Button>
          <Typography variant="h5">Renovacion {renovacion.id_renov}</Typography>
          <Chip size="small" label={renovacion.estado || '-'}
            color={COLORES_ESTADO_RENOVACION[renovacion.estado] || 'default'} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<DescriptionIcon />}
            onClick={() => descargarSolicitudRenovacion(idRenov)
              .catch((e) => error(mensajeDeError(e)))}>
            Solicitud (Word)
          </Button>
          <Tooltip title={sinInformes
            ? 'La renovacion no tiene informes de visita tecnica' : ''}>
            <span>
              <Button startIcon={<DescriptionIcon />} disabled={sinInformes}
                onClick={() => descargarInformeVisita(idRenov)
                  .catch((e) => error(mensajeDeError(e)))}>
                Informe Tecnico (Word)
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={!renovacion.resol_nro
            ? 'La renovacion aun no tiene resolucion emitida' : ''}>
            <span>
              <Button startIcon={<DescriptionIcon />}
                disabled={!renovacion.resol_nro}
                onClick={() => descargarResolucionRenovacion(idRenov)
                  .catch((e) => error(mensajeDeError(e)))}>
                Resolucion (Word)
              </Button>
            </span>
          </Tooltip>
          {puedeGestionarRenovaciones(rol) && editable && (
            <Button variant="outlined" startIcon={<EditIcon />}
              onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
          {puedeRemitirLegal(rol) && editable && (
            <Tooltip title={sinInformes
              ? 'Debe registrar al menos un informe de visita tecnica' : ''}>
              <span>
                <Button variant="contained" color="secondary" startIcon={<GavelIcon />}
                  disabled={sinInformes} onClick={() => setRemitiendo(true)}>
                  Remitir a Legal
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Dato etiqueta="Afiliado">
            {renovacion.afiliado ? (
              <Link component={RouterLink}
                to={`/afiliados/${encodeURIComponent(renovacion.afiliado.id_afi)}`}>
                {formatearCI(renovacion.afiliado.id_afi, renovacion.afiliado.ext)}{' - '}
                {renovacion.afiliado.nombre_completo}
              </Link>
            ) : textoODefecto(renovacion.id_afi)}
          </Dato>
          <Dato etiqueta="Cato">
            {renovacion.id_cato ? (
              <Link component={RouterLink} to={`/catos/${renovacion.id_cato}`}>
                {renovacion.id_cato}
              </Link>
            ) : '-'}
          </Dato>
          <Dato etiqueta="Fecha de solicitud">
            {formatearFecha(renovacion.fecha_solicitud)}
          </Dato>
          <Dato etiqueta="Nro. solicitud">{textoODefecto(renovacion.solicitud_num)}</Dato>
          <Dato etiqueta="Vigencia desde">{formatearFecha(renovacion.vigencia_inicio)}</Dato>
          <Dato etiqueta="Vigencia hasta">{formatearFecha(renovacion.vigencia_fin)}</Dato>
          <Dato etiqueta="Federacion">{textoODefecto(renovacion.federacion)}</Dato>
          <Dato etiqueta="Central">{textoODefecto(renovacion.central)}</Dato>
          <Dato etiqueta="Sindicato">{textoODefecto(renovacion.sindicato)}</Dato>
          <Dato etiqueta="Registrado por">{textoODefecto(renovacion.nombre_usr)}</Dato>
          {renovacion.fecha_remision_legal && (
            <Dato etiqueta="Remitida a Legal">
              {formatearFecha(renovacion.fecha_remision_legal)}
            </Dato>
          )}
          {renovacion.obs && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Observaciones</Typography>
              <Typography variant="body2">{renovacion.obs}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6">
          Informes de visita tecnica ({informes.length})
        </Typography>
        {puedeRegistrarInforme(rol) && editable && (
          <Button variant="outlined" startIcon={<AddIcon />}
            onClick={() => setInformeAbierto(true)}>
            Nuevo Informe
          </Button>
        )}
      </Stack>
      <DataTable columnas={colsInformes} datos={informes}
        vacio="La renovacion no tiene informes de visita registrados" />

      <RenovacionForm
        abierto={editando}
        renovacion={renovacion}
        onCerrar={() => setEditando(false)}
        onGuardado={() => { setEditando(false); cargar(); }}
      />

      <InformeForm
        abierto={informeAbierto}
        idRenov={idRenov}
        onCerrar={() => setInformeAbierto(false)}
        onGuardado={() => { setInformeAbierto(false); cargar(); }}
      />

      <Dialog open={remitiendo} onClose={() => setRemitiendo(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Remitir renovacion {renovacion.id_renov} al area Legal</DialogTitle>
        <DialogContent>
          <DialogContentText mb={2}>
            Se remitiran los {informes.length} informe(s) de visita tecnica al area
            Legal y el tramite pasara al estado REMITIDA_LEGAL. Luego de remitir,
            la solicitud ya no podra editarse desde esta area.
          </DialogContentText>
          <TextField fullWidth size="small" label="Nota para Legal (opcional)"
            multiline rows={2} value={notaLegal}
            onChange={(e) => setNotaLegal(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemitiendo(false)}>Cancelar</Button>
          <Button variant="contained" color="secondary" onClick={remitir}
            disabled={enviando}>
            {enviando ? 'Remitiendo...' : 'Remitir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
