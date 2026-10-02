"""
PatriMon — Service Open Banking (DSP2) via Enable Banking API & Mode Simulation.
Permet la connexion officielle aux banques françaises (BoursoBank, BNP Paribas, Revolut...)
et la synchronisation automatique des soldes et liquidités d'épargne.
"""
import os
import json
import logging
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
import jwt
from sqlmodel import Session, select

from app.models import BankConnection, BankAccountMapping, Account, AccountType

logger = logging.getLogger("open_banking_service")

ENABLE_BANKING_API_BASE = "https://api.enablebanking.com"
CONFIG_FILE_PATH = Path(__file__).resolve().parent.parent.parent / "open_banking_config.json"

# Banques populaires en France
POPULAR_INSTITUTIONS = [
    {
        "id": "boursobank",
        "name": "BoursoBank",
        "title": "BoursoBank (ex-Boursorama)",
        "country": "FR",
        "logo": "https://cdn.nordigen.com/ais/BOURSOBANK_BOUSFRPP.png",
    },
    {
        "id": "bnp_paribas",
        "name": "BNP Paribas",
        "title": "BNP Paribas Particuliers",
        "country": "FR",
        "logo": "https://cdn.nordigen.com/ais/BNP_PARIBAS_BNPAFRPP.png",
    },
    {
        "id": "revolut",
        "name": "Revolut",
        "title": "Revolut Bank UAB",
        "country": "FR",
        "logo": "https://cdn.nordigen.com/ais/REVOLUT_REVOGB2L.png",
    },
    {
        "id": "fortuneo",
        "name": "Fortuneo",
        "title": "Fortuneo Banque",
        "country": "FR",
        "logo": "https://cdn.nordigen.com/ais/FORTUNEO_FR.png",
    },
    {
        "id": "credit_agricole",
        "name": "Crédit Agricole",
        "title": "Crédit Agricole",
        "country": "FR",
        "logo": "https://cdn.nordigen.com/ais/CREDIT_AGRICOLE_FR.png",
    },
    {
        "id": "societe_generale",
        "name": "Société Générale",
        "title": "Société Générale",
        "country": "FR",
        "logo": "https://cdn.nordigen.com/ais/SOCIETE_GENERALE_FR.png",
    }
]


class OpenBankingService:
    def __init__(self):
        self.provider = "enable_banking"
        self.application_id: str = os.environ.get("ENABLE_BANKING_APP_ID", "")
        self.private_key: str = os.environ.get("ENABLE_BANKING_PRIVATE_KEY", "")
        self.is_simulation_mode: bool = os.environ.get("OPEN_BANKING_SIMULATION", "true").lower() == "true"
        self._load_config()

    def _load_config(self):
        """Charge la configuration depuis open_banking_config.json si existant."""
        if CONFIG_FILE_PATH.exists():
            try:
                with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.application_id = cfg.get("application_id", self.application_id)
                    self.private_key = cfg.get("private_key", self.private_key)
                    if "simulation_mode" in cfg:
                        self.is_simulation_mode = cfg["simulation_mode"]
            except Exception as e:
                logger.warning(f"Impossible de charger open_banking_config.json: {e}")

    def _save_config(self):
        """Sauvegarde la configuration dans open_banking_config.json."""
        try:
            with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump({
                    "provider": self.provider,
                    "application_id": self.application_id,
                    "private_key": self.private_key,
                    "simulation_mode": self.is_simulation_mode,
                }, f, indent=2)
        except Exception as e:
            logger.warning(f"Impossible de sauvegarder open_banking_config.json: {e}")

    def set_config(
        self,
        application_id: str = "",
        private_key: str = "",
        simulation_mode: bool = True,
        secret_id: str = "",
        secret_key: str = "",
    ):
        """Configure les identifiants Enable Banking ou bascule le mode simulation."""
        # Supporte application_id direct ou compatibilité secret_id
        app_id = application_id.strip() or secret_id.strip()
        priv_key = private_key.strip() or secret_key.strip()

        if app_id:
            self.application_id = app_id
        if priv_key:
            self.private_key = priv_key
        self.is_simulation_mode = simulation_mode
        self._save_config()

    def get_status(self, session: Session) -> Dict[str, Any]:
        """Retourne l'état de la configuration et des connexions bancaires."""
        connections = session.exec(select(BankConnection)).all()
        mappings = session.exec(select(BankAccountMapping)).all()

        has_creds = bool(self.application_id and self.private_key)
        effective_sim = self.is_simulation_mode or not has_creds

        return {
            "provider": "enable_banking",
            "has_credentials": has_creds,
            "application_id": self.application_id[:8] + "..." if len(self.application_id) > 8 else self.application_id,
            "has_private_key": bool(self.private_key),
            "simulation_mode": effective_sim,
            "connections_count": len(connections),
            "mappings_count": len(mappings),
            "connections": [
                {
                    "id": c.id,
                    "institution_id": c.institution_id,
                    "institution_name": c.institution_name,
                    "status": c.status,
                    "is_simulation": c.is_simulation,
                    "last_synced_at": c.last_synced_at.strftime("%d/%m/%Y %H:%M") if c.last_synced_at else None,
                    "accounts": [
                        {
                            "id": m.id,
                            "external_account_id": m.external_account_id,
                            "patrimon_account_id": m.patrimon_account_id,
                            "name": m.name,
                            "iban": m.iban,
                            "last_balance": m.last_balance,
                            "last_synced_at": m.last_synced_at.strftime("%d/%m/%Y %H:%M") if m.last_synced_at else None,
                        }
                        for m in mappings if m.connection_id == c.id
                    ],
                }
                for c in connections
            ],
        }

    # ────────────────────── Authentification Enable Banking ──────────────────────

    def _generate_jwt(self) -> str:
        """Génère un JWT signé avec la clé privée RSA (RS256) pour Enable Banking."""
        if not self.application_id or not self.private_key:
            raise ValueError("Application ID et clé privée RSA manquants pour Enable Banking.")

        now = int(time.time())
        payload = {
            "iss": "enablebanking.com",
            "aud": "api.enablebanking.com",
            "iat": now,
            "exp": now + 3600,
        }
        headers = {
            "alg": "RS256",
            "typ": "JWT",
            "kid": self.application_id,
        }

        # Nettoyage clé si nécessaire
        key_data = self.private_key
        if not key_data.startswith("-----BEGIN"):
            # Si c'est un chemin de fichier
            if os.path.exists(key_data):
                with open(key_data, "r", encoding="utf-8") as f:
                    key_data = f.read()

        return jwt.encode(payload, key_data, algorithm="RS256", headers=headers)

    # ────────────────────── Liste des Banques ──────────────────────

    async def list_institutions(self, country: str = "FR") -> List[Dict[str, Any]]:
        """Liste les banques disponibles (BoursoBank, BNP Paribas, Revolut...)."""
        if self.is_simulation_mode or not (self.application_id and self.private_key):
            return POPULAR_INSTITUTIONS

        try:
            token = self._generate_jwt()
            headers = {"Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{ENABLE_BANKING_API_BASE}/aspsps?country={country}",
                    headers=headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    aspsps = data.get("aspsps", [])
                    if aspsps:
                        # Mapper le format vers notre structure en conservant le nom exact ASPSP
                        result = []
                        for b in aspsps:
                            b_name = b.get("name", "")
                            result.append({
                                "id": b_name,
                                "name": b_name,
                                "title": b.get("title") or b_name,
                                "country": b.get("country", country),
                                "logo": b.get("logo"),
                                "aspsp_raw": b,
                            })
                        return result
        except Exception as e:
            logger.warning(f"Erreur catalogue institutions Enable Banking : {e}")

        return POPULAR_INSTITUTIONS

    # ────────────────────── Initialisation Connexion ──────────────────────

    async def create_requisition(
        self,
        session: Session,
        institution_id: str,
        redirect_uri: str,
    ) -> Dict[str, Any]:
        """Crée une demande d'accès et retourne le lien de consentement bancaire."""
        # Trouver les infos de l'institution en préservant le nom exact
        inst_name = institution_id
        try:
            available_institutions = await self.list_institutions()
            for inst in available_institutions:
                if inst["id"].lower() == institution_id.lower() or inst["name"].lower() == institution_id.lower():
                    inst_name = inst["name"]
                    break
        except Exception:
            for inst in POPULAR_INSTITUTIONS:
                if inst["id"].lower() == institution_id.lower() or inst["name"].lower() == institution_id.lower():
                    inst_name = inst["name"]
                    break

        if self.is_simulation_mode or not (self.application_id and self.private_key):
            # Mode Simulation / Démo immédiat
            sim_req_id = f"sim_eb_{int(time.time())}"
            conn = BankConnection(
                institution_id=institution_id,
                institution_name=inst_name,
                requisition_id=sim_req_id,
                status="LINKED",
                is_simulation=True,
                account_ids=json.dumps([f"{institution_id}_acc_checking", f"{institution_id}_acc_savings"]),
                last_synced_at=datetime.now(timezone.utc),
            )
            session.add(conn)
            session.commit()
            session.refresh(conn)

            # Auto-associer aux comptes PatriMon correspondants
            self._auto_map_simulated_accounts(session, conn)

            return {
                "success": True,
                "is_simulation": True,
                "connection_id": conn.id,
                "requisition_id": sim_req_id,
                "auth_link": f"{redirect_uri}?simulated_connection_id={conn.id}",
                "message": f"Connexion simulée établie avec succès pour {inst_name} !",
            }

        # Mode Réel Enable Banking
        token = self._generate_jwt()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        # Déterminer la redirect_url exacte autorisée dans l'application Enable Banking
        effective_redirect = redirect_uri
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                app_info = await client.get(
                    f"{ENABLE_BANKING_API_BASE}/application",
                    headers=headers,
                )
                if app_info.status_code == 200:
                    allowed_urls = app_info.json().get("redirect_urls", [])
                    for u in allowed_urls:
                        if u.rstrip("/") == redirect_uri.rstrip("/"):
                            effective_redirect = u
                            break
                    else:
                        if allowed_urls:
                            effective_redirect = allowed_urls[0]
            except Exception as e:
                logger.warning(f"Impossible de vérifier l'application Enable Banking: {e}")

            # Enregistre une connexion en statut PENDING
            conn = BankConnection(
                institution_id=institution_id,
                institution_name=inst_name,
                requisition_id="",
                status="PENDING",
                is_simulation=False,
            )
            session.add(conn)
            session.commit()
            session.refresh(conn)

            state_token = f"patrimon_conn_{conn.id}"

            # Paramètres d'autorisation Enable Banking (PSD2 limite à 90 jours)
            valid_until_str = (datetime.now(timezone.utc) + timedelta(days=89)).strftime("%Y-%m-%dT%H:%M:%SZ")
            payload = {
                "access": {
                    "valid_until": valid_until_str,
                },
                "aspsp": {
                    "name": inst_name,
                    "country": "FR",
                },
                "state": state_token,
                "redirect_url": effective_redirect,
            }

            resp = await client.post(
                f"{ENABLE_BANKING_API_BASE}/auth",
                headers=headers,
                json=payload,
            )
            if resp.status_code not in (200, 201):
                session.delete(conn)
                session.commit()
                raise ValueError(f"Erreur initialisation Enable Banking ({resp.status_code}) : {resp.text}")

            data = resp.json()
            auth_url = data.get("url")
            auth_id = data.get("authorization_id", "")

            conn.requisition_id = auth_id
            session.add(conn)
            session.commit()

            return {
                "success": True,
                "is_simulation": False,
                "connection_id": conn.id,
                "requisition_id": auth_id,
                "auth_link": auth_url,
                "link": auth_url,
            }

    # ────────────────────── Échange du Code contre Session ──────────────────────

    async def exchange_code_for_session(
        self,
        session: Session,
        code: str,
        state: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Échange le code d'autorisation retourné par la banque contre une session active."""
        if not code:
            raise ValueError("Code d'autorisation manquant")

        # Trouver la connexion associée via le state
        conn = None
        if state and "patrimon_conn_" in state:
            try:
                conn_id = int(state.replace("patrimon_conn_", ""))
                conn = session.get(BankConnection, conn_id)
            except Exception:
                pass

        if not conn:
            # Prend la dernière connexion PENDING
            conn = session.exec(
                select(BankConnection).where(BankConnection.status == "PENDING").order_by(BankConnection.id.desc())
            ).first()

        if not conn:
            raise ValueError("Aucune demande de connexion bancaire en attente trouvée.")

        token = self._generate_jwt()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{ENABLE_BANKING_API_BASE}/sessions",
                headers=headers,
                json={"code": code},
            )
            if resp.status_code not in (200, 201):
                raise ValueError(f"Erreur validation session Enable Banking : {resp.text}")

            session_data = resp.json()
            session_id = session_data.get("session_id", "")
            raw_accounts = session_data.get("accounts", [])

            conn.agreement_id = session_id
            conn.status = "LINKED"
            conn.account_ids = json.dumps([a.get("uid") or a.get("account_id", {}).get("iban", "") for a in raw_accounts])
            conn.last_synced_at = datetime.now(timezone.utc)
            session.add(conn)

            # Créer les liaisons de comptes
            mapped_count = 0
            patrimon_accounts = session.exec(select(Account)).all()

            for ext_acc in raw_accounts:
                acc_uid = ext_acc.get("uid") or ext_acc.get("account_id", {}).get("iban", f"acc_{mapped_count}")
                iban = ext_acc.get("account_id", {}).get("iban", "")
                acc_name = ext_acc.get("name") or f"Compte {conn.institution_name}"

                # Détecter balance initiale
                initial_balance = None
                balances = ext_acc.get("balances", [])
                if balances:
                    for b in balances:
                        if "amount" in b.get("balance_amount", {}):
                            initial_balance = float(b["balance_amount"]["amount"])
                            break

                # Trouver le compte PatriMon le plus approprié
                target_acc = None
                for pa in patrimon_accounts:
                    if conn.institution_name.lower() in pa.name.lower() or conn.institution_name.lower() in (pa.institution or "").lower():
                        target_acc = pa
                        break

                if target_acc:
                    mapping = BankAccountMapping(
                        connection_id=conn.id,
                        external_account_id=str(acc_uid),
                        patrimon_account_id=target_acc.id,
                        iban=iban,
                        name=acc_name,
                        last_balance=initial_balance or target_acc.cash_balance,
                        last_synced_at=datetime.now(timezone.utc),
                    )
                    session.add(mapping)
                    if initial_balance is not None:
                        target_acc.cash_balance = initial_balance
                        session.add(target_acc)
                    mapped_count += 1

            session.commit()
            return {
                "success": True,
                "message": f"Connexion bancaire validée avec succès pour {conn.institution_name} !",
                "accounts_mapped": mapped_count,
            }

    # ────────────────────── Synchronisation des Soldes ──────────────────────

    def _auto_map_simulated_accounts(self, session: Session, conn: BankConnection):
        """Associe automatiquement les comptes simulés aux comptes PatriMon existants."""
        accounts = session.exec(select(Account)).all()

        if "BOURSO" in conn.institution_id.upper():
            c_courant = next((a for a in accounts if "Bourso" in a.name and a.account_type == AccountType.CHECKING), None)
            c_pea = next((a for a in accounts if "Bourso" in a.name and a.account_type == AccountType.PEA), None)

            if c_courant:
                session.add(BankAccountMapping(
                    connection_id=conn.id,
                    external_account_id=f"{conn.institution_id}_checking",
                    patrimon_account_id=c_courant.id,
                    iban="FR76 3000 4000 1234 5678 901",
                    name="Compte Bancaire BoursoBank",
                    last_balance=c_courant.cash_balance,
                    last_synced_at=datetime.now(timezone.utc),
                ))
            if c_pea:
                session.add(BankAccountMapping(
                    connection_id=conn.id,
                    external_account_id=f"{conn.institution_id}_pea_cash",
                    patrimon_account_id=c_pea.id,
                    iban="FR76 3000 4000 9876 5432 109",
                    name="Compte Espèces PEA",
                    last_balance=c_pea.cash_balance,
                    last_synced_at=datetime.now(timezone.utc),
                ))

        elif "BNP" in conn.institution_id.upper():
            c_livret = next((a for a in accounts if "BNP" in a.name and a.account_type == AccountType.SAVINGS), None)
            if c_livret:
                session.add(BankAccountMapping(
                    connection_id=conn.id,
                    external_account_id=f"{conn.institution_id}_savings",
                    patrimon_account_id=c_livret.id,
                    iban="FR76 3000 2000 1122 3344 556",
                    name="Livret A BNP Paribas",
                    last_balance=c_livret.cash_balance,
                    last_synced_at=datetime.now(timezone.utc),
                ))

        elif "REVOLUT" in conn.institution_id.upper():
            c_revolut = next((a for a in accounts if "Revolut" in a.name), None)
            if c_revolut:
                session.add(BankAccountMapping(
                    connection_id=conn.id,
                    external_account_id=f"{conn.institution_id}_main",
                    patrimon_account_id=c_revolut.id,
                    iban="LT34 3250 0000 9988 7766 55",
                    name="Compte Principal Revolut",
                    last_balance=c_revolut.cash_balance,
                    last_synced_at=datetime.now(timezone.utc),
                ))

        session.commit()

    async def sync_all_balances(self, session: Session) -> Dict[str, Any]:
        """Synchronise les soldes espèces de tous les comptes bancaires liés."""
        connections = session.exec(select(BankConnection)).all()
        mappings = session.exec(select(BankAccountMapping)).all()

        synced_count = 0
        total_balance_updated = 0.0
        updated_list = []

        jwt_token = None
        if not self.is_simulation_mode and (self.application_id and self.private_key):
            try:
                jwt_token = self._generate_jwt()
            except Exception as e:
                logger.warning(f"Impossible de générer le JWT Enable Banking pour la synchro: {e}")

        for m in mappings:
            acc = session.get(Account, m.patrimon_account_id)
            if not acc:
                continue

            conn = session.get(BankConnection, m.connection_id)
            new_balance = m.last_balance or acc.cash_balance

            if conn and conn.is_simulation:
                # Mode simulation : solde réaliste stable
                new_balance = round(acc.cash_balance, 2)
            elif not self.is_simulation_mode and conn and not conn.is_simulation and jwt_token:
                try:
                    headers = {"Authorization": f"Bearer {jwt_token}"}
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.get(
                            f"{ENABLE_BANKING_API_BASE}/accounts/{m.external_account_id}/balances",
                            headers=headers,
                        )
                        if resp.status_code == 200:
                            b_data = resp.json().get("balances", [])
                            if b_data:
                                amount_val = float(b_data[0]["balance_amount"]["amount"])
                                new_balance = round(amount_val, 2)
                except Exception as e:
                    logger.warning(f"Erreur synchro solde Enable Banking {m.external_account_id}: {e}")

            acc.cash_balance = new_balance
            m.last_balance = new_balance
            m.last_synced_at = datetime.now(timezone.utc)
            session.add(acc)
            session.add(m)
            synced_count += 1
            total_balance_updated += new_balance
            updated_list.append({
                "account_name": acc.name,
                "institution": acc.institution,
                "new_balance": new_balance,
            })

        for c in connections:
            c.last_synced_at = datetime.now(timezone.utc)
            session.add(c)

        session.commit()

        return {
            "success": True,
            "message": f"{synced_count} compte(s) bancaire(s) synchronisé(s) avec succès.",
            "synced_accounts_count": synced_count,
            "total_balance_synced": round(total_balance_updated, 2),
            "updated_accounts": updated_list,
            "synced_at": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S"),
        }

    def delete_connection(self, session: Session, connection_id: int) -> bool:
        """Supprime une connexion bancaire et ses liaisons."""
        conn = session.get(BankConnection, connection_id)
        if not conn:
            return False

        mappings = session.exec(
            select(BankAccountMapping).where(BankAccountMapping.connection_id == connection_id)
        ).all()
        for m in mappings:
            session.delete(m)

        session.delete(conn)
        session.commit()
        return True


open_banking_service = OpenBankingService()
