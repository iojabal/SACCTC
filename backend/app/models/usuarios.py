"""Modelo Usuario + RBAC.

Tipos (SQL Server MS_Description en Usuarios.tipo):
ADMINSIS, USR_DIRECCION, USR_OPERACIONES, USR_PLANOS, USR_INSPECCIONES,
USR_DOCUMENTOS, USR_SECRETARIA, USR_TECNICO, USR_LEGAL

USR_LEGAL existia en el legacy (FormPrincipal.cs / MAPEO_AREAS_Y_MODULOS.md:
"USR_LEGAL - Abogados") y se incorpora aqui para el area Legal migrada.

Las claves migradas desde SQL Server estan en texto plano; en el primer
login exitoso se re-hashean con werkzeug (pbkdf2:sha256).
"""
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models.column_types import BIGINT_PK

# Roles del sistema
ROL_ADMINSIS = 'ADMINSIS'
ROL_DIRECCION = 'USR_DIRECCION'
ROL_OPERACIONES = 'USR_OPERACIONES'
ROL_PLANOS = 'USR_PLANOS'
ROL_INSPECCIONES = 'USR_INSPECCIONES'
ROL_DOCUMENTOS = 'USR_DOCUMENTOS'
ROL_SECRETARIA = 'USR_SECRETARIA'
ROL_TECNICO = 'USR_TECNICO'
ROL_LEGAL = 'USR_LEGAL'

ROLES = (
    ROL_ADMINSIS, ROL_DIRECCION, ROL_OPERACIONES, ROL_PLANOS,
    ROL_INSPECCIONES, ROL_DOCUMENTOS, ROL_SECRETARIA, ROL_TECNICO,
    ROL_LEGAL,
)

# Roles con acceso al area Ventanilla (lectura)
ROLES_VENTANILLA_LECTURA = ROLES  # todos consultan
# Roles con permiso de escritura en Ventanilla
ROLES_VENTANILLA_ESCRITURA = (
    ROL_ADMINSIS, ROL_OPERACIONES, ROL_TECNICO, ROL_SECRETARIA,
)
# Roles que pueden eliminar registros
ROLES_VENTANILLA_ELIMINAR = (ROL_ADMINSIS, ROL_OPERACIONES)
# Gestion de usuarios: solo administrador
ROLES_ADMIN = (ROL_ADMINSIS,)

# --- Area Renovaciones -------------------------------------------------------
# Lectura: todos los roles vigentes consultan
ROLES_RENOV_LECTURA = ROLES
# Gestion del tramite (crear/actualizar/remitir a legal)
ROLES_RENOV_GESTION = (ROL_ADMINSIS, ROL_OPERACIONES)
# Registro de inspecciones de campo (informes de visita tecnica)
ROLES_RENOV_INSPECCION = (ROL_ADMINSIS, ROL_TECNICO, ROL_INSPECCIONES)

# --- Area Legal --------------------------------------------------------------
# Lectura: todos los roles vigentes consultan el estado legal de los tramites
ROLES_LEGAL_LECTURA = ROLES
# Gestion legal: informes legales, observaciones y resoluciones administrativas
ROLES_LEGAL_GESTION = (ROL_ADMINSIS, ROL_LEGAL)

# --- Area Planos -------------------------------------------------------------
# Lectura: todos los roles vigentes consultan planos
ROLES_PLANOS_LECTURA = ROLES
# Gestion de planos: registro, actualizacion y archivo
# (FormRegistroMensura legacy: USR_ADMINSIS / USR_SISTEMAS / USR_PLANOS)
ROLES_PLANOS_GESTION = (ROL_ADMINSIS, ROL_PLANOS)
# Revision de documentacion tecnica: tambien inspectores
# (FormRegistroMensura legacy: ... || USR_PLANOS || USR_INSPECCIONES)
ROLES_PLANOS_REVISION = (ROL_ADMINSIS, ROL_PLANOS, ROL_INSPECCIONES)

ESTADO_VIGENTE = 'VIGENTE'


class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id_usr = db.Column(db.Integer, primary_key=True)  # CI del usuario (PK)
    nombre_apellido = db.Column(db.String(80), nullable=False)
    cargo = db.Column(db.String(80))
    login_usr = db.Column(db.String(40), unique=True, index=True)
    clave_usr = db.Column(db.String(255))
    tipo = db.Column(db.String(20))
    estado = db.Column(db.String(20))

    # --- Gestion de claves -------------------------------------------------
    def set_password(self, plana):
        self.clave_usr = generate_password_hash(plana)

    def check_password(self, plana):
        """Verifica hash werkzeug; acepta clave plana legacy y la migra."""
        if not self.clave_usr:
            return False
        if self.clave_usr.startswith(('pbkdf2:', 'scrypt:')):
            return check_password_hash(self.clave_usr, plana)
        # Clave legacy en texto plano (migrada de SQL Server)
        if self.clave_usr == plana:
            self.set_password(plana)  # upgrade transparente a hash
            db.session.commit()
            return True
        return False

    @property
    def vigente(self):
        return self.estado == ESTADO_VIGENTE

    def to_dict(self):
        # NUNCA exponer clave_usr
        return {
            'id_usr': self.id_usr,
            'nombre_apellido': self.nombre_apellido,
            'cargo': self.cargo,
            'login_usr': self.login_usr,
            'tipo': self.tipo,
            'estado': self.estado,
        }

    def __repr__(self):
        return f'<Usuario {self.login_usr} ({self.tipo})>'
