# ─── PatriMon — Dockerfile Multi-Stage Production ───
# Étape 1 : Compilation du frontend React (Vite + Tailwind)
# Étape 2 : Runtime Python FastAPI servant l'API et l'application statique SPA

# ──────── Stage 1 : Build Frontend ────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Mise en cache optimale des dépendances Node
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit

# Compilation du code source frontend vers /app/frontend/dist
COPY frontend/ ./
RUN npm run build

# ──────── Stage 2 : Backend + Static SPA ────────
FROM python:3.12-slim

LABEL maintainer="PatriMon"
LABEL description="PatriMon — Suivi de Patrimoine Intelligent Souverain (FastAPI + React)"

# Optimisation d'exécution Python dans Docker
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Installation des dépendances Python
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code backend
COPY backend/ ./

# Copie des fichiers statiques compilés de la SPA
COPY --from=frontend-build /app/frontend/dist ./static

# Répertoire de données persistantes (SQLite, configurations JSON, clés)
RUN mkdir -p /data

# Variables d'environnement de production par défaut
ENV PATRIMON_DATA_DIR=/data \
    PATRIMON_DB_PATH=/data/patrimoines.db \
    PATRIMON_STATIC_DIR=/app/static \
    PATRIMON_HOST=0.0.0.0 \
    PATRIMON_PORT=8000 \
    PATRIMON_RELOAD=false \
    PATRIMON_CORS_ORIGINS=* \
    PATRIMON_CACHE_TTL=60 \
    PATRIMON_CURRENCY_CACHE_TTL=600

# Volume persistant pour la base de données et les configurations
VOLUME ["/data"]

EXPOSE 8000

# Healthcheck : vérifie la réponse de l'API de synthèse
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/portfolio/summary')" || exit 1

CMD ["python", "run.py"]
