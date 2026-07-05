"""Pruebas de las areas Legal y Planos (flujo completo + RBAC).

Ejecutar desde /backend:  python -m pytest tests/test_legal_planos.py -v
"""


# ---------------------------------------------------------------------------
# Helpers: preparan un caso REMITIDA_LEGAL (flujo Renovaciones -> Legal)
# ---------------------------------------------------------------------------

def _preparar_caso_legal(client, auth_admin):
    """Crea renovacion + informe tecnico y la remite a Legal. Devuelve id."""
    renov = client.post('/api/renovaciones', headers=auth_admin, json={
        'id_afi': '4444444', 'nro_solicitud': 'HR-L001',
        'hruta_fecha': '2026-07-01',
    }).get_json()
    assert 'id' in renov, renov
    resp = client.post(f"/api/renovaciones/{renov['id']}/informes",
                       headers=auth_admin, json={
                           'fecha_visita': '2026-07-02',
                           'resultado': 'FACTIBLE',
                           'nro_informe': 'CITE-TEC-001',
                       })
    assert resp.status_code == 201, resp.get_json()
    resp = client.post(f"/api/renovaciones/{renov['id']}/remitir-legal",
                       headers=auth_admin,
                       json={'nota': 'Se remite para revision legal'})
    assert resp.status_code == 200, resp.get_json()
    return renov['id']


def _informe_legal(client, headers, id_caso, **extra):
    payload = {'fecha': '2026-07-03', 'nro_cite': 'CITE-LEG-001',
               'dictamen': 'PROCEDENTE',
               'contenido': 'Cumple los requisitos del DS 3318'}
    payload.update(extra)
    return client.post(f'/api/legal/casos/{id_caso}/informe',
                       headers=headers, json=payload)


def _resolucion(client, headers, id_caso, **extra):
    payload = {'fecha': '2026-07-04', 'nro_cite': 'RES-001',
               'resultado': 'APROBADA',
               'contenido': 'Se autoriza la renovacion de la parcela'}
    payload.update(extra)
    return client.post(f'/api/legal/casos/{id_caso}/resolucion',
                       headers=headers, json=payload)


def _crear_plano(client, headers, **extra):
    payload = {'nro_plano': 'REGTOP-001', 'tipo': 'MENSURA',
               'id_cato': 70001, 'fecha_registro': '2026-07-01',
               'superficie': 0.16, 'coordenadas': '123456-7890123',
               'dibujante': 'DIBUJANTE PRUEBAS'}
    payload.update(extra)
    return client.post('/api/planos', headers=headers, json=payload)


def _revision(client, headers, id_plano, **extra):
    payload = {'fecha_revision': '2026-07-02', 'resultado': 'APROBADO',
               'documentacion': 'Plano de mensura + respaldo digital'}
    payload.update(extra)
    return client.post(f'/api/planos/{id_plano}/revisiones',
                       headers=headers, json=payload)


# ---------------------------------------------------------------------------
# Area Legal: bandeja y flujo informe -> resolucion
# ---------------------------------------------------------------------------

class TestLegalBandeja:
    def test_bandeja_muestra_remitidas(self, client, auth_admin, auth_lector):
        id_caso = _preparar_caso_legal(client, auth_admin)
        data = client.get('/api/legal/casos', headers=auth_lector).get_json()
        assert data['total'] == 1
        assert data['items'][0]['id'] == id_caso
        assert data['items'][0]['estado'] == 'REMITIDA_LEGAL'

    def test_detalle_incluye_informes_y_actuaciones(self, client, auth_admin):
        id_caso = _preparar_caso_legal(client, auth_admin)
        data = client.get(f'/api/legal/casos/{id_caso}',
                          headers=auth_admin).get_json()
        assert data['afiliado']['id_afi'] == '4444444'
        assert len(data['informes_tecnicos']) == 1
        assert data['actuaciones'] == []

    def test_caso_inexistente_404(self, client, auth_admin):
        assert client.get('/api/legal/casos/99999',
                          headers=auth_admin).status_code == 404

    def test_resumen_estados(self, client, auth_admin):
        _preparar_caso_legal(client, auth_admin)
        data = client.get('/api/legal/resumen', headers=auth_admin).get_json()
        assert data['pendientes_legal'] == 1
        assert data['estados']['REMITIDA_LEGAL'] == 1


class TestFlujoLegal:
    def test_informe_legal_ok(self, client, auth_admin, auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        resp = _informe_legal(client, auth_legal, id_caso)
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['tipo'] == 'INFORME_LEGAL'
        assert data['dictamen'] == 'PROCEDENTE'
        # Sincronizacion legacy legal_info_*
        caso = client.get(f'/api/legal/casos/{id_caso}',
                          headers=auth_legal).get_json()
        assert caso['legal_info_nro'] == 'CITE-LEG-001'

    def test_informe_requiere_dictamen_valido(self, client, auth_admin,
                                              auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        resp = _informe_legal(client, auth_legal, id_caso,
                              dictamen='CUALQUIERA')
        assert resp.status_code == 400

    def test_cite_informe_duplicado(self, client, auth_admin, auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        assert _informe_legal(client, auth_legal, id_caso).status_code == 201
        # Mismo CITE legal otra vez -> ProcRenovExisteDocuNro (duplicado)
        resp = _informe_legal(client, auth_legal, id_caso)
        assert resp.status_code == 400
        assert 'CITE' in resp.get_json()['detalles'][0]

    def test_observacion_legal(self, client, auth_admin, auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        resp = client.post(f'/api/legal/casos/{id_caso}/observacion',
                           headers=auth_legal, json={
                               'fecha': '2026-07-03',
                               'contenido': 'Falta fotocopia del CI',
                           })
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['tipo'] == 'OBSERVACION_LEGAL'
        caso = client.get(f'/api/legal/casos/{id_caso}',
                          headers=auth_legal).get_json()
        assert 'Falta fotocopia del CI' in caso['nota_legal']

    def test_resolucion_sin_informe_legal_rechazada(self, client, auth_admin,
                                                    auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        resp = _resolucion(client, auth_legal, id_caso)
        assert resp.status_code == 400
        assert 'informe legal' in resp.get_json()['detalles'][0].lower()

    def test_resolucion_aprueba_caso(self, client, auth_admin, auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        _informe_legal(client, auth_legal, id_caso)
        resp = _resolucion(client, auth_legal, id_caso,
                           fecha_vencimiento='2027-07-04')
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['caso']['estado'] == 'APROBADA'
        assert data['caso']['resultado'] == 'APROBADO'
        assert data['caso']['resol_nro'] == 'RES-001'
        assert data['caso']['fecha_vencimiento'] == '2027-07-04'

    def test_resolucion_rechaza_caso(self, client, auth_admin, auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        _informe_legal(client, auth_legal, id_caso, dictamen='IMPROCEDENTE')
        resp = _resolucion(client, auth_legal, id_caso, resultado='RECHAZADA')
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['caso']['estado'] == 'RECHAZADA'
        assert data['caso']['resultado'] == 'RECHAZADO'

    def test_caso_cerrado_no_admite_actuaciones(self, client, auth_admin,
                                                auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        _informe_legal(client, auth_legal, id_caso)
        _resolucion(client, auth_legal, id_caso)
        resp = _informe_legal(client, auth_legal, id_caso,
                              nro_cite='CITE-LEG-002')
        assert resp.status_code == 400

    def test_archivo_actuaciones(self, client, auth_admin, auth_legal):
        id_caso = _preparar_caso_legal(client, auth_admin)
        _informe_legal(client, auth_legal, id_caso)
        _resolucion(client, auth_legal, id_caso)
        data = client.get(f'/api/legal/casos/{id_caso}/actuaciones',
                          headers=auth_legal).get_json()
        assert len(data) == 2
        assert {a['tipo'] for a in data} == {'INFORME_LEGAL', 'RESOLUCION'}


class TestLegalRBAC:
    def test_lector_consulta_pero_no_gestiona(self, client, auth_admin,
                                              auth_lector):
        id_caso = _preparar_caso_legal(client, auth_admin)
        assert client.get('/api/legal/casos',
                          headers=auth_lector).status_code == 200
        assert _informe_legal(client, auth_lector, id_caso).status_code == 403

    def test_tecnico_no_gestiona_legal(self, client, auth_admin, auth_tecnico):
        id_caso = _preparar_caso_legal(client, auth_admin)
        assert _resolucion(client, auth_tecnico, id_caso).status_code == 403

    def test_admin_gestiona_legal(self, client, auth_admin):
        id_caso = _preparar_caso_legal(client, auth_admin)
        assert _informe_legal(client, auth_admin, id_caso).status_code == 201

    def test_sin_token_401(self, client):
        assert client.get('/api/legal/casos').status_code == 401


# ---------------------------------------------------------------------------
# Area Planos: registro, revision, actualizacion y archivo
# ---------------------------------------------------------------------------

class TestPlanosCRUD:
    def test_crear_ok(self, client, auth_lector):
        resp = _crear_plano(client, auth_lector)  # lector = USR_PLANOS
        data = resp.get_json()
        assert resp.status_code == 201, data
        assert data['estado'] == 'REGISTRADO'
        assert data['id_afi'] == '4444444'  # heredado del cato

    def test_nro_plano_duplicado(self, client, auth_lector):
        _crear_plano(client, auth_lector)
        resp = _crear_plano(client, auth_lector)
        assert resp.status_code == 400

    def test_cato_inexistente(self, client, auth_lector):
        resp = _crear_plano(client, auth_lector, id_cato=99999)
        assert resp.status_code == 400

    def test_mensura_superficie_estandar(self, client, auth_lector):
        resp = _crear_plano(client, auth_lector, superficie=0.25)
        assert resp.status_code == 400
        assert '0.1600' in resp.get_json()['detalles'][0]

    def test_otro_tipo_sin_restriccion_superficie(self, client, auth_lector):
        resp = _crear_plano(client, auth_lector, tipo='UBICACION',
                            superficie=1.5)
        assert resp.status_code == 201

    def test_listar_con_filtros(self, client, auth_lector):
        _crear_plano(client, auth_lector)
        data = client.get('/api/planos?estado=REGISTRADO&id_cato=70001',
                          headers=auth_lector).get_json()
        assert data['total'] == 1
        assert data['items'][0]['nro_plano'] == 'REGTOP-001'

        vacio = client.get('/api/planos?estado=ARCHIVADO',
                           headers=auth_lector).get_json()
        assert vacio['total'] == 0

    def test_detalle_y_por_cato(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        data = client.get(f"/api/planos/{creado['id_plano']}",
                          headers=auth_lector).get_json()
        assert data['cato']['id_cato'] == 70001
        assert data['revisiones'] == []

        por_cato = client.get('/api/planos/cato/70001',
                              headers=auth_lector).get_json()
        assert len(por_cato) == 1

    def test_actualizar(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        resp = client.put(f"/api/planos/{creado['id_plano']}",
                          headers=auth_lector,
                          json={'escala': '1:500', 'zona_utm': '19K'})
        data = resp.get_json()
        assert resp.status_code == 200, data
        assert data['escala'] == '1:500'


class TestPlanosRevisiones:
    def test_revision_aprueba(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        resp = _revision(client, auth_lector, creado['id_plano'])
        assert resp.status_code == 201, resp.get_json()
        data = client.get(f"/api/planos/{creado['id_plano']}",
                          headers=auth_lector).get_json()
        assert data['estado'] == 'APROBADO'
        assert len(data['revisiones']) == 1

    def test_revision_observa(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        _revision(client, auth_lector, creado['id_plano'],
                  resultado='OBSERVADO', observaciones='Faltan coordenadas')
        data = client.get(f"/api/planos/{creado['id_plano']}",
                          headers=auth_lector).get_json()
        assert data['estado'] == 'OBSERVADO'

    def test_observado_vuelve_a_revision_al_corregir(self, client,
                                                     auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        _revision(client, auth_lector, creado['id_plano'],
                  resultado='OBSERVADO')
        resp = client.put(f"/api/planos/{creado['id_plano']}",
                          headers=auth_lector,
                          json={'coordenadas': '654321-1234567'})
        assert resp.get_json()['estado'] == 'EN_REVISION'

    def test_revision_fecha_duplicada(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        _revision(client, auth_lector, creado['id_plano'])
        resp = _revision(client, auth_lector, creado['id_plano'])
        assert resp.status_code == 400

    def test_inspector_puede_revisar(self, client, auth_lector,
                                     auth_inspector):
        creado = _crear_plano(client, auth_lector).get_json()
        resp = _revision(client, auth_inspector, creado['id_plano'])
        assert resp.status_code == 201


class TestPlanosArchivo:
    def test_archivar_aprobado(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        _revision(client, auth_lector, creado['id_plano'])
        resp = client.post(f"/api/planos/{creado['id_plano']}/archivar",
                           headers=auth_lector,
                           json={'ubicacion_fisica': 'ESTANTE A-12'})
        data = resp.get_json()
        assert resp.status_code == 200, data
        assert data['estado'] == 'ARCHIVADO'
        assert data['ubicacion_fisica'] == 'ESTANTE A-12'

    def test_no_archiva_sin_aprobar(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        resp = client.post(f"/api/planos/{creado['id_plano']}/archivar",
                           headers=auth_lector,
                           json={'ubicacion_fisica': 'ESTANTE A-12'})
        assert resp.status_code == 400

    def test_no_archiva_sin_ubicacion_ni_archivo(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        _revision(client, auth_lector, creado['id_plano'])
        resp = client.post(f"/api/planos/{creado['id_plano']}/archivar",
                           headers=auth_lector, json={})
        assert resp.status_code == 400

    def test_archivado_no_se_modifica(self, client, auth_lector):
        creado = _crear_plano(client, auth_lector).get_json()
        _revision(client, auth_lector, creado['id_plano'])
        client.post(f"/api/planos/{creado['id_plano']}/archivar",
                    headers=auth_lector,
                    json={'ubicacion_fisica': 'ESTANTE A-12'})
        resp = client.put(f"/api/planos/{creado['id_plano']}",
                          headers=auth_lector, json={'escala': '1:1000'})
        assert resp.status_code == 400
        resp = _revision(client, auth_lector, creado['id_plano'],
                         fecha_revision='2026-07-05')
        assert resp.status_code == 400


class TestPlanosRBAC:
    def test_tecnico_consulta_pero_no_registra(self, client, auth_tecnico):
        assert client.get('/api/planos',
                          headers=auth_tecnico).status_code == 200
        assert _crear_plano(client, auth_tecnico).status_code == 403

    def test_legal_no_gestiona_planos(self, client, auth_legal):
        assert _crear_plano(client, auth_legal).status_code == 403

    def test_inspector_no_registra_planos(self, client, auth_inspector):
        assert _crear_plano(client, auth_inspector).status_code == 403

    def test_admin_gestiona_planos(self, client, auth_admin):
        assert _crear_plano(client, auth_admin).status_code == 201

    def test_sin_token_401(self, client):
        assert client.get('/api/planos').status_code == 401
