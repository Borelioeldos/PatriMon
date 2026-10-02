from typing import Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from app.database import get_session
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

@router.get("/summary", response_model=Dict[str, Any])
def get_portfolio_summary(
    force_refresh: bool = Query(False, description="Forcer le rafraîchissement des prix de marché"),
    session: Session = Depends(get_session)
):
    """
    Retourne la vue consolidée du patrimoine :
    - Valeur totale nette (€)
    - Montant investi (€)
    - Plus-value globale (€ et %)
    - Liquidités totales
    - Répartition par institution (BoursoBank, Revolut, BNP, BNP EE...)
    - Répartition par classe d'actifs (Actions/ETF, Épargne, Crypto, PEE...)
    - Détail par compte et positions
    - Historique d'évolution
    """
    return PortfolioService.get_portfolio_summary(session, force_refresh=force_refresh)
