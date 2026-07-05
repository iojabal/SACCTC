#!/bin/sh
# UDESTRO - arranca toda la aplicacion con Docker
cd "$(dirname "$0")"
docker compose up --build -d
echo ""
echo "UDESTRO corriendo:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:5000"
echo "  Postgres: localhost:5432 (bdudestro)"
echo ""
echo "Logs:    docker compose logs -f"
echo "Detener: docker compose down"
