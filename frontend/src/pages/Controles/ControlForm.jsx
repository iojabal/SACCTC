// Formulario de control tecnico / registro de mensura
// Replica FormRegistroMensura: ProcControlCato_New / ProcUpdateControlCato.
// El backend valida que no exista otro control del cato en la misma fecha.
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Grid, Alert, InputAdornment, IconButton, Tooltip,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import AfiliadoSelector from '../../components/AfiliadoSelector';
import * as controlCatoApi from '../../services/controlCatoApi';
import * as mensuraApi from '../../services/mensuraApi';
import * as catoApi from '../../services/catoApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import {
  validarCI, validarFecha, validarEnteroPositivo, validarDecimalPositivo,
  validarTodo,
} from '../../utils/validators';

const VACIO = {
  id_cato: '', id_afi: '', fecha_control: '', sup_mensura: '', frecuencia: '',
  num_lote: '', sup_lote: '', coordenadas: '', tecnico: '', descripcion: '',
  edad_anio: '', edad_mes: '', hruta_nro: '',
};

// anidado=true usa los endpoints REST anidados bajo el cato
// (POST/PUT /api/catos/{id_cato}/controles) del Registro de Mensura.
export default function ControlForm({
  abierto, onCerrar, onGuardado, control, idCatoInicial, anidado = false,
}) {
  const esEdicion = Boolean(control);
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [selectorAfi, setSelectorAfi] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(control
        ? { ...VACIO, ...control }
        : { ...VACIO, id_cato: idCatoInicial || '' });
      setErrores([]);
    }
  }, [abierto, control, idCatoInicial]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  // Al ingresar el cato, autocompleta el titular vigente (comportamiento legacy)
  const cargarTitular = async () => {
    if (!form.id_cato || esEdicion || form.id_afi) return;
    try {
      const cato = await catoApi.obtenerCato(form.id_cato);
      setForm((f) => ({ ...f, id_afi: cato.id_afi || '' }));
    } catch {
      // el servidor validara al guardar
    }
  };

  const guardar = async () => {
    const errs = validarTodo(
      validarEnteroPositivo(form.id_cato, 'Cod. Cato', true),
      validarCI(form.id_afi),
      validarFecha(form.fecha_control, 'Fecha del control', true),
      validarDecimalPositivo(form.sup_mensura, 'Sup. mensura', true, 9999),
      validarEnteroPositivo(form.frecuencia, 'Frecuencia'),
      validarEnteroPositivo(form.num_lote, 'Nro. lote'),
      validarEnteroPositivo(form.sup_lote, 'Sup. lote'),
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = {
        ...form,
        id_cato: Number(form.id_cato),
        sup_mensura: Number(form.sup_mensura),
        frecuencia: form.frecuencia === '' ? null : Number(form.frecuencia),
        num_lote: form.num_lote === '' ? null : Number(form.num_lote),
        sup_lote: form.sup_lote === '' ? null : Number(form.sup_lote),
      };
      let data;
      if (esEdicion) {
        data = anidado
          ? await mensuraApi.actualizarControl(payload.id_cato, control.id_cont, payload)
          : await controlCatoApi.actualizarControl(control.id_cont, payload);
      } else {
        data = anidado
          ? await mensuraApi.crearControl(payload.id_cato, payload)
          : await controlCatoApi.crearControl(payload);
      }
      exito(esEdicion ? 'Control actualizado'
        : `Control Nro. ${data.control_numero} registrado para el cato ${data.id_cato}`);
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
          {esEdicion ? `Editar Control ${control.id_cont}` : 'Nuevo Control Tecnico'}
        </DialogTitle>
        <DialogContent>
          {errores.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
          )}
          <Grid container spacing={2} mt={0}>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Cod. Cato *" type="number"
                value={form.id_cato} onChange={setCampo('id_cato')}
                onBlur={cargarTitular} disabled={esEdicion} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="CI Afiliado *"
                value={form.id_afi} onChange={setCampo('id_afi')}
                disabled={esEdicion}
                InputProps={{
                  endAdornment: !esEdicion && (
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
              <TextField fullWidth size="small" label="Fecha del control *" type="date"
                InputLabelProps={{ shrink: true }} value={form.fecha_control || ''}
                onChange={setCampo('fecha_control')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Sup. mensura (ha) *" type="number"
                inputProps={{ step: '0.0001', min: 0, max: 9999 }}
                value={form.sup_mensura} onChange={setCampo('sup_mensura')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Frecuencia" type="number"
                value={form.frecuencia ?? ''} onChange={setCampo('frecuencia')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Nro. lote" type="number"
                value={form.num_lote ?? ''} onChange={setCampo('num_lote')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Sup. lote (m2)" type="number"
                value={form.sup_lote ?? ''} onChange={setCampo('sup_lote')} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Coordenadas"
                value={form.coordenadas || ''} onChange={setCampo('coordenadas')} />
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
              <TextField fullWidth size="small" label="Tecnico"
                value={form.tecnico || ''} onChange={setCampo('tecnico')} />
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

      <AfiliadoSelector
        abierto={selectorAfi}
        onCerrar={() => setSelectorAfi(false)}
        onSeleccionar={(a) => setForm((f) => ({ ...f, id_afi: a.id_afi }))}
      />
    </>
  );
}
