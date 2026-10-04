"""Router pour la synthèse globale et la comparaison avec les indices de référence."""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.database import get_session
from app.services.portfolio_service import PortfolioService
from app.services.benchmark_service import benchmark_service

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get("/summary", response_model=Dict[str, Any])
def get_portfolio_summary(
    force_refresh: bool = Query(False, description="Forcer le rafraîchissement des prix de marché"),
    record_snapshot: bool = Query(False, description="Enregistrer ou mettre à jour le snapshot du jour"),
    session: Session = Depends(get_session)
):
    """
    Retourne la vue consolidée du patrimoine (lecture seule par défaut) :
    - Valeur totale nette (€)
    - Montant investi (€)
    - Plus-value globale (€ et %)
    - Liquidités totales
    - Répartition par institution (BoursoBank, Revolut, BNP, BNP EE...)
    - Répartition par classe d'actifs (Actions/ETF, Épargne, Crypto, PEE...)
    - Détail par compte et positions
    - Historique d'évolution
    - Métriques financières avancées : TWR, MWR / TRI, dividendes, plus-values
    """
    return PortfolioService.get_portfolio_summary(
        session, force_refresh=force_refresh, record_snapshot=record_snapshot
    )


@router.post("/snapshot", response_model=Dict[str, Any])
def create_portfolio_snapshot(
    force_refresh: bool = Query(True, description="Rafraîchir les cotations avant snapshot"),
    session: Session = Depends(get_session)
):
    """Déclenche explicitement la prise d'un snapshot journalier de valorisation."""
    summary = PortfolioService.get_portfolio_summary(
        session, force_refresh=force_refresh, record_snapshot=True
    )
    return {
        "message": "Snapshot journalier enregistré avec succès",
        "snapshot_date": summary.get("history", [{}])[-1].get("full_date") if summary.get("history") else None,
        "total_net_worth": summary.get("total_net_worth"),
        "investment_net_worth": summary.get("investment_net_worth"),
        "total_gain": summary.get("total_gain"),
    }



@router.get("/benchmarks", response_model=List[Dict[str, str]])
def get_available_benchmarks():
    """Liste les indices de référence supportés (MSCI World, S&P 500, CAC 40, Bitcoin)."""
    return benchmark_service.get_available_benchmarks()


@router.get("/benchmark-comparison", response_model=Dict[str, Any])
def get_benchmark_comparison(
    benchmark: str = Query("CW8.PA", description="Symbole de l'indice de référence (CW8.PA, ^GSPC, ^FCHI, BTC-EUR)"),
    period: str = Query("1mo", description="Période de comparaison (1mo, 3mo, 6mo, 1y)"),
    session: Session = Depends(get_session)
):
    """Compare l'évolution en % du portefeuille avec celle d'un indice de référence."""
    return benchmark_service.compare_with_portfolio(session, benchmark_symbol=benchmark, period=period)
