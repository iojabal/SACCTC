"""Rutas: autenticacion (login JWT) y gestion de usuarios (RBAC)."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token

from app import db
from app.models import Usuario
from app.models.usuarios import ROLES, ROLES_ADMIN, ESTADO_VIGENTE
from app.middleware.auth import requiere_roles, usuario_actual
from app.middleware.validators import ValidationError, limpiar, parsear_entero

usuarios_bp = Blueprint('usuarios', __name__, url_prefix='/api/usuarios')


@usuarios_bp.route('/login', methods=['POST'])
def login():
    """Login: reemplaza VerificarUsr. Devuelve JWT + datos del usuario."""
    data = request.get_json(silent=True) or {}
    login_usr = limpiar(data.get('login_usr'))
    clave = data.get('clave_usr') or ''
    if not login_usr or not clave:
        return jsonify({'error': 'login_usr y clave_usr son requeridos'}), 400

    usuario = Usuario.query.filter_by(login_usr=login_usr).first()
    if usuario is None or not usuario.check_password(clave):
        # Mensaje generico: no revelar si el usuario existe
        return jsonify({'error': 'Credenciales invalidas'}), 401
    if not usuario.vigente:
        return jsonify({'error': 'Usuario no vigente'}), 403

    token = create_access_token(identity=usuario.login_usr,
                                additional_claims={'tipo': usuario.tipo})
    return jsonify({'access_token': token, 'usuario': usuario.to_dict()})


@usuarios_bp.route('/me', methods=['GET'])
@requiere_roles()
def perfil():
    return jsonify(usuario_actual().to_dict())


@usuarios_bp.route('', methods=['GET'])
@requiere_roles(*ROLES_ADMIN)
def listar():
    """ProcUsuarios / ProcUsuarios2 (filtro por nombre)."""
    nombre = limpiar(request.args.get('nombre'))
    query = Usuario.query
    if nombre:
        query = query.filter(Usuario.nombre_apellido.ilike(f'%{nombre}%'))
    usuarios = query.order_by(Usuario.nombre_apellido.asc()).all()
    return jsonify([u.to_dict() for u in usuarios])


@usuarios_bp.route('', methods=['POST'])
@requiere_roles(*ROLES_ADMIN)
def crear():
    """UsuariosNuevo con clave hasheada."""
    data = request.get_json(silent=True) or {}
    errores = []
    id_usr = parsear_entero(data.get('id_usr'), 'id_usr', errores, obligatorio=True)
    nombre = limpiar(data.get('nombre_apellido'))
    login_usr = limpiar(data.get('login_usr'))
    clave = data.get('clave_usr') or ''
    tipo = limpiar(data.get('tipo'))
    if not nombre:
        errores.append('nombre_apellido es requerido')
    if not login_usr:
        errores.append('login_usr es requerido')
    if len(clave) < 6:
        errores.append('clave_usr debe tener al menos 6 caracteres')
    if tipo not in ROLES:
        errores.append(f'tipo invalido; validos: {", ".join(ROLES)}')
    if errores:
        return ValidationError(errores).respuesta()

    if Usuario.query.filter_by(login_usr=login_usr).count() > 0:  # UsuarioExiste
        return jsonify({'error': f'Ya existe el usuario {login_usr}'}), 409

    usuario = Usuario(id_usr=id_usr, nombre_apellido=nombre,
                      cargo=limpiar(data.get('cargo')), login_usr=login_usr,
                      tipo=tipo, estado=limpiar(data.get('estado')) or ESTADO_VIGENTE)
    usuario.set_password(clave)
    db.session.add(usuario)
    db.session.commit()
    return jsonify(usuario.to_dict()), 201


@usuarios_bp.route('/<login_usr>', methods=['PUT'])
@requiere_roles(*ROLES_ADMIN)
def editar(login_usr):
    """UsuariosEditar."""
    usuario = Usuario.query.filter_by(login_usr=login_usr).first()
    if usuario is None:
        return jsonify({'error': f'No existe el usuario {login_usr}'}), 404

    data = request.get_json(silent=True) or {}
    errores = []
    nuevo_login = limpiar(data.get('login_usr')) or usuario.login_usr
    tipo = limpiar(data.get('tipo')) or usuario.tipo
    if tipo not in ROLES:
        errores.append(f'tipo invalido; validos: {", ".join(ROLES)}')
    if nuevo_login != login_usr and \
            Usuario.query.filter_by(login_usr=nuevo_login).count() > 0:
        errores.append(f'Ya existe el usuario {nuevo_login}')
    if errores:
        return ValidationError(errores).respuesta()

    if data.get('id_usr') is not None:
        id_usr = parsear_entero(data.get('id_usr'), 'id_usr', errores)
        if errores:
            return ValidationError(errores).respuesta()
        usuario.id_usr = id_usr
    usuario.nombre_apellido = limpiar(data.get('nombre_apellido')) or usuario.nombre_apellido
    usuario.cargo = limpiar(data.get('cargo')) if 'cargo' in data else usuario.cargo
    usuario.login_usr = nuevo_login
    usuario.tipo = tipo
    if limpiar(data.get('estado')):
        usuario.estado = limpiar(data.get('estado'))
    clave = data.get('clave_usr')
    if clave:
        if len(clave) < 6:
            return ValidationError('clave_usr debe tener al menos 6 caracteres').respuesta()
        usuario.set_password(clave)
    db.session.commit()
    return jsonify(usuario.to_dict())
