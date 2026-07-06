"""Modelos del area Renovaciones.

RenovacionProgramada mapea la tabla legacy renovacionprogramada0
(83,280 registros migrados de SQL Server). El id_renov legado tiene
valores duplicados (27,760), por lo que la PK es la columna sustituta
"id" agregada en la migracion 20260703_01_renovaciones.sql (mismo
patron id PK + id de negocio que cato/afiliados).

InformeVisitaTecnica es tabla nueva: historial de inspecciones de campo
por renovacion. El legacy solo guardaba el ultimo dato en las columnas
tecnico_info_* de RenovacionProgramada0 (ProcRenovUpdateDatosInfTec);
ahora cada visita queda registrada y las columnas legacy se sincronizan
con el ultimo informe para compatibilidad con reportes existentes.

Ciclo de vida (FormRenovacionProgramada legacy):
PENDIENTE -> REMITIDA_LEGAL -> APROBADA | RECHAZADA -> DESTRUIDA
"""
from datetime import datetime

from app import db
from app.models.column_types import BIGINT_PK

# Estados del tramite de renovacion
ESTADO_PENDIENTE = 'PENDIENTE'
ESTADO_REMITIDA_LEGAL = 'REMITIDA_LEGAL'
ESTADO_APROBADA = 'APROBADA'
ESTADO_RECHAZADA = 'RECHAZADA'
ESTADO_DESTRUIDA = 'DESTRUIDA'

ESTADOS_RENOVACION = (
    ESTADO_PENDIENTE, ESTADO_REMITIDA_LEGAL, ESTADO_APROBADA,
    ESTADO_RECHAZADA, ESTADO_DESTRUIDA,
)
# Estados que bloquean crear una nueva renovacion para el mismo cato
ESTADOS_RENOVACION_ACTIVA = (ESTADO_PENDIENTE, ESTADO_REMITIDA_LEGAL)

# Resultados de la inspeccion tecnica (combo del formulario legacy)
RESULTADO_FACTIBLE = 'FACTIBLE'
RESULTADO_NO_FACTIBLE = 'NO_FACTIBLE'
RESULTADO_AUSENTE = 'AUSENTE'
RESULTADOS_INFORME = (RESULTADO_FACTIBLE, RESULTADO_NO_FACTIBLE,
                      RESULTADO_AUSENTE)

# Causales de renovacion del DS 3318 (incisos a-f)
CAUSALES_INCISO = ('a', 'b', 'c', 'd', 'e', 'f')


class RenovacionProgramada(db.Model):
    __tablename__ = 'renovacionprogramada0'

    id = db.Column(BIGINT_PK, primary_key=True)
    id_renov = db.Column(db.BigInteger, index=True)  # id de negocio legacy
    id_cato = db.Column(db.BigInteger, index=True)
    id_afi = db.Column(db.String(50), index=True)
    nro_solicitud = db.Column(db.String(50))  # hoja de ruta / solicitud

    # Estado del tramite (nuevo) + resultado legacy (APROBADO/RECHAZADO/...)
    estado = db.Column(db.String(30), index=True, default=ESTADO_PENDIENTE)
    resultado = db.Column(db.String(50))

    # Vigencia de la renovacion
    vigencia_inicio = db.Column(db.Date)
    fecha_vencimiento = db.Column(db.Date)
    fecha_destruida = db.Column(db.Date)

    # Remision al area legal
    nota_legal = db.Column(db.Text)
    remitida_legal_fecha = db.Column(db.Date)
    remitida_legal_por = db.Column(db.String(50))

    # Parcela ANTERIOR (la que se renueva). cato_fecha_control es la fecha
    # del ultimo control de mensura que origino el snapshot (campo
    # "FechaControl" del formulario legacy; 20260705_01).
    cato_fecha_control = db.Column(db.Date)
    cato_sup = db.Column(db.Numeric(8, 4))
    cato_utm_xy = db.Column(db.String(250))
    cato_frec = db.Column(db.Integer)
    cato_edad_anio = db.Column(db.String(150))
    cato_edad_mes = db.Column(db.String(150))

    # Parcela NUEVA (la autorizada). renov_edad_anio = "Edad Anios" del
    # Nuevo Cultivo del formulario legacy (20260705_01).
    renov_sup = db.Column(db.Numeric(8, 4))
    renov_utm_xy = db.Column(db.String(250))
    renov_frec = db.Column(db.Integer)
    renov_edad_mes = db.Column(db.Integer)
    renov_edad_anio = db.Column(db.Integer)

    # Informe tecnico (ultimo, sincronizado desde informevisitatecnica)
    # tecnico_cargo = "Cargo" del tecnico en la seccion Causal (20260705_01)
    tecnico = db.Column(db.String(50))
    tecnico_cargo = db.Column(db.String(50))
    tecnico_info_nro = db.Column(db.String(20))
    tecnico_info_fecha = db.Column(db.Date)
    tecnico_info_causal_inciso = db.Column(db.String(5))
    tecnico_info_obs = db.Column(db.Text)
    tecnico_val_fecha = db.Column(db.Date)

    # Informe legal. legal_responsable/legal_cargo = "Responsable"/"Cargo"
    # de la seccion Asesoria Legal, sincronizados desde ActuacionLegal
    # (20260705_01).
    legal_info_nro = db.Column(db.String(20))
    legal_info_fecha = db.Column(db.Date)
    legal_info_obs = db.Column(db.Text)
    legal_responsable = db.Column(db.String(100))
    legal_cargo = db.Column(db.String(50))

    # Resolucion administrativa. con_resolucion = radio "Con Resolucion /
    # Sin Resolucion" del formulario legacy (20260705_01).
    con_resolucion = db.Column(db.Boolean)
    resol_nro = db.Column(db.String(20))
    resol_fecha = db.Column(db.Date)
    resol_obs = db.Column(db.Text)

    # Datos varios legacy
    edad_mes_nuevo = db.Column(db.Integer)
    superficie = db.Column(db.Numeric(8, 4))
    frecuencia = db.Column(db.Integer)
    coordenadas = db.Column(db.Text)
    observacion = db.Column(db.Text)
    ant_valoracion = db.Column(db.Integer)
    hruta_fecha = db.Column(db.Date)
    lote_nro = db.Column(db.String(10))
    lote_sup = db.Column(db.Integer)

    # Auditoria
    usuario_ci = db.Column(db.String(20))
    usuario_nombre = db.Column(db.String(50))
    usuario_cargo = db.Column(db.String(20))

    # Snapshot de organizacion sindical
    departamento = db.Column(db.String(30))
    provincia = db.Column(db.String(30))
    municipio = db.Column(db.String(30))
    federacion = db.Column(db.String(30))
    central = db.Column(db.String(30))
    sindicato = db.Column(db.String(30))

    afiliado = db.relationship(
        'Afiliado', lazy='select', viewonly=True,
        primaryjoin='foreign(RenovacionProgramada.id_afi) == Afiliado.id_afi')
    cato = db.relationship(
        'Cato', lazy='select', viewonly=True,
        primaryjoin='foreign(RenovacionProgramada.id_cato) == Cato.id_cato')
    informes = db.relationship(
        'InformeVisitaTecnica', backref='renovacion', lazy='dynamic',
        order_by='InformeVisitaTecnica.fecha_visita.asc()')

    def to_dict_resumen(self):
        """Fila del grid legacy (ProcGetHistorialRenovSol2, resumida)."""
        return {
            'id': self.id,
            'id_renov': self.id_renov,
            'id_cato': self.id_cato,
            'id_afi': self.id_afi,
            'nro_solicitud': self.nro_solicitud,
            'estado': self.estado,
            'resultado': self.resultado,
            'hruta_fecha': self.hruta_fecha.isoformat() if self.hruta_fecha else None,
            'vigencia_inicio': self.vigencia_inicio.isoformat() if self.vigencia_inicio else None,
            'fecha_vencimiento': self.fecha_vencimiento.isoformat() if self.fecha_vencimiento else None,
            'fecha_destruida': self.fecha_destruida.isoformat() if self.fecha_destruida else None,
            'tecnico_info_nro': self.tecnico_info_nro,
            'tecnico_info_fecha': self.tecnico_info_fecha.isoformat()
                if self.tecnico_info_fecha else None,
            'tecnico_val_fecha': self.tecnico_val_fecha.isoformat()
                if self.tecnico_val_fecha else None,
            'legal_info_nro': self.legal_info_nro,
            'resol_nro': self.resol_nro,
            'sindicato': self.sindicato,
            'central': self.central,
            'federacion': self.federacion,
        }

    def to_dict(self):
        data = self.to_dict_resumen()
        data.update({
            'nota_legal': self.nota_legal,
            'remitida_legal_fecha': self.remitida_legal_fecha.isoformat()
                if self.remitida_legal_fecha else None,
            'remitida_legal_por': self.remitida_legal_por,
            'cato_fecha_control': self.cato_fecha_control.isoformat()
                if self.cato_fecha_control else None,
            'cato_sup': float(self.cato_sup) if self.cato_sup is not None else None,
            'cato_utm_xy': self.cato_utm_xy,
            'cato_frec': self.cato_frec,
            'cato_edad_anio': self.cato_edad_anio,
            'cato_edad_mes': self.cato_edad_mes,
            'renov_sup': float(self.renov_sup) if self.renov_sup is not None else None,
            'renov_utm_xy': self.renov_utm_xy,
            'renov_frec': self.renov_frec,
            'renov_edad_mes': self.renov_edad_mes,
            'renov_edad_anio': self.renov_edad_anio,
            'tecnico': self.tecnico,
            'tecnico_cargo': self.tecnico_cargo,
            'tecnico_info_fecha': self.tecnico_info_fecha.isoformat()
                if self.tecnico_info_fecha else None,
            'tecnico_info_causal_inciso': self.tecnico_info_causal_inciso,
            'tecnico_info_obs': self.tecnico_info_obs,
            'tecnico_val_fecha': self.tecnico_val_fecha.isoformat()
                if self.tecnico_val_fecha else None,
            'legal_info_fecha': self.legal_info_fecha.isoformat()
                if self.legal_info_fecha else None,
            'legal_info_obs': self.legal_info_obs,
            'legal_responsable': self.legal_responsable,
            'legal_cargo': self.legal_cargo,
            'con_resolucion': self.con_resolucion,
            'resol_fecha': self.resol_fecha.isoformat() if self.resol_fecha else None,
            'resol_obs': self.resol_obs,
            'lote_nro': self.lote_nro,
            'lote_sup': self.lote_sup,
            'edad_mes_nuevo': self.edad_mes_nuevo,
            'superficie': float(self.superficie)
                if self.superficie is not None else None,
            'frecuencia': self.frecuencia,
            'coordenadas': self.coordenadas,
            'ant_valoracion': self.ant_valoracion,
            'observacion': self.observacion,
            'usuario_ci': self.usuario_ci,
            'usuario_nombre': self.usuario_nombre,
            'usuario_cargo': self.usuario_cargo,
            'departamento': self.departamento,
            'provincia': self.provincia,
            'municipio': self.municipio,
        })
        return data

    def __repr__(self):
        return f'<RenovacionProgramada {self.id} cato={self.id_cato} {self.estado}>'


class InformeVisitaTecnica(db.Model):
    __tablename__ = 'informevisitatecnica'

    id_informe = db.Column(BIGINT_PK, primary_key=True)
    id_renovacion = db.Column(db.BigInteger,
                              db.ForeignKey('renovacionprogramada0.id'),
                              nullable=False, index=True)
    fecha_visita = db.Column(db.Date, nullable=False)
    resultado = db.Column(db.String(20), nullable=False)
    nro_informe = db.Column(db.String(20))   # CITE
    coordenadas = db.Column(db.String(250))
    superficie = db.Column(db.Numeric(8, 4))
    edad_anio = db.Column(db.String(20))
    edad_mes = db.Column(db.String(20))
    causal_inciso = db.Column(db.String(5))
    observaciones = db.Column(db.Text)
    tecnico_nombre = db.Column(db.String(100))
    tecnico_ci = db.Column(db.String(20))
    usuario = db.Column(db.String(50))
    creado_en = db.Column(db.DateTime, nullable=False,
                          default=datetime.utcnow)

    def to_dict(self):
        return {
            'id_informe': self.id_informe,
            'id_renovacion': self.id_renovacion,
            'fecha_visita': self.fecha_visita.isoformat() if self.fecha_visita else None,
            'resultado': self.resultado,
            'nro_informe': self.nro_informe,
            'coordenadas': self.coordenadas,
            'superficie': float(self.superficie) if self.superficie is not None else None,
            'edad_anio': self.edad_anio,
            'edad_mes': self.edad_mes,
            'causal_inciso': self.causal_inciso,
            'observaciones': self.observaciones,
            'tecnico_nombre': self.tecnico_nombre,
            'tecnico_ci': self.tecnico_ci,
            'usuario': self.usuario,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }

    def __repr__(self):
        return f'<InformeVisitaTecnica {self.id_informe} renov={self.id_renovacion}>'
