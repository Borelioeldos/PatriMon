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
        BankConnection, BankAccountMapping
    )
    SQLModel.metadata.create_all(engine)

    # Migration légère des colonnes manquantes (SQLite)
    try:
        with engine.begin() as conn:
            cols = [c[1] for c in conn.exec_driver_sql("PRAGMA table_info([transaction])").fetchall()]
            if cols:
                if "category" not in cols:
                    conn.exec_driver_sql("ALTER TABLE [transaction] ADD COLUMN category VARCHAR")
                if "external_id" not in cols:
                    conn.exec_driver_sql("ALTER TABLE [transaction] ADD COLUMN external_id VARCHAR")
    except Exception as e:
        import logging
        logging.getLogger("database").warning(f"Note migration colonnes transaction: {e}")


def get_session():
    """Dépendance FastAPI : fournit une session de base de données."""
    with Session(engine) as session:
        yield session
