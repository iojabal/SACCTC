# ============================================================
# UDESTRO Frontend (React / CRA) - Dockerfile multi-etapa
#
#   deps        -> instala node_modules (capa cacheable)
#   development -> servidor CRA con hot-reload (usado por docker-compose)
#   build       -> `npm run build` (bundle optimizado de produccion)
#   production  -> nginx sirviendo los estaticos en el puerto 3000
#
# Build de produccion:
#   docker build --target production \
#     --build-arg REACT_APP_API_URL=http://localhost:5000/api \
#     -t udestro-frontend ./frontend
# ============================================================

# ---------- Etapa 1: dependencias ----------
FROM node:20-slim AS deps
WORKDIR /app
# Solo los manifests: la capa de npm ci se cachea mientras no cambien
COPY package.json package-lock.json ./
RUN npm install

# ---------- Etapa 2: desarrollo (hot-reload) ----------
FROM deps AS development
COPY . .
ENV PORT=3000 \
    BROWSER=none
EXPOSE 3000
# CRA dev server: lee REACT_APP_API_URL en runtime y recarga al editar src/
CMD ["npm", "start"]

# ---------- Etapa 3: build de produccion ----------
FROM deps AS build
# OJO: CRA "hornea" las variables REACT_APP_* en el bundle en tiempo de
# build, por eso se pasa como build-arg y no como env de runtime.
ARG REACT_APP_API_URL=http://localhost:5000/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
COPY . .
RUN npm run build

# ---------- Etapa 4: runtime de produccion (nginx) ----------
FROM nginx:1.27-alpine AS production
# Config propia: escucha en 3000 y hace fallback SPA a index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
