// Constantes del dominio SACCTC - Area Ventanilla

export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Roles (Usuarios.tipo)
export const ROLES = {
  ADMINSIS: 'ADMINSIS',
  DIRECCION: 'USR_DIRECCION',
  OPERACIONES: 'USR_OPERACIONES',
  PLANOS: 'USR_PLANOS',
  INSPECCIONES: 'USR_INSPECCIONES',
  DOCUMENTOS: 'USR_DOCUMENTOS',
  SECRETARIA: 'USR_SECRETARIA',
  TECNICO: 'USR_TECNICO',
  LEGAL: 'USR_LEGAL',
};

export const ROLES_ESCRITURA = [
  ROLES.ADMINSIS, ROLES.OPERACIONES, ROLES.TECNICO, ROLES.SECRETARIA,
];
export const ROLES_ELIMINAR = [ROLES.ADMINSIS, ROLES.OPERACIONES];

export const ESTADOS_AFILIADO = [
  'SIN_OBSERVACION', 'TRANSFERIDO', 'AUT_FEDERACION', 'SIN_CATASTRO',
  'POZA', 'OBS_SISTEMAS', 'OBS_SOLICITUD',
];

export const GENEROS = ['MASCULINO', 'FEMENINO'];

export const EXTENSIONES_CI = ['CB', 'LP', 'SC', 'OR', 'PT', 'TJ', 'CH', 'BE', 'PA', 'QR'];

export const TIPOS_AUT_CATO = [
  'CATASTRO', 'FEDERACION', 'VALORACION_TECNICA_ORGANICA',
  'NINGUNA', 'ADICIONAL_LEY906',
];

export const CATEGORIAS_CAMBIO = {
  TRANSFERENCIA: 'TRANSFERENCIA',
  REASIGNACION: 'REASIGNACION',
};

export const TIPOS_CAMBIO_POR_CATEGORIA = {
  [CATEGORIAS_CAMBIO.TRANSFERENCIA]: [
    { valor: 'COMPRA-VENTA', etiqueta: 'Compra-venta' },
    { valor: 'SUCESION-HEREDITARIA', etiqueta: 'Sucesión hereditaria' },
  ],
  [CATEGORIAS_CAMBIO.REASIGNACION]: [
    { valor: 'ABANDONO', etiqueta: 'Abandono' },
    { valor: 'SENTENCIA-PENAL', etiqueta: 'Sentencia-Penal' },
    { valor: 'RENUNCIA-VOLUNTARIA', etiqueta: 'Renuncia-voluntaria' },
  ],
};

export const TIPOS_CAMBIO = Object.values(TIPOS_CAMBIO_POR_CATEGORIA)
  .flat()
  .map((t) => t.valor);

export const ESTADOS_TRAMITE = ['EN_PROCESO', 'FINALIZADO'];

// --- Area Renovaciones ---

// Workflow del tramite de renovacion
export const ESTADOS_RENOVACION = [
  'REGISTRADA', 'EN_INSPECCION', 'REMITIDA_LEGAL', 'APROBADA', 'RECHAZADA',
];

// Color del chip MUI por estado de renovacion
export const COLORES_ESTADO_RENOVACION = {
  REGISTRADA: 'default',
  EN_INSPECCION: 'info',
  REMITIDA_LEGAL: 'warning',
  APROBADA: 'success',
  RECHAZADA: 'error',
};

// Estados en los que el tramite aun puede editarse / remitirse a Legal
export const ESTADOS_RENOVACION_EDITABLES = ['REGISTRADA', 'EN_INSPECCION'];

export const RECOMENDACIONES_INFORME = ['FAVORABLE', 'DESFAVORABLE', 'OBSERVADO'];

// Roles con escritura en Renovaciones (registro y edicion de solicitudes)
export const ROLES_RENOVACION = [
  ROLES.ADMINSIS, ROLES.OPERACIONES, ROLES.TECNICO, ROLES.INSPECCIONES,
];
// Roles que registran informes de visita tecnica
export const ROLES_INFORME_TECNICO = [
  ROLES.ADMINSIS, ROLES.TECNICO, ROLES.INSPECCIONES,
];
// Roles que remiten el tramite al area Legal
export const ROLES_REMITIR_LEGAL = [
  ROLES.ADMINSIS, ROLES.OPERACIONES, ROLES.SECRETARIA,
];

// --- Area Legal ---

// Estados del tramite visibles para el area Legal (workflow backend)
export const ESTADOS_CASO_LEGAL = [
  'PENDIENTE', 'REMITIDA_LEGAL', 'APROBADA', 'RECHAZADA', 'DESTRUIDA',
];

export const COLORES_ESTADO_CASO_LEGAL = {
  PENDIENTE: 'default',
  REMITIDA_LEGAL: 'warning',
  APROBADA: 'success',
  RECHAZADA: 'error',
  DESTRUIDA: 'default',
};

// Documentos del area Legal (ActuacionLegal.tipo)
export const TIPOS_ACTUACION_LEGAL = [
  'INFORME_LEGAL', 'OBSERVACION_LEGAL', 'RESOLUCION',
];
export const ETIQUETAS_ACTUACION_LEGAL = {
  INFORME_LEGAL: 'Informe Legal',
  OBSERVACION_LEGAL: 'Observacion Legal',
  RESOLUCION: 'Resolucion Administrativa',
};
export const COLORES_ACTUACION_LEGAL = {
  INFORME_LEGAL: 'info',
  OBSERVACION_LEGAL: 'warning',
  RESOLUCION: 'secondary',
};

export const DICTAMENES_INFORME_LEGAL = ['PROCEDENTE', 'IMPROCEDENTE'];
export const RESULTADOS_RESOLUCION = ['APROBADA', 'RECHAZADA'];

// Roles con gestion en el area Legal (informes, observaciones, resoluciones)
export const ROLES_LEGAL_GESTION = [ROLES.ADMINSIS, ROLES.LEGAL];

// --- Area Planos ---

export const TIPOS_PLANO = [
  'MENSURA', 'UBICACION', 'RENOVACION', 'ACTUALIZACION',
];

export const ESTADOS_PLANO = [
  'REGISTRADO', 'EN_REVISION', 'APROBADO', 'OBSERVADO', 'ARCHIVADO',
];
export const COLORES_ESTADO_PLANO = {
  REGISTRADO: 'default',
  EN_REVISION: 'info',
  APROBADO: 'success',
  OBSERVADO: 'warning',
  ARCHIVADO: 'secondary',
};
// Estados en los que el plano aun puede editarse
export const ESTADOS_PLANO_EDITABLES = [
  'REGISTRADO', 'EN_REVISION', 'OBSERVADO',
];

export const RESULTADOS_REVISION_PLANO = ['APROBADO', 'OBSERVADO', 'RECHAZADO'];
export const FORMATOS_ARCHIVO_PLANO = [
  'PDF', 'DWG', 'DXF', 'SHP', 'KMZ', 'JPG', 'PNG',
];

// Roles con gestion en Planos (registro, actualizacion, archivo)
export const ROLES_PLANOS_GESTION = [ROLES.ADMINSIS, ROLES.PLANOS];
// Roles que revisan documentacion tecnica (tambien inspectores)
export const ROLES_PLANOS_REVISION = [
  ROLES.ADMINSIS, ROLES.PLANOS, ROLES.INSPECCIONES,
];

// --- Registro de Mensura ---

// Radio buttons de estado de renovacion (FormRegistroMensura legacy:
// USR_ADMINSIS || USR_SISTEMAS (→ USR_OPERACIONES) || USR_PLANOS || USR_INSPECCIONES)
export const ROLES_MENSURA_RENOVACION = [
  ROLES.ADMINSIS, ROLES.OPERACIONES, ROLES.PLANOS, ROLES.INSPECCIONES,
];

export const puedeEscribir = (rol) => ROLES_ESCRITURA.includes(rol);
export const puedeEliminar = (rol) => ROLES_ELIMINAR.includes(rol);
export const esAdmin = (rol) => rol === ROLES.ADMINSIS;

export const puedeGestionarRenovaciones = (rol) => ROLES_RENOVACION.includes(rol);
export const puedeRegistrarInforme = (rol) => ROLES_INFORME_TECNICO.includes(rol);
export const puedeRemitirLegal = (rol) => ROLES_REMITIR_LEGAL.includes(rol);

export const puedeGestionarLegal = (rol) => ROLES_LEGAL_GESTION.includes(rol);
export const puedeGestionarRenovacionMensura = (rol) =>
  ROLES_MENSURA_RENOVACION.includes(rol);
export const puedeGestionarPlanos = (rol) => ROLES_PLANOS_GESTION.includes(rol);
export const puedeRevisarPlano = (rol) => ROLES_PLANOS_REVISION.includes(rol);
