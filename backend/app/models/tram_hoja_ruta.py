"""Modelo TramHojaDeRuta (tramites de sustitucion).

sustitucion: TRANSFERENCIA, REASIGNACION
sustitucion_tipo: COMPRA-VENTA, SUCESION-HEREDITARIA, RENUNCIA-VOLUNTARIA,
                  ABANDONO, SENTENCIA-PENAL
estado: EN_PROCESO, FINALIZADO
"""
from app import db
from app.models.column_types import BIGINT_PK

SUSTITUCIONES = ('TRANSFERENCIA', 'REASIGNACION')
SUSTITUCION_TIPOS = (
    'COMPRA-VENTA', 'SUCESION-HEREDITARIA', 'RENUNCIA-VOLUNTARIA',
    'ABANDONO', 'SENTENCIA-PENAL',
)
ESTADOS_TRAMITE = ('EN_PROCESO', 'FINALIZADO')


class TramHojaDeRuta(db.Model):
    __tablename__ = 'tramhojaderuta'

    id = db.Column(BIGINT_PK, primary_key=True)
    hruta = db.Column(db.String(50), nullable=False, index=True)
    hruta_fecha = db.Column(db.Date, nullable=False)
    id_cato = db.Column(db.BigInteger, nullable=False, index=True)
    cato_utm_xy = db.Column(db.String(100))
    lote_nro = db.Column(db.String(20))
    lote_nro_nuevo = db.Column(db.String(20))
    sustitucion = db.Column(db.String(30))
    sustitucion_tipo = db.Column(db.String(40))
    tecnico_info_nro = db.Column(db.String(50))
    tecnico_info_fecha = db.Column(db.Date)
    tecnico_info_obs = db.Column(db.Text)
    legal_info_nro = db.Column(db.String(50))
    legal_info_fecha = db.Column(db.Date)
    legal_info_obs = db.Column(db.Text)
    legal_resol_nro = db.Column(db.String(50))
    legal_resol_fecha = db.Column(db.Date)
    legal_resol_obs = db.Column(db.Text)
    titular_ci = db.Column(db.String(50))
    titular_exp = db.Column(db.String(10))
    titular_nombre = db.Column(db.String(150))
    solicitante_ci = db.Column(db.String(50))
    solicitante_nombre = db.Column(db.String(150))
    departamento = db.Column(db.String(100))
    provincia = db.Column(db.String(100))
    municipio = db.Column(db.String(100))
    federacion = db.Column(db.String(100))
    central = db.Column(db.String(200))
    sindicato = db.Column(db.String(200))
    estado = db.Column(db.String(20), index=True)
    login_usr = db.Column(db.String(40))

    def to_dict(self):
        d = {}
        for col in self.__table__.columns:
            val = getattr(self, col.name)
            d[col.name] = val.isoformat() if hasattr(val, 'isoformat') else val
        return d
