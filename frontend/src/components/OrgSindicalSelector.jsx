// Modal de seleccion en cascada: Federacion -> Central -> Sindicato
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, InputLabel, Select, MenuItem, Stack,
} from '@mui/material';
import * as orgApi from '../services/orgSindicalApi';
import { useNotification } from '../contexts/NotificationContext';
import { mensajeDeError } from '../services/api';

export default function OrgSindicalSelector({ abierto, onCerrar, onSeleccionar }) {
  const { error } = useNotification();
  const [federaciones, setFederaciones] = useState([]);
  const [centrales, setCentrales] = useState([]);
  const [sindicatos, setSindicatos] = useState([]);
  const [idFed, setIdFed] = useState('');
  const [idCent, setIdCent] = useState('');
  const [idSind, setIdSind] = useState('');

  useEffect(() => {
    if (!abierto) return;
    orgApi.listarFederaciones()
      .then(setFederaciones)
      .catch((e) => error(mensajeDeError(e)));
  }, [abierto, error]);

  useEffect(() => {
    setCentrales([]); setSindicatos([]); setIdCent(''); setIdSind('');
    if (!idFed) return;
    orgApi.listarCentrales(idFed)
      .then(setCentrales)
      .catch((e) => error(mensajeDeError(e)));
  }, [idFed, error]);

  useEffect(() => {
    setSindicatos([]); setIdSind('');
    if (!idCent) return;
    orgApi.listarSindicatos(idCent)
      .then(setSindicatos)
      .catch((e) => error(mensajeDeError(e)));
  }, [idCent, error]);

  const confirmar = () => {
    const fed = federaciones.find((f) => f.id_fed === idFed);
    const cent = centrales.find((c) => c.id_cent === idCent);
    const sind = sindicatos.find((s) => s.id_sind === idSind);
    onSeleccionar({
      id_sind: idSind,
      sindicato: sind?.nombre,
      central: cent?.nombre,
      federacion: fed?.sigla,
      departamento: fed?.dpto,
      provincia: fed?.prov,
      municipio: fed?.mun,
    });
    onCerrar();
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Seleccionar Organizacion Sindical</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <FormControl fullWidth size="small">
            <InputLabel>Federacion</InputLabel>
            <Select value={idFed} label="Federacion"
              onChange={(e) => setIdFed(e.target.value)}>
              {federaciones.map((f) => (
                <MenuItem key={f.id_fed} value={f.id_fed}>{f.sigla}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" disabled={!idFed}>
            <InputLabel>Central</InputLabel>
            <Select value={idCent} label="Central"
              onChange={(e) => setIdCent(e.target.value)}>
              {centrales.map((c) => (
                <MenuItem key={c.id_cent} value={c.id_cent}>{c.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" disabled={!idCent}>
            <InputLabel>Sindicato</InputLabel>
            <Select value={idSind} label="Sindicato"
              onChange={(e) => setIdSind(e.target.value)}>
              {sindicatos.map((s) => (
                <MenuItem key={s.id_sind} value={s.id_sind}>{s.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" disabled={!idSind} onClick={confirmar}>
          Seleccionar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
