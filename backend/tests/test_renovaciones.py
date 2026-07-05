"""Pruebas del area Renovaciones (flujo completo + RBAC).

Ejecutar desde /backend:  python -m pytest tests/test_renovaciones.py -v
"""


def _crear_renovacion(client, headers, **extra):
    payload = {'id_afi': '4444444', 'nro_solicitud': 'HR-0001',
               'hruta_fecha': '2026-07-01'}
    payload.update(extra)
    return client.post('/api/renovaciones', headers=headers, json=payload)


def _crear_informe(client, headers, id_renovacion, **extra):
    payload = {'fecha_visita': '2026-07-02', 'resultado': 'FACTIBLE',
               'nro_informe': 'CITE-001', 'causal_inciso': 'c',
               'superficie': 0.16, 'coordenadas': '123456-7890123',
               'observaciones': 'Parcela apta para renovacion'}
    payload.update(extra)
    return client.post(f'/api/renovaciones/{id_renovacion}/informes',
                       headers=headers, json=payload)


# ---------------------------------------------------------------------------
# Elegibilidad
# ---------------------------------------------------------------------------

class TestElegibilidad:
    def test_afiliado_elegible(self, client, auth_lector):
        resp = client.get('/api/renovaciones/afiliado/4444444/elegibilidad',
                          headers=auth_lector)
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['elegible'] is True
        assert data['id_cato_vigente'] == 70001
        assert data['checks']['tiene_cato_vigente'] is True
        assert data['checks']['sin_observaciones_pendientes'] is True

    def test_afiliado_sin_cato_no_elegible(self, client, auth_lector):
        resp = client.get('/api/renovaciones/afiliado/6666666/elegibilidad',
                          headers=auth_lector)
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['elegible'] is False
        assert data['checks']['tiene_cato_vigente'] is False

    def test_afiliado_inexistente_404(self, client, auth_lector):
        resp = client.get('/api/renovaciones/afiliado/9999999/elegibilidad',
                          headers=auth_lector)
        assert resp.status_code == 404

    def test_renovacion_activa_bloquea(self, client, auth_admin, auth_lector):
        assert _crear_renovacion(client, auth_admin).status_code == 201
        resp = client.get('/api/renovaciones/afiliado/4444444/elegibilidad',
                          headers=auth_lector)
        data = resp.get_json()
        assert data['elegible'] is False
        assert data['checks']['sin_renovacion_activa'] is False


# ---------------------------------------------------------------------------
# CRUD del tramite
# ---------------------------------------------------------------------------

class TestRenovacionesCRUD:
    def test_crear_ok(self, client, auth_admin):
        resp = _crear_renovacion(client, auth_admin)
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['estado'] == 'PENDIENTE'
        assert data['id_cato'] == 70001
        assert data['id_renov'] == 1  # numeracion de negocio
        assert data['sindicato'] == 'SINDICATO TEST'

    def test_operador_puede_crear(self, client, auth_operador):
        assert _crear_renovacion(client, auth_operador).status_code == 201

    def test_hoja_ruta_duplicada(self, client, auth_admin):
        _crear_renovacion(client, auth_admin)
        resp = _crear_renovacion(client, auth_admin,
                                 nro_solicitud='HR-0001', id_afi='5555555')
        assert resp.status_code == 400

    def test_cato_con_renovacion_en_curso(self, client, auth_admin):
        _crear_renovacion(client, auth_admin)
        resp = _crear_renovacion(client, auth_admin, nro_solicitud='HR-0002')
        assert resp.status_code == 400

    def test_afiliado_sin_cato_rechazado(self, client, auth_admin):
        resp = _crear_renovacion(client, auth_admin, id_afi='6666666')
        assert resp.status_code == 400

    def test_listar_con_filtros(self, client, auth_admin, auth_lector):
        _crear_renovacion(client, auth_admin)
        resp = client.get('/api/renovaciones?estado=PENDIENTE&id_afi=4444444',
                          headers=auth_lector)
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['total'] == 1
        assert data['items'][0]['nro_solicitud'] == 'HR-0001'

        vacia = client.get('/api/renovaciones?estado=APROBADA',
                           headers=auth_lector).get_json()
        assert vacia['total'] == 0

    def test_listar_estado_invalido(self, client, auth_lector):
        resp = client.get('/api/renovaciones?estado=CUALQUIERA',
                          headers=auth_lector)
        assert resp.status_code == 400

    def test_detalle_con_relacionados(self, client, auth_admin):
        creado = _crear_renovacion(client, auth_admin).get_json()
        resp = client.get(f"/api/renovaciones/{creado['id']}",
                          headers=auth_admin)
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['afiliado']['id_afi'] == '4444444'
        assert data['cato']['id_cato'] == 70001
        assert data['informes'] == []

    def test_detalle_404(self, client, auth_admin):
        assert client.get('/api/renovaciones/99999',
                          headers=auth_admin).status_code == 404

    def test_actualizar_vigencia(self, client, auth_operador):
        creado = _crear_renovacion(client, auth_operador).get_json()
        resp = client.put(f"/api/renovaciones/{creado['id']}",
                          headers=auth_operador,
                          json={'vigencia_inicio': '2026-07-01',
                                'fecha_vencimiento': '2027-07-01'})
        data = resp.get_json()
        assert resp.status_code == 200, data
        assert data['vigencia_inicio'] == '2026-07-01'
        assert data['fecha_vencimiento'] == '2027-07-01'

    def test_vigencia_invertida_rechazada(self, client, auth_operador):
        creado = _crear_renovacion(client, auth_operador).get_json()
        resp = client.put(f"/api/renovaciones/{creado['id']}",
                          headers=auth_operador,
                          json={'vigencia_inicio': '2027-07-01',
                                'fecha_vencimiento': '2026-07-01'})
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Informes de visita tecnica
# ---------------------------------------------------------------------------

class TestInformes:
    def test_tecnico_registra_informe(self, client, auth_admin, auth_tecnico):
        creado = _crear_renovacion(client, auth_admin).get_json()
        resp = _crear_informe(client, auth_tecnico, creado['id'])
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['resultado'] == 'FACTIBLE'
        assert data['tecnico_nombre'] == 'TECNICO PRUEBAS'
        assert data['usuario'] == 'tecnico.test'

        # Sincroniza columnas legacy tecnico_info_*
        detalle = client.get(f"/api/renovaciones/{creado['id']}",
                             headers=auth_tecnico).get_json()
        assert detalle['tecnico_info_nro'] == 'CITE-001'
        assert detalle['tecnico_info_fecha'] == '2026-07-02'
        assert len(detalle['informes']) == 1

    def test_listar_informes(self, client, auth_admin, auth_tecnico):
        creado = _crear_renovacion(client, auth_admin).get_json()
        _crear_informe(client, auth_tecnico, creado['id'])
        resp = client.get(f"/api/renovaciones/{creado['id']}/informes",
                          headers=auth_tecnico)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 1

    def test_informe_fecha_duplicada(self, client, auth_admin, auth_tecnico):
        creado = _crear_renovacion(client, auth_admin).get_json()
        _crear_informe(client, auth_tecnico, creado['id'])
        resp = _crear_informe(client, auth_tecnico, creado['id'])
        assert resp.status_code == 400

    def test_informe_resultado_invalido(self, client, auth_admin, auth_tecnico):
        creado = _crear_renovacion(client, auth_admin).get_json()
        resp = _crear_informe(client, auth_tecnico, creado['id'],
                              resultado='TALVEZ')
        assert resp.status_code == 400

    def test_informe_renovacion_inexistente(self, client, auth_tecnico):
        assert _crear_informe(client, auth_tecnico, 99999).status_code == 400


# ---------------------------------------------------------------------------
# Remision a legal
# ---------------------------------------------------------------------------

class TestRemitirLegal:
    def test_sin_informe_no_remite(self, client, auth_operador):
        creado = _crear_renovacion(client, auth_operador).get_json()
        resp = client.post(f"/api/renovaciones/{creado['id']}/remitir-legal",
                           headers=auth_operador,
                           json={'nota': 'Revisar requisitos'})
        assert resp.status_code == 400

    def test_flujo_completo(self, client, auth_operador, auth_tecnico):
        creado = _crear_renovacion(client, auth_operador).get_json()
        _crear_informe(client, auth_tecnico, creado['id'])
        resp = client.post(f"/api/renovaciones/{creado['id']}/remitir-legal",
                           headers=auth_operador,
                           json={'nota': 'Cumple requisitos tecnicos'})
        data = resp.get_json()
        assert resp.status_code == 200, data
        assert data['estado'] == 'REMITIDA_LEGAL'
        assert 'Cumple requisitos tecnicos' in data['nota_legal']
        assert data['remitida_legal_por'] == 'operador.test'

        # No se remite dos veces
        de_nuevo = client.post(
            f"/api/renovaciones/{creado['id']}/remitir-legal",
            headers=auth_operador, json={'nota': 'otra vez'})
        assert de_nuevo.status_code == 400

        # Remitida: la vigencia sigue editable (estado activo)
        put = client.put(f"/api/renovaciones/{creado['id']}",
                         headers=auth_operador,
                         json={'fecha_vencimiento': '2027-12-31'})
        assert put.status_code == 200

    def test_nota_requerida(self, client, auth_operador, auth_tecnico):
        creado = _crear_renovacion(client, auth_operador).get_json()
        _crear_informe(client, auth_tecnico, creado['id'])
        resp = client.post(f"/api/renovaciones/{creado['id']}/remitir-legal",
                           headers=auth_operador, json={})
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

class TestRBACRenovaciones:
    def test_sin_token(self, client):
        assert client.get('/api/renovaciones').status_code == 401

    def test_todos_consultan(self, client, auth_lector, auth_tecnico):
        assert client.get('/api/renovaciones',
                          headers=auth_lector).status_code == 200
        assert client.get('/api/renovaciones',
                          headers=auth_tecnico).status_code == 200

    def test_tecnico_no_gestiona_tramite(self, client, auth_tecnico):
        assert _crear_renovacion(client, auth_tecnico).status_code == 403
        assert client.put('/api/renovaciones/1', headers=auth_tecnico,
                          json={}).status_code == 403
        assert client.post('/api/renovaciones/1/remitir-legal',
                           headers=auth_tecnico,
                           json={'nota': 'x'}).status_code == 403

    def test_lector_no_registra_informes(self, client, auth_admin, auth_lector):
        creado = _crear_renovacion(client, auth_admin).get_json()
        assert _crear_informe(client, auth_lector,
                              creado['id']).status_code == 403

    def test_operador_registra_informe_denegado(self, client, auth_admin,
                                                auth_operador):
        """USR_OPERACIONES gestiona el tramite pero no inspecciona."""
        creado = _crear_renovacion(client, auth_admin).get_json()
        assert _crear_informe(client, auth_operador,
                              creado['id']).status_code == 403
