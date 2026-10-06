"""
Router FastAPI pour le Pilotage Stratégique, l'Allocation Cible, le Rééquilibrage DCA et les Projections Long Terme.
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from sqlmodel import Session
from app.database import get_session
from app.services.strategy_service import strategy_service, DEFAULT_PRESETS

router = APIRouter(prefix="/strategy", tags=["strategy"])


class TargetAllocationUpdate(BaseModel):
    allocations: Dict[str, float]
    preset_id: Optional[str] = "custom"


class RebalanceSimulationRequest(BaseModel):
    contribution_amount: float = Field(default=500.0, ge=0.0)
    custom_targets: Optional[Dict[str, float]] = None


class ProjectionRequest(BaseModel):
    initial_capital: Optional[float] = None
    monthly_contribution: float = Field(default=500.0, ge=0.0)
    annual_return_pct: float = Field(default=7.0, ge=0.0, le=30.0)
    years: int = Field(default=20, ge=1, le=40)
    inflation_rate_pct: float = Field(default=2.0, ge=0.0, le=15.0)
    swr_pct: float = Field(default=4.0, ge=1.0, le=10.0)
    desired_monthly_expense: float = Field(default=2500.0, ge=0.0)


@router.get("/presets")
def get_presets() -> Dict[str, Any]:
    """Retourne la liste des profils d'allocation types (Équilibré, Dynamique, All-Weather, Prudent)."""
    return {"presets": DEFAULT_PRESETS}


@router.get("/allocation")
def get_allocation_analysis(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """
    Retourne la matrice d'allocation complète :
    Répartition réelle vs Cible, écarts (Deltas % et €) et statuts (Sous-pondéré, Conforme, Surpondéré).
    """
    try:
        return strategy_service.get_allocation_analysis(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse d'allocation : {str(e)}")


@router.post("/allocation")
def update_target_allocation(payload: TargetAllocationUpdate) -> Dict[str, Any]:
    """
    Enregistre les pondérations cibles personnalisées ou applique un preset.
    """
    total = sum(payload.allocations.values())
    if abs(total - 100.0) > 0.5:
        raise HTTPException(
            status_code=400,
            detail=f"La somme des allocations cibles doit être égale à 100% (actuellement {total:.1f}%)."
        )
    return strategy_service.set_target_allocations(payload.allocations, payload.preset_id)


@router.post("/rebalance-simulate")
def simulate_rebalance(
    payload: RebalanceSimulationRequest,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """
    Calcule la ventilation optimale d'un versement mensuel (DCA) sans vente d'actifs.
    Priorise les classes sous-pondérées pour rapprocher le portefeuille de la cible.
    """
    try:
        return strategy_service.simulate_dca_rebalance(
            session=session,
            contribution_amount=payload.contribution_amount,
            custom_targets=payload.custom_targets,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur simulation rééquilibrage : {str(e)}")


@router.post("/projections")
def calculate_projections(
    payload: ProjectionRequest,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """
    Simulateur mathématique d'intérêts composés et trajectoire d'indépendance financière (FIRE).
    Si le capital initial n'est pas fourni, il est automatiquement initialisé avec le patrimoine net actuel.
    """
    try:
        init_cap = payload.initial_capital
        if init_cap is None:
            analysis = strategy_service.get_allocation_analysis(session)
            init_cap = analysis.get("total_net_worth", 10000.0)

        return strategy_service.calculate_projections(
            initial_capital=float(init_cap),
            monthly_contribution=float(payload.monthly_contribution),
            annual_return_pct=float(payload.annual_return_pct),
            years=int(payload.years),
            inflation_rate_pct=float(payload.inflation_rate_pct),
            swr_pct=float(payload.swr_pct),
            desired_monthly_expense=float(payload.desired_monthly_expense),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur calcul des projections : {str(e)}")
