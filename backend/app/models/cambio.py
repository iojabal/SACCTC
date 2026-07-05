"""Modelo Cambio (traslados/transferencias de catos entre afiliados)."""
from app import db
from app.models.column_types import BIGINT_PK

TIPOS_CAMBIO = (
    'COMPRA-VENTA', 'SUCESION-HEREDITARIA', 'RENUNCIA-VOLUNTARIA',
    'ABANDONO', 'SENTENCIA-PENAL', 'TRANSFERENCIA', 'REASIGNACION',
)


class Cambio(db.Model):
    __tablename__ = 'cambio'

    id_trf = db.Column(BIGINT_PK, primary_key=True, autoincrement=True)
    id_cato = db.Column(db.BigInteger, db.ForeignKey('cato.id_cato'), index=True)
    id_afi_titular = db.Column(db.String(50), db.ForeignKey('afiliados.id_afi'), index=True)
    id_afi_nuevo = db.Column(db.String(50), db.ForeignKey('afiliados.id_afi'), index=True)
    tipo_cambio = db.Column(db.String(50))
    codigo_docu = db.Column(db.String(50))
    fecha_cambio = db.Column(db.Date, index=True)
    obs = db.Column(db.Text)
    resol_nro = db.Column(db.String(50))
    resol_fecha = db.Column(db.Date)

    titular = db.relationship('Afiliado', foreign_keys=[id_afi_titular], lazy='joined')
    nuevo = db.relationship('Afiliado', foreign_keys=[id_afi_nuevo], lazy='joined')

    def to_dict(self):
        return {
            'id_trf': self.id_trf,
            'id_cato': self.id_cato,
            'id_afi_titular': self.id_afi_titular,
            'titular_nombre': self.titular.nombre_completo if self.titular else None,
            'id_afi_nuevo': self.id_afi_nuevo,
            'nuevo_nombre': self.nuevo.nombre_completo if self.nuevo else None,
            'tipo_cambio': self.tipo_cambio,
            'codigo_docu': self.codigo_docu,
            'fecha_cambio': self.fecha_cambio.isoformat() if self.fecha_cambio else None,
            'obs': self.obs,
            'resol_nro': self.resol_nro,
            'resol_fecha': self.resol_fecha.isoformat() if self.resol_fecha else None,
        }

    def __repr__(self):
        return f'<Cambio {self.id_trf} cato={self.id_cato}>'
