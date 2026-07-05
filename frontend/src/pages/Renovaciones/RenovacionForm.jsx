// Formulario de solicitud de renovacion (registro / actualizacion de vigencia)
// Verifica la elegibilidad del afiliado (estado, cato vigente, observaciones)
// antes de permitir el registro. El backend re-valida al guardar.
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Grid, Alert, InputAdornment, IconButton, Tooltip,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AfiliadoSelector from '../../components/AfiliadoSelector';
import OrgSindicalSelector from '../../components/OrgSindicalSelector';
import * as renovacionesApi from '../../services/renovacionesApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import {
  validarCI, validarFecha, validarEnteroPositivo, validarTodo,
} from '../../utils/validators';

const VACIO = {
  id_afi: '', id_cato: '', fecha_solicitud: '', vigencia_inicio: '',
  vigencia_fin: '', solicitud_num: '', id_sind: '', sindicato: '',
  central: '', federacion: '', obs: '',
};

export default function RenovacionForm({ abierto, onCerrar, onGuardado, renovacion }) {
  const esEdicion = Boolean(renovacion);
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [selectorAfi, setSelectorAfi] = useState(false);
  const [selectorOrg, setSelectorOrg] = useState(false);
  const [elegibilidad, setElegibilidad] = useState(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(renovacion ? { ...VACIO, ...renovacion } : VACIO);
      setErrores([]);
      setElegibilidad(null);
    }
  }, [abierto, renovacion]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  // Verifica elegibilidad al ingresar/seleccionar el afiliado (solo en registro)
  const verificar = async (idAfi) => {
    const ci = (idAfi || '').trim();
    if (!ci || esEdicion) return null;
    setVerificando(true);
    try {
      const r = await renovacionesApi.verificarElegibilidad(ci);
      setElegibilidad(r);
      // Autocompleta el cato vigente del afiliado (comportamiento legacy)
      if (r.elegible && r.cato_vigente?.id_cato) {
        setForm((f) => ({ ...f, id_cato: f.id_cato || r.cato_vigente.id_cato }));
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
      validarFecha(form.fecha_solicitud, 'Fecha de solicitud', true),
      validarFecha(form.vigencia_inicio, 'Inicio de vigencia', true),
      validarFecha(form.vigencia_fin, 'Fin de vigencia', true),
      form.vigencia_inicio && form.vigencia_fin &&
        form.vigencia_fin <= form.vigencia_inicio
        ? 'El fin de vigencia debe ser posterior al inicio' : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      // En registro, exige elegibilidad verificada (la verifica si aun no se hizo)
      if (!esEdicion) {
        const eleg = elegibilidad || await verificar(form.id_afi);
        if (!eleg) {
          setErrores(['No se pudo verificar la elegibilidad del afiliado']);
          return;
        }
        if (!eleg.elegible) {
          setErrores([
            `El afiliado no es elegible para renovar: ${
              (eleg.motivos || []).join('. ') || 'no cumple los requisitos'}`,
          ]);
          return;
        }
      }

      const payload = {
        id_afi: form.id_afi.trim(),
        id_cato: Number(form.id_cato),
        fecha_solicitud: form.fecha_solicitud,
        vigencia_inicio: form.vigencia_inicio,
        vigencia_fin: form.vigencia_fin,
        solicitud_num: form.solicitud_num || null,
        id_sind: form.id_sind || null,
        obs: form.obs || null,
      };
      const data = esEdicion
        ? await renovacionesApi.actualizarRenovacion(renovacion.id, payload)
        : await renovacionesApi.crearRenovacion(payload);
      exito(esEdicion
        ? `Renovacion ${renovacion.id} actualizada: vigencia hasta ${form.vigencia_fin}`
        : `Renovacion registrada para el cato ${data.id_cato}`);
      onGuardado?.(data);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const textoOrg = [form.federacion, form.central, form.sindicato]
    .filter(Boolean).join(' / ');

  return (
    <>
      <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
        <DialogTitle>
          {esEdicion
            ? `Editar Renovacion ${renovacion.id}`
            : 'Nueva Solicitud de Renovacion'}
        </DialogTitle>
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
                {elegibilidad.cato_vigente?.id_cato
                  ? ` (cato vigente ${elegibilidad.cato_vigente.id_cato})` : ''}
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No elegible: {(elegibilidad.motivos || []).join('. ')
                  || 'el afiliado no cumple los requisitos'}
              </Alert>
            )
          )}
          <Grid container spacing={2} mt={0}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="CI Afiliado *"
                value={form.id_afi} onChange={setCampo('id_afi')}
                onBlur={() => verificar(form.id_afi)} disabled={esEdicion}
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
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Cod. Cato *" type="number"
                value={form.id_cato} onChange={setCampo('id_cato')}
                disabled={esEdicion} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fecha de solicitud *" type="date"
                InputLabelProps={{ shrink: true }} value={form.fecha_solicitud || ''}
                onChange={setCampo('fecha_solicitud')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Nro. solicitud"
                value={form.solicitud_num || ''} onChange={setCampo('solicitud_num')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Inicio de vigencia *" type="date"
                InputLabelProps={{ shrink: true }} value={form.vigencia_inicio || ''}
                onChange={setCampo('vigencia_inicio')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fin de vigencia *" type="date"
                InputLabelProps={{ shrink: true }} value={form.vigencia_fin || ''}
                onChange={setCampo('vigencia_fin')} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Organizacion sindical"
                value={textoOrg} InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Seleccionar organizacion sindical">
                        <IconButton size="small" onClick={() => setSelectorOrg(true)}>
                          <AccountTreeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Observaciones" multiline rows={2}
                value={form.obs || ''} onChange={setCampo('obs')} />
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

      <OrgSindicalSelector
        abierto={selectorOrg}
        onCerrar={() => setSelectorOrg(false)}
        onSeleccionar={(org) => setForm((f) => ({
          ...f,
          id_sind: org.id_sind,
          sindicato: org.sindicato,
          central: org.central,
          federacion: org.federacion,
        }))}
      />
    </>
  );
}
