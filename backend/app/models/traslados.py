"""Modelo Traslado (traslado de cato entre sindicatos)."""
from app import db
from app.models.column_types import BIGINT_PK


class Traslado(db.Model):
    __tablename__ = 'traslados'

    id = db.Column(BIGINT_PK, primary_key=True)
    id_cato = db.Column(db.BigInteger, db.ForeignKey('cato.id_cato'),
                        nullable=False, index=True)
    id_sind_origen = db.Column(db.BigInteger, db.ForeignKey('sindicatos.id_sind'),
                               nullable=False)
    id_sind_destino = db.Column(db.BigInteger, db.ForeignKey('sindicatos.id_sind'),
                                nullable=False)
    obs = db.Column(db.Text)

    sind_origen = db.relationship('Sindicato', foreign_keys=[id_sind_origen])
    sind_destino = db.relationship('Sindicato', foreign_keys=[id_sind_destino])

    def to_dict(self):
        return {
            'id': self.id,
            'id_cato': self.id_cato,
            'id_sind_origen': self.id_sind_origen,
            'sind_origen': self.sind_origen.nombre if self.sind_origen else None,
            'id_sind_destino': self.id_sind_destino,
            'sind_destino': self.sind_destino.nombre if self.sind_destino else None,
            'obs': self.obs,
        }
