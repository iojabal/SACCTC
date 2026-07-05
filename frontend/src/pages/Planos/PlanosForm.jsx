// Formulario de plano (registro / actualizacion) - dialogo
// Regla legacy (FormRegistroMensura): la mensura estandar es de 0.1600 ha.
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Grid, Alert, MenuItem, InputAdornment, IconButton, Tooltip,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import AfiliadoSelector from '../../components/AfiliadoSelector';
import * as planosApi from '../../services/planosApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import {
  TIPOS_PLANO, FORMATOS_ARCHIVO_PLANO,
} from '../../utils/constants';
import {
  validarFecha, validarRequerido, validarEnteroPositivo,
  validarDecimalPositivo, validarTodo,
} from '../../utils/validators';

const VACIO = {
  nro_plano: '', id_cato: '', id_afi: '', tipo: 'MENSURA',
  fecha_registro: '', fecha_plano: '', superficie: '', coordenadas: '',
  escala: '', zona_utm: '', dibujante: '', archivo_nombre: '',
  archivo_formato: '', archivo_ruta: '', ubicacion_fisica: '',
  observaciones: '',
};

export default function PlanosForm({ abierto, onCerrar, onGuardado, plano }) {
  const esEdicion = Boolean(plano);
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [selectorAfi, setSelectorAfi] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(plano ? { ...VACIO, ...plano } : VACIO);
      setErrores([]);
    }
  }, [abierto, plano]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    const errs = validarTodo(
      validarRequerido(form.nro_plano, 'Nro. de plano'),
      validarRequerido(form.tipo, 'Tipo'),
      esEdicion ? null : validarFecha(form.fecha_registro, 'Fecha de registro', true),
      validarFecha(form.fecha_plano, 'Fecha del plano'),
      validarEnteroPositivo(form.id_cato, 'Cod. Cato'),
      validarDecimalPositivo(form.superficie, 'Superficie', false, 9999),
      form.tipo === 'MENSURA' && form.superficie !== '' &&
        Number(form.superficie) !== 0.16
        ? 'La superficie de la mensura debe ser igual a 0.1600 ha' : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = {
        nro_plano: form.nro_plano.trim(),
        tipo: form.tipo,
        id_cato: form.id_cato === '' ? null : Number(form.id_cato),
        id_afi: form.id_afi || null,
        fecha_plano: form.fecha_plano || null,
        superficie: form.superficie === '' ? null : Number(form.superficie),
        coordenadas: form.coordenadas || null,
        escala: form.escala || null,
        zona_utm: form.zona_utm || null,
        dibujante: form.dibujante || null,
        archivo_nombre: form.archivo_nombre || null,
        archivo_formato: form.archivo_formato || null,
        archivo_ruta: form.archivo_ruta || null,
        ubicacion_fisica: form.ubicacion_fisica || null,
        observaciones: form.observaciones || null,
      };
      if (!esEdicion) payload.fecha_registro = form.fecha_registro;
      const data = esEdicion
        ? await planosApi.actualizarPlano(plano.id_plano, payload)
        : await planosApi.crearPlano(payload);
      exito(esEdicion
        ? `Plano ${data.nro_plano} actualizado`
        : `Plano ${data.nro_plano} registrado`);
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
        <DialogTitle>
          {esEdicion ? `Actualizar Plano ${plano.nro_plano}` : 'Registrar Plano'}
        </DialogTitle>
        <DialogContent>
          {errores.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
          )}
          <Grid container spacing={2} mt={0}>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Nro. de plano *"
                value={form.nro_plano} onChange={setCampo('nro_plano')}
                helperText="Registro topografico" />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField select fullWidth size="small" label="Tipo *"
                value={form.tipo || ''} onChange={setCampo('tipo')}>
                {TIPOS_PLANO.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            </Grid>
            {!esEdicion && (
              <Grid item xs={6} md={3}>
                <TextField fullWidth size="small" label="Fecha de registro *"
                  type="date" InputLabelProps={{ shrink: true }}
                  value={form.fecha_registro || ''}
                  onChange={setCampo('fecha_registro')} />
              </Grid>
            )}
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Fecha del plano" type="date"
                InputLabelProps={{ shrink: true }} value={form.fecha_plano || ''}
                onChange={setCampo('fecha_plano')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Cod. Cato" type="number"
                value={form.id_cato ?? ''} onChange={setCampo('id_cato')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="CI Afiliado"
                value={form.id_afi || ''} onChange={setCampo('id_afi')}
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
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Superficie (ha)" type="number"
                inputProps={{ step: '0.0001', min: 0, max: 9999 }}
                value={form.superficie ?? ''} onChange={setCampo('superficie')}
                helperText={form.tipo === 'MENSURA' ? 'Mensura estandar: 0.1600' : ''} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Escala"
                value={form.escala || ''} onChange={setCampo('escala')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Zona UTM"
                value={form.zona_utm || ''} onChange={setCampo('zona_utm')} />
            </Grid>
            <Grid item xs={6} md={5}>
              <TextField fullWidth size="small" label="Coordenadas UTM (x-y)"
                value={form.coordenadas || ''} onChange={setCampo('coordenadas')} />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth size="small" label="Dibujante / tecnico"
                value={form.dibujante || ''} onChange={setCampo('dibujante')} />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth size="small" label="Archivo digital (nombre)"
                value={form.archivo_nombre || ''} onChange={setCampo('archivo_nombre')} />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField select fullWidth size="small" label="Formato"
                value={form.archivo_formato || ''} onChange={setCampo('archivo_formato')}>
                <MenuItem value="">(Ninguno)</MenuItem>
                {FORMATOS_ARCHIVO_PLANO.map((f) => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Ruta del archivo digital"
                value={form.archivo_ruta || ''} onChange={setCampo('archivo_ruta')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Ubicacion fisica (estante/folder)"
                value={form.ubicacion_fisica || ''} onChange={setCampo('ubicacion_fisica')} />
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

      <AfiliadoSelector
        abierto={selectorAfi}
        titulo="Buscar Afiliado del Plano"
        onCerrar={() => setSelectorAfi(false)}
        onSeleccionar={(a) => setForm((f) => ({ ...f, id_afi: a.id_afi }))}
      />
    </>
  );
}
