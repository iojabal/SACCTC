"""Middleware de autenticacion JWT + RBAC.

Uso:
    @bp.route('/afiliados', methods=['POST'])
    @requiere_roles(*ROLES_VENTANILLA_ESCRITURA)
    def crear_afiliado():
        ...

El decorador valida:
1. Token JWT presente y valido.
2. Usuario existe y esta VIGENTE (revocacion inmediata al deshabilitar).
3. El tipo (rol) del usuario esta dentro de los roles permitidos.
"""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from app.models.usuarios import Usuario


def usuario_actual():
    """Devuelve el Usuario del token actual (o None)."""
    login = get_jwt_identity()
    if not login:
        return None
    return Usuario.query.filter_by(login_usr=login).first()


def requiere_roles(*roles_permitidos):
    """Exige JWT valido, usuario VIGENTE y rol dentro de roles_permitidos.

    Si no se pasan roles, solo exige autenticacion (cualquier rol vigente).
    """
    def decorador(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
            except Exception:
                return jsonify({'error': 'Token invalido o ausente'}), 401

            usuario = usuario_actual()
            if usuario is None:
                return jsonify({'error': 'Usuario no encontrado'}), 401
            if not usuario.vigente:
                return jsonify({'error': 'Usuario no vigente'}), 403
            if roles_permitidos and usuario.tipo not in roles_permitidos:
                return jsonify({
                    'error': 'Permisos insuficientes',
                    'rol': usuario.tipo,
                    'requeridos': list(roles_permitidos),
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorador
