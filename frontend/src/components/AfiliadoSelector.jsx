// Modal de busqueda y seleccion de afiliado (por CI o nombre)
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
} from '@mui/material';
import SearchBar from './SearchBar';
import DataTable from './DataTable';
import * as afiliadosApi from '../services/afiliadosApi';
import { useNotification } from '../contexts/NotificationContext';
import { mensajeDeError } from '../services/api';
import { formatearCI, formatearFecha } from '../utils/formatters';

const COLUMNAS = [
  { id: 'ci', etiqueta: 'CI', render: (f) => formatearCI(f.id_afi, f.ext) },
  { id: 'nombre_completo', etiqueta: 'Nombre completo' },
  { id: 'fecha_nac', etiqueta: 'F. Nacimiento', render: (f) => formatearFecha(f.fecha_nac) },
  { id: 'estado', etiqueta: 'Estado' },
];

export default function AfiliadoSelector({ abierto, onCerrar, onSeleccionar, titulo }) {
  const { error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1 });
  const [criterio, setCriterio] = useState('');
  const [cargando, setCargando] = useState(false);

  const buscar = useCallback(async (q, page = 1) => {
    setCriterio(q);
    if (!q) { setDatos({ items: [], total: 0, page: 1 }); return; }
    setCargando(true);
    try {
      setDatos(await afiliadosApi.buscarAfiliados(q, page, 10));
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [error]);

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>{titulo || 'Buscar Afiliado'}</DialogTitle>
      <DialogContent>
        <Box my={1}>
          <SearchBar placeholder="CI o nombre del afiliado..." onBuscar={buscar} autoFocus />
        </Box>
        <DataTable
          columnas={COLUMNAS}
          datos={datos.items}
          cargando={cargando}
          total={datos.total}
          page={datos.page}
          perPage={10}
          onPageChange={(p) => buscar(criterio, p)}
          onRowClick={(fila) => { onSeleccionar(fila); onCerrar(); }}
          vacio={criterio ? 'Sin resultados' : 'Ingrese un criterio de busqueda'}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
}
