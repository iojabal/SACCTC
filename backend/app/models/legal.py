"""Modelos del area Legal.

ActuacionLegal es tabla nueva: registro y archivo historico de las
actuaciones del area Legal sobre cada tramite de renovacion (informes
legales, observaciones legales y resoluciones administrativas).

El legacy (D_RenovacionProgramada.cs / ProcRenovUpdate2) solo guardaba
la ULTIMA actuacion en columnas de RenovacionProgramada0:
  - legal_info_nro / legal_info_fecha / legal_info_obs  (informe legal)
  - resol_nro / resol_fecha / resol_obs                 (resolucion)
  - legal_resp_nombre / legal_resp_cargo                (responsable)
Ahora cada actuacion queda archivada y las columnas legacy se sincronizan
con la ultima de su tipo para compatibilidad con los reportes existentes
(mismo patron que InformeVisitaTecnica con tecnico_info_*).

Flujo legal del tramite (FormRenovacionProgramada legacy, verificaciones
ProcRenovTieneInfo2 con info_tipo INFO_TECNICO -> INFO_LEGAL -> INFO_RESOL):
1. El caso llega de Renovaciones en estado REMITIDA_LEGAL con informe tecnico.
2. Legal registra el informe legal (dictamen PROCEDENTE / IMPROCEDENTE).
3. Legal puede registrar observaciones legales (cuando corresponda).
4. Legal emite la resolucion administrativa -> estado APROBADA / RECHAZADA.
"""
from datetime import datetime

from app import db
from app.models.column_types import BIGINT_PK

# Tipos de actuacion legal (documentos del area)
TIPO_INFORME_LEGAL = 'INFORME_LEGAL'
TIPO_OBSERVACION_LEGAL = 'OBSERVACION_LEGAL'
TIPO_RESOLUCION = 'RESOLUCION'
TIPOS_ACTUACION = (TIPO_INFORME_LEGAL, TIPO_OBSERVACION_LEGAL,
                   TIPO_RESOLUCION)

# Dictamen del informe legal
DICTAMEN_PROCEDENTE = 'PROCEDENTE'
DICTAMEN_IMPROCEDENTE = 'IMPROCEDENTE'
DICTAMENES_INFORME = (DICTAMEN_PROCEDENTE, DICTAMEN_IMPROCEDENTE)

# Resultado de la resolucion administrativa (define el estado final)
RESOLUCION_APROBADA = 'APROBADA'
RESOLUCION_RECHAZADA = 'RECHAZADA'
RESULTADOS_RESOLUCION = (RESOLUCION_APROBADA, RESOLUCION_RECHAZADA)


class ActuacionLegal(db.Model):
    __tablename__ = 'actuacionlegal'

    id_actuacion = db.Column(BIGINT_PK, primary_key=True)
    id_renovacion = db.Column(db.BigInteger,
                              db.ForeignKey('renovacionprogramada0.id'),
                              nullable=False, index=True)
    tipo = db.Column(db.String(20), nullable=False, index=True)
    fecha = db.Column(db.Date, nullable=False)
    nro_cite = db.Column(db.String(20))       # CITE del documento
    dictamen = db.Column(db.String(20))       # PROCEDENTE/IMPROCEDENTE
                                              # o APROBADA/RECHAZADA (resol.)
    contenido = db.Column(db.Text)            # cuerpo / fundamentos
    responsable_nombre = db.Column(db.String(100))  # legal_resp_nombre legacy
    responsable_cargo = db.Column(db.String(50))    # legal_resp_cargo legacy
    usuario = db.Column(db.String(50))
    creado_en = db.Column(db.DateTime, nullable=False,
                          default=datetime.utcnow)

    renovacion = db.relationship(
        'RenovacionProgramada', lazy='select', viewonly=True,
        primaryjoin='foreign(ActuacionLegal.id_renovacion) '
                    '== RenovacionProgramada.id')

    def to_dict(self):
        return {
            'id_actuacion': self.id_actuacion,
            'id_renovacion': self.id_renovacion,
            'tipo': self.tipo,
            'fecha': self.fecha.isoformat() if self.fecha else None,
            'nro_cite': self.nro_cite,
            'dictamen': self.dictamen,
            'contenido': self.contenido,
            'responsable_nombre': self.responsable_nombre,
            'responsable_cargo': self.responsable_cargo,
            'usuario': self.usuario,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }

    def __repr__(self):
        return (f'<ActuacionLegal {self.id_actuacion} {self.tipo} '
                f'renov={self.id_renovacion}>')
