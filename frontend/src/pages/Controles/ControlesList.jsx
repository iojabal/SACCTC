// Lista de controles tecnicos (mensuras) con filtros por cato y afiliado
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Stack, Typography, TextField, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DataTable from '../../components/DataTable';
import ControlForm from './ControlForm';
import * as controlCatoApi from '../../services/controlCatoApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearFecha, formatearNumero, textoODefecto } from '../../utils/formatters';

export default function ControlesList() {
  const { puedeEscribir, puedeEliminar } = useAuth();
  const { exito, error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1, pages: 0 });
  const [filtroCato, setFiltroCato] = useState('');
  const [filtroAfi, setFiltroAfi] = useState('');
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async (page = 1, pp = perPage) => {
    setCargando(true);
    try {
      const params = { page, per_page: pp };
      if (filtroCato) params.id_cato = filtroCato;
      if (filtroAfi) params.id_afi = filtroAfi;
      setDatos(await controlCatoApi.listarControles(params));
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [filtroCato, filtroAfi, perPage, error]);

  useEffect(() => { cargar(1); /* carga inicial */ }, []); // eslint-disable-line

  const eliminar = async () => {
    setBorrando(true);
    try {
      await controlCatoApi.eliminarControl(eliminando.id_cont);
      exito(`Control ${eliminando.id_cont} eliminado`);
      setEliminando(null);
      cargar(datos.page);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setBorrando(false);
    }
  };

  const COLUMNAS = [
    { id: 'id_cato', etiqueta: 'Cod. Cato' },
    { id: 'id_afi', etiqueta: 'CI Afiliado' },
    { id: 'control_numero', etiqueta: 'Nro.', align: 'right' },
    {
      id: 'fecha_control', etiqueta: 'Fecha',
      render: (f) => formatearFecha(f.fecha_control),
    },
    {
      id: 'sup_mensura', etiqueta: 'Sup. mensura (ha)', align: 'right',
      render: (f) => formatearNumero(f.sup_mensura),
    },
    { id: 'tecnico', etiqueta: 'Tecnico', render: (f) => textoODefecto(f.tecnico) },
    { id: 'usuario', etiqueta: 'Usuario', render: (f) => textoODefecto(f.usuario) },
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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Controles Tecnicos</Typography>
        {puedeEscribir && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setFormAbierto(true)}>
            Nuevo Control
          </Button>
        )}
      </Stack>
      <form onSubmit={(e) => { e.preventDefault(); cargar(1); }}>
        <Stack direction="row" spacing={2} mb={2}>
          <TextField size="small" label="Cod. Cato" type="number" value={filtroCato}
            onChange={(e) => setFiltroCato(e.target.value)} sx={{ width: 180 }} />
          <TextField size="small" label="CI Afiliado" value={filtroAfi}
            onChange={(e) => setFiltroAfi(e.target.value)} sx={{ width: 200 }} />
          <Button type="submit" variant="outlined" startIcon={<SearchIcon />}>
            Buscar
          </Button>
        </Stack>
      </form>
      <DataTable
        columnas={COLUMNAS}
        datos={datos.items}
        cargando={cargando}
        total={datos.total}
        page={datos.page}
        perPage={perPage}
        onPageChange={(p) => cargar(p)}
        onPerPageChange={(pp) => { setPerPage(pp); cargar(1, pp); }}
      />

      <ControlForm
        abierto={formAbierto || Boolean(editando)}
        control={editando}
        onCerrar={() => { setFormAbierto(false); setEditando(null); }}
        onGuardado={() => {
          setFormAbierto(false);
          setEditando(null);
          cargar(datos.page);
        }}
      />

      <Dialog open={Boolean(eliminando)} onClose={() => setEliminando(null)}>
        <DialogTitle>Eliminar control {eliminando?.id_cont}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se eliminara el control Nro. {eliminando?.control_numero} del cato{' '}
            {eliminando?.id_cato}. Si esta vinculado a una hoja de ruta de
            renovacion, la fecha de destruccion se revertira.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEliminando(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={eliminar} disabled={borrando}>
            {borrando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
