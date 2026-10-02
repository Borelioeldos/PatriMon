"""
Modèles de données PatriMon (SQLModel + Pydantic v2).

Tables  : Account, Holding, PortfolioSnapshot
Schémas : AccountCreate / AccountRead / AccountUpdate
          HoldingCreate / HoldingRead / HoldingUpdate
"""
from datetime import datetime, date, timezone
from enum import Enum
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════ Enums ═══════════════════════════════

class AccountType(str, Enum):
    CHECKING = "checking"        # Compte courant
    SAVINGS = "savings"          # Livrets (A, LDDS, LEP…)
    PEA = "pea"                  # Plan d'Épargne en Actions
    CTO = "cto"                  # Compte-Titres Ordinaire
    CRYPTO = "crypto"            # Portefeuille crypto
    PEE = "pee"                  # Plan d'Épargne Entreprise
    REAL_ESTATE = "real_estate"  # Immobilier
    OTHER = "other"


class Institution(str, Enum):
    BOURSOBANK = "BoursoBank"
    REVOLUT = "Revolut"
    BNP = "BNP Paribas"
    BNP_EE = "BNP Épargne Entreprise"
    OTHER = "Autre"


class AssetClass(str, Enum):
    STOCK = "stock"       # Actions individuelles
    ETF = "etf"           # ETF / Trackers
    CRYPTO = "crypto"     # Cryptomonnaies
    FUND = "fund"         # Fonds / OPCVM / FCPE
    SAVINGS = "savings"   # Livrets réglementés
    CASH = "cash"         # Liquidités
    COMMODITY = "commodity"
    OTHER = "other"


# ═══════════════════════════════ Account ═══════════════════════════════

class AccountBase(SQLModel):
    name: str
    institution: str = Institution.BOURSOBANK.value
    account_type: AccountType = AccountType.CHECKING
    cash_balance: float = 0.0     # Liquidités non investies sur ce compte (€)
    currency: str = "EUR"
    color: Optional[str] = "#3B82F6"
    notes: Optional[str] = None


class Account(AccountBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)
    holdings: List["Holding"] = Relationship(
        back_populates="account",
        cascade_delete=True,
    )


class AccountCreate(AccountBase):
    pass


class AccountRead(AccountBase):
    """Schéma de réponse API — sans la relation ORM `holdings`."""
    id: int
    created_at: datetime
    updated_at: datetime


class AccountUpdate(SQLModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    account_type: Optional[AccountType] = None
    cash_balance: Optional[float] = None
    currency: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None


# ═══════════════════════════════ Holding ═══════════════════════════════

class HoldingBase(SQLModel):
    account_id: int = Field(foreign_key="account.id")
    symbol: str                    # Ex: CW8.PA, AAPL, BTC-EUR, FCPE-MONDE
    name: str                      # Ex: Amundi MSCI World, Apple Inc.
    asset_class: AssetClass = AssetClass.ETF
    quantity: float                # Nombre de parts / unités
    unit_cost: float               # PRU en devise de cotation (pour référence)
    unit_cost_eur: float = 0.0     # PRU converti en EUR au moment de l'achat (pour P&L)
    current_price: Optional[float] = None   # Dernier prix unitaire coté
    currency: str = "EUR"          # Devise de cotation (EUR, USD…)
    is_manual: bool = False        # True → prix non récupéré via Yahoo (ex: PEE FCPE)
    notes: Optional[str] = None


class Holding(HoldingBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    last_price_updated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=get_utc_now)
    account: Optional[Account] = Relationship(back_populates="holdings")


class HoldingCreate(SQLModel):
    """Schéma de création — unit_cost_eur est calculé par le backend si absent."""
    account_id: int
    symbol: str
    name: str = ""
    asset_class: AssetClass = AssetClass.ETF
    quantity: float
    unit_cost: float
    unit_cost_eur: Optional[float] = None   # Calculé côté serveur si absent
    current_price: Optional[float] = None
    currency: str = "EUR"
    is_manual: bool = False
    notes: Optional[str] = None


class HoldingRead(HoldingBase):
    """Schéma de réponse API pour une position."""
    id: int
    last_price_updated_at: Optional[datetime] = None
    created_at: datetime


class HoldingUpdate(SQLModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    asset_class: Optional[AssetClass] = None
    quantity: Optional[float] = None
    unit_cost: Optional[float] = None
    unit_cost_eur: Optional[float] = None
    current_price: Optional[float] = None
    currency: Optional[str] = None
    is_manual: Optional[bool] = None
    notes: Optional[str] = None


# ═══════════════════════════════ Snapshot ═══════════════════════════════

class PortfolioSnapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    snapshot_date: date = Field(default_factory=date.today, index=True)
    total_net_worth: float        # Valeur totale en EUR
    total_invested: float         # Capital total (PRU + liquidités)
    total_gain: float             # Plus-value latente totale (€)
    total_gain_percent: float     # Plus-value latente (%)
    created_at: datetime = Field(default_factory=get_utc_now)
