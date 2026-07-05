// Lista y busqueda de catos (catastro - 100K+ registros, paginacion server-side)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Stack, Typography, TextField, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DataTable from '../../components/DataTable';
import CatoForm from './CatoForm';
import * as catoApi from '../../services/catoApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { textoODefecto } from '../../utils/formatters';

const COLUMNAS = [
  { id: 'id_cato', etiqueta: 'Cod. Cato' },
  { id: 'id_afi', etiqueta: 'CI Afiliado' },
  { id: 'federacion', etiqueta: 'Federacion', render: (f) => textoODefecto(f.federacion) },
  { id: 'central', etiqueta: 'Central', render: (f) => textoODefecto(f.central) },
  { id: 'sindicato', etiqueta: 'Sindicato', render: (f) => textoODefecto(f.sindicato) },
  { id: 'tipo_aut', etiqueta: 'Tipo Aut.', render: (f) => textoODefecto(f.tipo_aut) },
  {
    id: 'estado',
    etiqueta: 'Estado',
    render: (f) => (
      <Chip size="small" label={f.estado || 'NORMAL'}
        color={f.estado === 'BLOQUEADO' ? 'error' : 'success'}
        variant="outlined" />
    ),
  },
];

export default function CatosList() {
  const navigate = useNavigate();
  const { puedeEscribir } = useAuth();
  const { error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1, pages: 0 });
  const [filtroCato, setFiltroCato] = useState('');
  const [filtroAfi, setFiltroAfi] = useState('');
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const cargar = useCallback(async (page = 1, pp = perPage) => {
    setCargando(true);
    try {
      const params = { page, per_page: pp };
      if (filtroCato) params.id_cato = filtroCato;
      if (filtroAfi) params.id_afi = filtroAfi;
      setDatos(await catoApi.listarCatos(params));
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [filtroCato, filtroAfi, perPage, error]);

  useEffect(() => { cargar(1); /* carga inicial */ }, []); // eslint-disable-line

  const buscar = (e) => {
    e?.preventDefault();
    cargar(1);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Catastro (Catos)</Typography>
        {puedeEscribir && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setFormAbierto(true)}>
            Nueva Asignacion
          </Button>
        )}
      </Stack>
      <form onSubmit={buscar}>
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
        onRowClick={(f) => navigate(`/catos/${f.id_cato}`)}
      />
      <CatoForm
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={(c) => {
          setFormAbierto(false);
          navigate(`/catos/${c.id_cato}`);
        }}
      />
    </Box>
  );
}
