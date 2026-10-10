# ─── PatriMon — Home Assistant Add-on Dockerfile ───
# Build autonome multi-stage pour le Supervisor Home Assistant

# ──────── Stage 1 : Build Frontend React ────────
FROM node:20-alpine AS frontend-build

RUN apk add --no-cache git

WORKDIR /build
ARG BUILD_VERSION="1.0.5"
RUN git clone --depth 1 -b main https://github.com/Borelioeldos/PatriMon.git repo

WORKDIR /build/repo/frontend
RUN npm ci --no-audit
RUN npm run build

# ──────── Stage 2 : Runtime Python FastAPI ────────
FROM python:3.12-slim

LABEL maintainer="PatriMon"
LABEL description="PatriMon — Suivi de Patrimoine Intelligent (Home Assistant Add-on)"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Dépendances Python
COPY --from=frontend-build /build/repo/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Code backend & static SPA
COPY --from=frontend-build /build/repo/backend/ ./
COPY --from=frontend-build /build/repo/frontend/dist ./static

# Dossier persistant Home Assistant (/data)
RUN mkdir -p /data

ENV PATRIMON_DATA_DIR=/data \
    PATRIMON_DB_PATH=/data/patrimoines.db \
    PATRIMON_STATIC_DIR=/app/static \
    PATRIMON_HOST=0.0.0.0 \
    PATRIMON_PORT=8000 \
    PATRIMON_RELOAD=false \
    PATRIMON_CORS_ORIGINS=* \
    PATRIMON_CACHE_TTL=60 \
    PATRIMON_CURRENCY_CACHE_TTL=600

VOLUME ["/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/portfolio/summary')" || exit 1

CMD ["python", "run.py"]
