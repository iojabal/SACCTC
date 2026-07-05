# UDESTRO con Docker

## ⚡ Ejecutar TODO (con datos restaurados)

```bash
run.bat          # Windows
bash run.sh      # Linux/Mac
```

Esto:
- ✅ Inicia PostgreSQL (restaura el backup automáticamente)
- ✅ Levanta el backend Flask
- ✅ Construye y sirve el frontend React

**Primera ejecución:** PostgreSQL restaura `backend/db/bdudestro_backup.sql` automáticamente.

## URLs

| Servicio | URL |
|----------|-----|
| **UDESTRO completo** | http://localhost |
| Frontend (detrás de proxy) | http://localhost/ |
| API Backend (detrás de proxy) | http://localhost/api |
| PostgreSQL | localhost:5432 — db `bdudestro`, usuario `postgres`, password `postgres` |

## Comandos utiles

```bash
docker compose logs -f        # ver logs
docker compose down           # detener
docker compose down -v        # detener y borrar la base de datos
docker compose up --build -d  # reconstruir tras cambios de codigo
```
