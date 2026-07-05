// Formulario de alta/edicion de afiliado (modal)
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Grid, Alert,
} from '@mui/material';
import * as afiliadosApi from '../../services/afiliadosApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { GENEROS, EXTENSIONES_CI, ESTADOS_AFILIADO } from '../../utils/constants';
import { validarCI, validarFecha, validarTodo } from '../../utils/validators';

const VACIO = {
  id_afi: '', ext: '', apellido1: '', apellido2: '', nombres: '',
  fecha_nac: '', genero: '', estado: '', obs: '',
};

export default function AfiliadoForm({ abierto, onCerrar, onGuardado, afiliado }) {
  const esEdicion = Boolean(afiliado);
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(afiliado ? { ...VACIO, ...afiliado, fecha_nac: afiliado.fecha_nac || '' } : VACIO);
      setErrores([]);
    }
  }, [abierto, afiliado]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    const errs = validarTodo(
      validarCI(form.id_afi),
      validarFecha(form.fecha_nac, 'Fecha de nacimiento'),
      (!form.nombres.trim() && !form.apellido1.trim() && !form.apellido2.trim())
        ? 'Debe registrar al menos nombres o un apellido' : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = { ...form, fecha_nac: form.fecha_nac || null };
      const data = esEdicion
        ? await afiliadosApi.actualizarAfiliado(afiliado.id_afi, payload)
        : await afiliadosApi.crearAfiliado(payload);
      exito(esEdicion ? 'Afiliado actualizado' : 'Afiliado registrado');
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>{esEdicion ? `Editar Afiliado ${afiliado.id_afi}` : 'Nuevo Afiliado'}</DialogTitle>
      <DialogContent>
        {errores.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
        )}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={8}>
            <TextField fullWidth size="small" label="CI *" value={form.id_afi}
              onChange={setCampo('id_afi')} />
          </Grid>
          <Grid item xs={4}>
            <TextField select fullWidth size="small" label="Ext." value={form.ext || ''}
              onChange={setCampo('ext')}>
              <MenuItem value="">-</MenuItem>
              {EXTENSIONES_CI.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Apellido Paterno"
              value={form.apellido1 || ''} onChange={setCampo('apellido1')} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Apellido Materno"
              value={form.apellido2 || ''} onChange={setCampo('apellido2')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Nombres"
              value={form.nombres || ''} onChange={setCampo('nombres')} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Fecha de Nacimiento" type="date"
              InputLabelProps={{ shrink: true }} value={form.fecha_nac || ''}
              onChange={setCampo('fecha_nac')} />
          </Grid>
          <Grid item xs={6}>
            <TextField select fullWidth size="small" label="Genero"
              value={form.genero || ''} onChange={setCampo('genero')}>
              <MenuItem value="">-</MenuItem>
              {GENEROS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
            </TextField>
          </Grid>
          {esEdicion && (
            <Grid item xs={12}>
              <TextField select fullWidth size="small" label="Estado"
                value={form.estado || ''} onChange={setCampo('estado')}>
                <MenuItem value="">-</MenuItem>
                {ESTADOS_AFILIADO.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
          )}
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
  );
}
