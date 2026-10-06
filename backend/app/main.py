from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.config import CORS_ORIGINS, STATIC_DIR
from app.database import init_db
from app.routers import accounts, holdings, portfolio, market, transactions, open_banking, pee, google_drive, strategy


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Vérification et réconciliation des gains réalisés historiques
    from app.database import engine
    from app.services.transaction_service import transaction_service
    from sqlmodel import Session
    try:
        with Session(engine) as session:
            transaction_service.recalculate_all_realized_gains(session)
    except Exception as e:
        import logging
        logging.getLogger("main").warning(f"Erreur réconciliation gains réalisés au démarrage: {e}")

    # Démarrage du planificateur de synchronisation automatique régulière
    from app.services.sync_scheduler_service import sync_scheduler_service
    sync_scheduler_service.start()
    yield
    sync_scheduler_service.stop()


app = FastAPI(
    title="PatriMon : Suivi de Patrimoine Intelligent",
    description="API de valorisation patrimoniale en temps réel (Actions, ETF, Crypto, Banques, PEE)",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routeurs
app.include_router(portfolio.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(holdings.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(open_banking.router, prefix="/api")
app.include_router(pee.router, prefix="/api")
app.include_router(google_drive.router, prefix="/api")
app.include_router(strategy.router, prefix="/api")


# ─── Distribution des fichiers statiques du frontend React (SPA) ───
if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static_assets")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        # Ne jamais intercepter les requêtes API ni Swagger / OpenAPI
        if (
            full_path.startswith("api")
            or full_path.startswith("docs")
            or full_path.startswith("openapi.json")
            or full_path.startswith("redoc")
        ):
            raise HTTPException(status_code=404, detail="Not Found")
        
        target = STATIC_DIR / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(STATIC_DIR / "index.html")
else:
    @app.get("/")
    def root():
        return {
            "status": "online",
            "app": "PatriMon API",
            "version": "3.0.0",
            "documentation": "/docs",
            "mode": "API only (Vite frontend sur port 5173)",
        }

