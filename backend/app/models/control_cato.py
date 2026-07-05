"""Modelo ControlCato (control tecnico/mensura) - 262,573 registros."""
from app import db
from app.models.column_types import BIGINT_PK


class ControlCato(db.Model):
    __tablename__ = 'controlcato'

    id_cont = db.Column(BIGINT_PK, primary_key=True)
    id_cato = db.Column(db.BigInteger, db.ForeignKey('cato.id_cato'), index=True)
    fecha_control = db.Column(db.Date, index=True)
    id_afi = db.Column(db.String(50), db.ForeignKey('afiliados.id_afi'),
                       nullable=False, index=True)
    control_numero = db.Column(db.Integer)
    coordenadas = db.Column(db.String(100))
    sup_mensura = db.Column(db.Numeric(8, 4))
    frecuencia = db.Column(db.Integer)
    edad_anio = db.Column(db.String(20))
    edad_mes = db.Column(db.String(20))
    num_lote = db.Column(db.Integer)
    sup_lote = db.Column(db.Integer)
    tecnico = db.Column(db.String(60))
    descripcion = db.Column(db.Text)
    usuario = db.Column(db.String(50))
    id_renov = db.Column(db.BigInteger, nullable=False, default=0)
    hruta_nro = db.Column(db.String(100))

    afiliado = db.relationship(
        'Afiliado', lazy='joined',
        primaryjoin='foreign(ControlCato.id_afi) == Afiliado.id_afi')

    def to_dict(self):
        return {
            'id_cont': self.id_cont,
            'id_cato': self.id_cato,
            'fecha_control': self.fecha_control.isoformat() if self.fecha_control else None,
            'id_afi': self.id_afi,
            'nombre': self.afiliado.nombre_completo if self.afiliado else None,
            'control_numero': self.control_numero,
            'coordenadas': self.coordenadas,
            'sup_mensura': float(self.sup_mensura) if self.sup_mensura is not None else None,
            'frecuencia': self.frecuencia,
            'edad_anio': self.edad_anio,
            'edad_mes': self.edad_mes,
            'num_lote': self.num_lote,
            'sup_lote': self.sup_lote,
            'tecnico': self.tecnico,
            'descripcion': self.descripcion,
            'usuario': self.usuario,
            'hruta_nro': self.hruta_nro,
        }

    def __repr__(self):
        return f'<ControlCato {self.id_cont} cato={self.id_cato}>'
