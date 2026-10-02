# ─── PatriMon — Dockerfile multi-stage ───
# Étape 1 : build du frontend React (Vite)
# Étape 2 : serveur Python FastAPI qui sert aussi les fichiers statiques

# ──────── Stage 1 : Build Frontend ────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit
COPY frontend/ ./
RUN npm run build

# ──────── Stage 2 : Backend + Static ────────
FROM python:3.12-slim

LABEL maintainer="PatriMon"
LABEL description="Suivi de Patrimoine — FastAPI + React"

WORKDIR /app

# Dépendances Python
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Code backend
COPY backend/ ./

# Fichiers statiques du frontend (build Vite)
COPY --from=frontend-build /app/frontend/dist ./static

# Variables d'environnement par défaut
ENV PATRIMON_DB_PATH=/data/patrimoines.db \
    PATRIMON_HOST=0.0.0.0 \
    PATRIMON_PORT=8000 \
    PATRIMON_CORS_ORIGINS=* \
    PATRIMON_CACHE_TTL=60 \
    PATRIMON_CURRENCY_CACHE_TTL=600 \
    PYTHONPATH=/app

# Volume pour la base SQLite (persistance)
VOLUME ["/data"]

EXPOSE 8000

CMD ["python", "run.py"]
