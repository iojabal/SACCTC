// Formulario de asignacion organica de cato (replica FormOrgSindical:
// ProcNewAsigOrg / ProcUpdateAfiOrg). fecha_aut y solicitud_num solo
// aplican cuando tipo_aut = ADICIONAL_LEY906 (Ley 906).
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Grid, Alert, InputAdornment, IconButton, Tooltip,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AfiliadoSelector from '../../components/AfiliadoSelector';
import OrgSindicalSelector from '../../components/OrgSindicalSelector';
import * as catoApi from '../../services/catoApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { TIPOS_AUT_CATO } from '../../utils/constants';
import {
  validarCI, validarRequerido, validarFecha, validarEnteroPositivo, validarTodo,
} from '../../utils/validators';

const VACIO = {
  id_cato: '', id_afi: '', id_sind: '', tipo_aut: '', descripcion: '',
  fecha_aut: '', solicitud_num: '',
};

export default function CatoForm({ abierto, onCerrar, onGuardado, cato }) {
  const esEdicion = Boolean(cato);
  const { exito, error } = useNotification();
  const [form, setForm] = useState(VACIO);
  const [orgTexto, setOrgTexto] = useState('');
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [selectorAfi, setSelectorAfi] = useState(false);
  const [selectorOrg, setSelectorOrg] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(cato ? { ...VACIO, ...cato, fecha_aut: cato.fecha_aut || '' } : VACIO);
      setOrgTexto(cato?.sindicato
        ? [cato.federacion, cato.central, cato.sindicato].filter(Boolean).join(' / ')
        : '');
      setErrores([]);
    }
  }, [abierto, cato]);

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const esLey906 = form.tipo_aut === 'ADICIONAL_LEY906';

  const guardar = async () => {
    const errs = validarTodo(
      validarEnteroPositivo(form.id_cato, 'Cod. Cato', true),
      validarCI(form.id_afi),
      validarRequerido(form.id_sind, 'Sindicato'),
      validarRequerido(form.tipo_aut, 'Tipo de autorizacion'),
      esLey906 ? validarFecha(form.fecha_aut, 'Fecha de autorizacion', true) : null,
    );
    setErrores(errs);
    if (errs.length) return;

    setGuardando(true);
    try {
      const payload = {
        id_cato: Number(form.id_cato),
        id_afi: form.id_afi,
        id_sind: Number(form.id_sind),
        tipo_aut: form.tipo_aut,
        descripcion: form.descripcion || null,
        fecha_aut: esLey906 ? form.fecha_aut : null,
        solicitud_num: esLey906 ? form.solicitud_num || null : null,
      };
      const data = esEdicion
        ? await catoApi.actualizarCato(cato.id_cato, payload)
        : await catoApi.crearCato(payload);
      exito(esEdicion ? `Cato ${data.id_cato} actualizado`
        : `Cato ${data.id_cato} asignado a ${data.id_afi}`);
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
        <DialogTitle>
          {esEdicion ? `Editar Cato ${cato.id_cato}` : 'Nueva Asignacion de Cato'}
        </DialogTitle>
        <DialogContent>
          {errores.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>{errores.join('. ')}</Alert>
          )}
          <Grid container spacing={2} mt={0}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Cod. Cato *" type="number"
                value={form.id_cato} onChange={setCampo('id_cato')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="CI Afiliado *"
                value={form.id_afi} onChange={setCampo('id_afi')}
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
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Organizacion sindical *"
                value={orgTexto} placeholder="Seleccione federacion / central / sindicato"
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Seleccionar organizacion">
                        <IconButton size="small" onClick={() => setSelectorOrg(true)}>
                          <AccountTreeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }} />
            </Grid>
            <Grid item xs={12}>
              <TextField select fullWidth size="small" label="Tipo de autorizacion *"
                value={form.tipo_aut || ''} onChange={setCampo('tipo_aut')}>
                {TIPOS_AUT_CATO.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            {esLey906 && (
              <>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Fecha autorizacion *"
                    type="date" InputLabelProps={{ shrink: true }}
                    value={form.fecha_aut || ''} onChange={setCampo('fecha_aut')} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Nro. solicitud"
                    value={form.solicitud_num || ''}
                    onChange={setCampo('solicitud_num')} />
                </Grid>
              </>
            )}
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
      <OrgSindicalSelector
        abierto={selectorOrg}
        onCerrar={() => setSelectorOrg(false)}
        onSeleccionar={(org) => {
          setForm((f) => ({ ...f, id_sind: org.id_sind }));
          setOrgTexto([org.federacion, org.central, org.sindicato]
            .filter(Boolean).join(' / '));
        }}
      />
    </>
  );
}
