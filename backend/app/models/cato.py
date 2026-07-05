"""Modelo Cato (catastro/propiedad) - tabla cato (100K+ registros).

tipo_aut: CATASTRO, FEDERACION, VALORACION_TECNICA_ORGANICA, NINGUNA,
          ADICIONAL_LEY906
estado:   NORMAL, BLOQUEADO
"""
from app import db
from app.models.column_types import BIGINT_PK

TIPOS_AUT = (
    'CATASTRO', 'FEDERACION', 'VALORACION_TECNICA_ORGANICA',
    'NINGUNA', 'ADICIONAL_LEY906',
)
ESTADOS_CATO = ('NORMAL', 'BLOQUEADO')


class Cato(db.Model):
    __tablename__ = 'cato'

    id = db.Column(BIGINT_PK, primary_key=True)
    id_cato = db.Column(db.BigInteger, nullable=False, unique=True, index=True)
    id_afi = db.Column(db.String(50), db.ForeignKey('afiliados.id_afi'), index=True)
    id_sind = db.Column(db.BigInteger, db.ForeignKey('sindicatos.id_sind'), index=True)
    tipo_aut = db.Column(db.String(50))
    descripcion = db.Column(db.Text)
    estado = db.Column(db.String(20))
    fecha_aut = db.Column(db.Date)
    solicitud_num = db.Column(db.String(20))
    nombre_usr = db.Column(db.String(60))

    sindicato = db.relationship('Sindicato', lazy='joined')

    def to_dict(self, incluir_org=False):
        data = {
            'id': self.id,
            'id_cato': self.id_cato,
            'id_afi': self.id_afi,
            'id_sind': self.id_sind,
            'tipo_aut': self.tipo_aut,
            'descripcion': self.descripcion,
            'estado': self.estado,
            'fecha_aut': self.fecha_aut.isoformat() if self.fecha_aut else None,
            'solicitud_num': self.solicitud_num,
            'nombre_usr': self.nombre_usr,
        }
        if incluir_org and self.sindicato:
            data['sindicato'] = self.sindicato.nombre
            if self.sindicato.central:
                data['central'] = self.sindicato.central.nombre
                if self.sindicato.central.federacion:
                    data['federacion'] = self.sindicato.central.federacion.sigla
        return data

    def __repr__(self):
        return f'<Cato {self.id_cato}>'
