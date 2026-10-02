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
    from app.models import Account, Holding, PortfolioSnapshot  # noqa: F401
    SQLModel.metadata.create_all(engine)


def get_session():
    """Dépendance FastAPI : fournit une session de base de données."""
    with Session(engine) as session:
        yield session
