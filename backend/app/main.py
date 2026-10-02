from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.database import init_db
from app.routers import accounts, holdings, portfolio, market, transactions, open_banking, pee


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


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


@app.get("/")
def root():
    return {
        "status": "online",
        "app": "PatriMon API",
        "version": "1.1.0",
        "documentation": "/docs",
    }
