"""
PatriMon — Router API pour la synchronisation Google Drive Bourse.
Expose les endpoints d'exploration d'arborescence, de synchronisation 1-clic et d'historique.
"""
import json
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select, desc

from app.config import DATA_DIR
from app.database import get_session
from app.models import DriveSyncLog
from app.services.google_drive_service import (
    google_drive_service,
    resolve_oauth_tokens_path,
)

router = APIRouter(prefix="/google-drive", tags=["Google Drive Bourse"])


@router.get("/status")
def get_drive_status() -> Dict[str, Any]:
    """Vérifie si les jetons Google Drive sont configurés et accessibles."""
    token_path = resolve_oauth_tokens_path()
    return {
        "configured": bool(token_path and token_path.is_file()),
        "token_path": str(token_path) if token_path else None,
        "message": f"Jetons détectés à : {token_path}" if token_path else "Fichier mcp_oauth_tokens.json introuvable.",
    }


@router.post("/tokens")
async def upload_tokens(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Permet de téléverser le fichier mcp_oauth_tokens.json depuis le navigateur."""
    try:
        content = await file.read()
        parsed = json.loads(content.decode("utf-8"))

        data_path = DATA_DIR / "mcp_oauth_tokens.json"
        data_path.parent.mkdir(parents=True, exist_ok=True)
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(parsed, f, indent=2)

        ha_path = Path("/config/patrimon/mcp_oauth_tokens.json")
        try:
            ha_path.parent.mkdir(parents=True, exist_ok=True)
            with open(ha_path, "w", encoding="utf-8") as f:
                json.dump(parsed, f, indent=2)
        except Exception:
            pass

        return {
            "success": True,
            "message": "Fichier de jetons enregistré avec succès !",
            "path": str(data_path),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fichier JSON invalide: {e}")



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
