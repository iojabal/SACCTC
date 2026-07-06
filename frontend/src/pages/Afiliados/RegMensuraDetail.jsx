// Registro de Control de Mensura (FormRegistroMensura legacy):
// datos del cato + grid "Cantidad de Controles Registrados" + radio buttons
// de estado de renovacion + CRUD de controles.
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Stack, Button, Chip, Link,
  CircularProgress, IconButton, Tooltip, Radio, RadioGroup,
  FormControlLabel, FormControl, FormLabel, TextField, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DataTable from '../../components/DataTable';
import ControlForm from '../Controles/ControlForm';
import * as catoApi from '../../services/catoApi';
import * as mensuraApi from '../../services/mensuraApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { puedeGestionarRenovacionMensura } from '../../utils/constants';
import {
  formatearFecha, formatearNumero, formatearCI, textoODefecto,
} from '../../utils/formatters';

function Dato({ etiqueta, children }) {
  return (
    <Grid item xs={6} sm={4} md={3}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2">{children ?? '-'}</Typography>
    </Grid>
  );
}

const hoy = () => new Date().toISOString().slice(0, 10);

export default function RegMensuraDetail() {
  const { idCato } = useParams();
  const navigate = useNavigate();
  const { rol, puedeEscribir, puedeEliminar } = useAuth();
  const { exito, error } = useNotification();

  const [cato, setCato] = useState(null);
  const [controles, setControles] = useState([]);
  const [renov, setRenov] = useState(null);
  const [cargando, setCargando] = useState(true);

  // CRUD de controles
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [borrando, setBorrando] = useState(false);

  // Radio buttons de renovacion
  const [dialogRenovado, setDialogRenovado] = useState(false);
  const [confirmEnCurso, setConfirmEnCurso] = useState(false);
  const [hrutaNro, setHrutaNro] = useState('');
  const [fechaDestruccion, setFechaDestruccion] = useState(hoy());
  const [guardandoRenov, setGuardandoRenov] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datosCato, listado, estadoRenov] = await Promise.all([
        catoApi.obtenerCato(idCato),
        mensuraApi.controlesPorCato(idCato),
        mensuraApi.estadoRenovacion(idCato).catch(() => null),
      ]);
      setCato(datosCato);
      setControles(listado.items || []);
      setRenov(estadoRenov);
    } catch (e) {
      error(mensajeDeError(e));
      setCato(null);
    } finally {
      setCargando(false);
    }
  }, [idCato, error]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async () => {
    setBorrando(true);
    try {
      await mensuraApi.eliminarControl(idCato, eliminando.id_cont);
      exito(`Control ${eliminando.id_cont} eliminado`);
      setEliminando(null);
      cargar();
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setBorrando(false);
    }
  };

  const ultimoControl = renov?.ultimo_control || null;
  const estadoRenov = renov?.estado || 'SIN_RENOVACION';
  // Legacy: radios habilitados solo para USR_ADMINSIS/USR_SISTEMAS/
  // USR_PLANOS/USR_INSPECCIONES y solo si hay renovacion vigente (o el
  // control ya fue marcado como renovado y debe poder revertirse).
  const puedeMarcarRenov = puedeGestionarRenovacionMensura(rol)
    && Boolean(ultimoControl)
    && (renov?.tiene_renovacion_vigente || estadoRenov === 'RENOVADO');

  const onRadio = (e) => {
    const valor = e.target.value;
    if (valor === estadoRenov) return;
    if (valor === 'RENOVADO') {
      setHrutaNro(renov?.renovacion?.nro_solicitud || '');
      setFechaDestruccion(hoy());
      setDialogRenovado(true);
    } else if (valor === 'EN_CURSO') {
      setConfirmEnCurso(true);
    }
  };

  const marcarRenovado = async () => {
    setGuardandoRenov(true);
    try {
      const data = await mensuraApi.actualizarRenovacion(
        idCato, ultimoControl.id_cont,
        { estado: 'RENOVADO', hruta_nro: hrutaNro, fecha_destruccion: fechaDestruccion });
      setRenov(data);
      setDialogRenovado(false);
      exito(`Cato ${idCato} marcado como RENOVADO (H.R. ${hrutaNro || data.ultimo_control?.hruta_nro})`);
      cargar();
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardandoRenov(false);
    }
  };

  const marcarEnCurso = async () => {
    setGuardandoRenov(true);
    try {
      const data = await mensuraApi.actualizarRenovacion(
        idCato, ultimoControl.id_cont, { estado: 'EN_CURSO' });
      setRenov(data);
      setConfirmEnCurso(false);
      exito('Renovacion revertida a "en curso"');
      cargar();
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardandoRenov(false);
    }
  };

  // Grid histórico: tabla de controles registrados (legacy "Cantidad de Controles Registrados")
  const COLUMNAS = [
    {
      id: 'id_cont', etiqueta: 'N°', align: 'right',
      render: (f) => textoODefecto(f.id_cont),
    },
    {
      id: 'hruta_nro', etiqueta: 'H. Rúa',
      render: (f) => textoODefecto(f.hruta_nro),
    },
    {
      id: 'fecha_control', etiqueta: 'Fecha Sol.',
      render: (f) => formatearFecha(f.fecha_control),
    },
    {
      id: 'nro_resolucion', etiqueta: 'Nro Resolución',
      render: (f) => textoODefecto(f.nro_resolucion),
    },
    {
      id: 'resultado', etiqueta: 'Resultado',
      render: (f) => textoODefecto(f.resultado),
    },
    // Columnas adicionales para completitud
    {
      id: 'frecuencia', etiqueta: 'Frec.',
      render: (f) => textoODefecto(f.frecuencia),
    },
    {
      id: 'edad_anio', etiqueta: 'Ed. Año', align: 'right',
      render: (f) => textoODefecto(f.edad_anio),
    },
    {
      id: 'edad_mes', etiqueta: 'Ed. Mes', align: 'right',
      render: (f) => textoODefecto(f.edad_mes),
    },
    {
      id: 'coordenadas', etiqueta: 'Coord. UTM',
      render: (f) => textoODefecto(f.coordenadas),
    },
    {
      id: 'acciones', etiqueta: '', align: 'right',
      render: (f) => (
        <Stack direction="row" justifyContent="flex-end" spacing={0}
          onClick={(e) => e.stopPropagation()}>
          {puedeEscribir && (
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => setEditando(f)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {puedeEliminar && (
            <Tooltip title="Eliminar">
              <IconButton size="small" color="error" onClick={() => setEliminando(f)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  if (cargando) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  }
  if (!cato) {
    return (
      <Box>
        <Typography color="text.secondary">No se encontro el cato {idCato}.</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Typography variant="h5">
            Registro de Control de Mensura - Cato {cato.id_cato}
          </Typography>
          <Chip size="small" label={cato.estado || 'NORMAL'}
            color={cato.estado === 'BLOQUEADO' ? 'error' : 'success'} />
        </Stack>
        <Stack direction="row" spacing={1}>
          {puedeEscribir && (
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => setFormAbierto(true)}>
              Nuevo Control
            </Button>
          )}
        </Stack>
      </Stack>

      {/* ENCABEZADO: Datos del Cato y Técnico */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Encabezado</Typography>
        <Grid container spacing={2}>
          <Dato etiqueta="Código de Cato">{textoODefecto(cato.id_cato)}</Dato>
          <Dato etiqueta="C.I./NP del Técnico">
            {cato.afiliado ? formatearCI(cato.afiliado.id_afi, cato.afiliado.ext) : textoODefecto(cato.id_afi)}
          </Dato>
          <Dato etiqueta="Expediente">{textoODefecto(cato.expediente)}</Dato>
          <Dato etiqueta="Primer Apellido">{textoODefecto(cato.primer_apellido)}</Dato>
          <Dato etiqueta="Segundo Apellido">{textoODefecto(cato.segundo_apellido)}</Dato>
          <Dato etiqueta="Nombres">{textoODefecto(cato.nombres)}</Dato>
        </Grid>
      </Paper>

      {/* ORGANIZACIÓN SINDICAL */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Organización Sindical</Typography>
        <Grid container spacing={2}>
          <Dato etiqueta="Federación">{textoODefecto(cato.federacion)}</Dato>
          <Dato etiqueta="Central">{textoODefecto(cato.central)}</Dato>
          <Dato etiqueta="Sindicato">{textoODefecto(cato.sindicato)}</Dato>
          <Dato etiqueta="Departamento">{textoODefecto(cato.departamento)}</Dato>
          <Dato etiqueta="Provincia">{textoODefecto(cato.provincia)}</Dato>
          <Dato etiqueta="Municipio">{textoODefecto(cato.municipio)}</Dato>
        </Grid>
      </Paper>

      {/* DATOS DEL ÚLTIMO CONTROL */}
      {ultimoControl && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Datos del Último Control</Typography>
          <Grid container spacing={2}>
            <Dato etiqueta="Fecha del Último Control">
              {formatearFecha(ultimoControl.fecha_control)}
            </Dato>
            <Dato etiqueta="Frecuencia">{textoODefecto(ultimoControl.frecuencia)}</Dato>
            <Dato etiqueta="NP Late">{textoODefecto(ultimoControl.np_late)}</Dato>
            <Dato etiqueta="Edad (Año)">{textoODefecto(ultimoControl.edad_anio)}</Dato>
            <Dato etiqueta="Edad (Mes)">{textoODefecto(ultimoControl.edad_mes)}</Dato>
          </Grid>
        </Paper>
      )}

      {/* COORDENADAS UTM */}
      {ultimoControl?.coordenadas && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Coordenadas (UTM)</Typography>
          <Grid container spacing={2}>
            <Dato etiqueta="Coordenadas">{textoODefecto(ultimoControl.coordenadas)}</Dato>
          </Grid>
        </Paper>
      )}

      {/* CONTROL ACTUAL (Si hay renovación) */}
      {renov?.renovacion && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Control Actual</Typography>
          <Grid container spacing={2}>
            <Dato etiqueta="Hora de No Salida">{textoODefecto(renov.renovacion.hora_no_salida)}</Dato>
            <Dato etiqueta="Fecha Solicitud">
              {renov.renovacion.fecha_solicitud ? formatearFecha(renov.renovacion.fecha_solicitud) : '-'}
            </Dato>
            <Dato etiqueta="Fecha Verificación">
              {renov.renovacion.fecha_verificacion ? formatearFecha(renov.renovacion.fecha_verificacion) : '-'}
            </Dato>
            <Dato etiqueta="Nro Hoja Técnica">{textoODefecto(renov.renovacion.nro_hoja_tecnica)}</Dato>
            <Dato etiqueta="Fecha Informe Técnico">
              {renov.renovacion.fecha_informe_tecnico ? formatearFecha(renov.renovacion.fecha_informe_tecnico) : '-'}
            </Dato>
            <Dato etiqueta="Resultado">{textoODefecto(renov.renovacion.resultado)}</Dato>
          </Grid>
        </Paper>
      )}

      {/* CAUSAL PARA RENOVACIÓN */}
      {renov?.renovacion && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Causal para Renovación</Typography>
          <Grid container spacing={2}>
            <Dato etiqueta="Causal">{textoODefecto(renov.renovacion.causal)}</Dato>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Descripción</Typography>
              <Typography variant="body2">{textoODefecto(renov.renovacion.descripcion)}</Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* CUADRO ACTUAL - Coordenadas UTM Nuevas */}
      {renov?.renovacion?.coordenadas_nuevas && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Cuadro Actual (Coordenadas UTM Nuevas)</Typography>
          <Grid container spacing={2}>
            <Dato etiqueta="Coordenadas">{textoODefecto(renov.renovacion.coordenadas_nuevas)}</Dato>
          </Grid>
        </Paper>
      )}

      {/* AMOJONAMIENTO LEGAL */}
      {ultimoControl?.hruta_nro && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Amojonamiento Legal</Typography>
          <Grid container spacing={2}>
            <Dato etiqueta="Nro Técnico">{textoODefecto(ultimoControl.hruta_nro)}</Dato>
            <Dato etiqueta="Fecha Info Tec">
              {ultimoControl.fecha_info_tec ? formatearFecha(ultimoControl.fecha_info_tec) : '-'}
            </Dato>
            <Dato etiqueta="Responsable">{textoODefecto(ultimoControl.responsable_amojonamiento)}</Dato>
            <Dato etiqueta="Cargo">{textoODefecto(ultimoControl.cargo_responsable)}</Dato>
          </Grid>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <FormControl disabled={!puedeMarcarRenov}>
          <FormLabel>Estado de renovacion</FormLabel>
          <RadioGroup row value={estadoRenov} onChange={onRadio}>
            <FormControlLabel value="EN_CURSO" control={<Radio />}
              label="Renovacion en curso" />
            <FormControlLabel value="RENOVADO" control={<Radio />}
              label="Renovado" />
          </RadioGroup>
        </FormControl>
        {estadoRenov === 'RENOVADO' && ultimoControl?.hruta_nro && (
          <Typography variant="body2" color="text.secondary">
            Hoja de ruta: {ultimoControl.hruta_nro}
          </Typography>
        )}
        {!renov?.tiene_renovacion_vigente && estadoRenov !== 'RENOVADO' && (
          <Alert severity="info" sx={{ mt: 1 }}>
            El cato no tiene una renovacion vigente registrada.
          </Alert>
        )}
        {renov?.tiene_renovacion_vigente && !puedeGestionarRenovacionMensura(rol) && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Solo Administracion, Planos e Inspecciones pueden cambiar el
            estado de renovacion.
          </Alert>
        )}
      </Paper>

      {/* GRID HISTÓRICO: Cantidad de Controles Registrados */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Grid Histórico - Cantidad de Controles Registrados: {controles.length}
        </Typography>
        <DataTable columnas={COLUMNAS} datos={controles}
          vacio="El cato no tiene controles registrados" />
      </Paper>

      <ControlForm
        abierto={formAbierto || Boolean(editando)}
        control={editando}
        idCatoInicial={idCato}
        anidado
        onCerrar={() => { setFormAbierto(false); setEditando(null); }}
        onGuardado={() => {
          setFormAbierto(false);
          setEditando(null);
          cargar();
        }}
      />

      {/* Confirmacion: marcar RENOVADO (pide hoja de ruta + fecha) */}
      <Dialog open={dialogRenovado} onClose={() => setDialogRenovado(false)}
        maxWidth="xs" fullWidth>
        <DialogTitle>Marcar cato {idCato} como RENOVADO</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Se asociara la hoja de ruta al ultimo control y se registrara la
            fecha de destruccion de la parcela renovada.
          </DialogContentText>
          <Stack spacing={2}>
            <TextField size="small" fullWidth label="Hoja de ruta Nro. *"
              value={hrutaNro} onChange={(e) => setHrutaNro(e.target.value)} />
            <TextField size="small" fullWidth type="date"
              label="Fecha de destruccion" InputLabelProps={{ shrink: true }}
              value={fechaDestruccion}
              onChange={(e) => setFechaDestruccion(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogRenovado(false)}>Cancelar</Button>
          <Button variant="contained" onClick={marcarRenovado}
            disabled={guardandoRenov || !hrutaNro.trim()}>
            {guardandoRenov ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmacion: revertir a EN_CURSO */}
      <Dialog open={confirmEnCurso} onClose={() => setConfirmEnCurso(false)}>
        <DialogTitle>Revertir a "Renovacion en curso"</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se limpiara la hoja de ruta del ultimo control y se revertira la
            fecha de destruccion de la renovacion asociada.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEnCurso(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={marcarEnCurso}
            disabled={guardandoRenov}>
            {guardandoRenov ? 'Guardando...' : 'Revertir'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmacion: eliminar control */}
      <Dialog open={Boolean(eliminando)} onClose={() => setEliminando(null)}>
        <DialogTitle>Eliminar control {eliminando?.id_cont}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se eliminara el control del {formatearFecha(eliminando?.fecha_control)}{' '}
            del cato {idCato}. Si esta vinculado a una hoja de ruta de
            renovacion, la fecha de destruccion se revertira.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEliminando(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={eliminar}
            disabled={borrando}>
            {borrando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
