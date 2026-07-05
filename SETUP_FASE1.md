# ⚙️ SETUP FASE 1 - SACCTC PostgreSQL

**Instrucciones de setup para semanas 1-2**  
**Duración:** ~4 horas total

---

## 🔴 DEV 1: PostgreSQL + Base de Datos

### PASO 1: Instalar PostgreSQL 14.x

```bash
# Windows: Descargar desde https://www.postgresql.org/download/windows/
# Instalar en C:\Program Files\PostgreSQL\14

# Linux:
sudo apt-get update
sudo apt-get install postgresql-14 postgresql-contrib-14

# macOS:
brew install postgresql@14
```

### PASO 2: Iniciar PostgreSQL

```bash
# Windows: PostgreSQL inicia automáticamente
# Verificar que está corriendo:
psql --version

# Linux:
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS:
brew services start postgresql@14
```

### PASO 3: Crear Base de Datos

```bash
# Conectar como administrador
psql -U postgres

# En psql:
CREATE DATABASE BDUDESTRO_NEW ENCODING 'UTF8';
CREATE USER userud WITH PASSWORD 'SecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE BDUDESTRO_NEW TO userud;
ALTER USER userud CREATEDB;
\q

# Verificar conexión como userud:
psql -U userud -d BDUDESTRO_NEW -c "SELECT 1"
# Resultado: 1 ✓
```

### PASO 4: Configurar Backup Automático

```bash
# Crear carpeta backups
mkdir /backups
chmod 700 /backups

# Crear script backup
cat > /backups/backup_daily.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -U userud BDUDESTRO_NEW > /backups/BDUDESTRO_$DATE.sql
echo "Backup completado: /backups/BDUDESTRO_$DATE.sql"
EOF

chmod +x /backups/backup_daily.sh

# Agendar cron (diario 3 AM)
# Linux/macOS:
crontab -e
# Agregar esta línea:
# 0 3 * * * /backups/backup_daily.sh

# Windows (usar Task Scheduler):
# Nueva tarea → programa: C:\backups\backup_daily.bat
```

### PASO 5: Documentación Connection String

```
Guardar en archivo: C:\Users\M S I\Documents\UDESTRO\DATABASE_CONNECTION.txt

BDUDESTRO_NEW Connection Details:
  Host: localhost
  Port: 5432
  Database: BDUDESTRO_NEW
  User: userud
  Password: SecurePassword123!
  
Python/SQLAlchemy:
  postgresql://userud:SecurePassword123!@localhost:5432/BDUDESTRO_NEW
  
JDBC (Java):
  jdbc:postgresql://localhost:5432/BDUDESTRO_NEW
  
psql CLI:
  psql -U userud -d BDUDESTRO_NEW -h localhost
```

---

## 🟢 DEV 2: Python/Flask + React Setup

### PASO 1: Python 3.11 + venv

```bash
# Windows: Descargar Python 3.11 desde https://www.python.org/downloads/

# Verificar instalación
python --version  # Should be 3.11.x

# Crear virtual environment
cd C:\Users\M S I\Documents\UDESTRO\backend
python -m venv venv

# Activar venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### PASO 2: Instalar dependencias Python

```bash
# (En venv)
pip install -r requirements.txt

# Verificar instalación
pip list | grep Flask
# Flask 2.3.3 ✓
```

### PASO 3: Setup React

```bash
# Node.js: Descargar desde https://nodejs.org/ (LTS)

# Verificar instalación
node --version  # v18.x o v20.x
npm --version   # 9.x o 10.x

# Ir a carpeta frontend
cd C:\Users\M S I\Documents\UDESTRO\frontend

# Instalar dependencias
npm install
# Esto crea node_modules/ (tarda ~5 minutos)
```

### PASO 4: Git Repository

```bash
# En C:\Users\M S I\Documents\UDESTRO

git init
git config user.name "Tu Nombre"
git config user.email "tu@email.com"

# Crear ramas
git branch develop
git branch feature/fase-1

# Ver ramas
git branch -a
```

### PASO 5: .env Archivo

```bash
# Copiar plantilla
cp .env.example .env

# Editar .env con valores reales:
# DATABASE_URL=postgresql://userud:SecurePassword123!@localhost:5432/BDUDESTRO_NEW
# REACT_APP_API_URL=http://localhost:5000/api
# etc.
```

---

## ✅ VERIFICACIÓN FASE 1

### Dev 1 Checklist

```bash
# PostgreSQL corriendo
psql -U userud -d BDUDESTRO_NEW -c "SELECT NOW()"
# Resultado: timestamp actual ✓

# Backup script funciona
/backups/backup_daily.sh
# Resultado: "Backup completado" ✓

# Archivo documentación existe
cat DATABASE_CONNECTION.txt
# ✓
```

### Dev 2 Checklist

```bash
# Backend venv activo
echo $VIRTUAL_ENV
# Resultado: .../venv ✓

# Flask instalado
python -c "import flask; print(flask.__version__)"
# Resultado: 2.3.3 ✓

# React instalado
cd frontend && npm list react
# Resultado: react@18.x ✓

# Git repo existe
git status
# ✓

# .env existe
cat .env | head -5
# ✓
```

---

## 🚀 Próximos Pasos (Semana 2)

### Dev 1:
- [ ] Crear schema DDL (27 tablas)
- [ ] Crear índices
- [ ] Setup pgAdmin para testing

### Dev 2:
- [ ] Iniciar conversión procedures (Afiliados)
- [ ] Setup testing framework (pytest)
- [ ] Documentar plantilla conversión

---

## 📞 Troubleshooting

### PostgreSQL no inicia
```
Windows: Abrir Services (services.msc) → buscar PostgreSQL → Start
Linux: sudo systemctl start postgresql
macOS: brew services start postgresql@14
```

### Python venv no activa
```
Windows: Ejecutar desde PowerShell (no CMD)
Linux/macOS: Usar source, no . (dot)
```

### Node modules error
```
Eliminar y reinstalar:
rm -rf node_modules package-lock.json
npm install
```

### Puerto 5432 en uso
```
PostgreSQL usa 5432 por defecto
Ver: netstat -an | grep 5432
Cambiar en .env: DB_PORT=5433
```

---

**FASE 1 Setup - Ready!** ✅
