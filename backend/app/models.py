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
    PERO = "pero"                # Plan d'Épargne Retraite Obligatoire / Cardif
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


class TransactionType(str, Enum):
    BUY = "buy"                  # Achat d'un actif
    SELL = "sell"                # Vente d'un actif
    DEPOSIT = "deposit"          # Dépôt / Versement d'espèces
    WITHDRAWAL = "withdrawal"    # Retrait d'espèces
    DIVIDEND = "dividend"        # Dividende perçu


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
    transactions: List["Transaction"] = Relationship(
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
    transactions: List["Transaction"] = Relationship(
        back_populates="holding",
        cascade_delete=True,
    )


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


# ═══════════════════════════════ Transaction ═══════════════════════════════

class TransactionBase(SQLModel):
    account_id: int = Field(foreign_key="account.id")
    holding_id: Optional[int] = Field(default=None, foreign_key="holding.id")
    type: TransactionType = TransactionType.BUY
    transaction_date: date = Field(default_factory=date.today)
    symbol: Optional[str] = None          # Ex: CW8.PA, AAPL, BTC-EUR
    name: Optional[str] = None            # Ex: Amundi MSCI World
    quantity: Optional[float] = None      # Quantité d'unités (ex: 5.0)
    unit_price: Optional[float] = None    # Prix unitaire en devise de cotation
    unit_price_eur: Optional[float] = None# Prix unitaire en EUR
    amount: float = 0.0                   # Montant total de l'opération
    amount_eur: float = 0.0               # Montant total en EUR
    fees: float = 0.0                     # Frais d'ordre / courtage
    fees_eur: float = 0.0
    currency: str = "EUR"
    category: Optional[str] = None        # Ex: Alimentation, Logement, Revenus, Investissement, Abonnements...
    external_id: Optional[str] = None     # Identifiant externe de transaction (Open Banking DSP2)
    notes: Optional[str] = None


class Transaction(TransactionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    realized_gain_eur: Optional[float] = None   # Plus-value réalisée pour une vente
    created_at: datetime = Field(default_factory=get_utc_now)
    account: Optional[Account] = Relationship(back_populates="transactions")
    holding: Optional[Holding] = Relationship(back_populates="transactions")


class TransactionCreate(TransactionBase):
    auto_update_holding: bool = True     # Si True, met à jour quantité et PRU du holding
    auto_update_cash: bool = True        # Si True, ajuste le cash_balance du compte


class TransactionRead(TransactionBase):
    id: int
    realized_gain_eur: Optional[float] = None
    created_at: datetime
    account_name: Optional[str] = None
    account_institution: Optional[str] = None


# ═══════════════════════════════ Snapshot ═══════════════════════════════

class PortfolioSnapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    snapshot_date: date = Field(default_factory=date.today, index=True)
    total_net_worth: float        # Valeur totale en EUR
    total_invested: float         # Capital total (PRU + liquidités)
    total_gain: float             # Plus-value latente totale (€)
    total_gain_percent: float     # Plus-value latente (%)
    created_at: datetime = Field(default_factory=get_utc_now)


# ═══════════════════════════ Open Banking DSP2 ═══════════════════════════

class BankConnection(SQLModel, table=True):
    """Connexion bancaire GoCardless active auprès d'un établissement."""
    id: Optional[int] = Field(default=None, primary_key=True)
    institution_id: str                   # Ex: BOURSOBANK_FR, BNP_PARIBAS_FR, REVOLUT_FR
    institution_name: str                 # Ex: BoursoBank, BNP Paribas, Revolut
    requisition_id: str                   # ID de réquisition GoCardless (ou simulation)
    status: str = "LINKED"                # PENDING, LINKED, EXPIRED
    agreement_id: Optional[str] = None
    account_ids: Optional[str] = None     # JSON array des account_ids
    is_simulation: bool = False           # True si mode démo/simulation
    last_synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=get_utc_now)


class BankAccountMapping(SQLModel, table=True):
    """Liaison entre un compte bancaire externe (GoCardless) et un compte PatriMon."""
    id: Optional[int] = Field(default=None, primary_key=True)
    connection_id: int = Field(foreign_key="bankconnection.id")
    external_account_id: str              # ID de compte GoCardless (ex: acc_bourso_01)
    patrimon_account_id: int = Field(foreign_key="account.id")
    iban: Optional[str] = None
    name: Optional[str] = None            # Ex: Compte Bancaire Principal
    last_balance: Optional[float] = None
    last_synced_at: Optional[datetime] = None


# ═══════════════════════════ Google Drive Bourse ═══════════════════════════

class DriveSyncLog(SQLModel, table=True):
    """Journal de traçabilité des fichiers traités depuis Google Drive (Anti-doublons)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    drive_file_id: str = Field(index=True)
    file_name: str
    file_category: str                    # bourso_trade, bourso_statement, revolut_trading, revolut_crypto, revolut_pnl, bnp_pee
    md5_checksum: Optional[str] = None
    file_mtime: Optional[str] = None
    transactions_imported: int = 0
    holdings_updated: int = 0
    status: str = "SUCCESS"               # SUCCESS, PARTIAL, ERROR
    details: Optional[str] = None         # Message résumé ou détails JSON
    imported_at: datetime = Field(default_factory=get_utc_now)

