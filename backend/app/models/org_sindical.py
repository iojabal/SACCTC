"""Modelos de organizacion sindical: Federacion -> Central -> Sindicato."""
from app import db
from app.models.column_types import BIGINT_PK


class Federacion(db.Model):
    __tablename__ = 'federaciones'

    id_fed = db.Column(BIGINT_PK, primary_key=True)
    sigla = db.Column(db.String(100))
    obs = db.Column(db.Text)
    dpto = db.Column(db.String(100))
    prov = db.Column(db.String(100))
    mun = db.Column(db.String(100))

    centrales = db.relationship('Central', backref='federacion', lazy='dynamic')

    def to_dict(self):
        return {
            'id_fed': self.id_fed, 'sigla': self.sigla, 'obs': self.obs,
            'dpto': self.dpto, 'prov': self.prov, 'mun': self.mun,
        }


class Central(db.Model):
    __tablename__ = 'centrales'

    id_cent = db.Column(BIGINT_PK, primary_key=True)
    id_fed = db.Column(db.BigInteger, db.ForeignKey('federaciones.id_fed'))
    nombre = db.Column(db.String(200))
    obs = db.Column(db.Text)

    sindicatos = db.relationship('Sindicato', backref='central', lazy='dynamic')

    def to_dict(self):
        return {
            'id_cent': self.id_cent, 'id_fed': self.id_fed,
            'nombre': self.nombre, 'obs': self.obs,
        }


class Sindicato(db.Model):
    __tablename__ = 'sindicatos'

    id_sind = db.Column(BIGINT_PK, primary_key=True)
    id_cent = db.Column(db.BigInteger, db.ForeignKey('centrales.id_cent'))
    nombre = db.Column(db.String(200))
    obs = db.Column(db.Text)

    def to_dict(self, incluir_jerarquia=False):
        data = {
            'id_sind': self.id_sind, 'id_cent': self.id_cent,
            'nombre': self.nombre, 'obs': self.obs,
        }
        if incluir_jerarquia and self.central:
            data['central'] = self.central.nombre
            if self.central.federacion:
                data['federacion'] = self.central.federacion.sigla
                data['departamento'] = self.central.federacion.dpto
                data['provincia'] = self.central.federacion.prov
                data['municipio'] = self.central.federacion.mun
        return data
