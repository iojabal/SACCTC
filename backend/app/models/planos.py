"""Modelos del area Planos.

Plano es tabla nueva: registro (archivo fisico y digital) de los planos
de las parcelas. En el legacy el area Planos trabajaba desde
FormRegistroMensura.cs (rol USR_PLANOS) sobre ControlCato y consultaba
los "registros topograficos" (campo REGTOP de los shapefiles que abria
FormRegistroMensura_VerMapa). Ese archivo de planos no tenia tabla
propia; esta migracion lo formaliza:

  - nro_plano       -> identificador del plano (REGTOP legacy), unico
  - archivo_*       -> archivo digital (nombre, formato, ruta)
  - ubicacion_fisica-> archivo fisico (estante/folder)

PlanoRevision registra la recepcion y revision de la documentacion
tecnica de cada plano (historial, mismo patron que InformeVisitaTecnica).

Ciclo de vida del plano:
REGISTRADO -> EN_REVISION -> APROBADO | OBSERVADO -> ARCHIVADO
(un plano OBSERVADO puede corregirse/actualizarse y volver a revision)
"""
from datetime import datetime

from app import db
from app.models.column_types import BIGINT_PK

# Estados del plano
ESTADO_REGISTRADO = 'REGISTRADO'
ESTADO_EN_REVISION = 'EN_REVISION'
ESTADO_APROBADO = 'APROBADO'
ESTADO_OBSERVADO = 'OBSERVADO'
ESTADO_ARCHIVADO = 'ARCHIVADO'
ESTADOS_PLANO = (ESTADO_REGISTRADO, ESTADO_EN_REVISION, ESTADO_APROBADO,
                 ESTADO_OBSERVADO, ESTADO_ARCHIVADO)
# Estados en los que el plano aun puede modificarse
ESTADOS_PLANO_EDITABLES = (ESTADO_REGISTRADO, ESTADO_EN_REVISION,
                           ESTADO_OBSERVADO)

# Tipos de plano (origen del levantamiento)
TIPO_MENSURA = 'MENSURA'
TIPO_UBICACION = 'UBICACION'
TIPO_RENOVACION = 'RENOVACION'
TIPO_ACTUALIZACION = 'ACTUALIZACION'
TIPOS_PLANO = (TIPO_MENSURA, TIPO_UBICACION, TIPO_RENOVACION,
               TIPO_ACTUALIZACION)

# Resultado de la revision de documentacion tecnica
REVISION_APROBADO = 'APROBADO'
REVISION_OBSERVADO = 'OBSERVADO'
REVISION_RECHAZADO = 'RECHAZADO'
RESULTADOS_REVISION = (REVISION_APROBADO, REVISION_OBSERVADO,
                       REVISION_RECHAZADO)

# Formatos admitidos del archivo digital
FORMATOS_ARCHIVO = ('PDF', 'DWG', 'DXF', 'SHP', 'KMZ', 'JPG', 'PNG')


class Plano(db.Model):
    __tablename__ = 'plano'

    id_plano = db.Column(BIGINT_PK, primary_key=True)
    nro_plano = db.Column(db.String(30), nullable=False, unique=True,
                          index=True)  # registro topografico (REGTOP legacy)
    id_cato = db.Column(db.BigInteger, index=True)
    id_afi = db.Column(db.String(50), index=True)
    tipo = db.Column(db.String(20), nullable=False, default=TIPO_MENSURA)
    estado = db.Column(db.String(20), nullable=False, index=True,
                       default=ESTADO_REGISTRADO)

    fecha_registro = db.Column(db.Date, nullable=False)
    fecha_plano = db.Column(db.Date)          # fecha de elaboracion

    # Datos tecnicos del levantamiento (FormRegistroMensura legacy)
    superficie = db.Column(db.Numeric(8, 4))  # ha (mensura = 0.1600)
    coordenadas = db.Column(db.String(250))   # UTM x-y
    escala = db.Column(db.String(20))
    zona_utm = db.Column(db.String(10))
    dibujante = db.Column(db.String(100))     # tecnico dibujante

    # Archivo digital
    archivo_nombre = db.Column(db.String(150))
    archivo_formato = db.Column(db.String(10))
    archivo_ruta = db.Column(db.String(250))
    # Archivo fisico
    ubicacion_fisica = db.Column(db.String(100))

    observaciones = db.Column(db.Text)

    # Auditoria
    usuario = db.Column(db.String(50))
    creado_en = db.Column(db.DateTime, nullable=False,
                          default=datetime.utcnow)
    actualizado_en = db.Column(db.DateTime, nullable=False,
                               default=datetime.utcnow,
                               onupdate=datetime.utcnow)

    afiliado = db.relationship(
        'Afiliado', lazy='select', viewonly=True,
        primaryjoin='foreign(Plano.id_afi) == Afiliado.id_afi')
    cato = db.relationship(
        'Cato', lazy='select', viewonly=True,
        primaryjoin='foreign(Plano.id_cato) == Cato.id_cato')
    revisiones = db.relationship(
        'PlanoRevision', backref='plano', lazy='dynamic',
        order_by='PlanoRevision.fecha_revision.asc()')

    def to_dict_resumen(self):
        """Fila del grid de consulta de planos."""
        return {
            'id_plano': self.id_plano,
            'nro_plano': self.nro_plano,
            'id_cato': self.id_cato,
            'id_afi': self.id_afi,
            'tipo': self.tipo,
            'estado': self.estado,
            'fecha_registro': self.fecha_registro.isoformat()
                if self.fecha_registro else None,
            'superficie': float(self.superficie)
                if self.superficie is not None else None,
            'archivo_formato': self.archivo_formato,
            'dibujante': self.dibujante,
        }

    def to_dict(self):
        data = self.to_dict_resumen()
        data.update({
            'fecha_plano': self.fecha_plano.isoformat()
                if self.fecha_plano else None,
            'coordenadas': self.coordenadas,
            'escala': self.escala,
            'zona_utm': self.zona_utm,
            'archivo_nombre': self.archivo_nombre,
            'archivo_ruta': self.archivo_ruta,
            'ubicacion_fisica': self.ubicacion_fisica,
            'observaciones': self.observaciones,
            'usuario': self.usuario,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
            'actualizado_en': self.actualizado_en.isoformat()
                if self.actualizado_en else None,
        })
        return data

    def __repr__(self):
        return f'<Plano {self.id_plano} {self.nro_plano} {self.estado}>'


class PlanoRevision(db.Model):
    __tablename__ = 'planorevision'

    id_revision = db.Column(BIGINT_PK, primary_key=True)
    id_plano = db.Column(db.BigInteger, db.ForeignKey('plano.id_plano'),
                         nullable=False, index=True)
    fecha_revision = db.Column(db.Date, nullable=False)
    resultado = db.Column(db.String(20), nullable=False)
    documentacion = db.Column(db.Text)   # documentacion tecnica recibida
    observaciones = db.Column(db.Text)
    revisor_nombre = db.Column(db.String(100))
    usuario = db.Column(db.String(50))
    creado_en = db.Column(db.DateTime, nullable=False,
                          default=datetime.utcnow)

    def to_dict(self):
        return {
            'id_revision': self.id_revision,
            'id_plano': self.id_plano,
            'fecha_revision': self.fecha_revision.isoformat()
                if self.fecha_revision else None,
            'resultado': self.resultado,
            'documentacion': self.documentacion,
            'observaciones': self.observaciones,
            'revisor_nombre': self.revisor_nombre,
            'usuario': self.usuario,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }

    def __repr__(self):
        return f'<PlanoRevision {self.id_revision} plano={self.id_plano}>'
