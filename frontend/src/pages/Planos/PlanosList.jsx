// Consulta de planos con filtros por numero, afiliado, cato, tipo y estado
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Stack, Typography, TextField, MenuItem, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DataTable from '../../components/DataTable';
import PlanosForm from './PlanosForm';
import * as planosApi from '../../services/planosApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearFecha, formatearNumero, textoODefecto } from '../../utils/formatters';
import {
  TIPOS_PLANO, ESTADOS_PLANO, COLORES_ESTADO_PLANO, puedeGestionarPlanos,
} from '../../utils/constants';

const COLUMNAS = [
  { id: 'nro_plano', etiqueta: 'Nro. Plano' },
  { id: 'tipo', etiqueta: 'Tipo' },
  { id: 'id_afi', etiqueta: 'CI Afiliado', render: (f) => textoODefecto(f.id_afi) },
  { id: 'id_cato', etiqueta: 'Cato', render: (f) => textoODefecto(f.id_cato) },
  {
    id: 'fecha_registro', etiqueta: 'F. Registro',
    render: (f) => formatearFecha(f.fecha_registro),
  },
  {
    id: 'superficie', etiqueta: 'Sup. (ha)', align: 'right',
    render: (f) => formatearNumero(f.superficie),
  },
  { id: 'archivo_formato', etiqueta: 'Formato', render: (f) => textoODefecto(f.archivo_formato) },
  { id: 'dibujante', etiqueta: 'Dibujante', render: (f) => textoODefecto(f.dibujante) },
  {
    id: 'estado', etiqueta: 'Estado',
    render: (f) => (
      <Chip size="small" label={f.estado || '-'}
        color={COLORES_ESTADO_PLANO[f.estado] || 'default'} />
    ),
  },
];

export default function PlanosList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { rol } = useAuth();
  const { error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1 });
  const [filtros, setFiltros] = useState({
    nro_plano: '', id_afi: '', id_cato: '', tipo: '',
    estado: searchParams.get('estado') || '',
  });
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const puedeRegistrar = puedeGestionarPlanos(rol);

  const cargar = useCallback(async (page = 1, pp = perPage, f = filtros) => {
    setCargando(true);
    try {
      const params = { page, per_page: pp };
      if (f.nro_plano) params.nro_plano = f.nro_plano;
      if (f.id_afi) params.id_afi = f.id_afi;
      if (f.id_cato) params.id_cato = f.id_cato;
      if (f.tipo) params.tipo = f.tipo;
      if (f.estado) params.estado = f.estado;
      setDatos(await planosApi.listarPlanos(params));
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
        <Typography variant="h5">Consulta de Planos</Typography>
        {puedeRegistrar && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setFormAbierto(true)}>
            Registrar Plano
          </Button>
        )}
      </Stack>
      <form onSubmit={(e) => { e.preventDefault(); cargar(1); }}>
        <Stack direction="row" spacing={2} mb={2}>
          <TextField size="small" label="Nro. Plano" value={filtros.nro_plano}
            onChange={(e) => setFiltros((f) => ({ ...f, nro_plano: e.target.value }))}
            sx={{ width: 180 }} />
          <TextField size="small" label="CI Afiliado" value={filtros.id_afi}
            onChange={(e) => setFiltros((f) => ({ ...f, id_afi: e.target.value }))}
            sx={{ width: 170 }} />
          <TextField size="small" label="Cod. Cato" type="number" value={filtros.id_cato}
            onChange={(e) => setFiltros((f) => ({ ...f, id_cato: e.target.value }))}
            sx={{ width: 150 }} />
          <TextField select size="small" label="Tipo" value={filtros.tipo}
            onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}
            sx={{ width: 170 }}>
            <MenuItem value="">(Todos)</MenuItem>
            {TIPOS_PLANO.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Estado" value={filtros.estado}
            onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
            sx={{ width: 180 }}>
            <MenuItem value="">(Todos)</MenuItem>
            {ESTADOS_PLANO.map((es) => (
              <MenuItem key={es} value={es}>{es}</MenuItem>
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
        onRowClick={(f) => navigate(`/planos/${f.id_plano}`)}
        vacio="Sin planos registrados con los filtros seleccionados"
      />
      <PlanosForm
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={(p) => {
          setFormAbierto(false);
          if (p?.id_plano) navigate(`/planos/${p.id_plano}`);
          else cargar(1);
        }}
      />
    </Box>
  );
}
