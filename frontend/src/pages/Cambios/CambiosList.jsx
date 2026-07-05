// Lista de cambios/traslados con filtros
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Stack, Typography, TextField, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import DataTable from '../../components/DataTable';
import CambioForm from './CambioForm';
import * as cambiosApi from '../../services/cambiosApi';
import { descargarComprobanteCambio } from '../../services/documentosApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearFecha } from '../../utils/formatters';

export default function CambiosList() {
  const { puedeEscribir, puedeEliminar } = useAuth();
  const { exito, error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1 });
  const [filtros, setFiltros] = useState({ id_cato: '', id_afi: '' });
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const cargar = useCallback(async (page = 1, pp = perPage, f = filtros) => {
    setCargando(true);
    try {
      const params = { page, per_page: pp };
      if (f.id_cato) params.id_cato = f.id_cato;
      if (f.id_afi) params.id_afi = f.id_afi;
      setDatos(await cambiosApi.listarCambios(params));
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [perPage, filtros, error]);

  useEffect(() => { cargar(1); }, []); // eslint-disable-line

  const eliminar = async (fila) => {
    // Regla legacy: solo el ultimo cambio del cato puede eliminarse
    if (!window.confirm(
      `Eliminar el cambio ${fila.id_trf} del cato ${fila.id_cato}? ` +
      'El cato volvera al titular anterior.')) return;
    try {
      const r = await cambiosApi.eliminarCambio(fila.id_trf);
      exito(`Cambio eliminado. Cato revertido a ${r.cato_revertido_a}`);
      cargar(datos.page);
    } catch (e) {
      error(mensajeDeError(e));
    }
  };

  const columnas = [
    { id: 'fecha_cambio', etiqueta: 'Fecha', render: (f) => formatearFecha(f.fecha_cambio) },
    { id: 'id_cato', etiqueta: 'Cato' },
    { id: 'id_afi_titular', etiqueta: 'CI Titular' },
    { id: 'titular_nombre', etiqueta: 'Titular' },
    { id: 'id_afi_nuevo', etiqueta: 'CI Nuevo' },
    { id: 'nuevo_nombre', etiqueta: 'Nuevo' },
    { id: 'tipo_cambio', etiqueta: 'Tipo' },
    { id: 'codigo_docu', etiqueta: 'Documento' },
    {
      id: 'comprobante', etiqueta: '', align: 'right',
      render: (f) => (
        <Tooltip title="Descargar Comprobante de Cambio (Word)">
          <IconButton size="small" color="primary"
            onClick={(e) => {
              e.stopPropagation();
              descargarComprobanteCambio(f.id_trf)
                .catch((err) => error(mensajeDeError(err)));
            }}>
            <DescriptionIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
    ...(puedeEliminar ? [{
      id: 'acciones', etiqueta: '', align: 'right',
      render: (f) => (
        <Tooltip title="Eliminar (solo el ultimo del cato)">
          <IconButton size="small" color="error"
            onClick={(e) => { e.stopPropagation(); eliminar(f); }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    }] : []),
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Cambios / Traslados</Typography>
        {puedeEscribir && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setFormAbierto(true)}>
            Nuevo Cambio
          </Button>
        )}
      </Stack>
      <Stack direction="row" spacing={2} mb={2}>
        <TextField size="small" label="Cod. Cato" type="number" value={filtros.id_cato}
          onChange={(e) => setFiltros((f) => ({ ...f, id_cato: e.target.value }))} />
        <TextField size="small" label="CI Afiliado" value={filtros.id_afi}
          onChange={(e) => setFiltros((f) => ({ ...f, id_afi: e.target.value }))} />
        <Button variant="outlined" onClick={() => cargar(1)}>Filtrar</Button>
      </Stack>
      <DataTable
        columnas={columnas}
        datos={datos.items}
        cargando={cargando}
        total={datos.total}
        page={datos.page}
        perPage={perPage}
        onPageChange={(p) => cargar(p)}
        onPerPageChange={(pp) => { setPerPage(pp); cargar(1, pp); }}
      />
      <CambioForm abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={() => { setFormAbierto(false); cargar(1); }} />
    </Box>
  );
}
