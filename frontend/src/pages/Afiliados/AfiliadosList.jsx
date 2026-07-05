// Lista y busqueda de afiliados (69,978 registros - paginacion server-side)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
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
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const cargar = useCallback(async (q = criterio, page = 1, pp = perPage) => {
    setCargando(true);
    try {
      setDatos(await afiliadosApi.buscarAfiliados(q, page, pp));
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [criterio, perPage, error]);

  useEffect(() => { cargar('', 1); /* carga inicial */ }, []); // eslint-disable-line

  const buscar = (q) => { setCriterio(q); cargar(q, 1); };

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
        <SearchBar placeholder="Buscar por CI o nombre..." onBuscar={buscar} />
      </Box>
      <DataTable
        columnas={COLUMNAS}
        datos={datos.items}
        cargando={cargando}
        total={datos.total}
        page={datos.page}
        perPage={perPage}
        onPageChange={(p) => cargar(criterio, p)}
        onPerPageChange={(pp) => { setPerPage(pp); cargar(criterio, 1, pp); }}
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
