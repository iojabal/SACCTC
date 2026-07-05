// Detalle del plano: datos tecnicos, archivo fisico/digital, historial de
// revisiones de documentacion tecnica y acciones (actualizar, revisar,
// archivar)
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
import Inventory2Icon from '@mui/icons-material/Inventory2';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import DataTable from '../../components/DataTable';
import PlanosForm from './PlanosForm';
import * as planosApi from '../../services/planosApi';
import {
  descargarCertificadoPlano, descargarActaRevision,
} from '../../services/documentosApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import {
  formatearFecha, formatearNumero, formatearCI, textoODefecto,
} from '../../utils/formatters';
import {
  COLORES_ESTADO_PLANO, ESTADOS_PLANO_EDITABLES,
  RESULTADOS_REVISION_PLANO, puedeGestionarPlanos, puedeRevisarPlano,
} from '../../utils/constants';
import { validarFecha, validarRequerido, validarTodo } from '../../utils/validators';

const COLOR_RESULTADO_REVISION = {
  APROBADO: 'success', OBSERVADO: 'warning', RECHAZADO: 'error',
};

const COLS_REVISIONES = [
  {
    id: 'fecha_revision', etiqueta: 'F. Revision',
    render: (f) => formatearFecha(f.fecha_revision),
  },
  {
    id: 'resultado', etiqueta: 'Resultado',
    render: (f) => (
      <Chip size="small" label={f.resultado || '-'}
        color={COLOR_RESULTADO_REVISION[f.resultado] || 'default'} />
    ),
  },
  { id: 'revisor_nombre', etiqueta: 'Revisor', render: (f) => textoODefecto(f.revisor_nombre) },
  { id: 'documentacion', etiqueta: 'Documentacion recibida', render: (f) => textoODefecto(f.documentacion) },
  { id: 'observaciones', etiqueta: 'Observaciones', render: (f) => textoODefecto(f.observaciones) },
];

const REVISION_VACIA = {
  fecha_revision: '', resultado: '', documentacion: '', observaciones: '',
  revisor_nombre: '',
};

function Dato({ etiqueta, children }) {
  return (
    <Grid item xs={6} sm={4} md={3}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2">{children ?? '-'}</Typography>
    </Grid>
  );
}

/** Dialogo de revision de documentacion tecnica (patron InformeForm) */
function RevisionForm({ abierto, onCerrar, onGuardado, idPlano }) {
  const { exito, error } = useNotification();
  const [form, setForm] = useState(REVISION_VACIA);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(REVISION_VACIA);
      setErrores([]);
    }
  }, [abierto]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    const errs = validarTodo(
      validarFecha(form.fecha_revision, 'Fecha de revision', true),
      validarRequerido(form.resultado, 'Resultado'),
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const data = await planosApi.registrarRevision(idPlano, form);
      exito(`Revision registrada: plano ${data.resultado}`);
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Revision de Documentacion Tecnica</DialogTitle>
      <DialogContent>
        {errores.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
        )}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Fecha de revision *" type="date"
              InputLabelProps={{ shrink: true }} value={form.fecha_revision || ''}
              onChange={setCampo('fecha_revision')} />
          </Grid>
          <Grid item xs={6}>
            <TextField select fullWidth size="small" label="Resultado *"
              value={form.resultado || ''} onChange={setCampo('resultado')}>
              {RESULTADOS_REVISION_PLANO.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Documentacion tecnica recibida"
              multiline rows={2} value={form.documentacion || ''}
              onChange={setCampo('documentacion')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Observaciones" multiline rows={2}
              value={form.observaciones || ''} onChange={setCampo('observaciones')} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Revisor"
              value={form.revisor_nombre || ''} onChange={setCampo('revisor_nombre')}
              helperText="Vacio = usuario actual" />
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

export default function PlanosDetail() {
  const { idPlano } = useParams();
  const navigate = useNavigate();
  const { rol } = useAuth();
  const { exito, error } = useNotification();
  const [plano, setPlano] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const [ubicacion, setUbicacion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setPlano(await planosApi.obtenerPlano(idPlano));
    } catch (e) {
      error(mensajeDeError(e));
      setPlano(null);
    } finally {
      setCargando(false);
    }
  }, [idPlano, error]);

  useEffect(() => { cargar(); }, [cargar]);

  const archivar = async () => {
    setEnviando(true);
    try {
      await planosApi.archivarPlano(idPlano,
        ubicacion ? { ubicacion_fisica: ubicacion } : {});
      exito(`Plano ${plano.nro_plano} archivado`);
      setArchivando(false);
      setUbicacion('');
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
  if (!plano) {
    return (
      <Box>
        <Typography color="text.secondary">No se encontro el plano {idPlano}.</Typography>
        <Button startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/planos/lista')} sx={{ mt: 2 }}>
          Volver a la lista
        </Button>
      </Box>
    );
  }

  const revisiones = plano.revisiones || [];
  const editable = ESTADOS_PLANO_EDITABLES.includes(plano.estado);
  const gestiona = puedeGestionarPlanos(rol);
  const revisa = puedeRevisarPlano(rol);

  // Columnas de revisiones + descarga del Acta de Revision Tecnica (Word)
  const colsRevisiones = [
    ...COLS_REVISIONES,
    {
      id: 'acta', etiqueta: '', align: 'right',
      render: (f) => (
        <Tooltip title="Descargar Acta de Revision (Word)">
          <IconButton size="small" color="primary"
            onClick={(e) => {
              e.stopPropagation();
              descargarActaRevision(f.id_revision)
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
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/planos/lista')}>
            Planos
          </Button>
          <Typography variant="h5">Plano {plano.nro_plano}</Typography>
          <Chip size="small" label={plano.estado || '-'}
            color={COLORES_ESTADO_PLANO[plano.estado] || 'default'} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title={plano.estado !== 'APROBADO' && plano.estado !== 'ARCHIVADO'
            ? 'El certificado se emite cuando el plano esta APROBADO' : ''}>
            <span>
              <Button startIcon={<DescriptionIcon />}
                disabled={plano.estado !== 'APROBADO' && plano.estado !== 'ARCHIVADO'}
                onClick={() => descargarCertificadoPlano(idPlano)
                  .catch((e) => error(mensajeDeError(e)))}>
                Certificado (Word)
              </Button>
            </span>
          </Tooltip>
          {gestiona && editable && (
            <Button variant="outlined" startIcon={<EditIcon />}
              onClick={() => setEditando(true)}>
              Actualizar
            </Button>
          )}
          {revisa && plano.estado !== 'ARCHIVADO' && (
            <Button variant="outlined" startIcon={<AddIcon />}
              onClick={() => setRevisando(true)}>
              Nueva Revision
            </Button>
          )}
          {gestiona && plano.estado === 'APROBADO' && (
            <Tooltip title="Cierra el ciclo del plano (archivo fisico/digital)">
              <Button variant="contained" color="secondary"
                startIcon={<Inventory2Icon />} onClick={() => setArchivando(true)}>
                Archivar
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Dato etiqueta="Tipo">{plano.tipo}</Dato>
          <Dato etiqueta="Afiliado">
            {plano.afiliado ? (
              <Link component={RouterLink}
                to={`/afiliados/${encodeURIComponent(plano.afiliado.id_afi)}`}>
                {formatearCI(plano.afiliado.id_afi, plano.afiliado.ext)}{' - '}
                {plano.afiliado.nombre_completo}
              </Link>
            ) : textoODefecto(plano.id_afi)}
          </Dato>
          <Dato etiqueta="Cato">
            {plano.id_cato ? (
              <Link component={RouterLink} to={`/catos/${plano.id_cato}`}>
                {plano.id_cato}
              </Link>
            ) : '-'}
          </Dato>
          <Dato etiqueta="F. Registro">{formatearFecha(plano.fecha_registro)}</Dato>
          <Dato etiqueta="F. Plano">{formatearFecha(plano.fecha_plano)}</Dato>
          <Dato etiqueta="Superficie (ha)">{formatearNumero(plano.superficie)}</Dato>
          <Dato etiqueta="Coordenadas UTM">{textoODefecto(plano.coordenadas)}</Dato>
          <Dato etiqueta="Escala">{textoODefecto(plano.escala)}</Dato>
          <Dato etiqueta="Zona UTM">{textoODefecto(plano.zona_utm)}</Dato>
          <Dato etiqueta="Dibujante">{textoODefecto(plano.dibujante)}</Dato>
          <Dato etiqueta="Archivo digital">
            {plano.archivo_nombre
              ? `${plano.archivo_nombre}${plano.archivo_formato ? ` (${plano.archivo_formato})` : ''}`
              : '-'}
          </Dato>
          <Dato etiqueta="Ruta del archivo">{textoODefecto(plano.archivo_ruta)}</Dato>
          <Dato etiqueta="Ubicacion fisica">{textoODefecto(plano.ubicacion_fisica)}</Dato>
          <Dato etiqueta="Registrado por">{textoODefecto(plano.usuario)}</Dato>
          {plano.observaciones && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Observaciones</Typography>
              <Typography variant="body2">{plano.observaciones}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" mb={1}>
        Revisiones de documentacion tecnica ({revisiones.length})
      </Typography>
      <DataTable columnas={colsRevisiones} datos={revisiones}
        vacio="El plano no tiene revisiones registradas" />

      <PlanosForm
        abierto={editando}
        plano={plano}
        onCerrar={() => setEditando(false)}
        onGuardado={() => { setEditando(false); cargar(); }}
      />

      <RevisionForm
        abierto={revisando}
        idPlano={idPlano}
        onCerrar={() => setRevisando(false)}
        onGuardado={() => { setRevisando(false); cargar(); }}
      />

      <Dialog open={archivando} onClose={() => setArchivando(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Archivar plano {plano.nro_plano}</DialogTitle>
        <DialogContent>
          <DialogContentText mb={2}>
            El plano pasara al estado ARCHIVADO y ya no podra modificarse.
            Indique la ubicacion fisica si corresponde (el archivo digital
            registrado se conserva).
          </DialogContentText>
          <TextField fullWidth size="small" label="Ubicacion fisica (estante/folder)"
            value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}
            placeholder={plano.ubicacion_fisica || ''} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchivando(false)}>Cancelar</Button>
          <Button variant="contained" color="secondary" onClick={archivar}
            disabled={enviando}>
            {enviando ? 'Archivando...' : 'Archivar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
