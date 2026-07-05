"""Modelo Observado (observaciones sobre catos/afiliados).

tipo_obs: POZA_MACERACION, SIN_CATASTRO, INCREMENTO, REGISTRO_MULTIPLE,
          SOLICITUD, OTROS
"""
from app import db
from app.models.column_types import BIGINT_PK

TIPOS_OBS = (
    'POZA_MACERACION', 'SIN_CATASTRO', 'INCREMENTO',
    'REGISTRO_MULTIPLE', 'SOLICITUD', 'OTROS',
)


class Observado(db.Model):
    __tablename__ = 'observados'

    id_obs = db.Column(BIGINT_PK, primary_key=True)
    id_cato = db.Column(db.BigInteger, db.ForeignKey('cato.id_cato'), index=True)
    id_afi = db.Column(db.String(50), db.ForeignKey('afiliados.id_afi'), index=True)
    tipo_obs = db.Column(db.String(50))
    fecha_obs = db.Column(db.Date)
    des_obs = db.Column(db.String(500))
    aclarado = db.Column(db.String(5))
    fecha_acla = db.Column(db.Date)
    des_acla = db.Column(db.String(500))

    def to_dict(self):
        return {
            'id_obs': self.id_obs,
            'id_cato': self.id_cato,
            'id_afi': self.id_afi,
            'tipo_obs': self.tipo_obs,
            'fecha_obs': self.fecha_obs.isoformat() if self.fecha_obs else None,
            'des_obs': self.des_obs,
            'aclarado': self.aclarado,
            'fecha_acla': self.fecha_acla.isoformat() if self.fecha_acla else None,
            'des_acla': self.des_acla,
        }
