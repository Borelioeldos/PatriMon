"""Router CRUD pour les comptes / enveloppes d'investissement."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    Account, AccountCreate, AccountRead, AccountUpdate,
    Holding, AccountType, AssetClass,
)
from app.services.market_service import market_service

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.get("/", response_model=List[AccountRead])
def list_accounts(session: Session = Depends(get_session)):
    """Récupère la liste de tous les comptes bancaires et enveloppes."""
    return session.exec(select(Account)).all()


@router.post("/", response_model=AccountRead)
def create_account(account_in: AccountCreate, session: Session = Depends(get_session)):
    """Crée un nouveau compte ou enveloppe d'investissement."""
    account = Account(**account_in.model_dump())
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountRead)
def get_account(account_id: int, session: Session = Depends(get_session)):
    """Récupère un compte par son ID."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    return account


@router.put("/{account_id}", response_model=AccountRead)
def update_account(
    account_id: int,
    update_data: AccountUpdate,
    session: Session = Depends(get_session),
):
    """Met à jour les informations d'un compte."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable")

    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(account, key, value)

    account.updated_at = datetime.now(timezone.utc)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(account_id: int, session: Session = Depends(get_session)):
    """Supprime un compte et tous ses actifs associés (cascade)."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    session.delete(account)
    session.commit()
    return {"message": "Compte supprimé avec succès"}


# ────────────────── Initialisation (Seed) ──────────────────

@router.post("/seed-initial", response_model=List[AccountRead])
def seed_initial_accounts(session: Session = Depends(get_session)):
    """Initialise les comptes types de l'utilisateur (BoursoBank, Revolut, BNP, BNP EE)."""
    existing = session.exec(select(Account)).first()
    if existing:
        return session.exec(select(Account)).all()

    default_accounts = [
        Account(
            name="BoursoBank - PEA",
            institution="BoursoBank",
            account_type=AccountType.PEA,
            cash_balance=250.0,
            color="#0066FF",
            notes="PEA investissement indiciel long terme",
        ),
        Account(
            name="BoursoBank - Compte Courant",
            institution="BoursoBank",
            account_type=AccountType.CHECKING,
            cash_balance=1200.0,
            color="#1E40AF",
        ),
        Account(
            name="Revolut - CTO & Crypto",
            institution="Revolut",
            account_type=AccountType.CTO,
            cash_balance=150.0,
            color="#00D4FF",
            notes="Actions US et actifs crypto",
        ),
        Account(
            name="BNP Paribas - Livret A & Épargne",
            institution="BNP Paribas",
            account_type=AccountType.SAVINGS,
            cash_balance=5000.0,
            color="#00965E",
            notes="Épargne de précaution",
        ),
        Account(
            name="BNP - Épargne Entreprise (PEE)",
            institution="BNP Épargne Entreprise",
            account_type=AccountType.PEE,
            cash_balance=0.0,
            color="#10B981",
            notes="PEE entreprise avec abondement",
        ),
    ]

    for acc in default_accounts:
        session.add(acc)
    session.commit()

    # ── Positions d'exemple ──

    pea_acc = session.exec(
        select(Account).where(Account.name == "BoursoBank - PEA")
    ).first()
    if pea_acc:
        session.add(Holding(
            account_id=pea_acc.id,
            symbol="CW8.PA",
            name="Amundi MSCI World UCITS ETF",
            asset_class=AssetClass.ETF,
            quantity=12.0,
            unit_cost=480.0,
            unit_cost_eur=480.0,   # EUR → même valeur
            is_manual=False,
        ))

    revolut_acc = session.exec(
        select(Account).where(Account.name == "Revolut - CTO & Crypto")
    ).first()
    if revolut_acc:
        # Bitcoin (cotation en EUR → unit_cost_eur = unit_cost)
        session.add(Holding(
            account_id=revolut_acc.id,
            symbol="BTC-EUR",
            name="Bitcoin",
            asset_class=AssetClass.CRYPTO,
            quantity=0.045,
            unit_cost=55000.0,
            unit_cost_eur=55000.0,
            is_manual=False,
        ))

        # Apple (cotation en USD → conversion au taux du jour)
        usd_rate = market_service.get_eur_rate("USD")
        session.add(Holding(
            account_id=revolut_acc.id,
            symbol="AAPL",
            name="Apple Inc.",
            asset_class=AssetClass.STOCK,
            quantity=8.0,
            unit_cost=185.0,
            unit_cost_eur=round(185.0 * usd_rate, 2),
            currency="USD",
            is_manual=False,
        ))

    pee_acc = session.exec(
        select(Account).where(Account.name == "BNP - Épargne Entreprise (PEE)")
    ).first()
    if pee_acc:
        session.add(Holding(
            account_id=pee_acc.id,
            symbol="FCPE-MONDE",
            name="BNP Paribas FCPE Actions Monde",
            asset_class=AssetClass.FUND,
            quantity=50.0,
            unit_cost=75.0,
            unit_cost_eur=75.0,   # EUR → même valeur
            current_price=88.5,
            is_manual=True,
            notes="Valorisation issue du relevé BNP EE",
        ))

    session.commit()
    return session.exec(select(Account)).all()
