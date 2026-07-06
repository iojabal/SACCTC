// Formulario de solicitud de renovacion (registro del tramite).
// Verifica la elegibilidad del afiliado (estado, cato vigente, observaciones)
// antes de permitir el registro. El backend re-valida al guardar y toma el
// snapshot del ultimo control y de la organizacion sindical del cato.
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Grid, Alert, InputAdornment, IconButton, Tooltip,
  Paper, Typography,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import AfiliadoSelector from '../../components/AfiliadoSelector';
import * as renovacionesApi from '../../services/renovacionesApi';
import * as afiliadosApi from '../../services/afiliadosApi';
import * as catoApi from '../../services/catoApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { motivosNoElegible } from '../../utils/constants';
import {
  validarCI, validarFecha, validarEnteroPositivo, validarRequerido,
  validarTodo,
} from '../../utils/validators';

const VACIO = {
  id_afi: '', id_cato: '', hruta_fecha: '', nro_solicitud: '',
  vigencia_inicio: '', fecha_vencimiento: '', observacion: '',
};

// Dato de solo lectura de la ficha identificatoria (mismo patron que
// CatoDetail/CambiosList)
function Dato({ etiqueta, xs = 6, sm = 4, children }) {
  return (
    <Grid item xs={xs} sm={sm}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2">{children ?? '-'}</Typography>
    </Grid>
  );
}

// `inicial` (opcional): valores precargados (p.ej. al iniciar el tramite
// desde la ficha del afiliado con { id_afi, id_cato }); dispara la
// verificacion de elegibilidad al abrir.
export default function RenovacionForm({ abierto, onCerrar, onGuardado, inicial }) {
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [selectorAfi, setSelectorAfi] = useState(false);
  const [elegibilidad, setElegibilidad] = useState(null);
  const [verificando, setVerificando] = useState(false);
  // Ficha identificatoria (encabezado legacy): afiliado + cato, solo lectura
  const [ficha, setFicha] = useState(null);

  // Carga la ficha cuando hay CI y cato validos (autocompletado por
  // verificar(), precargado via `inicial` o tipeado a mano). Debounce corto
  // para no consultar en cada tecla; errores se ignoran porque la ficha es
  // solo informativa (el backend re-valida al guardar).
  useEffect(() => {
    const idAfi = (form.id_afi || '').trim();
    const idCato = form.id_cato;
    if (!abierto || !idAfi || !idCato) {
      setFicha(null);
      return undefined;
    }
    let cancelado = false;
    const timer = setTimeout(async () => {
      try {
        const [afiliado, cato] = await Promise.all([
          afiliadosApi.obtenerAfiliado(idAfi),
          catoApi.obtenerCato(idCato),
        ]);
        if (!cancelado) setFicha({ afiliado, cato });
      } catch {
        if (!cancelado) setFicha(null);
      }
    }, 400);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [abierto, form.id_afi, form.id_cato]);

  useEffect(() => {
    if (abierto) {
      setForm({ ...VACIO, ...inicial });
      setErrores([]);
      setElegibilidad(null);
      // Con valores precargados, verifica la elegibilidad automaticamente
      if (inicial?.id_afi) verificar(inicial.id_afi);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, inicial]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  // Verifica elegibilidad al ingresar/seleccionar el afiliado
  const verificar = async (idAfi) => {
    const ci = (idAfi || '').trim();
    if (!ci) return null;
    setVerificando(true);
    try {
      const r = await renovacionesApi.verificarElegibilidad(ci);
      setElegibilidad(r);
      // Autocompleta el cato vigente del afiliado (comportamiento legacy)
      if (r.elegible && r.id_cato_vigente) {
        setForm((f) => ({ ...f, id_cato: f.id_cato || r.id_cato_vigente }));
      }
      return r;
    } catch (e) {
      setElegibilidad(null);
      error(mensajeDeError(e));
      return null;
    } finally {
      setVerificando(false);
    }
  };

  const seleccionarAfiliado = (a) => {
    setForm((f) => ({ ...f, id_afi: a.id_afi }));
    verificar(a.id_afi);
  };

  const guardar = async () => {
    const errs = validarTodo(
      validarCI(form.id_afi),
      validarEnteroPositivo(form.id_cato, 'Cod. Cato', true),
      validarRequerido(form.nro_solicitud, 'H.R. Nro. Sol.'),
      validarFecha(form.hruta_fecha, 'Fecha de solicitud', true),
      validarFecha(form.vigencia_inicio, 'Inicio de vigencia'),
      validarFecha(form.fecha_vencimiento, 'Fecha de vencimiento'),
      form.vigencia_inicio && form.fecha_vencimiento &&
        form.fecha_vencimiento <= form.vigencia_inicio
        ? 'La fecha de vencimiento debe ser posterior al inicio de vigencia'
        : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      // Exige elegibilidad verificada (la verifica si aun no se hizo)
      const eleg = elegibilidad || await verificar(form.id_afi);
      if (!eleg) {
        setErrores(['No se pudo verificar la elegibilidad del afiliado']);
        return;
      }
      if (!eleg.elegible) {
        setErrores([
          `El afiliado no es elegible para renovar: ${
            motivosNoElegible(eleg).join('. ') || 'no cumple los requisitos'}`,
        ]);
        return;
      }

      const payload = {
        id_afi: form.id_afi.trim(),
        id_cato: Number(form.id_cato),
        nro_solicitud: form.nro_solicitud.trim(),
        hruta_fecha: form.hruta_fecha,
        vigencia_inicio: form.vigencia_inicio || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        observacion: form.observacion || null,
      };
      const data = await renovacionesApi.crearRenovacion(payload);
      exito(`Renovacion registrada para el cato ${data.id_cato}`);
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Solicitud de Renovacion</DialogTitle>
        <DialogContent>
          {errores.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
          )}
          {verificando && (
            <Alert severity="info" sx={{ mb: 2 }}>Verificando elegibilidad...</Alert>
          )}
          {!verificando && elegibilidad && (
            elegibilidad.elegible ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                Afiliado elegible para renovacion
                {elegibilidad.id_cato_vigente
                  ? ` (cato vigente ${elegibilidad.id_cato_vigente})` : ''}
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No elegible: {motivosNoElegible(elegibilidad).join('. ')
                  || 'el afiliado no cumple los requisitos'}
              </Alert>
            )
          )}
          {ficha && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'action.hover' }}>
              <Typography variant="overline" color="text.secondary">
                Datos del afiliado y cato
              </Typography>
              <Grid container spacing={1}>
                <Dato etiqueta="Afiliado" xs={12} sm={8}>
                  {ficha.afiliado.nombre_completo}
                </Dato>
                <Dato etiqueta="C.I. Nro.">
                  {[ficha.afiliado.id_afi, ficha.afiliado.ext]
                    .filter(Boolean).join(' ')}
                </Dato>
                <Dato etiqueta="Cod. Cato">{ficha.cato.id_cato}</Dato>
                <Dato etiqueta="Estado cato">{ficha.cato.estado}</Dato>
                <Dato etiqueta="Federacion">{ficha.cato.federacion}</Dato>
                <Dato etiqueta="Central">{ficha.cato.central}</Dato>
                <Dato etiqueta="Sindicato">{ficha.cato.sindicato}</Dato>
              </Grid>
            </Paper>
          )}
          <Grid container spacing={2} mt={0}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="CI Afiliado *"
                value={form.id_afi} onChange={setCampo('id_afi')}
                onBlur={() => verificar(form.id_afi)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Buscar afiliado">
                        <IconButton size="small" onClick={() => setSelectorAfi(true)}>
                          <PersonSearchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Cod. Cato *" type="number"
                value={form.id_cato} onChange={setCampo('id_cato')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="H.R. Nro. Sol. *"
                value={form.nro_solicitud || ''}
                onChange={setCampo('nro_solicitud')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fecha de solicitud *" type="date"
                InputLabelProps={{ shrink: true }} value={form.hruta_fecha || ''}
                onChange={setCampo('hruta_fecha')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Inicio de vigencia" type="date"
                InputLabelProps={{ shrink: true }} value={form.vigencia_inicio || ''}
                onChange={setCampo('vigencia_inicio')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fecha de vencimiento" type="date"
                InputLabelProps={{ shrink: true }} value={form.fecha_vencimiento || ''}
                onChange={setCampo('fecha_vencimiento')} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Observaciones" multiline rows={2}
                value={form.observacion || ''} onChange={setCampo('observacion')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button variant="contained" onClick={guardar}
            disabled={guardando || verificando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <AfiliadoSelector
        abierto={selectorAfi}
        titulo="Buscar Afiliado a Renovar"
        onCerrar={() => setSelectorAfi(false)}
        onSeleccionar={seleccionarAfiliado}
      />
    </>
  );
}
