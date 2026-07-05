// Formulario de nuevo cambio (transferencia de cato entre afiliados)
// Replica FormCambios: valida titular real, observaciones y cato vigente
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Grid, Alert, InputAdornment, IconButton, Tooltip,
  Chip, Box, Typography, Divider,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AfiliadoSelector from '../../components/AfiliadoSelector';
import * as cambiosApi from '../../services/cambiosApi';
import * as catoApi from '../../services/catoApi';
import * as afiliadosApi from '../../services/afiliadosApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { TIPOS_CAMBIO, GENEROS, EXTENSIONES_CI } from '../../utils/constants';
import {
  validarCI, validarRequerido, validarFecha, validarEnteroPositivo, validarTodo,
} from '../../utils/validators';

const VACIO = {
  id_cato: '', id_afi_titular: '', id_afi_nuevo: '', tipo_cambio: '',
  codigo_docu: '', fecha_cambio: '', obs: '', resol_nro: '', resol_fecha: '',
};

// Datos basicos para dar de alta a un comprador que aun no esta afiliado
const NUEVO_AFI_VACIO = {
  ext: '', apellido1: '', apellido2: '', nombres: '', fecha_nac: '', genero: '',
};

// Color del chip segun el estado del afiliado
const colorEstado = (estado) => (estado === 'TRANSFERIDO' ? 'warning' : 'default');

export default function CambioForm({ abierto, onCerrar, onGuardado, cambio }) {
  const esEdicion = Boolean(cambio);
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [selector, setSelector] = useState(null); // 'titular' | 'nuevo' | null
  // Datos del afiliado titular/nuevo para confirmacion visual (o null)
  const [infoTitular, setInfoTitular] = useState(null);
  const [infoNuevo, setInfoNuevo] = useState(null);
  // Cuando el comprador no existe: alta inline previa a la transferencia
  const [nuevoEsAlta, setNuevoEsAlta] = useState(false);
  const [datosNuevo, setDatosNuevo] = useState(NUEVO_AFI_VACIO);

  useEffect(() => {
    if (abierto) {
      setForm(cambio ? { ...VACIO, ...cambio } : VACIO);
      setErrores([]);
      setInfoTitular(null);
      setInfoNuevo(null);
      setNuevoEsAlta(false);
      setDatosNuevo(NUEVO_AFI_VACIO);
    }
  }, [abierto, cambio]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const setCampoNuevo = (campo) => (e) =>
    setDatosNuevo((d) => ({ ...d, [campo]: e.target.value }));

  // Al ingresar el cato, autocompleta el titular actual (comportamiento legacy)
  const cargarTitular = async () => {
    if (!form.id_cato || esEdicion) return;
    try {
      const cato = await catoApi.obtenerCato(form.id_cato);
      setForm((f) => ({ ...f, id_afi_titular: cato.id_afi || '' }));
    } catch {
      // el servidor validara al guardar
    }
  };

  // Al ingresar la CI del titular: autocompleta su cato vigente (flujo inverso)
  // y muestra sus datos (nombre/estado) para confirmacion visual del funcionario.
  const cargarCatoVigente = async () => {
    if (esEdicion || validarCI(form.id_afi_titular)) return;
    // Datos del titular (nombre + estado) para el chip informativo
    try {
      const afi = await afiliadosApi.obtenerAfiliado(form.id_afi_titular);
      setInfoTitular(afi);
    } catch {
      setInfoTitular(null);
      error(`No existe el afiliado ${form.id_afi_titular}`);
      return;
    }
    // Cato vigente (solo si el campo cato aun esta vacio)
    if (form.id_cato) return;
    try {
      const r = await afiliadosApi.catoVigente(form.id_afi_titular);
      if (r.tiene_cato && r.id_cato) {
        setForm((f) => (f.id_cato ? f : { ...f, id_cato: String(r.id_cato) }));
      } else {
        error(`El afiliado ${form.id_afi_titular} no tiene cato vigente`);
      }
    } catch {
      // el servidor validara al guardar
    }
  };

  // Al ingresar la CI del comprador: si existe muestra sus datos; si no existe,
  // habilita el alta inline de sus datos basicos antes de la transferencia.
  const cargarNuevo = async () => {
    if (validarCI(form.id_afi_nuevo)) return;
    try {
      const { existe } = await afiliadosApi.existeAfiliado(form.id_afi_nuevo);
      if (existe) {
        const afi = await afiliadosApi.obtenerAfiliado(form.id_afi_nuevo);
        setInfoNuevo(afi);
        setNuevoEsAlta(false);
        setDatosNuevo(NUEVO_AFI_VACIO);
      } else {
        setInfoNuevo(null);
        setNuevoEsAlta(true); // pedir datos para darlo de alta
      }
    } catch {
      // el servidor validara al guardar
    }
  };

  const guardar = async () => {
    const errs = validarTodo(
      validarEnteroPositivo(form.id_cato, 'Cod. Cato', true),
      validarCI(form.id_afi_titular),
      validarCI(form.id_afi_nuevo),
      validarRequerido(form.tipo_cambio, 'Tipo de cambio'),
      validarFecha(form.fecha_cambio, 'Fecha del cambio', true),
      form.id_afi_titular && form.id_afi_titular === form.id_afi_nuevo
        ? 'El titular y el nuevo afiliado no pueden ser el mismo' : null,
      // Si el comprador es nuevo, exigir al menos un nombre/apellido
      nuevoEsAlta && !datosNuevo.nombres.trim() && !datosNuevo.apellido1.trim()
        && !datosNuevo.apellido2.trim()
        ? 'Registre al menos nombres o un apellido del nuevo afiliado' : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      // Si el comprador no existe, darlo de alta ANTES de registrar el cambio
      // (crearAfiliado es idempotente-seguro: si ya existiera, el backend
      // rechaza; ante fallo de la transferencia el afiliado queda creado pero
      // sin efecto sobre catos, sin dejar la transferencia a medias).
      if (nuevoEsAlta) {
        await afiliadosApi.crearAfiliado({
          id_afi: form.id_afi_nuevo,
          ...datosNuevo,
          fecha_nac: datosNuevo.fecha_nac || null,
        });
      }
      const payload = {
        ...form,
        id_cato: Number(form.id_cato),
        fecha_cambio: form.fecha_cambio,
        resol_fecha: form.resol_fecha || null,
      };
      const data = esEdicion
        ? await cambiosApi.actualizarCambio(cambio.id_trf, payload)
        : await cambiosApi.crearCambio(payload);
      exito(esEdicion ? 'Cambio actualizado'
        : `Cambio registrado: el cato ${data.id_cato} paso a ${data.id_afi_nuevo}`);
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  // Chip informativo con nombre y estado del afiliado (confirmacion visual)
  const chipInfo = (info) => (
    <Box mt={0.5} display="flex" gap={0.5} alignItems="center" flexWrap="wrap">
      <Typography variant="caption" color="text.secondary">
        {info.nombre_completo || '(sin nombre)'}
      </Typography>
      {info.estado && (
        <Chip size="small" label={info.estado} color={colorEstado(info.estado)} />
      )}
    </Box>
  );

  const botonBuscar = (destino) => (
    <InputAdornment position="end">
      <Tooltip title="Buscar afiliado">
        <IconButton size="small" onClick={() => setSelector(destino)}>
          <PersonSearchIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );

  return (
    <>
      <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
        <DialogTitle>{esEdicion ? `Editar Cambio ${cambio.id_trf}` : 'Nuevo Cambio / Traslado'}</DialogTitle>
        <DialogContent>
          {errores.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
          )}
          <Grid container spacing={2} mt={0}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Cod. Cato *" type="number"
                value={form.id_cato} onChange={setCampo('id_cato')}
                onBlur={cargarTitular} disabled={esEdicion} />
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Tipo de cambio *"
                value={form.tipo_cambio || ''} onChange={setCampo('tipo_cambio')}>
                {TIPOS_CAMBIO.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="CI Titular (vendedor) *"
                value={form.id_afi_titular}
                onChange={(e) => { setInfoTitular(null); setCampo('id_afi_titular')(e); }}
                onBlur={cargarCatoVigente}
                InputProps={{ endAdornment: botonBuscar('titular') }} />
              {infoTitular && chipInfo(infoTitular)}
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="CI Nuevo (comprador) *"
                value={form.id_afi_nuevo}
                onChange={(e) => {
                  setInfoNuevo(null); setNuevoEsAlta(false);
                  setCampo('id_afi_nuevo')(e);
                }}
                onBlur={cargarNuevo}
                InputProps={{ endAdornment: botonBuscar('nuevo') }} />
              {infoNuevo && chipInfo(infoNuevo)}
              {nuevoEsAlta && (
                <Box mt={0.5} display="flex" gap={0.5} alignItems="center">
                  <PersonAddIcon fontSize="small" color="info" />
                  <Typography variant="caption" color="info.main">
                    Afiliado nuevo: complete sus datos abajo
                  </Typography>
                </Box>
              )}
            </Grid>

            {nuevoEsAlta && !esEdicion && (
              <>
                <Grid item xs={12}>
                  <Divider textAlign="left">
                    <Typography variant="caption" color="text.secondary">
                      Datos del nuevo afiliado (comprador)
                    </Typography>
                  </Divider>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Apellido Paterno"
                    value={datosNuevo.apellido1} onChange={setCampoNuevo('apellido1')} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Apellido Materno"
                    value={datosNuevo.apellido2} onChange={setCampoNuevo('apellido2')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Nombres"
                    value={datosNuevo.nombres} onChange={setCampoNuevo('nombres')} />
                </Grid>
                <Grid item xs={4}>
                  <TextField select fullWidth size="small" label="Ext."
                    value={datosNuevo.ext} onChange={setCampoNuevo('ext')}>
                    <MenuItem value="">-</MenuItem>
                    {EXTENSIONES_CI.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={4}>
                  <TextField fullWidth size="small" label="Fecha de Nacimiento" type="date"
                    InputLabelProps={{ shrink: true }} value={datosNuevo.fecha_nac}
                    onChange={setCampoNuevo('fecha_nac')} />
                </Grid>
                <Grid item xs={4}>
                  <TextField select fullWidth size="small" label="Genero"
                    value={datosNuevo.genero} onChange={setCampoNuevo('genero')}>
                    <MenuItem value="">-</MenuItem>
                    {GENEROS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                </Grid>
              </>
            )}
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fecha del cambio *" type="date"
                InputLabelProps={{ shrink: true }} value={form.fecha_cambio || ''}
                onChange={setCampo('fecha_cambio')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Codigo documento"
                value={form.codigo_docu || ''} onChange={setCampo('codigo_docu')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Nro. Resolucion"
                value={form.resol_nro || ''} onChange={setCampo('resol_nro')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fecha Resolucion" type="date"
                InputLabelProps={{ shrink: true }} value={form.resol_fecha || ''}
                onChange={setCampo('resol_fecha')} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Observaciones" multiline rows={2}
                value={form.obs || ''} onChange={setCampo('obs')} />
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

      <AfiliadoSelector
        abierto={selector !== null}
        titulo={selector === 'titular' ? 'Buscar Titular' : 'Buscar Nuevo Afiliado'}
        onCerrar={() => setSelector(null)}
        onSeleccionar={(a) => {
          setForm((f) => ({
            ...f,
            [selector === 'titular' ? 'id_afi_titular' : 'id_afi_nuevo']: a.id_afi,
          }));
          // El afiliado elegido existe: mostrar su info y (para el comprador)
          // desactivar el alta inline
          if (selector === 'titular') {
            setInfoTitular(a);
          } else {
            setInfoNuevo(a);
            setNuevoEsAlta(false);
          }
        }}
      />
    </>
  );
}
