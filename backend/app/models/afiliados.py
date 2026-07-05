"""Modelo Afiliado - tabla afiliados (69,978 registros).

Estados validos (SQL Server MS_Description):
SIN_OBSERVACION, TRANSFERIDO, AUT_FEDERACION, SIN_CATASTRO, POZA,
OBS_SISTEMAS, OBS_SOLICITUD
"""
from app import db
from app.models.column_types import BIGINT_PK

ESTADOS_AFILIADO = (
    'SIN_OBSERVACION', 'TRANSFERIDO', 'AUT_FEDERACION', 'SIN_CATASTRO',
    'POZA', 'OBS_SISTEMAS', 'OBS_SOLICITUD',
)
GENEROS = ('MASCULINO', 'FEMENINO', 'M', 'F')


class Afiliado(db.Model):
    __tablename__ = 'afiliados'

    id = db.Column(BIGINT_PK, primary_key=True)
    id_afi = db.Column(db.String(50), nullable=False, unique=True, index=True)  # CI
    ext = db.Column(db.String(10))            # extension CI: CB, LP, SC...
    apellido1 = db.Column(db.String(50))
    apellido2 = db.Column(db.String(50))
    nombres = db.Column(db.String(50))
    fecha_nac = db.Column(db.Date)
    genero = db.Column(db.String(10))
    estado = db.Column(db.String(30))
    obs = db.Column(db.Text)

    catos = db.relationship('Cato', backref='afiliado', lazy='dynamic',
                            primaryjoin='Afiliado.id_afi == foreign(Cato.id_afi)')

    @property
    def nombre_completo(self):
        """Equivalente a ProcGetNombAfi: solo partes no vacias."""
        partes = [p for p in (self.apellido1, self.apellido2, self.nombres) if p]
        return ' '.join(partes)

    def to_dict(self, incluir_catos=False):
        data = {
            'id': self.id,
            'id_afi': self.id_afi,
            'ext': self.ext,
            'apellido1': self.apellido1,
            'apellido2': self.apellido2,
            'nombres': self.nombres,
            'nombre_completo': self.nombre_completo,
            'fecha_nac': self.fecha_nac.isoformat() if self.fecha_nac else None,
            'genero': self.genero,
            'estado': self.estado,
            'obs': self.obs,
        }
        if incluir_catos:
            data['catos'] = [c.to_dict() for c in self.catos]
        return data

    def __repr__(self):
        return f'<Afiliado {self.id_afi}>'
