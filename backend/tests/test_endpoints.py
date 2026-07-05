"""Pruebas de los endpoints del area Ventanilla (CRUD basicos + RBAC).

Ejecutar desde /backend:  python -m pytest tests/ -v
"""


# ---------------------------------------------------------------------------
# Salud y autenticacion
# ---------------------------------------------------------------------------

class TestAuth:
    def test_health(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200
        assert resp.get_json()['status'] == 'OK'

    def test_login_ok(self, client):
        resp = client.post('/api/usuarios/login',
                           json={'login_usr': 'admin.test',
                                 'clave_usr': 'clave-tests-123'})
        data = resp.get_json()
        assert resp.status_code == 200
        assert 'access_token' in data
        assert data['usuario']['tipo'] == 'ADMINSIS'
        assert 'clave_usr' not in data['usuario']

    def test_login_clave_incorrecta(self, client):
        resp = client.post('/api/usuarios/login',
                           json={'login_usr': 'admin.test', 'clave_usr': 'mala'})
        assert resp.status_code == 401

    def test_login_usuario_no_vigente(self, client):
        resp = client.post('/api/usuarios/login',
                           json={'login_usr': 'baja.test',
                                 'clave_usr': 'clave-tests-123'})
        assert resp.status_code == 403

    def test_endpoint_sin_token(self, client):
        assert client.get('/api/afiliados').status_code == 401

    def test_perfil(self, client, auth_admin):
        resp = client.get('/api/usuarios/me', headers=auth_admin)
        assert resp.status_code == 200
        assert resp.get_json()['login_usr'] == 'admin.test'


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

class TestRBAC:
    def test_lector_puede_consultar(self, client, auth_lector):
        assert client.get('/api/afiliados', headers=auth_lector).status_code == 200

    def test_lector_no_puede_escribir(self, client, auth_lector):
        resp = client.post('/api/afiliados', headers=auth_lector,
                           json={'id_afi': '9999999'})
        assert resp.status_code == 403

    def test_lector_no_gestiona_usuarios(self, client, auth_lector):
        assert client.get('/api/usuarios', headers=auth_lector).status_code == 403

    def test_admin_gestiona_usuarios(self, client, auth_admin):
        assert client.get('/api/usuarios', headers=auth_admin).status_code == 200


# ---------------------------------------------------------------------------
# Afiliados
# ---------------------------------------------------------------------------

class TestAfiliados:
    def test_busqueda_paginada(self, client, auth_lector):
        resp = client.get('/api/afiliados?q=PEREZ', headers=auth_lector)
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['total'] >= 1
        assert any(a['id_afi'] == '4444444' for a in data['items'])

    def test_detalle(self, client, auth_lector):
        resp = client.get('/api/afiliados/4444444', headers=auth_lector)
        assert resp.status_code == 200
        assert resp.get_json()['nombre_completo'] == 'PEREZ MAMANI JUAN'

    def test_detalle_inexistente(self, client, auth_lector):
        assert client.get('/api/afiliados/0000000',
                          headers=auth_lector).status_code == 404

    def test_existe(self, client, auth_lector):
        resp = client.get('/api/afiliados/4444444/existe', headers=auth_lector)
        assert resp.get_json()['existe'] is True

    def test_cato_vigente(self, client, auth_lector):
        resp = client.get('/api/afiliados/4444444/cato-vigente',
                          headers=auth_lector)
        data = resp.get_json()
        assert data['tiene_cato'] is True
        assert data['id_cato'] == 70001

    def test_crear_y_actualizar(self, client, auth_admin):
        nuevo = {'id_afi': '7777777', 'ext': 'CB', 'apellido1': 'GUTIERREZ',
                 'nombres': 'ANA', 'genero': 'FEMENINO',
                 'estado': 'SIN_CATASTRO'}
        resp = client.post('/api/afiliados', headers=auth_admin, json=nuevo)
        assert resp.status_code == 201, resp.get_json()

        # El PUT replica ProcAfiActualizar: espera el registro completo
        resp = client.put('/api/afiliados/7777777', headers=auth_admin,
                          json={**nuevo, 'nombres': 'ANA MARIA'})
        assert resp.status_code == 200, resp.get_json()
        assert resp.get_json()['nombres'] == 'ANA MARIA'

    def test_crear_duplicado(self, client, auth_admin):
        resp = client.post('/api/afiliados', headers=auth_admin,
                           json={'id_afi': '4444444', 'apellido1': 'X',
                                 'nombres': 'Y'})
        assert resp.status_code in (400, 409)


# ---------------------------------------------------------------------------
# Catos (catastro)
# ---------------------------------------------------------------------------

class TestCatos:
    def test_listar_filtrado(self, client, auth_lector):
        resp = client.get('/api/catos?id_afi=4444444', headers=auth_lector)
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['total'] == 1
        assert data['items'][0]['id_cato'] == 70001
        assert data['items'][0]['sindicato'] == 'SINDICATO TEST'

    def test_detalle_con_flags(self, client, auth_lector):
        resp = client.get('/api/catos/70001', headers=auth_lector)
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['afiliado']['id_afi'] == '4444444'
        assert data['tiene_cambios'] is False
        assert data['tiene_controles'] is False

    def test_crear_para_afiliado_sin_cato(self, client, auth_admin):
        resp = client.post('/api/catos', headers=auth_admin,
                           json={'id_cato': 70002, 'id_afi': '6666666',
                                 'id_sind': 1, 'tipo_aut': 'CATASTRO'})
        assert resp.status_code == 201, resp.get_json()

    def test_rechaza_segundo_cato_vigente(self, client, auth_admin):
        resp = client.post('/api/catos', headers=auth_admin,
                           json={'id_cato': 70003, 'id_afi': '4444444',
                                 'id_sind': 1, 'tipo_aut': 'CATASTRO'})
        assert resp.status_code == 409

    def test_ultimo_codigo(self, client, auth_lector):
        resp = client.get('/api/catos/ultimo-codigo/7', headers=auth_lector)
        assert resp.get_json()['ultimo_id_cato'] == 70001

    def test_eliminar_sin_dependencias(self, client, auth_admin):
        client.post('/api/catos', headers=auth_admin,
                    json={'id_cato': 70009, 'id_afi': '6666666',
                          'id_sind': 1, 'tipo_aut': 'NINGUNA'})
        resp = client.delete('/api/catos/70009', headers=auth_admin)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Cambios (transferencias)
# ---------------------------------------------------------------------------

class TestCambios:
    PAYLOAD = {
        'id_cato': 70001, 'id_afi_titular': '4444444',
        'id_afi_nuevo': '5555555', 'tipo_cambio': 'COMPRA-VENTA',
        'fecha_cambio': '2026-07-01',
    }

    def test_registrar_transfiere_cato(self, client, auth_admin, auth_lector):
        resp = client.post('/api/cambios', headers=auth_admin, json=self.PAYLOAD)
        assert resp.status_code == 201, resp.get_json()

        # El cato ahora pertenece al afiliado entrante
        cato = client.get('/api/catos/70001', headers=auth_lector).get_json()
        assert cato['id_afi'] == '5555555'
        assert cato['tiene_cambios'] is True

    def test_rechaza_titular_falso(self, client, auth_admin):
        resp = client.post('/api/cambios', headers=auth_admin,
                           json={**self.PAYLOAD, 'id_afi_titular': '6666666',
                                 'id_afi_nuevo': '5555555'})
        assert resp.status_code == 400

    def test_historial(self, client, auth_admin, auth_lector):
        client.post('/api/cambios', headers=auth_admin, json=self.PAYLOAD)
        resp = client.get('/api/cambios/cato/70001/historial', headers=auth_lector)
        historial = resp.get_json()
        assert resp.status_code == 200
        assert len(historial) == 1
        assert historial[0]['id_afi_nuevo'] == '5555555'

    def test_eliminar_revierte_titular(self, client, auth_admin, auth_lector):
        creado = client.post('/api/cambios', headers=auth_admin,
                             json=self.PAYLOAD).get_json()
        resp = client.delete(f"/api/cambios/{creado['id_trf']}",
                             headers=auth_admin)
        assert resp.status_code == 200
        cato = client.get('/api/catos/70001', headers=auth_lector).get_json()
        assert cato['id_afi'] == '4444444'

    def test_titular_queda_transferido(self, client, auth_admin, auth_lector):
        # El titular 4444444 solo tiene el cato 70001; al transferirlo queda
        # sin ningun cato vigente => estado TRANSFERIDO.
        resp = client.post('/api/cambios', headers=auth_admin,
                           json=self.PAYLOAD)
        assert resp.status_code == 201, resp.get_json()
        afi = client.get('/api/afiliados/4444444', headers=auth_lector).get_json()
        assert afi['estado'] == 'TRANSFERIDO'
        assert afi['tiene_cato_vigente'] is False

    def test_eliminar_revierte_estado_transferido(self, client, auth_admin,
                                                  auth_lector):
        creado = client.post('/api/cambios', headers=auth_admin,
                             json=self.PAYLOAD).get_json()
        client.delete(f"/api/cambios/{creado['id_trf']}", headers=auth_admin)
        afi = client.get('/api/afiliados/4444444', headers=auth_lector).get_json()
        # Al recuperar el cato deja de estar TRANSFERIDO
        assert afi['estado'] == 'SIN_OBSERVACION'


# ---------------------------------------------------------------------------
# Controles tecnicos
# ---------------------------------------------------------------------------

class TestControles:
    PAYLOAD = {
        'id_cato': 70001, 'id_afi': '4444444',
        'fecha_control': '2026-06-15', 'sup_mensura': 0.1600,
        'tecnico': 'TEC. PRUEBAS',
    }

    def test_registrar_numera_automatico(self, client, auth_admin):
        resp = client.post('/api/controles', headers=auth_admin, json=self.PAYLOAD)
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['control_numero'] == 1
        assert data['usuario'] == 'admin.test'

    def test_rechaza_fecha_duplicada(self, client, auth_admin):
        client.post('/api/controles', headers=auth_admin, json=self.PAYLOAD)
        resp = client.post('/api/controles', headers=auth_admin, json=self.PAYLOAD)
        assert resp.status_code == 400

    def test_historial_y_ultimo(self, client, auth_admin, auth_lector):
        client.post('/api/controles', headers=auth_admin, json=self.PAYLOAD)
        client.post('/api/controles', headers=auth_admin,
                    json={**self.PAYLOAD, 'fecha_control': '2026-06-20'})

        resp = client.get('/api/controles/cato/70001', headers=auth_lector)
        assert len(resp.get_json()) == 2

        ultimo = client.get('/api/controles/cato/70001/ultimo',
                            headers=auth_lector).get_json()
        assert ultimo['fecha_control'] == '2026-06-20'
        assert ultimo['control_numero'] == 2

    def test_ultimo_sin_controles_404(self, client, auth_lector):
        assert client.get('/api/controles/cato/70001/ultimo',
                          headers=auth_lector).status_code == 404

    def test_actualizar_y_eliminar(self, client, auth_admin):
        creado = client.post('/api/controles', headers=auth_admin,
                             json=self.PAYLOAD).get_json()
        id_cont = creado['id_cont']

        resp = client.put(f'/api/controles/{id_cont}', headers=auth_admin,
                          json={'sup_mensura': 0.25})
        assert resp.status_code == 200
        assert float(resp.get_json()['sup_mensura']) == 0.25

        assert client.delete(f'/api/controles/{id_cont}',
                             headers=auth_admin).status_code == 200


# ---------------------------------------------------------------------------
# Organizacion sindical
# ---------------------------------------------------------------------------

class TestOrgSindical:
    def test_cascada(self, client, auth_lector):
        feds = client.get('/api/org/federaciones', headers=auth_lector).get_json()
        assert any(f['sigla'] == 'FED-TEST' for f in feds)

        cents = client.get('/api/org/federaciones/1/centrales',
                           headers=auth_lector).get_json()
        assert cents[0]['nombre'] == 'CENTRAL TEST'

        sinds = client.get('/api/org/centrales/1/sindicatos',
                           headers=auth_lector).get_json()
        assert sinds[0]['nombre'] == 'SINDICATO TEST'
