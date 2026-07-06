"""Pruebas: vistas legacy Detalle de Afiliado (catos) y Registro de Mensura.

Cubre:
- GET  /api/afiliados/{id_afi}/catos           (grid Afiliaciones Registradas)
- CRUD /api/catos/{id_cato}/controles          (grid Controles Registrados)
- GET  /api/catos/{id_cato}/renovacion         (radio buttons)
- PUT  /api/catos/{id_cato}/controles/{id}/renovacion (RENOVADO / EN_CURSO)
"""
from app import db
from app.models import ControlCato, RenovacionProgramada


CONTROL_BASE = {
    'id_afi': '4444444',
    'fecha_control': '2026-01-15',
    'sup_mensura': 0.16,
    'frecuencia': 1,
    'num_lote': 2,
    'sup_lote': 1600,
    'coordenadas': '250300 8025400',
    'edad_anio': '3',
    'edad_mes': '6',
    'tecnico': 'TEC. CAMPO',
    'descripcion': 'Control de prueba',
}


def _crear_control(client, headers, **cambios):
    body = {**CONTROL_BASE, **cambios}
    resp = client.post('/api/catos/70001/controles', json=body,
                       headers=headers)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def _sembrar_renovacion(**cambios):
    datos = {
        'id_renov': 900, 'id_cato': 70001, 'id_afi': '4444444',
        'nro_solicitud': 'HR-0099', 'estado': 'PENDIENTE',
    }
    datos.update(cambios)
    renov = RenovacionProgramada(**datos)
    db.session.add(renov)
    db.session.commit()
    return renov


class TestCatosDeAfiliado:
    def test_grid_afiliaciones_registradas(self, client, auth_lector):
        resp = client.get('/api/afiliados/4444444/catos', headers=auth_lector)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['total'] == 1
        assert data['nombre_completo'] == 'PEREZ MAMANI JUAN'
        fila = data['items'][0]
        assert fila['id_cato'] == 70001
        assert fila['id_sind'] == 1
        assert fila['tipo_aut'] == 'CATASTRO'
        assert fila['sindicato'] == 'SINDICATO TEST'
        assert fila['central'] == 'CENTRAL TEST'
        assert fila['federacion'] == 'FED-TEST'

    def test_afiliado_inexistente(self, client, auth_lector):
        resp = client.get('/api/afiliados/9999999/catos', headers=auth_lector)
        assert resp.status_code == 404

    def test_requiere_token(self, client):
        assert client.get('/api/afiliados/4444444/catos').status_code == 401


class TestControlesAnidados:
    def test_crud_completo(self, client, auth_admin, auth_lector):
        creado = _crear_control(client, auth_admin)
        assert creado['id_cato'] == 70001
        assert creado['control_numero'] == 1

        # GET con JOIN Afiliados (columna NOMBRES del grid legacy)
        resp = client.get('/api/catos/70001/controles', headers=auth_lector)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['total'] == 1
        fila = data['items'][0]
        assert fila['id_afi'] == '4444444'
        assert fila['nombres'] == 'PEREZ MAMANI JUAN'
        assert fila['coordenadas'] == '250300 8025400'
        assert fila['sup_mensura'] == 0.16
        assert fila['num_lote'] == 2 and fila['sup_lote'] == 1600
        assert fila['usuario'] == 'admin.test'

        # PUT
        resp = client.put(f"/api/catos/70001/controles/{creado['id_cont']}",
                          json={'tecnico': 'TEC. NUEVO'}, headers=auth_admin)
        assert resp.status_code == 200
        assert resp.get_json()['tecnico'] == 'TEC. NUEVO'

        # DELETE
        resp = client.delete(f"/api/catos/70001/controles/{creado['id_cont']}",
                             headers=auth_admin)
        assert resp.status_code == 200
        assert ControlCato.query.count() == 0

    def test_fecha_duplicada_rechazada(self, client, auth_admin):
        _crear_control(client, auth_admin)
        resp = client.post('/api/catos/70001/controles', json=CONTROL_BASE,
                           headers=auth_admin)
        assert resp.status_code == 400

    def test_lector_no_escribe(self, client, auth_lector):
        resp = client.post('/api/catos/70001/controles', json=CONTROL_BASE,
                           headers=auth_lector)
        assert resp.status_code == 403


class TestRadioRenovacion:
    def test_sin_renovacion_vigente(self, client, auth_admin):
        control = _crear_control(client, auth_admin)
        resp = client.get('/api/catos/70001/renovacion', headers=auth_admin)
        assert resp.status_code == 200
        assert resp.get_json()['estado'] == 'SIN_RENOVACION'
        assert resp.get_json()['tiene_renovacion_vigente'] is False

        # Marcar RENOVADO sin renovacion vigente debe fallar
        resp = client.put(
            f"/api/catos/70001/controles/{control['id_cont']}/renovacion",
            json={'estado': 'RENOVADO', 'hruta_nro': 'HR-1'},
            headers=auth_admin)
        assert resp.status_code == 400

    def test_ciclo_renovado_y_reversion(self, client, auth_admin, auth_lector):
        control = _crear_control(client, auth_admin)
        renov = _sembrar_renovacion()

        # Con renovacion vigente el estado inicial es EN_CURSO
        resp = client.get('/api/catos/70001/renovacion', headers=auth_lector)
        data = resp.get_json()
        assert data['estado'] == 'EN_CURSO'
        assert data['tiene_renovacion_vigente'] is True

        # USR_PLANOS (lector) SI puede marcar renovado (regla legacy)
        resp = client.put(
            f"/api/catos/70001/controles/{control['id_cont']}/renovacion",
            json={'estado': 'RENOVADO', 'hruta_nro': 'HR-0099',
                  'fecha_destruccion': '2026-02-01'},
            headers=auth_lector)
        assert resp.status_code == 200, resp.get_json()
        data = resp.get_json()
        assert data['estado'] == 'RENOVADO'
        assert data['ultimo_control']['hruta_nro'] == 'HR-0099'

        db.session.refresh(renov)
        assert renov.fecha_destruida is not None
        assert renov.estado == 'DESTRUIDA'

        # Revertir a EN_CURSO limpia hruta_nro y fecha_destruida
        resp = client.put(
            f"/api/catos/70001/controles/{control['id_cont']}/renovacion",
            json={'estado': 'EN_CURSO'}, headers=auth_lector)
        assert resp.status_code == 200
        assert resp.get_json()['estado'] == 'EN_CURSO'
        db.session.refresh(renov)
        assert renov.fecha_destruida is None
        assert renov.estado == 'PENDIENTE'

    def test_hruta_por_defecto_de_solicitud(self, client, auth_admin):
        control = _crear_control(client, auth_admin)
        _sembrar_renovacion()
        resp = client.put(
            f"/api/catos/70001/controles/{control['id_cont']}/renovacion",
            json={'estado': 'RENOVADO'}, headers=auth_admin)
        assert resp.status_code == 200
        assert resp.get_json()['ultimo_control']['hruta_nro'] == 'HR-0099'

    def test_rol_sin_permiso(self, client, auth_admin, auth_tecnico):
        control = _crear_control(client, auth_admin)
        _sembrar_renovacion()
        # USR_TECNICO no esta en ROLES_MENSURA_RENOVACION
        resp = client.put(
            f"/api/catos/70001/controles/{control['id_cont']}/renovacion",
            json={'estado': 'RENOVADO', 'hruta_nro': 'HR-1'},
            headers=auth_tecnico)
        assert resp.status_code == 403

    def test_estado_invalido(self, client, auth_admin):
        control = _crear_control(client, auth_admin)
        resp = client.put(
            f"/api/catos/70001/controles/{control['id_cont']}/renovacion",
            json={'estado': 'OTRA_COSA'}, headers=auth_admin)
        assert resp.status_code == 400
