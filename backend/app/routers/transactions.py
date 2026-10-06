"""Router CRUD et statistiques pour les transactions financières."""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    Transaction, TransactionCreate, TransactionRead, TransactionType,
    Account, Holding
)
from app.services.transaction_service import transaction_service

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("/", response_model=List[TransactionRead])
def list_transactions(
    account_id: Optional[int] = Query(None, description="Filtrer par compte"),
    holding_id: Optional[int] = Query(None, description="Filtrer par position"),
    type: Optional[TransactionType] = Query(None, description="Filtrer par type d'opération"),
    category: Optional[str] = Query(None, description="Filtrer par catégorie"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
):
    """Liste l'historique complet des transactions avec filtres optionnels."""
    query = select(Transaction)

    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if holding_id:
        query = query.where(Transaction.holding_id == holding_id)
    if type:
        query = query.where(Transaction.type == type)
    if category:
        query = query.where(Transaction.category == category)

    query = query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    query = query.offset(offset).limit(limit)

    txs = session.exec(query).all()

    # Enrichissement avec les métadonnées du compte pour l'affichage direct
    accounts_map = {a.id: a for a in session.exec(select(Account)).all()}

    results: List[TransactionRead] = []
    for t in txs:
        acc = accounts_map.get(t.account_id)
        tr = TransactionRead(
            id=t.id,
            account_id=t.account_id,
            holding_id=t.holding_id,
            type=t.type,
            transaction_date=t.transaction_date,
            symbol=t.symbol,
            name=t.name,
            quantity=t.quantity,
            unit_price=t.unit_price,
            unit_price_eur=t.unit_price_eur,
            amount=t.amount,
            amount_eur=t.amount_eur,
            fees=t.fees,
            fees_eur=t.fees_eur,
            currency=t.currency,
            category=t.category,
            external_id=t.external_id,
            notes=t.notes,
            realized_gain_eur=t.realized_gain_eur,
            created_at=t.created_at,
            account_name=acc.name if acc else None,
            account_institution=acc.institution if acc else None,
        )
        results.append(tr)

    return results


@router.get("/categories", response_model=List[str])
def list_categories():
    """Retourne la liste des catégories de transactions disponibles."""
    from app.services.transaction_enricher import ALL_CATEGORIES
    return ALL_CATEGORIES


@router.post("/enrich", response_model=Dict[str, Any])
def enrich_transaction(
    payload: Dict[str, Any],
):
    """Auto-complète et pré-remplit les champs d'une transaction (titre, cotation, catégorie, montants)."""
    from app.services.transaction_enricher import transaction_enricher
    return transaction_enricher.enrich_transaction_data(payload)


@router.post("/", response_model=TransactionRead)
def create_transaction(
    tx_in: TransactionCreate,
    session: Session = Depends(get_session),
):
    """Enregistre une nouvelle opération et recalcule le PRU ou les soldes correspondants."""
    try:
        tx = transaction_service.create_transaction(session, tx_in)
        acc = session.get(Account, tx.account_id)
        return TransactionRead(
            id=tx.id,
            account_id=tx.account_id,
            holding_id=tx.holding_id,
            type=tx.type,
            transaction_date=tx.transaction_date,
            symbol=tx.symbol,
            name=tx.name,
            quantity=tx.quantity,
            unit_price=tx.unit_price,
            unit_price_eur=tx.unit_price_eur,
            amount=tx.amount,
            amount_eur=tx.amount_eur,
            fees=tx.fees,
            fees_eur=tx.fees_eur,
            currency=tx.currency,
            category=tx.category,
            external_id=tx.external_id,
            notes=tx.notes,
            realized_gain_eur=tx.realized_gain_eur,
            created_at=tx.created_at,
            account_name=acc.name if acc else None,
            account_institution=acc.institution if acc else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur enregistrement transaction : {e}")


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, session: Session = Depends(get_session)):
    """Supprime une transaction, réajuste le solde espèces du compte et recalcule la position."""
    deleted = transaction_service.delete_transaction(session, transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    return {"message": "Transaction supprimée avec succès, solde espèces réajusté et position recalculée"}



@router.get("/stats", response_model=Dict[str, Any])
def get_transaction_stats(session: Session = Depends(get_session)):
    """Retourne la synthèse des flux financiers : dividendes, plus-values réalisées, frais..."""
    return transaction_service.get_transaction_stats(session)


@router.post("/recalculate-holding/{holding_id}")
def recalculate_holding(holding_id: int, session: Session = Depends(get_session)):
    """Recalcule dynamiquement le PRU pondéré et la quantité restante pour un holding."""
    holding = transaction_service.recalculate_holding_pru(session, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Position introuvable")
    return {"message": "PRU et quantité recalculés avec succès", "holding_id": holding.id, "pru_eur": holding.unit_cost_eur, "quantity": holding.quantity}


@router.post("/recalculate-all")
def recalculate_all_transactions(session: Session = Depends(get_session)):
    """Recalcule les positions et les plus-values réalisées pour l'ensemble des comptes et holdings."""
    count = transaction_service.recalculate_all_realized_gains(session)
    return {"message": "Plus-values réalisées et PRU recalculés avec succès pour l'ensemble du portefeuille", "updated_count": count}
