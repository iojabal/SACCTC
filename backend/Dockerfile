# ============================================================
# UDESTRO Backend (Flask) - Dockerfile
# Base: Python 3.13 slim (imagen ligera, ~150 MB)
# ============================================================
FROM python:3.13-slim

# Buenas practicas Python en contenedores:
#  - no generar .pyc (PYTHONDONTWRITEBYTECODE)
#  - logs sin buffer, visibles en `docker logs` (PYTHONUNBUFFERED)
#  - FLASK_APP para que `flask run` encuentre la app (run.py)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=run.py \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 1) Instalar dependencias primero (capa cacheable: solo se
#    reconstruye si cambia requirements.txt, no con cada cambio de codigo)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) Copiar el codigo de la aplicacion
#    (en modo dev, docker-compose monta ./backend encima de /app
#     para hot-reload; esta copia sirve para builds autonomos/produccion)
COPY . .

# Puerto de la API Flask
EXPOSE 5000

# Servidor de desarrollo con auto-reload (FLASK_DEBUG=1 via compose).
# Para produccion, sobrescribir con:
#   command: gunicorn -w 4 -b 0.0.0.0:5000 "run:app"
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
