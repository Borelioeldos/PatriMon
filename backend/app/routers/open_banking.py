"""Router pour l'Open Banking DSP2 (Enable Banking API) et synchronisation des banques."""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
from sqlmodel import Session
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from app.database import get_session
from app.services.open_banking_service import open_banking_service

router = APIRouter(prefix="/open-banking", tags=["Open Banking DSP2"])


class ConfigRequest(BaseModel):
    application_id: Optional[str] = ""
    private_key: Optional[str] = ""
    secret_id: Optional[str] = ""
    secret_key: Optional[str] = ""
    simulation_mode: bool = True


class ConnectRequest(BaseModel):
    institution_id: str
    redirect_uri: str = "https://localhost:5173"
    psu_type: Optional[str] = "personal"


class SessionRequest(BaseModel):
    code: str
    state: Optional[str] = None


@router.get("/status", response_model=Dict[str, Any])
def get_status(session: Session = Depends(get_session)):
    """Retourne l'état des liaisons bancaires et de la configuration."""
    return open_banking_service.get_status(session)


@router.post("/config")
def update_config(req: ConfigRequest):
    """Enregistre les clés d'API Enable Banking ou bascule en mode simulation."""
    open_banking_service.set_config(
        application_id=req.application_id or "",
        private_key=req.private_key or "",
        simulation_mode=req.simulation_mode,
        secret_id=req.secret_id or "",
        secret_key=req.secret_key or "",
    )
    return {
        "message": "Configuration Open Banking mise à jour",
        "provider": open_banking_service.provider,
        "is_simulation": open_banking_service.is_simulation_mode,
    }


@router.get("/keys")
def get_rsa_keys():
    """Retourne la clé publique statique permanente actuelle."""
    pub_key = open_banking_service.get_public_key()
    return {
        "has_keys": bool(open_banking_service.private_key),
        "public_key": pub_key,
        "is_static": True,
    }


@router.post("/generate-keys")
def generate_rsa_key_pair(force: bool = False):
    """Retourne la clé statique existante ou en génère une nouvelle si explicitement forcé."""
    if open_banking_service.private_key and not force:
        return {
            "private_key": open_banking_service.private_key,
            "public_key": open_banking_service.get_public_key(),
            "message": "Clé statique permanente existante récupérée.",
            "is_static": True,
        }

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    open_banking_service.set_config(
        application_id=open_banking_service.application_id,
        private_key=private_pem,
        simulation_mode=open_banking_service.is_simulation_mode,
    )

    return {
        "private_key": private_pem,
        "public_key": public_pem,
        "message": "Nouvelle paire de clés statique générée et enregistrée.",
        "is_static": True,
    }


@router.get("/institutions")
async def list_institutions(country: str = Query("FR")):
    """Liste les banques françaises compatibles (BoursoBank, BNP Paribas, Revolut...)."""
    return await open_banking_service.list_institutions(country)


@router.post("/connect")
async def connect_bank(
    req: ConnectRequest,
    session: Session = Depends(get_session),
):
    """Initialise une demande d'accès bancaire et fournit le lien de connexion."""
    try:
        res = await open_banking_service.create_requisition(
            session=session,
            institution_id=req.institution_id,
            redirect_uri=req.redirect_uri,
            psu_type=req.psu_type or "personal",
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/session")
async def exchange_session_code(
    req: SessionRequest,
    session: Session = Depends(get_session),
):
    """Échange le code d'autorisation retourné par la banque contre une session active."""
    try:
        res = await open_banking_service.exchange_code_for_session(
            session=session,
            code=req.code,
            state=req.state,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync")
async def sync_balances(session: Session = Depends(get_session)):
    """Synchronise les soldes et transactions de tous les comptes bancaires connectés."""
    try:
        res = await open_banking_service.sync_all_balances(session)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de synchronisation : {e}")


@router.post("/sync-transactions")
async def sync_transactions(session: Session = Depends(get_session)):
    """Synchronise spécifiquement l'historique des transactions bancaires."""
    try:
        res = await open_banking_service.sync_all_transactions(session)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de synchronisation des transactions : {e}")


# ────────────────────── Planification Automatique (Scheduler) ──────────────────────

class SchedulerConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    interval_minutes: Optional[int] = None


@router.get("/scheduler")
def get_scheduler_status():
    """Retourne l'état actuel de la synchronisation automatique en tâche de fond."""
    from app.services.sync_scheduler_service import sync_scheduler_service
    return sync_scheduler_service.get_status()


@router.post("/scheduler/config")
def update_scheduler_config(req: SchedulerConfigRequest):
    """Met à jour l'intervalle et l'activation de la synchronisation automatique."""
    from app.services.sync_scheduler_service import sync_scheduler_service
    return sync_scheduler_service.update_config(
        enabled=req.enabled,
        interval_minutes=req.interval_minutes
    )


@router.post("/scheduler/trigger")
async def trigger_scheduler_sync():
    """Déclenche immédiatement un cycle de synchronisation automatique complète."""
    from app.services.sync_scheduler_service import sync_scheduler_service
    res = await sync_scheduler_service.execute_sync_now()
    return res


@router.delete("/connection/{connection_id}")
def delete_bank_connection(connection_id: int, session: Session = Depends(get_session)):
    """Supprime une liaison bancaire."""
    ok = open_banking_service.delete_connection(session, connection_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Connexion bancaire introuvable")
    return {"message": "Liaison bancaire supprimée"}
