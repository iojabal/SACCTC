"""Fixtures de pruebas: app Flask con SQLite en memoria + datos semilla."""
import os

import pytest

os.environ['FLASK_ENV'] = 'testing'  # antes de importar la app

from app import create_app, db  # noqa: E402
from app.models import (  # noqa: E402
    Usuario, Afiliado, Cato, Federacion, Central, Sindicato,
)

CLAVE_TESTS = 'clave-tests-123'


def _sembrar():
    """Datos minimos: usuarios de cada perfil + org sindical + afiliados."""
    admin = Usuario(id_usr=100, nombre_apellido='ADMIN PRUEBAS',
                    cargo='ADMINISTRADOR', login_usr='admin.test',
                    tipo='ADMINSIS', estado='VIGENTE')
    admin.set_password(CLAVE_TESTS)
    lector = Usuario(id_usr=101, nombre_apellido='LECTOR PRUEBAS',
                     cargo='PLANOS', login_usr='lector.test',
                     tipo='USR_PLANOS', estado='VIGENTE')
    lector.set_password(CLAVE_TESTS)
    baja = Usuario(id_usr=102, nombre_apellido='USUARIO BAJA',
                   cargo='OPERACIONES', login_usr='baja.test',
                   tipo='USR_OPERACIONES', estado='BAJA')
    baja.set_password(CLAVE_TESTS)
    tecnico = Usuario(id_usr=103, nombre_apellido='TECNICO PRUEBAS',
                      cargo='TECNICO DE CAMPO', login_usr='tecnico.test',
                      tipo='USR_TECNICO', estado='VIGENTE')
    tecnico.set_password(CLAVE_TESTS)
    operador = Usuario(id_usr=104, nombre_apellido='OPERADOR PRUEBAS',
                       cargo='OPERACIONES', login_usr='operador.test',
                       tipo='USR_OPERACIONES', estado='VIGENTE')
    operador.set_password(CLAVE_TESTS)
    legal = Usuario(id_usr=105, nombre_apellido='ABOGADO PRUEBAS',
                    cargo='ABOGADO', login_usr='legal.test',
                    tipo='USR_LEGAL', estado='VIGENTE')
    legal.set_password(CLAVE_TESTS)
    inspector = Usuario(id_usr=106, nombre_apellido='INSPECTOR PRUEBAS',
                        cargo='INSPECTOR', login_usr='inspector.test',
                        tipo='USR_INSPECCIONES', estado='VIGENTE')
    inspector.set_password(CLAVE_TESTS)

    fede = Federacion(id_fed=1, sigla='FED-TEST', dpto='COCHABAMBA',
                      prov='CHAPARE', mun='VILLA TUNARI')
    cent = Central(id_cent=1, id_fed=1, nombre='CENTRAL TEST')
    sind = Sindicato(id_sind=1, id_cent=1, nombre='SINDICATO TEST')

    titular = Afiliado(id_afi='4444444', ext='CB', apellido1='PEREZ',
                       apellido2='MAMANI', nombres='JUAN',
                       genero='MASCULINO', estado='SIN_OBSERVACION')
    entrante = Afiliado(id_afi='5555555', ext='CB', apellido1='QUISPE',
                        apellido2='ROJAS', nombres='MARIA',
                        genero='FEMENINO', estado='SIN_OBSERVACION')
    sin_cato = Afiliado(id_afi='6666666', ext='CB', apellido1='CONDORI',
                        apellido2='FLORES', nombres='PEDRO',
                        genero='MASCULINO', estado='SIN_OBSERVACION')

    cato = Cato(id_cato=70001, id_afi='4444444', id_sind=1,
                tipo_aut='CATASTRO', estado='NORMAL')

    db.session.add_all([admin, lector, baja, tecnico, operador,
                        legal, inspector,
                        fede, cent, sind,
                        titular, entrante, sin_cato, cato])
    db.session.commit()


@pytest.fixture()
def app():
    aplicacion = create_app('testing')
    with aplicacion.app_context():
        db.drop_all()
        db.create_all()
        _sembrar()
        yield aplicacion
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _login(client, login_usr):
    resp = client.post('/api/usuarios/login',
                       json={'login_usr': login_usr, 'clave_usr': CLAVE_TESTS})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()['access_token']


@pytest.fixture()
def auth_admin(client):
    """Cabeceras Authorization de un ADMINSIS (escritura + eliminacion)."""
    return {'Authorization': f'Bearer {_login(client, "admin.test")}'}


@pytest.fixture()
def auth_lector(client):
    """Cabeceras de un USR_PLANOS (solo lectura)."""
    return {'Authorization': f'Bearer {_login(client, "lector.test")}'}


@pytest.fixture()
def auth_tecnico(client):
    """Cabeceras de un USR_TECNICO (registra inspecciones)."""
    return {'Authorization': f'Bearer {_login(client, "tecnico.test")}'}


@pytest.fixture()
def auth_operador(client):
    """Cabeceras de un USR_OPERACIONES (gestiona renovaciones)."""
    return {'Authorization': f'Bearer {_login(client, "operador.test")}'}


@pytest.fixture()
def auth_legal(client):
    """Cabeceras de un USR_LEGAL (gestiona el area Legal)."""
    return {'Authorization': f'Bearer {_login(client, "legal.test")}'}


@pytest.fixture()
def auth_inspector(client):
    """Cabeceras de un USR_INSPECCIONES (revisa documentacion tecnica)."""
    return {'Authorization': f'Bearer {_login(client, "inspector.test")}'}
