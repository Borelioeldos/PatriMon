"""Router pour les cotations de marché et la recherche de tickers."""
from typing import Dict, Any, List

from fastapi import APIRouter, Query

from app.services.market_service import market_service

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/quote", response_model=Dict[str, Any])
def get_quote(
    symbol: str = Query(..., description="Symbole boursier (ex: CW8.PA, AAPL, BTC-EUR)"),
):
    """Récupère la cotation en direct d'un titre."""
    return market_service.get_quote(symbol)


@router.get("/search", response_model=List[Dict[str, Any]])
def search_symbol(
    q: str = Query(..., description="Recherche par nom ou ticker"),
):
    """Recherche des suggestions de tickers boursiers."""
    return market_service.search_symbol(q)


@router.post("/refresh")
def refresh_market_cache():
    """Force le vidage du cache des cotations et devises.

    Le prochain appel à /portfolio/summary ou /holdings re-fetche tout.
    """
    market_service.clear_cache()
    return {"message": "Cache des cotations vidé — les prochains appels récupèreront les cours frais."}
