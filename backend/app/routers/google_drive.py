"""
PatriMon — Router API pour la synchronisation Google Drive Bourse.
Expose les endpoints d'exploration d'arborescence, de synchronisation 1-clic et d'historique.
"""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc

from app.database import get_session
from app.models import DriveSyncLog
from app.services.google_drive_service import google_drive_service

router = APIRouter(prefix="/api/google-drive", tags=["Google Drive Bourse"])


@router.get("/tree")
def get_drive_tree(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Renvoie l'état de la connexion Google Drive et la liste des fichiers des 3 dossiers."""
    try:
        tree = google_drive_service.get_drive_tree(session)
        return tree
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "total_files": 0,
            "categories": {},
        }


@router.post("/sync")
def sync_drive_bourse(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Déclenche la synchronisation complète de tous les dossiers Bourse Google Drive."""
    try:
        stats = google_drive_service.sync_all(session)
        return {
            "success": True,
            "message": "Synchronisation Google Drive Bourse terminée !",
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur synchronisation Google Drive: {str(e)}")


@router.get("/logs")
def get_sync_logs(limit: int = 50, session: Session = Depends(get_session)) -> List[DriveSyncLog]:
    """Renvoie la liste des derniers fichiers importés avec leur statut et le nombre de lignes."""
    return session.exec(
        select(DriveSyncLog).order_by(desc(DriveSyncLog.imported_at)).limit(limit)
    ).all()
