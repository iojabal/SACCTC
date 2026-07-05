// Detalle del caso legal: datos del tramite, informes tecnicos recibidos,
// archivo de actuaciones legales y acciones del flujo (informe legal,
// observacion legal, resolucion administrativa)
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Stack, Button, Chip, Divider,
  CircularProgress, Link, Tooltip, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import GavelIcon from '@mui/icons-material/Gavel';
import DownloadIcon from '@mui/icons-material/Download';
import DataTable from '../../components/DataTable';
import LegalForm from './LegalForm';
import * as legalApi from '../../services/legalApi';
import { descargarDocumentoLegal } from '../../services/documentosApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { mensajeDeError } from '../../services/api';
import {
  formatearFecha, formatearNumero, formatearCI, textoODefecto,
} from '../../utils/formatters';
import {
  COLORES_ESTADO_CASO_LEGAL, COLORES_ACTUACION_LEGAL,
  ETIQUETAS_ACTUACION_LEGAL, puedeGestionarLegal,
} from '../../utils/constants';

const COLS_INFORMES_TEC = [
  {
    id: 'fecha_visita', etiqueta: 'F. Visita',
    render: (f) => formatearFecha(f.fecha_visita),
  },
  { id: 'nro_informe', etiqueta: 'CITE', render: (f) => textoODefecto(f.nro_informe) },
  { id: 'resultado', etiqueta: 'Resultado', render: (f) => textoODefecto(f.resultado) },
  {
    id: 'superficie', etiqueta: 'Sup. (ha)', align: 'right',
    render: (f) => formatearNumero(f.superficie),
  },
  { id: 'causal_inciso', etiqueta: 'Causal', render: (f) => textoODefecto(f.causal_inciso) },
  { id: 'tecnico_nombre', etiqueta: 'Tecnico', render: (f) => textoODefecto(f.tecnico_nombre) },
  { id: 'observaciones', etiqueta: 'Observaciones', render: (f) => textoODefecto(f.observaciones) },
];

const COLS_ACTUACIONES = [
  {
    id: 'tipo', etiqueta: 'Tipo',
    render: (f) => (
      <Chip size="small" label={ETIQUETAS_ACTUACION_LEGAL[f.tipo] || f.tipo}
        color={COLORES_ACTUACION_LEGAL[f.tipo] || 'default'} />
    ),
  },
  { id: 'fecha', etiqueta: 'Fecha', render: (f) => formatearFecha(f.fecha) },
  { id: 'nro_cite', etiqueta: 'Nro. CITE', render: (f) => textoODefecto(f.nro_cite) },
  { id: 'dictamen', etiqueta: 'Dictamen', render: (f) => textoODefecto(f.dictamen) },
  { id: 'responsable_nombre', etiqueta: 'Responsable', render: (f) => textoODefecto(f.responsable_nombre) },
  { id: 'contenido', etiqueta: 'Contenido', render: (f) => textoODefecto(f.contenido) },
];

function Dato({ etiqueta, children }) {
  return (
    <Grid item xs={6} sm={4} md={3}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2">{children ?? '-'}</Typography>
    </Grid>
  );
}

export default function LegalDetail() {
  const { idCaso } = useParams();
  const navigate = useNavigate();
  const { rol } = useAuth();
  const { error } = useNotification();
  const [caso, setCaso] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [formTipo, setFormTipo] = useState(null); // tipo de actuacion abierta

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setCaso(await legalApi.obtenerCaso(idCaso));
    } catch (e) {
      error(mensajeDeError(e));
      setCaso(null);
    } finally {
      setCargando(false);
    }
  }, [idCaso, error]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  }
  if (!caso) {
    return (
      <Box>
        <Typography color="text.secondary">No se encontro el caso {idCaso}.</Typography>
        <Button startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/legal/casos')} sx={{ mt: 2 }}>
          Volver a la bandeja
        </Button>
      </Box>
    );
  }

  const informesTec = caso.informes_tecnicos || [];
  const actuaciones = caso.actuaciones || [];

  // Columnas de actuaciones + descarga del documento Word
  // (Informe Legal / Observaciones Legales / Resolucion Administrativa)
  const colsActuaciones = [
    ...COLS_ACTUACIONES,
    {
      id: 'documento', etiqueta: '', align: 'right',
      render: (f) => (
        <Tooltip title={`Descargar ${ETIQUETAS_ACTUACION_LEGAL[f.tipo] || f.tipo} (Word)`}>
          <IconButton size="small" color="primary"
            onClick={(e) => {
              e.stopPropagation();
              descargarDocumentoLegal(f.id_actuacion)
                .catch((err) => error(mensajeDeError(err)));
            }}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];
  const activo = caso.estado === 'REMITIDA_LEGAL';
  const tieneInformeTec = informesTec.length > 0 || Boolean(caso.tecnico_info_nro);
  const tieneInformeLegal = Boolean(caso.legal_info_nro)
    || actuaciones.some((a) => a.tipo === 'INFORME_LEGAL');
  const gestiona = puedeGestionarLegal(rol);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/legal/casos')}>
            Casos
          </Button>
          <Typography variant="h5">Caso {caso.id_renov}</Typography>
          <Chip size="small" label={caso.estado || '-'}
            color={COLORES_ESTADO_CASO_LEGAL[caso.estado] || 'default'} />
        </Stack>
        {gestiona && activo && (
          <Stack direction="row" spacing={1}>
            <Tooltip title={!tieneInformeTec
              ? 'El caso no tiene informe tecnico registrado' : ''}>
              <span>
                <Button variant="outlined" startIcon={<DescriptionIcon />}
                  disabled={!tieneInformeTec}
                  onClick={() => setFormTipo('INFORME_LEGAL')}>
                  Informe Legal
                </Button>
              </span>
            </Tooltip>
            <Button variant="outlined" color="warning"
              startIcon={<ReportProblemIcon />}
              onClick={() => setFormTipo('OBSERVACION_LEGAL')}>
              Observacion
            </Button>
            <Tooltip title={!tieneInformeLegal
              ? 'Debe registrar primero el informe legal' : ''}>
              <span>
                <Button variant="contained" color="secondary" startIcon={<GavelIcon />}
                  disabled={!tieneInformeLegal}
                  onClick={() => setFormTipo('RESOLUCION')}>
                  Emitir Resolucion
                </Button>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Dato etiqueta="Afiliado">
            {caso.afiliado ? (
              <Link component={RouterLink}
                to={`/afiliados/${encodeURIComponent(caso.afiliado.id_afi)}`}>
                {formatearCI(caso.afiliado.id_afi, caso.afiliado.ext)}{' - '}
                {caso.afiliado.nombre_completo}
              </Link>
            ) : textoODefecto(caso.id_afi)}
          </Dato>
          <Dato etiqueta="Cato">
            {caso.id_cato ? (
              <Link component={RouterLink} to={`/catos/${caso.id_cato}`}>
                {caso.id_cato}
              </Link>
            ) : '-'}
          </Dato>
          <Dato etiqueta="Hoja de ruta">{textoODefecto(caso.nro_solicitud)}</Dato>
          <Dato etiqueta="F. Solicitud">{formatearFecha(caso.hruta_fecha)}</Dato>
          <Dato etiqueta="Remitido a Legal">{formatearFecha(caso.remitida_legal_fecha)}</Dato>
          <Dato etiqueta="Remitido por">{textoODefecto(caso.remitida_legal_por)}</Dato>
          <Dato etiqueta="Vigencia desde">{formatearFecha(caso.vigencia_inicio)}</Dato>
          <Dato etiqueta="Vigencia hasta">{formatearFecha(caso.fecha_vencimiento)}</Dato>
          <Dato etiqueta="CITE Informe Tecnico">{textoODefecto(caso.tecnico_info_nro)}</Dato>
          <Dato etiqueta="CITE Informe Legal">{textoODefecto(caso.legal_info_nro)}</Dato>
          <Dato etiqueta="Nro. Resolucion">{textoODefecto(caso.resol_nro)}</Dato>
          <Dato etiqueta="Resultado">{textoODefecto(caso.resultado)}</Dato>
          <Dato etiqueta="Federacion">{textoODefecto(caso.federacion)}</Dato>
          <Dato etiqueta="Central">{textoODefecto(caso.central)}</Dato>
          <Dato etiqueta="Sindicato">{textoODefecto(caso.sindicato)}</Dato>
          {caso.nota_legal && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Notas legales</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {caso.nota_legal}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" mb={1}>
        Informes tecnicos recibidos ({informesTec.length})
      </Typography>
      <DataTable columnas={COLS_INFORMES_TEC} datos={informesTec}
        vacio="El caso no tiene informes de visita tecnica" />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" mb={1}>
        Actuaciones legales ({actuaciones.length})
      </Typography>
      <DataTable columnas={colsActuaciones} datos={actuaciones}
        vacio="El caso no tiene actuaciones legales registradas" />

      <LegalForm
        abierto={Boolean(formTipo)}
        tipo={formTipo}
        caso={caso}
        onCerrar={() => setFormTipo(null)}
        onGuardado={() => { setFormTipo(null); cargar(); }}
      />
    </Box>
  );
}
