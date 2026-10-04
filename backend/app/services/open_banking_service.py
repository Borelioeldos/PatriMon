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

from app.models import BankConnection, BankAccountMapping, Account, AccountType, Transaction, TransactionType
from app.services.transaction_enricher import transaction_enricher

logger = logging.getLogger("open_banking_service")

ENABLE_BANKING_API_BASE = "https://api.enablebanking.com"
CONFIG_FILE_PATH = Path(__file__).resolve().parent.parent.parent / "open_banking_config.json"

# Banques populaires en France
POPULAR_INSTITUTIONS = [
    {
        "id": "boursobank",
        "name": "Boursorama Banque",
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
        self.public_key: str = ""
        self.is_simulation_mode: bool = os.environ.get("OPEN_BANKING_SIMULATION", "true").lower() == "true"
        self._load_config()

    def get_public_key(self) -> str:
        """Dérive la clé publique statique permanente à partir de la clé privée actuelle."""
        if self.public_key:
            return self.public_key
        if not self.private_key:
            return ""
        try:
            priv = serialization.load_pem_private_key(self.private_key.encode("utf-8"), password=None)
            pub = priv.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode("utf-8")
            self.public_key = pub
            return pub
        except Exception as e:
            logger.warning(f"Impossible de dériver la clé publique: {e}")
            return ""

    def _load_config(self):
        """Charge la configuration depuis open_banking_config.json si existant."""
        if CONFIG_FILE_PATH.exists():
            try:
                with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.application_id = cfg.get("application_id", self.application_id)
                    self.private_key = cfg.get("private_key", self.private_key)
                    self.public_key = cfg.get("public_key", "")
                    if "simulation_mode" in cfg:
                        self.is_simulation_mode = cfg["simulation_mode"]
                if not self.public_key and self.private_key:
                    self.public_key = self.get_public_key()
            except Exception as e:
                logger.warning(f"Impossible de charger open_banking_config.json: {e}")

    def _save_config(self):
        """Sauvegarde la configuration dans open_banking_config.json."""
        try:
            pub_key = self.get_public_key()
            with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump({
                    "provider": self.provider,
                    "application_id": self.application_id,
                    "private_key": self.private_key,
                    "public_key": pub_key,
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
            self.public_key = self.get_public_key()
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
            "application_id": self.application_id,
            "masked_application_id": self.application_id[:8] + "..." if len(self.application_id) > 8 else self.application_id,
            "has_private_key": bool(self.private_key),
            "public_key": self.get_public_key(),
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
        psu_type: str = "personal",
    ) -> Dict[str, Any]:
        """Crée une demande d'accès et retourne le lien de consentement bancaire."""
        # Trouver les infos de l'institution en préservant le nom exact et le type PSU
        inst_name = institution_id
        effective_psu_type = psu_type or "personal"
        try:
            available_institutions = await self.list_institutions()
            matched_inst = None
            target = institution_id.lower().strip()

            # 1. Correspondance exacte par ID ou name
            for inst in available_institutions:
                if inst["id"].lower() == target or inst["name"].lower() == target:
                    matched_inst = inst
                    break

            # 2. Correspondance souple pour banques françaises courantes
            if not matched_inst:
                for inst in available_institutions:
                    i_name = inst["name"].lower()
                    if ("bourso" in target and "bourso" in i_name) or \
                       ("bnp" in target and "bnp" in i_name) or \
                       ("revolut" in target and "revolut" in i_name) or \
                       ("fortuneo" in target and "fortuneo" in i_name) or \
                       ("societe" in target and "societe" in i_name) or \
                       ("agricole" in target and "agricole" in i_name):
                        matched_inst = inst
                        break

            if matched_inst:
                inst_name = matched_inst["name"]
                raw_aspsp = matched_inst.get("aspsp_raw") or {}
                supported_psu_types = raw_aspsp.get("psu_types", [])
                if supported_psu_types and effective_psu_type not in supported_psu_types:
                    effective_psu_type = supported_psu_types[0]
        except Exception as e:
            logger.warning(f"Erreur recherche institution: {e}")
            for inst in POPULAR_INSTITUTIONS:
                if inst["id"].lower() == institution_id.lower() or inst["name"].lower() == institution_id.lower() or ("bourso" in institution_id.lower() and "bourso" in inst["name"].lower()):
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
                "psu_type": effective_psu_type,
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

    # ────────────────────── Gestion Auto des Comptes PatriMon ──────────────────────

    def _determine_account_color(self, institution_name: str) -> str:
        """Attribue une couleur élégante selon l'établissement bancaire."""
        inst = institution_name.lower()
        if "bourso" in inst:
            return "#004899"
        elif "bnp" in inst:
            return "#008A5A"
        elif "revolut" in inst:
            return "#0075FF"
        elif "fortuneo" in inst:
            return "#007E33"
        elif "agricole" in inst:
            return "#008272"
        elif "societe" in inst or "generale" in inst:
            return "#E60028"
        elif "bbva" in inst:
            return "#004481"
        elif "mock" in inst or "test" in inst:
            return "#6366F1"
        return "#3B82F6"

    def _determine_account_type(self, account_name: str, institution_name: str) -> AccountType:
        """Détecte intelligemment le type de compte (Courant, Livret, PEA, etc.)."""
        text = f"{account_name} {institution_name}".lower()
        if "pea" in text:
            return AccountType.PEA
        if any(w in text for w in ["livret", "épargne", "epargne", "savings", "coffre", "ldds", "lep"]):
            return AccountType.SAVINGS
        if any(w in text for w in ["crypto", "btc", "eth"]):
            return AccountType.CRYPTO
        if any(w in text for w in ["cto", "titres", "trading"]):
            return AccountType.CTO
        if any(w in text for w in ["pee", "pero", "cardif", "retraite"]):
            return AccountType.PEE
        return AccountType.CHECKING

    def _get_or_create_account(
        self,
        session: Session,
        institution_name: str,
        account_name: str,
        initial_balance: float = 0.0,
        iban: Optional[str] = None,
        currency: str = "EUR",
        account_type: Optional[AccountType] = None,
    ) -> Account:
        """
        Recherche un compte existant ou en crée un nouveau automatiquement
        avec solde, devise, couleur et notes pré-remplis.
        """
        accounts = session.exec(select(Account)).all()
        inst_clean = institution_name.strip()
        expected_type = account_type or self._determine_account_type(account_name, inst_clean)

        # 1. Vérifier si un compte est déjà mappé avec cet IBAN
        clean_iban = iban.strip() if isinstance(iban, str) else ""
        if clean_iban and len(clean_iban) > 5 and not clean_iban.startswith("{"):
            existing_mapping = session.exec(
                select(BankAccountMapping).where(BankAccountMapping.iban == clean_iban)
            ).first()
            if existing_mapping:
                acc = session.get(Account, existing_mapping.patrimon_account_id)
                if acc:
                    if initial_balance is not None and initial_balance > 0:
                        acc.cash_balance = round(initial_balance, 2)
                        acc.updated_at = datetime.now(timezone.utc)
                        session.add(acc)
                    return acc

        # Comptes déjà assignés à des liaisons bancaires existantes
        assigned_account_ids = {
            m.patrimon_account_id
            for m in session.exec(select(BankAccountMapping)).all()
        }

        # 2. Chercher par correspondance de nom d'établissement, devise et type parmi les comptes non encore assignés
        matched = None
        target_cur = (currency or "EUR").upper()
        for a in accounts:
            if a.id in assigned_account_ids:
                continue

            a_cur = (a.currency or "EUR").upper()
            if a_cur != target_cur:
                continue

            a_inst = (a.institution or "").lower()
            a_name = (a.name or "").lower()
            target_inst = inst_clean.lower()

            # Vérification stricte de l'établissement bancaire
            inst_matches = (
                target_inst == a_inst or
                (target_inst in a_inst and len(target_inst) > 3) or
                (a_inst in target_inst and len(a_inst) > 3) or
                ("bourso" in target_inst and ("bourso" in a_inst or "bourso" in a_name)) or
                ("bnp" in target_inst and ("bnp" in a_inst or "bnp" in a_name)) or
                ("revolut" in target_inst and ("revolut" in a_inst or "revolut" in a_name))
            )
            if not inst_matches:
                continue

            if a.account_type == expected_type:
                matched = a
                break
            # Correspondance par mots clés
            if expected_type == AccountType.CHECKING and any(w in a_name for w in ["courant", "checking", "principal"]):
                matched = a
                break
            elif expected_type == AccountType.SAVINGS and any(w in a_name for w in ["livret", "épargne", "epargne", "coffre"]):
                matched = a
                break

        if matched:
            if initial_balance is not None:
                matched.cash_balance = round(initial_balance, 2)
                matched.updated_at = datetime.now(timezone.utc)
                session.add(matched)
                session.commit()
                session.refresh(matched)
            return matched

        # 3. Création automatique du nouveau compte
        display_name = account_name.strip()
        if inst_clean.lower() not in display_name.lower():
            display_name = f"{inst_clean} - {display_name}"

        color = self._determine_account_color(inst_clean)
        new_acc = Account(
            name=display_name,
            institution=inst_clean,
            account_type=expected_type,
            cash_balance=round(initial_balance or 0.0, 2),
            currency=currency or "EUR",
            color=color,
            notes=f"Compte créé automatiquement via Open Banking DSP2{f' • IBAN: {clean_iban}' if clean_iban else ''}",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(new_acc)
        session.commit()
        session.refresh(new_acc)

        logger.info(f"Nouveau compte PatriMon auto-créé : {new_acc.name} ({new_acc.cash_balance} {currency})")
        return new_acc

    # ────────────────────── Échange du Code contre Session ──────────────────────

    async def exchange_code_for_session(
        self,
        session: Session,
        code: str,
        state: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Échange le code d'autorisation retourné par la banque contre une session active et auto-crée les comptes."""
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

            session_data = resp.json() or {}
            session_id = session_data.get("session_id", "")
            raw_accounts = session_data.get("accounts") or []

            conn.agreement_id = session_id
            conn.status = "LINKED"

            # Sauvegarde propre et sécurisée des UIDs
            saved_uids = []
            for a in raw_accounts:
                if isinstance(a, str):
                    saved_uids.append(a)
                elif isinstance(a, dict):
                    u = a.get("uid")
                    acc_val = a.get("account_id")
                    if not u and isinstance(acc_val, dict):
                        u = acc_val.get("iban") or acc_val.get("bban")
                    elif not u and isinstance(acc_val, str):
                        u = acc_val
                    if u:
                        saved_uids.append(str(u))

            conn.account_ids = json.dumps(saved_uids)
            conn.last_synced_at = datetime.now(timezone.utc)
            session.add(conn)

            # Auto-création et liaison des comptes bancaires
            mapped_count = 0
            created_accounts_names = []

            for idx, ext_acc in enumerate(raw_accounts):
                # Extraction 100% robuste de l'acc_uid, iban, nom et devise
                if isinstance(ext_acc, str):
                    acc_uid = ext_acc
                    iban = ""
                    acc_name = f"Compte {conn.institution_name} {idx + 1}"
                    currency = "EUR"
                    balances_raw = []
                elif isinstance(ext_acc, dict):
                    acc_uid = ext_acc.get("uid")
                    acc_id_val = ext_acc.get("account_id")
                    iban = ""
                    if isinstance(acc_id_val, dict):
                        cand = acc_id_val.get("iban") or acc_id_val.get("bban")
                        if isinstance(cand, str) and cand.strip():
                            iban = cand.strip()
                        else:
                            other_val = acc_id_val.get("other")
                            if isinstance(other_val, dict):
                                ident = other_val.get("identification")
                                if isinstance(ident, str) and ident.strip():
                                    iban = ident.strip()
                            elif isinstance(other_val, str) and other_val.strip():
                                iban = other_val.strip()
                    elif isinstance(acc_id_val, str) and acc_id_val.strip():
                        iban = acc_id_val.strip()

                    if not isinstance(iban, str):
                        iban = ""

                    if not acc_uid:
                        acc_uid = iban or f"acc_{conn.id}_{idx + 1}"

                    acc_name = (
                        ext_acc.get("name")
                        or ext_acc.get("title")
                        or ext_acc.get("product")
                        or ext_acc.get("details")
                        or f"Compte {conn.institution_name} {idx + 1}"
                    )
                    currency = ext_acc.get("currency") or "EUR"
                    balances_raw = ext_acc.get("balances")
                    if balances_raw is None:
                        balances_raw = ext_acc.get("balance")
                else:
                    continue

                # Détecter balance initiale
                initial_balance = 0.0
                balance_list = []
                if isinstance(balances_raw, list):
                    balance_list = balances_raw
                elif isinstance(balances_raw, dict):
                    balance_list = [balances_raw]

                for b in balance_list:
                    if isinstance(b, dict):
                        b_amount = b.get("balance_amount")
                        if isinstance(b_amount, dict) and "amount" in b_amount:
                            try:
                                initial_balance = float(b_amount["amount"])
                                if b_amount.get("currency"):
                                    currency = b_amount["currency"]
                                break
                            except (ValueError, TypeError):
                                pass
                        elif "amount" in b:
                            try:
                                initial_balance = float(b["amount"])
                                if b.get("currency"):
                                    currency = b["currency"]
                                break
                            except (ValueError, TypeError):
                                pass

                # Interroger directement /accounts/{acc_uid}/balances si disponible pour s'assurer du solde et de la devise
                if acc_uid:
                    try:
                        b_resp = await client.get(
                            f"{ENABLE_BANKING_API_BASE}/accounts/{acc_uid}/balances",
                            headers=headers,
                        )
                        if b_resp.status_code == 200:
                            b_json = b_resp.json() or {}
                            direct_b = b_json.get("balances") or b_json.get("balance") or []
                            if isinstance(direct_b, dict):
                                direct_b = [direct_b]
                            if isinstance(direct_b, list) and direct_b:
                                for db in direct_b:
                                    if isinstance(db, dict):
                                        amt_info = db.get("balance_amount")
                                        if isinstance(amt_info, dict) and "amount" in amt_info:
                                            initial_balance = float(amt_info["amount"])
                                            if amt_info.get("currency"):
                                                currency = amt_info["currency"]
                                            break
                                        elif "amount" in db:
                                            initial_balance = float(db["amount"])
                                            if db.get("currency"):
                                                currency = db["currency"]
                                            break
                    except Exception as e:
                        logger.warning(f"Impossible de récupérer le solde direct pour {acc_uid}: {e}")

                # Ajuster le nom si trop générique
                if "Compte " in acc_name and currency:
                    acc_name = f"{conn.institution_name} - Compte {currency}"

                # Trouver ou créer automatiquement le compte
                clean_iban = iban.strip() if isinstance(iban, str) else ""
                target_acc = self._get_or_create_account(
                    session=session,
                    institution_name=conn.institution_name,
                    account_name=acc_name,
                    initial_balance=initial_balance,
                    iban=clean_iban,
                    currency=currency,
                )

                created_accounts_names.append(target_acc.name)

                # Créer ou mettre à jour le mapping
                mapping = session.exec(
                    select(BankAccountMapping).where(
                        BankAccountMapping.connection_id == conn.id,
                        BankAccountMapping.external_account_id == str(acc_uid)
                    )
                ).first()

                if not mapping:
                    mapping = BankAccountMapping(
                        connection_id=conn.id,
                        external_account_id=str(acc_uid),
                        patrimon_account_id=target_acc.id,
                        iban=clean_iban if (clean_iban and len(clean_iban) > 5 and not clean_iban.startswith("{")) else None,
                        name=acc_name,
                        last_balance=initial_balance or target_acc.cash_balance,
                        last_synced_at=datetime.now(timezone.utc),
                    )
                    session.add(mapping)
                else:
                    mapping.last_balance = initial_balance
                    mapping.last_synced_at = datetime.now(timezone.utc)
                    session.add(mapping)

                target_acc.cash_balance = initial_balance
                target_acc.updated_at = datetime.now(timezone.utc)
                session.add(target_acc)
                mapped_count += 1

            # Si la banque n'a listé aucun compte dans la session
            if mapped_count == 0:
                conn.status = "PENDING"
                session.add(conn)
                session.commit()
                return {
                    "success": False,
                    "message": f"La banque {conn.institution_name} n'a retourné aucun compte autorisé. Veuillez vérifier vos accès et renouveler le consentement en mode Particulier.",
                    "accounts_mapped": 0,
                    "accounts": [],
                }

            session.commit()

            # Synchronisation conjointe immédiate de l'historique des transactions
            tx_count = 0
            try:
                tx_stats = await self.sync_all_transactions(session)
                tx_count = tx_stats.get("new_transactions_imported", 0)
            except Exception as e:
                logger.warning(f"Erreur synchronisation initiale des transactions pour {conn.institution_name}: {e}")

            return {
                "success": True,
                "message": f"Banque {conn.institution_name} connectée ! {mapped_count} compte(s) lié(s) et {tx_count} transaction(s) importée(s).",
                "accounts_mapped": mapped_count,
                "accounts": created_accounts_names,
                "transactions_imported": tx_count,
            }

    async def repair_connection_mappings(self, session: Session, conn_id: int) -> Dict[str, Any]:
        """
        Restaure ou complète la synchronisation et le mapping des comptes pour une connexion bancaire
        déjà autorisée (statut LINKED avec agreement_id).
        """
        conn = session.get(BankConnection, conn_id)
        if not conn:
            return {"success": False, "message": "Connexion introuvable"}

        if conn.is_simulation:
            self._auto_map_simulated_accounts(session, conn)
            return {"success": True, "message": "Connexion simulée réinitialisée"}

        if not self.application_id or not self.private_key:
            return {"success": False, "message": "Identifiants Enable Banking manquants"}

        token = self._generate_jwt()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        raw_uids = []
        if conn.account_ids:
            try:
                raw_uids = json.loads(conn.account_ids)
            except Exception:
                raw_uids = []

        async with httpx.AsyncClient(timeout=20.0) as client:
            if not raw_uids and conn.agreement_id:
                try:
                    s_resp = await client.get(
                        f"{ENABLE_BANKING_API_BASE}/sessions/{conn.agreement_id}",
                        headers=headers,
                    )
                    if s_resp.status_code == 200:
                        s_data = s_resp.json() or {}
                        raw_uids = s_data.get("accounts") or []
                        if raw_uids:
                            conn.account_ids = json.dumps([str(u) for u in raw_uids])
                            session.add(conn)
                            session.commit()
                except Exception as e:
                    logger.warning(f"Erreur interrogation session Enable Banking: {e}")

            if not raw_uids:
                return {"success": False, "message": "Aucun compte trouvé"}

            mapped_count = 0
            created_accounts_names = []

            for idx, acc_uid in enumerate(raw_uids):
                acc_uid_str = str(acc_uid)
                currency = "EUR"
                initial_balance = 0.0

                try:
                    b_resp = await client.get(
                        f"{ENABLE_BANKING_API_BASE}/accounts/{acc_uid_str}/balances",
                        headers=headers,
                    )
                    if b_resp.status_code == 200:
                        b_json = b_resp.json() or {}
                        b_list = b_json.get("balances") or b_json.get("balance") or []
                        if isinstance(b_list, dict):
                            b_list = [b_list]
                        if isinstance(b_list, list) and b_list:
                            first_b = b_list[0]
                            if isinstance(first_b, dict):
                                amt_info = first_b.get("balance_amount")
                                if isinstance(amt_info, dict) and "amount" in amt_info:
                                    initial_balance = float(amt_info["amount"])
                                    if amt_info.get("currency"):
                                        currency = amt_info["currency"]
                                elif "amount" in first_b:
                                    initial_balance = float(first_b["amount"])
                                    if first_b.get("currency"):
                                        currency = first_b["currency"]
                except Exception as e:
                    logger.warning(f"Erreur récupération solde pour {acc_uid_str}: {e}")

                acc_name = f"{conn.institution_name} - Compte {currency}"
                # Différencier si plusieurs comptes de même devise
                same_name_existing = session.exec(
                    select(BankAccountMapping).where(
                        BankAccountMapping.connection_id == conn.id,
                        BankAccountMapping.name == acc_name,
                        BankAccountMapping.external_account_id != acc_uid_str
                    )
                ).first()
                if same_name_existing:
                    acc_name = f"{conn.institution_name} - Compte {currency} ({idx + 1})"

                target_acc = self._get_or_create_account(
                    session=session,
                    institution_name=conn.institution_name,
                    account_name=acc_name,
                    initial_balance=initial_balance,
                    iban="",
                    currency=currency,
                )

                created_accounts_names.append(target_acc.name)

                mapping = session.exec(
                    select(BankAccountMapping).where(
                        BankAccountMapping.connection_id == conn.id,
                        BankAccountMapping.external_account_id == acc_uid_str
                    )
                ).first()

                if not mapping:
                    mapping = BankAccountMapping(
                        connection_id=conn.id,
                        external_account_id=acc_uid_str,
                        patrimon_account_id=target_acc.id,
                        name=acc_name,
                        last_balance=initial_balance or target_acc.cash_balance,
                        last_synced_at=datetime.now(timezone.utc),
                    )
                    session.add(mapping)
                else:
                    mapping.last_balance = initial_balance
                    mapping.last_synced_at = datetime.now(timezone.utc)
                    session.add(mapping)

                target_acc.cash_balance = initial_balance
                target_acc.updated_at = datetime.now(timezone.utc)
                session.add(target_acc)
                mapped_count += 1

            session.commit()
            return {
                "success": True,
                "accounts_mapped": mapped_count,
                "accounts": created_accounts_names,
            }

    # ────────────────────── Synchronisation des Soldes ──────────────────────

    def _auto_map_simulated_accounts(self, session: Session, conn: BankConnection):
        """Associe ou crée automatiquement les comptes et leurs soldes pour la banque simulée."""
        inst_name = conn.institution_name
        inst_upper = conn.institution_id.upper()

        simulated_accounts_data = []

        if "BOURSO" in inst_upper:
            simulated_accounts_data = [
                {
                    "ext_id": f"{conn.institution_id}_checking",
                    "name": "Compte Courant",
                    "type": AccountType.CHECKING,
                    "iban": "FR76 3000 4000 1234 5678 901",
                    "balance": 2450.00,
                },
                {
                    "ext_id": f"{conn.institution_id}_pea_cash",
                    "name": "Compte Espèces PEA",
                    "type": AccountType.PEA,
                    "iban": "FR76 3000 4000 9876 5432 109",
                    "balance": 350.50,
                },
            ]
        elif "BNP" in inst_upper:
            simulated_accounts_data = [
                {
                    "ext_id": f"{conn.institution_id}_checking",
                    "name": "Compte Courant",
                    "type": AccountType.CHECKING,
                    "iban": "FR76 3000 2000 1122 3344 556",
                    "balance": 1120.50,
                },
                {
                    "ext_id": f"{conn.institution_id}_savings",
                    "name": "Livret A",
                    "type": AccountType.SAVINGS,
                    "iban": "FR76 3000 2000 9988 7766 112",
                    "balance": 12500.00,
                },
            ]
        elif "REVOLUT" in inst_upper:
            simulated_accounts_data = [
                {
                    "ext_id": f"{conn.institution_id}_main",
                    "name": "Compte Principal",
                    "type": AccountType.CHECKING,
                    "iban": "LT34 3250 0000 9988 7766 55",
                    "balance": 540.20,
                },
                {
                    "ext_id": f"{conn.institution_id}_vault",
                    "name": "Coffre Épargne",
                    "type": AccountType.SAVINGS,
                    "iban": "LT34 3250 0000 1122 3344 55",
                    "balance": 1800.00,
                },
            ]
        elif "BBVA" in inst_upper:
            simulated_accounts_data = [
                {
                    "ext_id": f"{conn.institution_id}_checking",
                    "name": "Compte Courant",
                    "type": AccountType.CHECKING,
                    "iban": "FR76 1820 6000 0111 2223 344",
                    "balance": 1650.00,
                }
            ]
        elif "MOCK" in inst_upper or "TEST" in inst_upper:
            simulated_accounts_data = [
                {
                    "ext_id": f"{conn.institution_id}_checking",
                    "name": "Compte Test Démo",
                    "type": AccountType.CHECKING,
                    "iban": "FR76 9999 9999 0000 1111 222",
                    "balance": 3200.00,
                }
            ]
        else:
            simulated_accounts_data = [
                {
                    "ext_id": f"{conn.institution_id}_main",
                    "name": "Compte Courant",
                    "type": AccountType.CHECKING,
                    "iban": "FR76 1000 2000 3000 4000 555",
                    "balance": 1500.00,
                }
            ]

        for s_data in simulated_accounts_data:
            target_acc = self._get_or_create_account(
                session=session,
                institution_name=inst_name,
                account_name=s_data["name"],
                initial_balance=s_data["balance"],
                iban=s_data["iban"],
                account_type=s_data["type"],
            )

            mapping = session.exec(
                select(BankAccountMapping).where(
                    BankAccountMapping.connection_id == conn.id,
                    BankAccountMapping.external_account_id == s_data["ext_id"],
                )
            ).first()

            if not mapping:
                session.add(BankAccountMapping(
                    connection_id=conn.id,
                    external_account_id=s_data["ext_id"],
                    patrimon_account_id=target_acc.id,
                    iban=s_data["iban"],
                    name=s_data["name"],
                    last_balance=s_data["balance"],
                    last_synced_at=datetime.now(timezone.utc),
                ))
            else:
                mapping.last_balance = s_data["balance"]
                mapping.last_synced_at = datetime.now(timezone.utc)
                session.add(mapping)

            target_acc.cash_balance = s_data["balance"]
            session.add(target_acc)

        session.commit()

    def _get_simulated_transactions(
        self, 
        account: Account, 
        conn: BankConnection, 
        mapping: BankAccountMapping
    ) -> List[Dict[str, Any]]:
        """Génère des transactions bancaires simulées réalistes avec libellés et montants adaptés."""
        inst = (conn.institution_name or "").upper()
        acc_name = (account.name or "").upper()
        today = datetime.now(timezone.utc).date()

        sim_txs = []

        if "BOURSO" in inst:
            if "PEA" in acc_name:
                sim_txs = [
                    {
                        "external_id": f"sim_bourso_pea_cw8_{account.id}",
                        "amount": -495.50,
                        "currency": "EUR",
                        "date": (today - timedelta(days=5)).isoformat(),
                        "raw_label": "ACHAT TITRE AMUNDI MSCI WORLD UCITS ETF (CW8.PA)",
                        "symbol": "CW8.PA",
                        "quantity": 1.0,
                        "unit_price": 495.50,
                    },
                    {
                        "external_id": f"sim_bourso_pea_div_{account.id}",
                        "amount": 38.40,
                        "currency": "EUR",
                        "date": (today - timedelta(days=12)).isoformat(),
                        "raw_label": "DIVIDENDE TRIMESTRIEL AMUNDI MSCI WORLD",
                    },
                ]
            else:
                sim_txs = [
                    {
                        "external_id": f"sim_bourso_sal_{account.id}",
                        "amount": 3250.00,
                        "currency": "EUR",
                        "date": (today - timedelta(days=3)).isoformat(),
                        "raw_label": "VIR SEPA SCHNEIDER ELECTRIC SALAIRE MENSUEL",
                    },
                    {
                        "external_id": f"sim_bourso_carr_{account.id}",
                        "amount": -64.20,
                        "currency": "EUR",
                        "date": (today - timedelta(days=2)).isoformat(),
                        "raw_label": "PAIEMENT CARTE CARREFOUR MARKET PARIS 75011",
                    },
                    {
                        "external_id": f"sim_bourso_edf_{account.id}",
                        "amount": -89.40,
                        "currency": "EUR",
                        "date": (today - timedelta(days=4)).isoformat(),
                        "raw_label": "PRLV SEPA TOTALENERGIES ELECTRICITE & GAZ",
                    },
                    {
                        "external_id": f"sim_bourso_spot_{account.id}",
                        "amount": -10.99,
                        "currency": "EUR",
                        "date": (today - timedelta(days=1)).isoformat(),
                        "raw_label": "PRLV SPOTIFY ABONNEMENT MENSUEL",
                    },
                    {
                        "external_id": f"sim_bourso_sncf_{account.id}",
                        "amount": -54.00,
                        "currency": "EUR",
                        "date": (today - timedelta(days=6)).isoformat(),
                        "raw_label": "PAIEMENT CARTE SNCF VOYAGEURS TGV",
                    },
                ]
        elif "BNP" in inst:
            if "LIVRET" in acc_name or "SAVINGS" in acc_name:
                sim_txs = [
                    {
                        "external_id": f"sim_bnp_liv_1_{account.id}",
                        "amount": 300.00,
                        "currency": "EUR",
                        "date": (today - timedelta(days=4)).isoformat(),
                        "raw_label": "VIREMENT PERIODIQUE RECU COMPTE COURANT",
                    },
                ]
            else:
                sim_txs = [
                    {
                        "external_id": f"sim_bnp_mut_{account.id}",
                        "amount": -42.80,
                        "currency": "EUR",
                        "date": (today - timedelta(days=3)).isoformat(),
                        "raw_label": "PRLV MUTUELLE ALAN SANTE",
                    },
                    {
                        "external_id": f"sim_bnp_vir_ep_{account.id}",
                        "amount": -300.00,
                        "currency": "EUR",
                        "date": (today - timedelta(days=4)).isoformat(),
                        "raw_label": "VIREMENT PERIODIQUE VERS LIVRET A",
                    },
                    {
                        "external_id": f"sim_bnp_phar_{account.id}",
                        "amount": -18.50,
                        "currency": "EUR",
                        "date": (today - timedelta(days=5)).isoformat(),
                        "raw_label": "PAIEMENT CARTE PHARMACIE CENTRALE",
                    },
                ]
        elif "REVOLUT" in inst:
            sim_txs = [
                {
                    "external_id": f"sim_revo_resto_{account.id}",
                    "amount": -26.50,
                    "currency": "EUR",
                    "date": (today - timedelta(days=1)).isoformat(),
                    "raw_label": "PAIEMENT CB RESTAURANT LE BISTROT DU COIN",
                },
                {
                    "external_id": f"sim_revo_netf_{account.id}",
                    "amount": -13.49,
                    "currency": "EUR",
                    "date": (today - timedelta(days=7)).isoformat(),
                    "raw_label": "PRLV NETFLIX COM MENSUEL",
                },
                {
                    "external_id": f"sim_revo_rech_{account.id}",
                    "amount": 150.00,
                    "currency": "EUR",
                    "date": (today - timedelta(days=8)).isoformat(),
                    "raw_label": "RECHARGE DU COMPTE REVOLUT PAR CARTE",
                },
            ]
        else:
            sim_txs = [
                {
                    "external_id": f"sim_gen_sal_{account.id}",
                    "amount": 2500.00,
                    "currency": "EUR",
                    "date": (today - timedelta(days=3)).isoformat(),
                    "raw_label": "VIREMENT SALAIRE",
                },
                {
                    "external_id": f"sim_gen_cours_{account.id}",
                    "amount": -45.00,
                    "currency": "EUR",
                    "date": (today - timedelta(days=2)).isoformat(),
                    "raw_label": "PAIEMENT CARTE SUPERMARCHE",
                },
            ]

        return sim_txs

    async def sync_all_transactions(self, session: Session) -> Dict[str, Any]:
        """
        Synchronise automatiquement l'historique des transactions pour tous les comptes liés.
        Tous les champs (libellé, catégorie, type, montant, devise, notes) sont remplis automatiquement.
        """
        from datetime import date
        mappings = session.exec(select(BankAccountMapping)).all()
        synced_accounts = 0
        new_transactions_count = 0

        jwt_token = None
        if not self.is_simulation_mode and (self.application_id and self.private_key):
            try:
                jwt_token = self._generate_jwt()
            except Exception as e:
                logger.warning(f"JWT Enable Banking indisponible pour synchro transactions: {e}")

        for m in mappings:
            acc = session.get(Account, m.patrimon_account_id)
            if not acc:
                continue

            conn = session.get(BankConnection, m.connection_id)
            raw_txs_to_process = []

            if conn and conn.is_simulation:
                raw_txs_to_process = self._get_simulated_transactions(acc, conn, m)
            elif not self.is_simulation_mode and conn and not conn.is_simulation and jwt_token:
                try:
                    headers = {"Authorization": f"Bearer {jwt_token}"}
                    async with httpx.AsyncClient(timeout=20.0) as client:
                        resp = await client.get(
                            f"{ENABLE_BANKING_API_BASE}/accounts/{m.external_account_id}/transactions",
                            headers=headers,
                        )
                        if resp.status_code == 200:
                            data = resp.json() or {}
                            tx_list = data.get("transactions") or []
                            for t in tx_list:
                                ext_id = t.get("entry_reference") or t.get("transaction_id") or t.get("internal_transaction_id")
                                amt_dict = t.get("transaction_amount") or {}
                                amt_val = float(amt_dict.get("amount", 0.0))
                                cur = amt_dict.get("currency") or "EUR"
                                dt_str = t.get("booking_date") or t.get("value_date") or str(date.today())

                                indicator = (t.get("credit_debit_indicator") or "").upper()
                                if indicator == "DBIT" and amt_val > 0:
                                    amt_val = -amt_val
                                elif indicator == "CRDT" and amt_val < 0:
                                    amt_val = abs(amt_val)

                                rem_info = t.get("remittance_information")
                                rem_str = " ".join(rem_info) if isinstance(rem_info, list) else str(rem_info or "")
                                creditor = (t.get("creditor") or {}).get("name", "")
                                debtor = (t.get("debtor") or {}).get("name", "")

                                # Si identifiant manquant, générer une empreinte unique avec signature des données (R6)
                                if not ext_id:
                                    import hashlib
                                    sig = f"{dt_str}_{amt_val}_{rem_str}_{creditor}_{debtor}"
                                    h = hashlib.sha256(sig.encode('utf-8')).hexdigest()[:12]
                                    ext_id = f"eb_{dt_str}_{abs(amt_val)}_{h}"

                                # Préférer le nom explicite du commerçant / tiers si disponible
                                party_name = (debtor if amt_val > 0 and debtor else creditor) or rem_str or "Opération bancaire"

                                raw_txs_to_process.append({
                                    "external_id": str(ext_id),

                                    "amount": amt_val,
                                    "currency": cur,
                                    "date": dt_str,
                                    "raw_label": party_name,
                                    "creditor": creditor,
                                    "debtor": debtor,
                                })
                except Exception as e:
                    logger.warning(f"Erreur synchro transactions Enable Banking ({m.external_account_id}): {e}")

            # Traitement et enrichissement automatique de chaque transaction
            for item in raw_txs_to_process:
                ext_id = item["external_id"]
                # Vérifier si déjà enregistrée (déduplication)
                existing = session.exec(
                    select(Transaction)
                    .where(Transaction.account_id == acc.id)
                    .where(Transaction.external_id == ext_id)
                ).first()
                if existing:
                    continue

                raw_amt = float(item["amount"])
                abs_amount = round(abs(raw_amt), 2)
                raw_label = item.get("raw_label", "")

                # Date
                dt_raw = item.get("date")
                if isinstance(dt_raw, str):
                    try:
                        tx_date_val = datetime.strptime(dt_raw[:10], "%Y-%m-%d").date()
                    except Exception:
                        tx_date_val = date.today()
                else:
                    tx_date_val = date.today()

                # Déduction automatique du type et de la catégorie
                tx_type, auto_cat = transaction_enricher.deduce_type_and_category(raw_amt, raw_label)
                clean_name = transaction_enricher.clean_label(raw_label)

                curr = item.get("currency") or "EUR"
                from app.services.market_service import market_service
                rate = market_service.get_eur_rate(curr)
                amt_eur = round(abs_amount * rate, 2)

                unit_price = item.get("unit_price")
                unit_price_eur = round(float(unit_price) * rate, 4) if unit_price else None

                new_tx = Transaction(
                    account_id=acc.id,
                    type=tx_type,
                    transaction_date=tx_date_val,
                    symbol=item.get("symbol"),
                    name=clean_name or raw_label,
                    quantity=item.get("quantity"),
                    unit_price=unit_price,
                    unit_price_eur=unit_price_eur,
                    amount=abs_amount,
                    amount_eur=amt_eur,
                    fees=0.0,
                    fees_eur=0.0,
                    currency=curr,
                    category=auto_cat,
                    external_id=ext_id,
                    notes=f"Synchronisé automatiquement via Open Banking{f' ({raw_label})' if clean_name != raw_label else ''}",
                    created_at=datetime.now(timezone.utc),
                )
                session.add(new_tx)
                new_transactions_count += 1

            synced_accounts += 1

        session.commit()
        return {
            "success": True,
            "accounts_processed": synced_accounts,
            "new_transactions_imported": new_transactions_count,
        }

    async def sync_all_balances(self, session: Session) -> Dict[str, Any]:
        """Synchronise les soldes espèces et l'historique des transactions de tous les comptes bancaires liés."""
        connections = session.exec(select(BankConnection)).all()
        # Auto-réparation si des connexions LINKED n'ont pas encore leurs mappings
        for c in connections:
            if not c.is_simulation and c.status == "LINKED" and c.agreement_id:
                m_count = len(session.exec(select(BankAccountMapping).where(BankAccountMapping.connection_id == c.id)).all())
                if m_count == 0:
                    try:
                        logger.info(f"Auto-réparation des comptes pour la connexion {c.institution_name} ({c.id})...")
                        await self.repair_connection_mappings(session, c.id)
                    except Exception as e:
                        logger.warning(f"Impossible d'auto-réparer la connexion {c.id}: {e}")

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
                            b_json = resp.json() or {}
                            b_data = b_json.get("balances") or b_json.get("balance") or []
                            if isinstance(b_data, dict):
                                b_data = [b_data]
                            if isinstance(b_data, list) and b_data:
                                # Prioriser le solde comptable ou disponible de référence (CLBD > ITAV > premier) (R6)
                                chosen_b = None
                                for b in b_data:
                                    if isinstance(b, dict):
                                        b_type = (b.get("balance_type") or b.get("name") or "").upper()
                                        if "CLBD" in b_type or "CLOSINGBOOKED" in b_type:
                                            chosen_b = b
                                            break
                                        elif ("ITAV" in b_type or "INTERIMAVAILABLE" in b_type) and not chosen_b:
                                            chosen_b = b
                                if not chosen_b:
                                    chosen_b = b_data[0]

                                if isinstance(chosen_b, dict):
                                    amt_obj = chosen_b.get("balance_amount")
                                    if isinstance(amt_obj, dict) and "amount" in amt_obj:
                                        new_balance = round(float(amt_obj["amount"]), 2)
                                    elif "amount" in chosen_b:
                                        new_balance = round(float(chosen_b["amount"]), 2)

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

        # 2. Synchronisation conjointe automatique des transactions
        tx_stats = {"new_transactions_imported": 0}
        try:
            tx_stats = await self.sync_all_transactions(session)
        except Exception as e:
            logger.warning(f"Erreur lors de la synchronisation conjointe des transactions: {e}")

        new_tx_count = tx_stats.get("new_transactions_imported", 0)

        return {
            "success": True,
            "message": f"{synced_count} compte(s) synchronisé(s) et {new_tx_count} nouvelle(s) transaction(s) importée(s) et catégorisée(s).",
            "synced_accounts_count": synced_count,
            "total_balance_synced": round(total_balance_updated, 2),
            "new_transactions_imported": new_tx_count,
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
