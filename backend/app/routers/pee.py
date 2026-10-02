"""Router pour l'automatisation et l'import de relevés BNP Épargne & Retraite Entreprises."""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_session
from app.services.pee_import_service import pee_import_service

router = APIRouter(prefix="/pee", tags=["Épargne Entreprise (PEE & PERO)"])


class ConfirmImportRequest(BaseModel):
    items: List[Dict[str, Any]]
    target_pee_account_id: Optional[int] = None
    create_pero_account_if_needed: bool = True


@router.post("/preview-statement")
async def preview_statement(
    file: UploadFile = File(..., description="Relevé PDF ou CSV BNP Épargne Entreprise"),
):
    """
    Extrait les données d'un relevé officiel (PDF ou CSV) sans modifier la base.
    Reconnaît les fonds PEE et PERO (parts, valeurs liquidatives, plus-values, montants bruts).
    """
    filename = file.filename or ""
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Fichier vide")

    try:
        if filename.lower().endswith(".pdf") or content.startswith(b"%PDF"):
            result = pee_import_service.parse_pdf_statement(content)
        elif filename.lower().endswith(".csv") or b";" in content[:200] or b"," in content[:200]:
            text_str = content.decode("utf-8", errors="replace")
            result = pee_import_service.parse_csv_statement(text_str)
        else:
            # Essayer en PDF par défaut
            result = pee_import_service.parse_pdf_statement(content)

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur d'analyse du relevé : {e}")


@router.post("/confirm-import")
def confirm_import(
    req: ConfirmImportRequest,
    session: Session = Depends(get_session),
):
    """Applique en base de données les fonds validés par l'utilisateur."""
    if not req.items:
        raise HTTPException(status_code=400, detail="Aucun fonds sélectionné pour l'import")

    try:
        res = pee_import_service.apply_imported_holdings(
            session=session,
            items=req.items,
            target_pee_account_id=req.target_pee_account_id,
            create_pero_account_if_needed=req.create_pero_account_if_needed,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'enregistrement : {e}")
