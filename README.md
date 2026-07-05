# 🚀 SACCTC PostgreSQL - FASE 1

**Migración: SQL Server → PostgreSQL**  
**Fecha:** 30 de Junio de 2026  
**Duración:** 17 semanas (4 meses)  
**GO-LIVE:** 28 de Octubre de 2026

---

## 📊 Estructura del Proyecto

```
UDESTRO/
├── backend/                 # Python/Flask
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, RBAC
│   │   └── __init__.py
│   ├── tests/              # Pytest
│   ├── requirements.txt    # Dependencies
│   ├── config.py           # Configuration
│   ├── run.py              # Entry point
│   └── .env                # Secrets
│
├── frontend/               # React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/       # API calls
│   │   ├── App.jsx
│   │   └── index.js
│   ├── package.json
│   └── .env
│
├── migrations/             # SQL migration scripts
├── backups/                # SQL Server backups (.bak)
├── exports/                # CSV exports for import
├── docs/                   # Documentation
│
├── .gitignore
├── .env.example
└── README.md
```

---

## 🎯 FASE 1: Preparación (Semanas 1-2)

### Dev 1: PostgreSQL + BD
- [ ] Instalar PostgreSQL 14.x
- [ ] Crear BD: BDUDESTRO_NEW
- [ ] Crear usuario: userud
- [ ] Configurar backup automático
- [ ] Schema y tablas

### Dev 2: Python/Flask + React
- [ ] Setup Python 3.11 + venv
- [ ] Flask project initialization
- [ ] React project creation
- [ ] Git repository setup
- [ ] Docker configuration (optional)

---

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

pip install -r requirements.txt
python run.py
# Flask en http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm start
# React en http://localhost:3000
```

---

## 📋 Checklist FASE 1

### Semana 1

**Dev 1:**
- [ ] PostgreSQL instalado y verificado
- [ ] BD BDUDESTRO_NEW creada
- [ ] Usuario userud con permisos
- [ ] Backup automático configurado
- [ ] Connection string documentada

**Dev 2:**
- [ ] Python 3.11 + venv listo
- [ ] Flask project structure
- [ ] React project created
- [ ] Git + branches configured
- [ ] Docker files (si aplica)

### Semana 2

**Dev 1:**
- [ ] Schema DDL convertido SQL Server → PostgreSQL
- [ ] Todas 27 tablas creadas
- [ ] Índices creados
- [ ] PKs y FKs definidas
- [ ] Testing básico

**Dev 2:**
- [ ] Procedures: Afiliados (24) convertidos
- [ ] Testing básico de procedures
- [ ] Plantilla conversión T-SQL → PL/pgSQL
- [ ] Documentación procedures

---

## 🔧 Tecnologías

### Backend
- Python 3.11
- Flask 2.3.3
- SQLAlchemy 2.0.21
- psycopg2 (PostgreSQL driver)
- python-docx (Word generation)
- PyJWT (Authentication)

### Frontend
- Node.js 18.x
- React 18.x
- Material-UI 5.x
- Axios
- React-Router

### Database
- PostgreSQL 14+
- pgAdmin (testing)

---

## 📝 Archivo .env

```
# Backend
FLASK_ENV=development
DATABASE_URL=postgresql://userud:password@localhost:5432/BDUDESTRO_NEW
SECRET_KEY=your-secret-key-here
JWT_EXPIRATION=86400

# Frontend
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🎬 Comandos Útiles

```bash
# Backend
flask run                    # Iniciar servidor
pytest                       # Correr tests
python -m pytest -v          # Tests con salida verbose

# Frontend
npm start                    # Iniciar dev server
npm run build                # Build producción
npm test                     # Correr tests

# Database
psql -U userud -d BDUDESTRO_NEW  # Conectar a BD
\dt                          # Listar tablas
\df                          # Listar funciones
```

---

## 📞 Contacto

- **Dev 1:** [teléfono/email]
- **Dev 2:** [teléfono/email]
- **Jefe:** [teléfono/email]

---

## 🗓️ Timeline

- **Sem 1-2:** Setup + BD schema
- **Sem 2-3:** Migración datos
- **Sem 4-8:** Procedures + Backend
- **Sem 10-15:** Frontend + Testing
- **Sem 17:** GO-LIVE

---

**Proyecto SACCTC PostgreSQL - FASE 1**  
**¡Bienvenido al futuro!** 🚀
