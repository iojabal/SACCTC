// Lista y busqueda de afiliados (69,978 registros - paginacion server-side)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography, FormControl, InputLabel, Select, MenuItem, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchBar from '../../components/SearchBar';
import DataTable from '../../components/DataTable';
import AfiliadoForm from './AfiliadoForm';
import * as afiliadosApi from '../../services/afiliadosApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearCI, formatearFecha } from '../../utils/formatters';

const COLUMNAS = [
  { id: 'ci', etiqueta: 'CI', render: (f) => formatearCI(f.id_afi, f.ext) },
  { id: 'apellido1', etiqueta: 'Ap. Paterno' },
  { id: 'apellido2', etiqueta: 'Ap. Materno' },
  { id: 'nombres', etiqueta: 'Nombres' },
  { id: 'fecha_nac', etiqueta: 'F. Nacimiento', render: (f) => formatearFecha(f.fecha_nac) },
  { id: 'genero', etiqueta: 'Genero' },
  { id: 'estado', etiqueta: 'Estado' },
];

export default function AfiliadosList() {
  const navigate = useNavigate();
  const { puedeEscribir } = useAuth();
  const { error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1, pages: 0 });
  const [criterio, setCriterio] = useState('');
  const [filtroCato, setFiltroCato] = useState('todos'); // 'todos', 'con_cato', 'sin_cato'
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const cargar = useCallback(async (q = criterio, page = 1, pp = perPage, filtro = filtroCato) => {
    setCargando(true);
    try {
      // Convertir el filtro a parámetro para el API
      let tieneCATO = null;
      if (filtro === 'con_cato') tieneCATO = true;
      if (filtro === 'sin_cato') tieneCATO = false;

      const resultado = await afiliadosApi.buscarAfiliados(q, page, pp, tieneCATO);
      setDatos(resultado);
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [criterio, perPage, filtroCato, error]);

  useEffect(() => { cargar('', 1, perPage, filtroCato); /* carga inicial */ }, []); // eslint-disable-line

  const buscar = (q) => { setCriterio(q); cargar(q, 1, perPage, filtroCato); };

  const manejarCambioFiltro = (nuevoFiltro) => {
    setFiltroCato(nuevoFiltro);
    cargar(criterio, 1, perPage, nuevoFiltro);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Afiliados</Typography>
        {puedeEscribir && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setFormAbierto(true)}>
            Nuevo Afiliado
          </Button>
        )}
      </Stack>
      <Box mb={2}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <SearchBar placeholder="Buscar por CI o nombre..." onBuscar={buscar} />
          </Box>
          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel>Filtro CATO</InputLabel>
            <Select
              value={filtroCato}
              label="Filtro CATO"
              onChange={(e) => manejarCambioFiltro(e.target.value)}
              disabled={cargando}
            >
              <MenuItem value="todos">Todos los afiliados</MenuItem>
              <MenuItem value="con_cato">Con CATO vigente</MenuItem>
              <MenuItem value="sin_cato">Sin CATO vigente</MenuItem>
            </Select>
          </FormControl>
          {cargando && <CircularProgress size={24} sx={{ mt: 1 }} />}
        </Stack>
      </Box>
      <DataTable
        columnas={COLUMNAS}
        datos={datos.items}
        cargando={cargando}
        total={datos.total}
        page={datos.page}
        perPage={perPage}
        onPageChange={(p) => cargar(criterio, p, perPage, filtroCato)}
        onPerPageChange={(pp) => { setPerPage(pp); cargar(criterio, 1, pp, filtroCato); }}
        onRowClick={(f) => navigate(`/afiliados/${encodeURIComponent(f.id_afi)}`)}
      />
      <AfiliadoForm
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={(a) => {
          setFormAbierto(false);
          navigate(`/afiliados/${encodeURIComponent(a.id_afi)}`);
        }}
      />
    </Box>
  );
}
