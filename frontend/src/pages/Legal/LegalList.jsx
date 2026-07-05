// Bandeja de casos del area Legal con filtros por estado, afiliado y cato
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Stack, Typography, TextField, MenuItem, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DataTable from '../../components/DataTable';
import * as legalApi from '../../services/legalApi';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import { formatearFecha, textoODefecto } from '../../utils/formatters';
import {
  ESTADOS_CASO_LEGAL, COLORES_ESTADO_CASO_LEGAL,
} from '../../utils/constants';

const COLUMNAS = [
  { id: 'id_renov', etiqueta: 'Nro.', align: 'right' },
  { id: 'nro_solicitud', etiqueta: 'Hoja de ruta', render: (f) => textoODefecto(f.nro_solicitud) },
  { id: 'id_afi', etiqueta: 'CI Afiliado' },
  { id: 'id_cato', etiqueta: 'Cato' },
  {
    id: 'hruta_fecha', etiqueta: 'F. Solicitud',
    render: (f) => formatearFecha(f.hruta_fecha),
  },
  { id: 'tecnico_info_nro', etiqueta: 'CITE Tecnico', render: (f) => textoODefecto(f.tecnico_info_nro) },
  { id: 'legal_info_nro', etiqueta: 'CITE Legal', render: (f) => textoODefecto(f.legal_info_nro) },
  { id: 'resol_nro', etiqueta: 'Resolucion', render: (f) => textoODefecto(f.resol_nro) },
  { id: 'sindicato', etiqueta: 'Sindicato', render: (f) => textoODefecto(f.sindicato) },
  {
    id: 'estado', etiqueta: 'Estado',
    render: (f) => (
      <Chip size="small" label={f.estado || '-'}
        color={COLORES_ESTADO_CASO_LEGAL[f.estado] || 'default'} />
    ),
  },
];

export default function LegalList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { error } = useNotification();
  const [datos, setDatos] = useState({ items: [], total: 0, page: 1 });
  const [filtros, setFiltros] = useState({
    estado: searchParams.get('estado') || 'REMITIDA_LEGAL',
    id_afi: '', id_cato: '', nro_cite: '',
  });
  const [perPage, setPerPage] = useState(25);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (page = 1, pp = perPage, f = filtros) => {
    setCargando(true);
    try {
      const params = { page, per_page: pp };
      if (f.estado) params.estado = f.estado;
      if (f.id_afi) params.id_afi = f.id_afi;
      if (f.id_cato) params.id_cato = f.id_cato;
      if (f.nro_cite) params.nro_cite = f.nro_cite;
      setDatos(await legalApi.listarCasos(params));
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
        <Typography variant="h5">Casos del Area Legal</Typography>
      </Stack>
      <form onSubmit={(e) => { e.preventDefault(); cargar(1); }}>
        <Stack direction="row" spacing={2} mb={2}>
          <TextField select size="small" label="Estado" value={filtros.estado}
            onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
            sx={{ width: 220 }}>
            {ESTADOS_CASO_LEGAL.map((e) => (
              <MenuItem key={e} value={e}>{e}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="CI Afiliado" value={filtros.id_afi}
            onChange={(e) => setFiltros((f) => ({ ...f, id_afi: e.target.value }))}
            sx={{ width: 180 }} />
          <TextField size="small" label="Cod. Cato" type="number" value={filtros.id_cato}
            onChange={(e) => setFiltros((f) => ({ ...f, id_cato: e.target.value }))}
            sx={{ width: 160 }} />
          <TextField size="small" label="Nro. CITE" value={filtros.nro_cite}
            onChange={(e) => setFiltros((f) => ({ ...f, nro_cite: e.target.value }))}
            sx={{ width: 180 }} />
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
        onRowClick={(f) => navigate(`/legal/casos/${f.id}`)}
        vacio="Sin casos con los filtros seleccionados"
      />
    </Box>
  );
}
