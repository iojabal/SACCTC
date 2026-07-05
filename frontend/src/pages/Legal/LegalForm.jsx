// Formulario de actuacion legal (dialogo): informe legal, observacion
// legal o resolucion administrativa segun la prop "tipo".
// El backend re-valida los prerequisitos del flujo (INFO_TECNICO -> INFO_LEGAL).
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Grid, Alert, MenuItem,
} from '@mui/material';
import * as legalApi from '../../services/legalApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import {
  ETIQUETAS_ACTUACION_LEGAL, DICTAMENES_INFORME_LEGAL,
  RESULTADOS_RESOLUCION,
} from '../../utils/constants';
import {
  validarFecha, validarRequerido, validarTodo,
} from '../../utils/validators';

const VACIO = {
  fecha: '', nro_cite: '', dictamen: '', resultado: '', contenido: '',
  responsable_nombre: '', responsable_cargo: '', fecha_vencimiento: '',
};

export default function LegalForm({ abierto, tipo, caso, onCerrar, onGuardado }) {
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const esInforme = tipo === 'INFORME_LEGAL';
  const esResolucion = tipo === 'RESOLUCION';
  const requiereCite = esInforme || esResolucion;

  useEffect(() => {
    if (abierto) {
      setForm(VACIO);
      setErrores([]);
    }
  }, [abierto, tipo]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    const errs = validarTodo(
      validarFecha(form.fecha, 'Fecha', true),
      requiereCite ? validarRequerido(form.nro_cite, 'Nro. CITE') : null,
      esInforme ? validarRequerido(form.dictamen, 'Dictamen') : null,
      esResolucion ? validarRequerido(form.resultado, 'Resultado') : null,
      validarRequerido(form.contenido, 'Contenido'),
      esResolucion && form.fecha_vencimiento
        ? validarFecha(form.fecha_vencimiento, 'Fecha de vencimiento') : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = {
        fecha: form.fecha,
        nro_cite: form.nro_cite || null,
        contenido: form.contenido,
        responsable_nombre: form.responsable_nombre || null,
        responsable_cargo: form.responsable_cargo || null,
      };
      let data;
      if (esInforme) {
        payload.dictamen = form.dictamen;
        data = await legalApi.registrarInformeLegal(caso.id, payload);
        exito(`Informe legal ${form.nro_cite} registrado para el caso ${caso.id_renov}`);
      } else if (esResolucion) {
        payload.resultado = form.resultado;
        if (form.fecha_vencimiento) payload.fecha_vencimiento = form.fecha_vencimiento;
        data = await legalApi.emitirResolucion(caso.id, payload);
        exito(`Resolucion ${form.nro_cite} emitida: caso ${form.resultado}`);
      } else {
        data = await legalApi.registrarObservacion(caso.id, payload);
        exito(`Observacion legal registrada para el caso ${caso.id_renov}`);
      }
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>
        {ETIQUETAS_ACTUACION_LEGAL[tipo] || 'Actuacion Legal'}
        {caso ? ` - Caso ${caso.id_renov}` : ''}
      </DialogTitle>
      <DialogContent>
        {errores.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
        )}
        {esResolucion && (
          <Alert severity="info" sx={{ mb: 2 }}>
            La resolucion cierra el caso: APROBADA o RECHAZADA. Esta accion
            no puede deshacerse desde el area Legal.
          </Alert>
        )}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Fecha *" type="date"
              InputLabelProps={{ shrink: true }} value={form.fecha || ''}
              onChange={setCampo('fecha')} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small"
              label={requiereCite ? 'Nro. CITE *' : 'Nro. CITE'}
              value={form.nro_cite} onChange={setCampo('nro_cite')} />
          </Grid>
          {esInforme && (
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Dictamen *"
                value={form.dictamen || ''} onChange={setCampo('dictamen')}>
                {DICTAMENES_INFORME_LEGAL.map((d) => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          {esResolucion && (
            <>
              <Grid item xs={6}>
                <TextField select fullWidth size="small" label="Resultado *"
                  value={form.resultado || ''} onChange={setCampo('resultado')}>
                  {RESULTADOS_RESOLUCION.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              {form.resultado === 'APROBADA' && (
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Nueva fecha de vencimiento"
                    type="date" InputLabelProps={{ shrink: true }}
                    value={form.fecha_vencimiento || ''}
                    onChange={setCampo('fecha_vencimiento')} />
                </Grid>
              )}
            </>
          )}
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Contenido / fundamentos *"
              multiline rows={4} value={form.contenido || ''}
              onChange={setCampo('contenido')} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Responsable"
              value={form.responsable_nombre || ''}
              onChange={setCampo('responsable_nombre')}
              helperText="Vacio = usuario actual" />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Cargo del responsable"
              value={form.responsable_cargo || ''}
              onChange={setCampo('responsable_cargo')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" onClick={guardar} disabled={guardando}
          color={esResolucion ? 'secondary' : 'primary'}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
