// Lista de solicitudes de renovacion con filtros por afiliado, cato y estado
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Stack, Typography, TextField, MenuItem, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DataTable from '../../components/DataTable';
import RenovacionForm from './RenovacionForm';
import * as renovacionesApi from '../../services/renovacionesApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearFecha, textoODefecto } from '../../utils/formatters';
import {
  ESTADOS_RENOVACION, COLORES_ESTADO_RENOVACION, puedeGestionarRenovaciones,
} from '../../utils/constants';

const COLUMNAS = [
  { id: 'id_renov', etiqueta: 'Nro.', align: 'right' },
  {
    id: 'fecha_solicitud', etiqueta: 'F. Solicitud',
    render: (f) => formatearFecha(f.fecha_solicitud),
  },
  { id: 'id_afi', etiqueta: 'CI Afiliado' },
  { id: 'afiliado_nombre', etiqueta: 'Afiliado', render: (f) => textoODefecto(f.afiliado_nombre) },
  { id: 'id_cato', etiqueta: 'Cato' },
  {
    id: 'vigencia_inicio', etiqueta: 'Vigencia desde',
    render: (f) => formatearFecha(f.vigencia_inicio),
  },
  {
    id: 'vigencia_fin', etiqueta: 'Vigencia hasta',
    render: (f) => formatearFecha(f.vigencia_fin),
  },
  {
    id: 'estado', etiqueta: 'Estado',
    render: (f) => (
      <Chip size="small" label={f.estado || '-'}
        color={COLORES_ESTADO_RENOVACION[f.estado] || 'default'} />
    ),
  },
];

export default function RenovacionesList() {
  const navigate = useNavigate();
  const { rol } = useAuth();
  const { error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1 });
  const [filtros, setFiltros] = useState({ id_afi: '', id_cato: '', estado: '' });
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const puedeRegistrar = puedeGestionarRenovaciones(rol);

  const cargar = useCallback(async (page = 1, pp = perPage, f = filtros) => {
    setCargando(true);
    try {
      const params = { page, per_page: pp };
      if (f.id_afi) params.id_afi = f.id_afi;
      if (f.id_cato) params.id_cato = f.id_cato;
      if (f.estado) params.estado = f.estado;
      setDatos(await renovacionesApi.listarRenovaciones(params));
    } catch (e) {
      error(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [perPage, filtros, error]);

  useEffect(() => { cargar(1); /* carga inicial */ }, []); // eslint-disable-line

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Solicitudes de Renovacion</Typography>
        {puedeRegistrar && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setFormAbierto(true)}>
            Nueva Renovacion
          </Button>
        )}
      </Stack>
      <form onSubmit={(e) => { e.preventDefault(); cargar(1); }}>
        <Stack direction="row" spacing={2} mb={2}>
          <TextField size="small" label="CI Afiliado" value={filtros.id_afi}
            onChange={(e) => setFiltros((f) => ({ ...f, id_afi: e.target.value }))}
            sx={{ width: 200 }} />
          <TextField size="small" label="Cod. Cato" type="number" value={filtros.id_cato}
            onChange={(e) => setFiltros((f) => ({ ...f, id_cato: e.target.value }))}
            sx={{ width: 180 }} />
          <TextField select size="small" label="Estado" value={filtros.estado}
            onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
            sx={{ width: 220 }}>
            <MenuItem value="">(Todos)</MenuItem>
            {ESTADOS_RENOVACION.map((e) => (
              <MenuItem key={e} value={e}>{e}</MenuItem>
            ))}
          </TextField>
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
        onRowClick={(f) => navigate(`/renovaciones/${f.id}`)}
        vacio="Sin solicitudes de renovacion"
      />
      <RenovacionForm
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={(r) => {
          setFormAbierto(false);
          if (r?.id) navigate(`/renovaciones/${r.id}`);
          else cargar(1);
        }}
      />
    </Box>
  );
}
