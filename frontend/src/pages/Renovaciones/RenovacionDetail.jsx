// Detalle de renovacion: replica el formulario legacy "INFORME TECNICO
// AGRIMENSOR" (FormRenovacionProgramada C#) organizado en sus secciones:
// Datos del ultimo control, Solicitud/Resultado, Causal, Cultivo Actual,
// Nuevo Cultivo y Asesoria Legal. Incluye edicion de los datos del tramite,
// informes de visita tecnica y remision al area Legal.
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Stack, Button, Chip, Divider,
  CircularProgress, Link, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, TextField, MenuItem, Alert, Tooltip,
  IconButton, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import GavelIcon from '@mui/icons-material/Gavel';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import DataTable from '../../components/DataTable';
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
  RESULTADOS_INFORME, CAUSALES_RENOVACION, puedeGestionarRenovaciones,
  puedeRegistrarInforme, puedeRemitirLegal,
} from '../../utils/constants';
import {
  validarFecha, validarRequerido, validarDecimalPositivo, validarTodo,
} from '../../utils/validators';

const COLOR_RESULTADO_INFORME = {
  FACTIBLE: 'success', NO_FACTIBLE: 'error', AUSENTE: 'warning',
};

const COLS_INFORMES = [
  { id: 'nro_informe', etiqueta: 'CITE', render: (f) => textoODefecto(f.nro_informe) },
  {
    id: 'fecha_visita', etiqueta: 'F. Visita',
    render: (f) => formatearFecha(f.fecha_visita),
  },
  {
    id: 'tecnico_nombre', etiqueta: 'Tecnico',
    render: (f) => textoODefecto(f.tecnico_nombre),
  },
  {
    id: 'superficie', etiqueta: 'Sup. (has.)', align: 'right',
    render: (f) => formatearNumero(f.superficie),
  },
  {
    id: 'resultado', etiqueta: 'Resultado',
    render: (f) => f.resultado ? (
      <Chip size="small" label={f.resultado}
        color={COLOR_RESULTADO_INFORME[f.resultado] || 'default'} />
    ) : '-',
  },
  { id: 'causal_inciso', etiqueta: 'Causal', render: (f) => textoODefecto(f.causal_inciso) },
  {
    id: 'observaciones', etiqueta: 'Observaciones',
    render: (f) => textoODefecto(f.observaciones),
  },
];

const INFORME_VACIO = {
  fecha_visita: '', resultado: '', nro_informe: '', causal_inciso: '',
  superficie: '', coordenadas: '', edad_anio: '', edad_mes: '',
  tecnico_nombre: '', tecnico_ci: '', observaciones: '',
};

// Dias entre hoy y la fecha de vencimiento ("T.Faltante" del form legacy)
function diasFaltantes(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const dias = Math.ceil(
    (new Date(`${fechaVencimiento}T00:00:00`) - new Date()) / 86400000);
  return dias;
}

function Dato({ etiqueta, xs = 6, sm = 4, md = 3, children }) {
  return (
    <Grid item xs={xs} sm={sm} md={md}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2">{children ?? '-'}</Typography>
    </Grid>
  );
}

function Seccion({ titulo }) {
  return (
    <Grid item xs={12}>
      <Divider textAlign="left" sx={{ mt: 0.5 }}>
        <Typography variant="subtitle2" color="primary">{titulo}</Typography>
      </Divider>
    </Grid>
  );
}

// ---------------------------------------------------------------------------
// Edicion de los datos del tramite (PUT /renovaciones/<id>), organizada en
// las mismas secciones del formulario legacy. Cada campo mapea 1:1 a una
// columna de renovacionprogramada0.
// ---------------------------------------------------------------------------

const SECCIONES_EDICION = [
  {
    titulo: 'Solicitud',
    campos: [
      { id: 'nro_solicitud', label: 'H.R. Nro. Sol. *' },
      { id: 'hruta_fecha', label: 'Fecha solicitud', tipo: 'fecha' },
      { id: 'tecnico_val_fecha', label: 'Fecha verificacion', tipo: 'fecha' },
      { id: 'tecnico_info_nro', label: 'Nro. Inf. Tecnico' },
      { id: 'tecnico_info_fecha', label: 'Fecha Inf. Tecnico', tipo: 'fecha' },
    ],
  },
  {
    titulo: 'Causal para la Renovacion',
    campos: [
      {
        id: 'tecnico_info_causal_inciso', label: 'Causal (inciso DS 3318)',
        tipo: 'select', opciones: CAUSALES_RENOVACION,
      },
      { id: 'tecnico', label: 'Tecnico' },
      { id: 'tecnico_cargo', label: 'Cargo' },
      {
        id: 'tecnico_info_obs', label: 'Descripcion causal',
        tipo: 'multiline', md: 12,
      },
    ],
  },
  {
    titulo: 'Datos del ultimo control',
    campos: [
      { id: 'cato_fecha_control', label: 'Fecha control', tipo: 'fecha' },
      { id: 'cato_sup', label: 'Men. (has.)', tipo: 'decimal' },
      { id: 'cato_frec', label: 'Frec.', tipo: 'entero' },
      { id: 'cato_edad_anio', label: 'Edad (anios)' },
      { id: 'cato_edad_mes', label: 'Edad (meses)' },
      { id: 'cato_utm_xy', label: 'Coordenadas (UTM)', md: 6 },
    ],
  },
  {
    titulo: 'Cultivo Actual',
    campos: [
      { id: 'lote_nro', label: 'Nro. Lote' },
      { id: 'lote_sup', label: 'Sup. Lote (has.)', tipo: 'entero' },
      { id: 'superficie', label: 'Sup. (has.)', tipo: 'decimal' },
      { id: 'frecuencia', label: 'Frec.', tipo: 'entero' },
      { id: 'edad_mes_nuevo', label: 'Edad (meses)', tipo: 'entero' },
      { id: 'ant_valoracion', label: 'Ant. valoracion', tipo: 'entero' },
      { id: 'coordenadas', label: 'Coordenadas (UTM)', md: 6 },
    ],
  },
  {
    titulo: 'Nuevo Cultivo',
    campos: [
      { id: 'renov_edad_anio', label: 'Edad (anios)', tipo: 'entero' },
      { id: 'renov_edad_mes', label: 'Edad (meses)', tipo: 'entero' },
      { id: 'renov_sup', label: 'Men. (has.)', tipo: 'decimal' },
      { id: 'renov_frec', label: 'Frec.', tipo: 'entero' },
      { id: 'renov_utm_xy', label: 'Coordenadas (UTM)', md: 6 },
      { id: 'vigencia_inicio', label: 'Inicio de vigencia', tipo: 'fecha' },
      { id: 'fecha_vencimiento', label: 'Fecha vencimiento', tipo: 'fecha' },
    ],
  },
  {
    titulo: 'Observaciones',
    campos: [
      { id: 'observacion', label: 'Observaciones', tipo: 'multiline', md: 12 },
    ],
  },
];

const CAMPOS_EDICION = SECCIONES_EDICION.flatMap((s) => s.campos);

function formDesdeRenovacion(renovacion) {
  const form = {};
  CAMPOS_EDICION.forEach(({ id }) => {
    const valor = renovacion?.[id];
    form[id] = valor === null || valor === undefined ? '' : String(valor);
  });
  // Radio Con/Sin Resolucion (booleano nullable en el backend)
  form.con_resolucion = renovacion?.con_resolucion === true ? 'con'
    : renovacion?.con_resolucion === false ? 'sin' : '';
  return form;
}

function DatosForm({ abierto, onCerrar, onGuardado, renovacion }) {
  const { exito, error } = useNotification();
  const [form, setForm] = useState({});
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(formDesdeRenovacion(renovacion));
      setErrores([]);
    }
  }, [abierto, renovacion]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    const errs = validarTodo(
      validarRequerido(form.nro_solicitud, 'H.R. Nro. Sol.'),
      form.vigencia_inicio && form.fecha_vencimiento &&
        form.fecha_vencimiento < form.vigencia_inicio
        ? 'La fecha de vencimiento no puede ser anterior al inicio de vigencia'
        : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = {};
      CAMPOS_EDICION.forEach(({ id, tipo }) => {
        const valor = (form[id] ?? '').trim();
        if (valor === '') payload[id] = null;
        else if (tipo === 'entero' || tipo === 'decimal') payload[id] = Number(valor);
        else payload[id] = valor;
      });
      payload.con_resolucion = form.con_resolucion === 'con' ? true
        : form.con_resolucion === 'sin' ? false : null;
      const data = await renovacionesApi.actualizarRenovacion(
        renovacion.id, payload);
      exito(`Renovacion ${renovacion.id_renov} actualizada`);
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>
        Editar datos de la Renovacion {renovacion?.id_renov}
      </DialogTitle>
      <DialogContent>
        {errores.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
        )}
        <Grid container spacing={2} mt={0}>
          {SECCIONES_EDICION.map(({ titulo, campos }) => (
            <React.Fragment key={titulo}>
              <Seccion titulo={titulo} />
              {campos.map(({ id, label, tipo, opciones, md = 3 }) => (
                <Grid item xs={6} md={md} key={id}>
                  {tipo === 'select' ? (
                    <TextField select fullWidth size="small" label={label}
                      value={form[id] || ''} onChange={setCampo(id)}>
                      <MenuItem value="">(Ninguna)</MenuItem>
                      {opciones.map((o) => (
                        <MenuItem key={o} value={o}>{o}</MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField fullWidth size="small" label={label}
                      type={tipo === 'fecha' ? 'date'
                        : tipo === 'entero' || tipo === 'decimal' ? 'number' : 'text'}
                      InputLabelProps={tipo === 'fecha' ? { shrink: true } : undefined}
                      inputProps={tipo === 'decimal'
                        ? { step: '0.0001', min: 0, max: 9999 }
                        : tipo === 'entero' ? { step: 1, min: 0 } : undefined}
                      multiline={tipo === 'multiline'}
                      rows={tipo === 'multiline' ? 2 : undefined}
                      value={form[id] || ''} onChange={setCampo(id)} />
                  )}
                </Grid>
              ))}
              {titulo === 'Solicitud' && (
                <Grid item xs={12} md={9}>
                  <FormControl>
                    <FormLabel sx={{ fontSize: '0.75rem' }}>Resolucion</FormLabel>
                    <RadioGroup row value={form.con_resolucion || ''}
                      onChange={setCampo('con_resolucion')}>
                      <FormControlLabel value="con" label="Con Resolucion"
                        control={<Radio size="small" />} />
                      <FormControlLabel value="sin" label="Sin Resolucion"
                        control={<Radio size="small" />} />
                      <FormControlLabel value="" label="(Sin definir)"
                        control={<Radio size="small" />} />
                    </RadioGroup>
                  </FormControl>
                </Grid>
              )}
            </React.Fragment>
          ))}
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
      validarRequerido(form.resultado, 'Resultado'),
      validarDecimalPositivo(form.superficie, 'Sup. verificada', false, 9999),
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = {
        ...form,
        superficie: form.superficie === '' ? null : Number(form.superficie),
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
            <TextField select fullWidth size="small" label="Resultado *"
              value={form.resultado || ''} onChange={setCampo('resultado')}>
              {RESULTADOS_INFORME.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Nro. Informe (CITE)"
              value={form.nro_informe || ''} onChange={setCampo('nro_informe')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField select fullWidth size="small" label="Causal (inciso)"
              value={form.causal_inciso || ''} onChange={setCampo('causal_inciso')}>
              <MenuItem value="">(Ninguna)</MenuItem>
              {CAUSALES_RENOVACION.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Sup. verificada (has.)"
              type="number" inputProps={{ step: '0.0001', min: 0, max: 9999 }}
              value={form.superficie} onChange={setCampo('superficie')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Edad (anios)"
              value={form.edad_anio || ''} onChange={setCampo('edad_anio')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Edad (meses)"
              value={form.edad_mes || ''} onChange={setCampo('edad_mes')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Coordenadas (UTM)"
              value={form.coordenadas || ''} onChange={setCampo('coordenadas')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="Tecnico"
              helperText="Vacio: usa el usuario actual"
              value={form.tecnico_nombre || ''} onChange={setCampo('tecnico_nombre')} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" label="CI Tecnico"
              value={form.tecnico_ci || ''} onChange={setCampo('tecnico_ci')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Observaciones" multiline rows={2}
              value={form.observaciones || ''} onChange={setCampo('observaciones')} />
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
      await renovacionesApi.remitirALegal(idRenov, { nota: notaLegal });
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
  const faltante = diasFaltantes(renovacion.fecha_vencimiento);

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
          {puedeRemitirLegal(rol) && renovacion.estado === 'PENDIENTE' && (
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
          <Dato etiqueta="Federacion">{textoODefecto(renovacion.federacion)}</Dato>
          <Dato etiqueta="Central">{textoODefecto(renovacion.central)}</Dato>
          <Dato etiqueta="Sindicato">{textoODefecto(renovacion.sindicato)}</Dato>
          <Dato etiqueta="Departamento">{textoODefecto(renovacion.departamento)}</Dato>
          <Dato etiqueta="Provincia">{textoODefecto(renovacion.provincia)}</Dato>
          <Dato etiqueta="Municipio">{textoODefecto(renovacion.municipio)}</Dato>
          <Dato etiqueta="Registrado por">
            {textoODefecto(renovacion.usuario_nombre)}
            {renovacion.usuario_cargo ? ` (${renovacion.usuario_cargo})` : ''}
          </Dato>
          {renovacion.fecha_destruida && (
            <Dato etiqueta="Fecha destruida">
              {formatearFecha(renovacion.fecha_destruida)}
            </Dato>
          )}

          <Seccion titulo="Datos del ultimo control" />
          <Dato etiqueta="Fecha control">
            {formatearFecha(renovacion.cato_fecha_control)}
          </Dato>
          <Dato etiqueta="Men. (has.)">{formatearNumero(renovacion.cato_sup)}</Dato>
          <Dato etiqueta="Frec.">{textoODefecto(renovacion.cato_frec)}</Dato>
          <Dato etiqueta="Edad (anios)">{textoODefecto(renovacion.cato_edad_anio)}</Dato>
          <Dato etiqueta="Edad (meses)">{textoODefecto(renovacion.cato_edad_mes)}</Dato>
          <Dato etiqueta="Coordenadas (UTM)" md={6}>
            {textoODefecto(renovacion.cato_utm_xy)}
          </Dato>

          <Seccion titulo="Solicitud / Resultado" />
          <Dato etiqueta="H.R. Nro. Sol.">{textoODefecto(renovacion.nro_solicitud)}</Dato>
          <Dato etiqueta="Fecha solicitud">{formatearFecha(renovacion.hruta_fecha)}</Dato>
          <Dato etiqueta="Fecha verificacion">
            {formatearFecha(renovacion.tecnico_val_fecha)}
          </Dato>
          <Dato etiqueta="Nro. Inf. Tecnico">
            {textoODefecto(renovacion.tecnico_info_nro)}
          </Dato>
          <Dato etiqueta="Fecha Inf. Tecnico">
            {formatearFecha(renovacion.tecnico_info_fecha)}
          </Dato>
          <Dato etiqueta="Resultado">{textoODefecto(renovacion.resultado)}</Dato>
          <Dato etiqueta="Resolucion">
            {renovacion.con_resolucion === true ? 'Con Resolucion'
              : renovacion.con_resolucion === false ? 'Sin Resolucion' : '-'}
          </Dato>
          <Dato etiqueta="Resol. Nro.">{textoODefecto(renovacion.resol_nro)}</Dato>
          <Dato etiqueta="Fecha Resol.">{formatearFecha(renovacion.resol_fecha)}</Dato>
          {renovacion.resol_obs && (
            <Dato etiqueta="Obs. Resolucion" md={6}>{renovacion.resol_obs}</Dato>
          )}

          <Seccion titulo="Causal para la Renovacion" />
          <Dato etiqueta="Causal (inciso DS 3318)">
            {textoODefecto(renovacion.tecnico_info_causal_inciso)}
          </Dato>
          <Dato etiqueta="Tecnico">{textoODefecto(renovacion.tecnico)}</Dato>
          <Dato etiqueta="Cargo">{textoODefecto(renovacion.tecnico_cargo)}</Dato>
          <Dato etiqueta="Descripcion causal" md={3}>
            {textoODefecto(renovacion.tecnico_info_obs)}
          </Dato>

          <Seccion titulo="Cultivo Actual" />
          <Dato etiqueta="Nro. Lote">{textoODefecto(renovacion.lote_nro)}</Dato>
          <Dato etiqueta="Sup. Lote (has.)">{textoODefecto(renovacion.lote_sup)}</Dato>
          <Dato etiqueta="Sup. (has.)">{formatearNumero(renovacion.superficie)}</Dato>
          <Dato etiqueta="Frec.">{textoODefecto(renovacion.frecuencia)}</Dato>
          <Dato etiqueta="Edad (meses)">{textoODefecto(renovacion.edad_mes_nuevo)}</Dato>
          <Dato etiqueta="Ant. valoracion">{textoODefecto(renovacion.ant_valoracion)}</Dato>
          <Dato etiqueta="Coordenadas (UTM)" md={6}>
            {textoODefecto(renovacion.coordenadas)}
          </Dato>

          <Seccion titulo="Nuevo Cultivo" />
          <Dato etiqueta="Edad (anios)">{textoODefecto(renovacion.renov_edad_anio)}</Dato>
          <Dato etiqueta="Edad (meses)">{textoODefecto(renovacion.renov_edad_mes)}</Dato>
          <Dato etiqueta="Men. (has.)">{formatearNumero(renovacion.renov_sup)}</Dato>
          <Dato etiqueta="Frec.">{textoODefecto(renovacion.renov_frec)}</Dato>
          <Dato etiqueta="Coordenadas (UTM)" md={6}>
            {textoODefecto(renovacion.renov_utm_xy)}
          </Dato>
          <Dato etiqueta="Inicio de vigencia">
            {formatearFecha(renovacion.vigencia_inicio)}
          </Dato>
          <Dato etiqueta="Fecha vencimiento">
            {formatearFecha(renovacion.fecha_vencimiento)}
          </Dato>
          <Dato etiqueta="T. faltante (dias)">
            {faltante === null ? '-' : faltante >= 0
              ? `${faltante} dias`
              : `Vencida hace ${Math.abs(faltante)} dias`}
          </Dato>
          <Dato etiqueta="Estado">
            <Chip size="small" label={renovacion.estado || '-'}
              color={COLORES_ESTADO_RENOVACION[renovacion.estado] || 'default'} />
          </Dato>

          <Seccion titulo="Asesoria Legal" />
          <Dato etiqueta="Nro. Inf. Legal">{textoODefecto(renovacion.legal_info_nro)}</Dato>
          <Dato etiqueta="Fecha Inf. Legal">
            {formatearFecha(renovacion.legal_info_fecha)}
          </Dato>
          <Dato etiqueta="Responsable">
            {textoODefecto(renovacion.legal_responsable)}
          </Dato>
          <Dato etiqueta="Cargo">{textoODefecto(renovacion.legal_cargo)}</Dato>
          <Dato etiqueta="Remitida a Legal">
            {formatearFecha(renovacion.remitida_legal_fecha)}
          </Dato>
          <Dato etiqueta="Remitida por">
            {textoODefecto(renovacion.remitida_legal_por)}
          </Dato>
          {renovacion.legal_info_obs && (
            <Dato etiqueta="Obs. Inf. Legal" md={6}>{renovacion.legal_info_obs}</Dato>
          )}
          {renovacion.nota_legal && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Nota Legal</Typography>
              <Typography variant="body2" whiteSpace="pre-line">
                {renovacion.nota_legal}
              </Typography>
            </Grid>
          )}

          {renovacion.observacion && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Observaciones</Typography>
              <Typography variant="body2">{renovacion.observacion}</Typography>
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

      <DatosForm
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
            Legal y el tramite pasara al estado REMITIDA_LEGAL.
          </DialogContentText>
          <TextField fullWidth size="small" label="Nota para Legal *"
            multiline rows={2} value={notaLegal}
            onChange={(e) => setNotaLegal(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemitiendo(false)}>Cancelar</Button>
          <Button variant="contained" color="secondary" onClick={remitir}
            disabled={enviando || !notaLegal.trim()}>
            {enviando ? 'Remitiendo...' : 'Remitir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
