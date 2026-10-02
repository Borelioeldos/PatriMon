"""
PatriMon — Configuration centralisée.
Toutes les valeurs sont paramétrables via variables d'environnement (Docker-ready).
"""
import os
from pathlib import Path

# Répertoire racine du backend (parent de /app/)
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Base de données ───
DB_PATH: str = os.environ.get("PATRIMON_DB_PATH", str(BASE_DIR / "patrimoines.db"))
DATABASE_URL: str = f"sqlite:///{DB_PATH}"

# ─── Serveur ───
HOST: str = os.environ.get("PATRIMON_HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PATRIMON_PORT", "8000"))

# ─── CORS ───
CORS_ORIGINS: list[str] = os.environ.get("PATRIMON_CORS_ORIGINS", "*").split(",")

# ─── Cache marché (secondes) ───
MARKET_CACHE_TTL: int = int(os.environ.get("PATRIMON_CACHE_TTL", "60"))
CURRENCY_CACHE_TTL: int = int(os.environ.get("PATRIMON_CURRENCY_CACHE_TTL", "600"))
