"""
PatriMon — Configuration centralisée.
Toutes les valeurs sont paramétrables via variables d'environnement (Docker-ready).
"""
import os
from pathlib import Path

# Répertoire racine du backend (parent de /app/)
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Répertoire de données persistantes (/data en conteneur ou BASE_DIR en local) ───
DATA_DIR: Path = Path(os.environ.get("PATRIMON_DATA_DIR", str(BASE_DIR)))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ─── Base de données SQLite ───
DB_PATH: Path = Path(os.environ.get("PATRIMON_DB_PATH", str(DATA_DIR / "patrimoines.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Migration douce de la base existante lors du premier lancement conteneurisé
legacy_db: Path = BASE_DIR / "patrimoines.db"
if not DB_PATH.exists() and legacy_db.exists() and DB_PATH != legacy_db:
    try:
        import shutil
        shutil.copy2(legacy_db, DB_PATH)
    except Exception:
        pass

DATABASE_URL: str = f"sqlite:///{DB_PATH}"

# ─── Fichiers de configuration persistants ───
OPEN_BANKING_CONFIG_PATH: Path = Path(
    os.environ.get("PATRIMON_OPEN_BANKING_CONFIG_PATH", str(DATA_DIR / "open_banking_config.json"))
)
STRATEGY_CONFIG_PATH: Path = Path(
    os.environ.get("PATRIMON_STRATEGY_CONFIG_PATH", str(DATA_DIR / "strategy_config.json"))
)
SYNC_SCHEDULER_CONFIG_PATH: Path = Path(
    os.environ.get("PATRIMON_SYNC_SCHEDULER_CONFIG_PATH", str(DATA_DIR / "sync_scheduler_config.json"))
)

# ─── Répertoire des fichiers statiques (Frontend React SPA) ───
STATIC_DIR: Path = Path(os.environ.get("PATRIMON_STATIC_DIR", str(BASE_DIR / "static")))

# ─── Serveur ───
HOST: str = os.environ.get("PATRIMON_HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PATRIMON_PORT", "8000"))
RELOAD: bool = os.environ.get(
    "PATRIMON_RELOAD", "false" if os.environ.get("PATRIMON_DATA_DIR") else "true"
).lower() == "true"

# ─── CORS ───
CORS_ORIGINS: list[str] = os.environ.get("PATRIMON_CORS_ORIGINS", "*").split(",")

# ─── Cache marché (secondes) ───
MARKET_CACHE_TTL: int = int(os.environ.get("PATRIMON_CACHE_TTL", "60"))
CURRENCY_CACHE_TTL: int = int(os.environ.get("PATRIMON_CURRENCY_CACHE_TTL", "600"))
