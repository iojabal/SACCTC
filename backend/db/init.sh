#!/bin/bash
# Script para inicializar la BD en Docker
# Si existe bdudestro_backup.sql, la restaura

set -e

echo "[*] Esperando a PostgreSQL..."
until pg_isready -h localhost -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "[✓] PostgreSQL está listo"

# Crear BD si no existe
psql -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'bdudestro'" | grep -q 1 || \
  psql -h localhost -U postgres -c "CREATE DATABASE bdudestro ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C';"

echo "[✓] BD bdudestro lista"

# Restaurar backup si existe
if [ -f /docker-entrypoint-initdb.d/bdudestro_backup.sql ]; then
  echo "[*] Restaurando backup..."
  psql -h localhost -U postgres -d bdudestro < /docker-entrypoint-initdb.d/bdudestro_backup.sql
  echo "[✓] Backup restaurado"
else
  echo "[-] No hay backup para restaurar (normal en primera ejecución)"
fi

echo "[✓] Inicialización completada"
