"""Initialisation et accès à la base de données SQLite via SQLModel."""
from sqlmodel import SQLModel, create_engine, Session
from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


def init_db():
    """Crée les tables SQLite si elles n'existent pas encore.
    
    Les modèles doivent être importés pour que SQLModel.metadata les connaisse.
    """
    from app.models import (  # noqa: F401
        Account, Holding, PortfolioSnapshot, Transaction,
        BankConnection, BankAccountMapping, DriveSyncLog
    )
    SQLModel.metadata.create_all(engine)

    # Migration légère des colonnes manquantes et index (SQLite)
    try:
        with engine.begin() as conn:
            # Table Transaction
            cols = [c[1] for c in conn.exec_driver_sql("PRAGMA table_info([transaction])").fetchall()]
            if cols:
                if "category" not in cols:
                    conn.exec_driver_sql("ALTER TABLE [transaction] ADD COLUMN category VARCHAR")
                if "external_id" not in cols:
                    conn.exec_driver_sql("ALTER TABLE [transaction] ADD COLUMN external_id VARCHAR")
                # Index pour optimiser les dédoublonnages d'import
                conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_transaction_external_id ON [transaction] (external_id)")
                # Normalisation catégorie historique
                conn.exec_driver_sql("UPDATE [transaction] SET category = 'Dividendes & Intérêts' WHERE category = 'Revenus de capitaux'")

            # Table Holding
            h_cols = [c[1] for c in conn.exec_driver_sql("PRAGMA table_info(holding)").fetchall()]
            if h_cols:
                if "initial_quantity" not in h_cols:
                    conn.exec_driver_sql("ALTER TABLE holding ADD COLUMN initial_quantity FLOAT DEFAULT 0.0")
                if "initial_unit_cost_eur" not in h_cols:
                    conn.exec_driver_sql("ALTER TABLE holding ADD COLUMN initial_unit_cost_eur FLOAT DEFAULT 0.0")
                # Backfill pour les positions créées sans transaction
                conn.exec_driver_sql(
                    "UPDATE holding SET initial_quantity = quantity, initial_unit_cost_eur = unit_cost_eur "
                    "WHERE (initial_quantity IS NULL OR initial_quantity = 0.0) "
                    "AND id NOT IN (SELECT DISTINCT holding_id FROM [transaction] WHERE holding_id IS NOT NULL)"
                )

            # Table PortfolioSnapshot
            s_cols = [c[1] for c in conn.exec_driver_sql("PRAGMA table_info(portfoliosnapshot)").fetchall()]
            if s_cols:
                if "investment_net_worth" not in s_cols:
                    conn.exec_driver_sql("ALTER TABLE portfoliosnapshot ADD COLUMN investment_net_worth FLOAT")
                if "investment_invested" not in s_cols:
                    conn.exec_driver_sql("ALTER TABLE portfoliosnapshot ADD COLUMN investment_invested FLOAT")
    except Exception as e:
        import logging
        logging.getLogger("database").warning(f"Note migration base de données: {e}")



def get_session():
    """Dépendance FastAPI : fournit une session de base de données."""
    with Session(engine) as session:
        yield session
