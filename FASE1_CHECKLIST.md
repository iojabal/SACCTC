# ✅ FASE 1 CHECKLIST - Semanas 1-2

**Para marcar tareas completadas**

---

## 🔴 DEV 1: PostgreSQL + Database

### Semana 1

**PostgreSQL Installation & Setup**
- [ ] PostgreSQL 14.x instalado
- [ ] `psql --version` devuelve 14.x
- [ ] PostgreSQL servicio corriendo
- [ ] Se puede conectar como postgres

**Database Creation**
- [ ] BD BDUDESTRO_NEW creada
- [ ] Usuario userud creado
- [ ] Permisos otorgados a userud
- [ ] Conexión de prueba funciona: `psql -U userud -d BDUDESTRO_NEW`

**Backup Setup**
- [ ] Carpeta /backups/ creada
- [ ] Script backup_daily.sh creado
- [ ] Cron agendado (Linux/macOS)
- [ ] Task Scheduler configurado (Windows)
- [ ] Backup manual de prueba funciona

**Documentation**
- [ ] Archivo CONNECTION_STRING.txt creado
- [ ] Connection details documentadas
- [ ] Python/SQLAlchemy connection string listo
- [ ] JDBC connection string (si necesario)

**Testing**
- [ ] `psql -U userud -d BDUDESTRO_NEW -c "SELECT NOW()"` funciona
- [ ] Tamaño BD es ~0 (vacía, como esperado)
- [ ] Permisos correctos verificados

### Semana 2

**Schema & Tables**
- [ ] DDL SQL Server convertido a PostgreSQL
- [ ] Archivo: `migrations/01_create_tables.sql`
- [ ] Script probado en PostgreSQL
- [ ] Todas 27 tablas creadas:
  - [ ] usuarios
  - [ ] afiliados
  - [ ] cambio
  - [ ] renovacion_programada0
  - [ ] renovacion_solicitudes0
  - [ ] control_cato
  - [ ] observados
  - [ ] sindicatos
  - [ ] centrales
  - [ ] federaciones
  - [ ] ... (18 más)

**Indexes**
- [ ] Índice en afiliados.id_afi_ci
- [ ] Índice en control_cato.fecha_control
- [ ] Índice en renovacion_programada0.resultado
- [ ] Índice en renovacion_programada0.id_afi
- [ ] Índice en renovacion_programada0.id_cato

**Primary Keys & Foreign Keys**
- [ ] PKs definidas en todas tablas
- [ ] FKs creadas (especialmente entre tablas grandes)
- [ ] Integridad referencial verificada

**Testing Phase 2**
- [ ] `\d afiliados` muestra estructura correcta
- [ ] `SELECT COUNT(*) FROM afiliados` devuelve 0
- [ ] `\di` lista todos los índices
- [ ] Conexión desde Python funciona

---

## 🟢 DEV 2: Python/Flask + React

### Semana 1

**Python Setup**
- [ ] Python 3.11.x instalado
- [ ] `python --version` devuelve 3.11.x
- [ ] pip funciona correctamente

**Virtual Environment**
- [ ] `venv/` folder creada en backend/
- [ ] venv activado en PowerShell/bash
- [ ] `echo $VIRTUAL_ENV` muestra path correcto

**Flask Installation**
- [ ] requirements.txt existe en backend/
- [ ] `pip install -r requirements.txt` funciona
- [ ] `pip list` muestra Flask 2.3.3
- [ ] Otras dependencias:
  - [ ] SQLAlchemy 2.0.21
  - [ ] psycopg2-binary 2.9.7
  - [ ] python-docx 0.8.11
  - [ ] PyJWT 2.8.1

**Flask Project Structure**
- [ ] backend/app/ folder creada
- [ ] backend/app/models/ folder creada
- [ ] backend/app/routes/ folder creada
- [ ] backend/app/services/ folder creada
- [ ] backend/app/middleware/ folder creada
- [ ] backend/app/__init__.py existe
- [ ] backend/config.py existe
- [ ] backend/run.py existe

**React Installation**
- [ ] Node.js v18.x o v20.x instalado
- [ ] `node --version` funciona
- [ ] `npm --version` funciona
- [ ] package.json existe en frontend/
- [ ] `npm install` completado sin errores
- [ ] node_modules/ folder creada
- [ ] frontend/src/ estructura lista

**Git Repository**
- [ ] `git init` ejecutado
- [ ] .gitignore creado
- [ ] user.name configurado
- [ ] user.email configurado
- [ ] Ramas creadas:
  - [ ] main/master
  - [ ] develop
  - [ ] feature/fase-1
- [ ] `git status` muestra repo limpio

**Environment Setup**
- [ ] .env.example existe
- [ ] .env creado (copy de .env.example)
- [ ] .env no está en git (en .gitignore)
- [ ] Valores correctos en .env:
  - [ ] DATABASE_URL correcto
  - [ ] REACT_APP_API_URL = http://localhost:5000/api
  - [ ] SECRET_KEY set
  - [ ] JWT_SECRET_KEY set

### Semana 2

**Procedures Conversion Start**
- [ ] Archivo: `migrations/02_procedures_afiliados.sql`
- [ ] 24 procedures de Afiliados convertidos:
  - [ ] ProcAfiGetDatos → proc_afi_get_datos
  - [ ] ProcAfiNuevo → proc_afi_nuevo
  - [ ] ProcAfiActualizar → proc_afi_actualizar
  - [ ] ProcAfiCiExiste → proc_afi_ci_existe
  - [ ] ... (20 más)
- [ ] Plantilla conversión T-SQL → PL/pgSQL creada
- [ ] Documento: `docs/PLANTILLA_CONVERSION.md`

**Procedures Testing**
- [ ] 5 procedures de prueba ejecutadas
- [ ] Cada procedure retorna resultados esperados
- [ ] Testing against sample data funciona

**Documentation**
- [ ] README.md existe
- [ ] SETUP_FASE1.md existe
- [ ] DATABASE_CONNECTION.txt existe
- [ ] Documento de plantilla conversión existe
- [ ] Estructura proyecto documentada

**Framework Testing**
- [ ] `python run.py` inicia Flask sin errores
- [ ] Flask respond en http://localhost:5000
- [ ] `/api/health` endpoint funciona
- [ ] `npm start` inicia React dev server
- [ ] React accessible en http://localhost:3000
- [ ] App.jsx renderiza correctamente

---

## 📊 Validación Final FASE 1

### Combinado (Dev 1 + Dev 2)

- [ ] PostgreSQL + Flask backend pueden conectar
- [ ] Backup autom átic se ejecuta sin errores
- [ ] Procedures básicos funcionan en PostgreSQL
- [ ] Frontend puede hacer requests al backend (aunque vacíos)
- [ ] Git repo está limpio y ready
- [ ] Documentación completa

### Performance Checklist

- [ ] BD connection time < 100ms
- [ ] Flask health check < 50ms
- [ ] React build bundled (< 5MB)
- [ ] No console errors en React

---

## 🎯 FASE 1 DONE CRITERIA

```
✅ PostgreSQL: BD lista, backup funciona
✅ Python/Flask: venv + framework listo
✅ React: node_modules instalado, app renderiza
✅ Git: repo init, branches creadas
✅ Docs: README + setup guide completos
✅ Testing: Conexión BD OK, Flask OK, React OK
✅ Ready: Para empezar Semana 3 migración de datos
```

---

## 🚀 Próximo Hito

**SEMANA 3:**
- Exportar datos SQL Server → CSV
- Importar CSV → PostgreSQL
- Validar integridad 500K registros
- Backup #1 completado ✓

---

**FASE 1 Completion Date: ___________**

**Sign-off:**
- Dev 1: _________________ Date: ___________
- Dev 2: _________________ Date: ___________
- Jefe:  _________________ Date: ___________
