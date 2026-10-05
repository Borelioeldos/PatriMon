"""Router CRUD pour les positions / lignes d'actifs (holdings)."""
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, or_

from app.database import get_session
from app.models import Holding, HoldingCreate, HoldingUpdate, Account, AssetClass, Transaction, TransactionType
from app.services.portfolio_service import PortfolioService
from app.services.market_service import market_service

router = APIRouter(prefix="/holdings", tags=["Holdings"])


@router.get("/", response_model=List[Dict[str, Any]])
def list_holdings(
    account_id: Optional[int] = Query(None, description="Filtrer par compte"),

    force_refresh: bool = Query(False, description="Forcer le rafraîchissement des cotations"),
    session: Session = Depends(get_session),
):
    """Liste tous les actifs avec valorisation en temps réel et gains calculés."""
    query = select(Holding)
    if account_id:
        query = query.where(Holding.account_id == account_id)

    holdings = session.exec(query).all()
    return [PortfolioService.enrich_holding(h, force_refresh=force_refresh) for h in holdings]


@router.post("/", response_model=Dict[str, Any])
def create_holding(
    holding_in: HoldingCreate,
    session: Session = Depends(get_session),
):
    """Ajoute une nouvelle position d'investissement."""
    account = session.get(Account, holding_in.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable")

    name = holding_in.name or holding_in.symbol
    current_price = holding_in.current_price
    currency = holding_in.currency or "EUR"
    is_manual = holding_in.is_manual
    unit_cost = holding_in.unit_cost

    input_currency = (holding_in.currency or "EUR").upper()
    quote_currency = None

    # ── Cas livrets / liquidités : prix fixe = 1 € ──
    if holding_in.asset_class in (AssetClass.SAVINGS, AssetClass.CASH):
        is_manual = True
        unit_cost = 1.0
        current_price = 1.0
        unit_cost_eur = 1.0
        currency = "EUR"

    elif not is_manual and holding_in.symbol:
        # ── Titre coté : récupérer les infos de marché ──
        quote = market_service.get_quote(holding_in.symbol)
        if quote.get("success"):
            if not name or name == holding_in.symbol:
                name = quote.get("name", holding_in.symbol)
            if current_price is None:
                current_price = quote.get("current_price")
            quote_currency = quote.get("currency")

        currency = quote_currency or input_currency

        # Calcul du PRU en EUR (permanent)
        if holding_in.unit_cost_eur is not None:
            unit_cost_eur = holding_in.unit_cost_eur
        elif input_currency == "EUR":
            unit_cost_eur = unit_cost
        else:
            eur_rate = market_service.get_eur_rate(input_currency)
            unit_cost_eur = round(unit_cost * eur_rate, 4)

        # Si saisie en EUR pour un actif coté en devise étrangère, ajuster unit_cost en devise
        if input_currency == "EUR" and currency != "EUR":
            target_rate = market_service.get_eur_rate(currency)
            unit_cost = round(unit_cost_eur / target_rate, 4) if target_rate > 0 else unit_cost
    else:
        # ── Titre manuel (PEE, FCPE…) ──
        currency = input_currency
        if holding_in.unit_cost_eur is not None:
            unit_cost_eur = holding_in.unit_cost_eur
        elif currency == "EUR":
            unit_cost_eur = unit_cost
        else:
            eur_rate = market_service.get_eur_rate(currency)
            unit_cost_eur = round(unit_cost * eur_rate, 4)

    holding = Holding(
        account_id=holding_in.account_id,
        symbol=(holding_in.symbol or name).upper(),
        name=name,
        asset_class=holding_in.asset_class,
        quantity=holding_in.quantity,
        unit_cost=unit_cost,
        unit_cost_eur=unit_cost_eur,
        current_price=current_price,
        currency=currency,
        is_manual=is_manual,
        initial_quantity=holding_in.quantity,
        initial_unit_cost_eur=unit_cost_eur,
        notes=holding_in.notes,
    )

    session.add(holding)
    session.commit()
    session.refresh(holding)
    return PortfolioService.enrich_holding(holding)


@router.put("/{holding_id}", response_model=Dict[str, Any])
def update_holding(
    holding_id: int,
    update_data: HoldingUpdate,
    session: Session = Depends(get_session),
):
    """Modifie une position existante (quantité, PRU, prix manuel…)."""
    holding = session.get(Holding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Position introuvable")

    data = update_data.model_dump(exclude_unset=True)

    for key, value in data.items():
        if key == "symbol" and value:
            value = value.upper()
        setattr(holding, key, value)

    session.add(holding)
    session.commit()
    session.refresh(holding)
    return PortfolioService.enrich_holding(holding, force_refresh=True)


@router.delete("/{holding_id}")
def delete_holding(holding_id: int, session: Session = Depends(get_session)):
    """Supprime une position sans détruire l'historique de ses transactions."""
    holding = session.get(Holding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Position introuvable")

    # Détacher les transactions existantes pour préserver l'historique comptable
    from app.models import Transaction
    txs = session.exec(select(Transaction).where(Transaction.holding_id == holding_id)).all()
    for tx in txs:
        tx.holding_id = None
        session.add(tx)
    session.flush()

    session.delete(holding)
    session.commit()
    return {"message": "Position supprimée avec succès (historique des transactions préservé)"}


@router.get("/{holding_id}/detail", response_model=Dict[str, Any])
def get_holding_detail(
    holding_id: int,
    session: Session = Depends(get_session),
):
    """Retourne la fiche d'identité détaillée d'un actif : cotation live, compte parent, historique de ses ordres/dividendes et métriques financières."""
    holding = session.get(Holding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Position introuvable")

    account = session.get(Account, holding.account_id)
    enriched = PortfolioService.enrich_holding(holding)

    # Récupération des transactions associées (par holding_id direct ou par symbole sur ce compte)
    conditions = [Transaction.holding_id == holding_id]
    if holding.symbol:
        conditions.append(
            (Transaction.account_id == holding.account_id) & (Transaction.symbol == holding.symbol)
        )

    txs = session.exec(
        select(Transaction)
        .where(or_(*conditions))
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    ).all()

    # Synthèse financière de la position
    total_buys_count = 0
    total_sells_count = 0
    total_dividends_count = 0
    total_dividends_eur = 0.0
    total_bought_eur = 0.0
    total_sold_eur = 0.0
    realized_gain_eur = 0.0

    tx_list = []
    for t in txs:
        t_dict = {
            "id": t.id,
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "transaction_date": t.transaction_date.isoformat(),
            "symbol": t.symbol,
            "name": t.name,
            "quantity": t.quantity,
            "unit_price": t.unit_price,
            "unit_price_eur": t.unit_price_eur,
            "amount": t.amount,
            "amount_eur": t.amount_eur,
            "fees_eur": t.fees_eur,
            "currency": t.currency,
            "realized_gain_eur": t.realized_gain_eur,
            "notes": t.notes,
        }
        tx_list.append(t_dict)

        if t.type == TransactionType.BUY:
            total_buys_count += 1
            total_bought_eur += (t.amount_eur or 0.0)
        elif t.type == TransactionType.SELL:
            total_sells_count += 1
            total_sold_eur += (t.amount_eur or 0.0)
            realized_gain_eur += (t.realized_gain_eur or 0.0)
        elif t.type == TransactionType.DIVIDEND:
            total_dividends_count += 1
            total_dividends_eur += (t.amount_eur or 0.0)

    # Yield on Cost (Dividendes cumulés rapportés au coût d'achat résiduel ou investi)
    cost_basis = enriched["total_invested_eur"]
    yield_on_cost = (
        round((total_dividends_eur / cost_basis) * 100, 2)
        if cost_basis > 0 and total_dividends_eur > 0
        else 0.0
    )

    unrealized_gain_eur = enriched["gain_eur"]
    total_return_eur = round(unrealized_gain_eur + realized_gain_eur + total_dividends_eur, 2)

    return {
        "holding": enriched,
        "account": {
            "id": account.id if account else None,
            "name": account.name if account else "Inconnu",
            "institution": account.institution if account else None,
            "account_type": account.account_type.value if account else None,
            "currency": account.currency if account else "EUR",
            "color": account.color if account else "#3B82F6",
        },
        "stats": {
            "total_buys_count": total_buys_count,
            "total_sells_count": total_sells_count,
            "total_dividends_count": total_dividends_count,
            "total_dividends_eur": round(total_dividends_eur, 2),
            "total_bought_eur": round(total_bought_eur, 2),
            "total_sold_eur": round(total_sold_eur, 2),
            "realized_gain_eur": round(realized_gain_eur, 2),
            "unrealized_gain_eur": round(unrealized_gain_eur, 2),
            "unrealized_gain_percent": enriched["gain_percent"],
            "total_return_eur": total_return_eur,
            "yield_on_cost": yield_on_cost,
        },
        "transactions": tx_list,
    }
