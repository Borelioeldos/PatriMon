"""
PatriMon — Service d'intégration et de synchronisation officielle Google Drive Cloud (v3).
Connexion sécurisée via OAuth, scan récursif du dossier Bourse, téléchargement en mémoire,
dédoublonnage intelligent via md5Checksum, et routage vers les parseurs spécialisés.
"""
import io
import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
from sqlmodel import Session, select

from app.models import DriveSyncLog, Account, AccountType
from app.services.bourso_trade_parser import BoursoTradeParser
from app.services.bourso_statement_parser import BoursoStatementParser
from app.services.revolut_csv_parser import RevolutCsvParser
from app.services.pee_import_service import PeeImportService

from app.config import DATA_DIR

logger = logging.getLogger("google_drive_service")

# Chemin des jetons MCP / OAuth sur la machine (avec surcharge env possible et fallback /data)
_data_tokens = DATA_DIR / "mcp_oauth_tokens.json"
_data_mcp = DATA_DIR / "mcp_config.json"

OAUTH_TOKENS_PATH = os.getenv(
    "DRIVE_OAUTH_TOKENS_PATH",
    str(_data_tokens if _data_tokens.exists() else r"C:\Users\Borel\.gemini\antigravity\mcp_oauth_tokens.json")
)
MCP_CONFIG_PATH = os.getenv(
    "DRIVE_MCP_CONFIG_PATH",
    str(_data_mcp if _data_mcp.exists() else r"C:\Users\Borel\.gemini\config\mcp_config.json")
)

GOOGLE_DRIVE_MCP_URL = "https://drivemcp.googleapis.com/mcp/v1"
DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"

# Identifiant officiel du dossier "Bourse" dans Google Drive
DEFAULT_BOURSE_FOLDER_ID = "1nA7R5KYPgqV6Y6PwvysZDp4B3A3-urmQ"


class GoogleDriveService:

    def __init__(self, folder_id: str = DEFAULT_BOURSE_FOLDER_ID):
        self.folder_id = folder_id

    def _get_access_token(self) -> str:
        """Récupère le jeton d'accès OAuth actif et le rafraîchit automatiquement si expiré."""
        if not os.path.exists(OAUTH_TOKENS_PATH):
            raise ValueError(f"Fichier de jetons introuvable : {OAUTH_TOKENS_PATH}")

        with open(OAUTH_TOKENS_PATH, "r", encoding="utf-8") as f:
            tokens_data = json.load(f)

        drive_info = tokens_data.get(GOOGLE_DRIVE_MCP_URL, {})
        token_info = drive_info.get("token", {})
        access_token = token_info.get("access_token")
        refresh_token = token_info.get("refresh_token")
        client_id = drive_info.get("client_id")
        client_secret = drive_info.get("client_secret")

        # Vérifier la validité du token
        if access_token:
            try:
                check_resp = httpx.get(
                    f"https://oauth2.googleapis.com/tokeninfo?access_token={access_token}",
                    timeout=5.0
                )
                if check_resp.status_code == 200:
                    exp = int(check_resp.json().get("expires_in", 0))
                    if exp > 60:
                        return access_token
            except Exception as e:
                logger.warning(f"Erreur vérification token : {e}")

        # Rafraîchir le token si nécessaire
        if refresh_token and client_id and client_secret:
            logger.info("Rafraîchissement du jeton d'accès Google Drive...")
            refresh_resp = httpx.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                timeout=10.0,
            )
            if refresh_resp.status_code == 200:
                new_data = refresh_resp.json()
                new_access_token = new_data.get("access_token")
                token_info["access_token"] = new_access_token
                drive_info["token"] = token_info
                tokens_data[GOOGLE_DRIVE_MCP_URL] = drive_info
                try:
                    with open(OAUTH_TOKENS_PATH, "w", encoding="utf-8") as f:
                        json.dump(tokens_data, f, indent=2)
                except Exception as e:
                    logger.warning(f"Impossible de réécrire le tokenfile : {e}")
                return new_access_token

        if access_token:
            return access_token
        raise ValueError("Impossible d'obtenir un jeton d'accès valide pour Google Drive.")

    def _get_headers(self) -> Dict[str, str]:
        token = self._get_access_token()
        return {"Authorization": f"Bearer {token}"}

    def download_file_bytes(self, file_id: str) -> bytes:
        """Télécharge le contenu brut d'un fichier Drive en mémoire."""
        headers = self._get_headers()
        url = f"{DRIVE_API_BASE}/files/{file_id}?alt=media"
        resp = httpx.get(url, headers=headers, timeout=30.0)
        if resp.status_code != 200:
            raise ValueError(f"Erreur téléchargement fichier {file_id} ({resp.status_code})")
        return resp.content

    def get_drive_tree(self, session: Optional[Session] = None) -> Dict[str, Any]:
        """
        Explore l'arborescence complète du dossier Bourse et renvoie les dossiers et fichiers
        avec leur statut de synchronisation (déjà importé vs en attente).
        """
        headers = self._get_headers()
        
        # Récupérer l'ensemble des fichiers sous Bourse avec pagination (R5)
        all_files = []
        page_token = None
        while True:
            params = {
                "q": "trashed = false",
                "fields": "nextPageToken, files(id, name, mimeType, parents, size, modifiedTime, md5Checksum)",
                "pageSize": 200,
            }
            if page_token:
                params["pageToken"] = page_token

            resp = httpx.get(f"{DRIVE_API_BASE}/files", headers=headers, params=params, timeout=20.0)
            if resp.status_code != 200:
                raise ValueError(f"Erreur requête Google Drive API : {resp.text}")

            data = resp.json() or {}
            all_files.extend(data.get("files", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        files_by_id = {f["id"]: f for f in all_files}


        # Repérer les dossiers clés
        subfolders = {}
        for f in all_files:
            if f.get("mimeType") == "application/vnd.google-apps.folder":
                parents = f.get("parents") or []
                if self.folder_id in parents:
                    subfolders[f["id"]] = f["name"]

        # Récupérer l'historique des synchronisations
        synced_file_ids = set()
        if session:
            logs = session.exec(select(DriveSyncLog.drive_file_id)).all()
            synced_file_ids = set(logs)

        # Structurer par catégories
        bourso_files = []
        revolut_files = []
        bnp_files = []

        # Trouver tous les fichiers qui descendent de Bourse
        for f in all_files:
            if f.get("mimeType") == "application/vnd.google-apps.folder":
                continue
            parents = f.get("parents") or []
            # Vérifier l'appartenance
            is_bourso = False
            is_revo = False
            is_bnp = False

            for p in parents:
                p_name = subfolders.get(p, "").lower()
                parent_obj = files_by_id.get(p)
                p_parent = (parent_obj.get("parents") or [None])[0] if parent_obj else None
                p_parent_name = subfolders.get(p_parent, "").lower()

                if "bourso" in p_name or "bourso" in p_parent_name or "avis" in p_name:
                    is_bourso = True
                elif "revolut" in p_name:
                    is_revo = True
                elif "bnp" in p_name or "epargne" in p_name:
                    is_bnp = True

            f_info = {
                "id": f["id"],
                "name": f["name"],
                "size": int(f.get("size", 0)),
                "modified_time": f.get("modifiedTime"),
                "md5": f.get("md5Checksum"),
                "is_synced": f["id"] in synced_file_ids,
            }

            if is_bourso:
                f_info["category"] = "bourso_trade" if "avis" in f["name"].lower() else "bourso_statement"
                bourso_files.append(f_info)
            elif is_revo:
                f_info["category"] = "revolut"
                revolut_files.append(f_info)
            elif is_bnp:
                f_info["category"] = "bnp_pee"
                bnp_files.append(f_info)

        return {
            "root_folder_id": self.folder_id,
            "connected": True,
            "total_files": len(bourso_files) + len(revolut_files) + len(bnp_files),
            "categories": {
                "bourso": {
                    "label": "BoursoBank PEA",
                    "files": sorted(bourso_files, key=lambda x: x["name"], reverse=True),
                    "total": len(bourso_files),
                    "pending": sum(1 for f in bourso_files if not f["is_synced"]),
                },
                "revolut": {
                    "label": "Revolut (CTO & Crypto)",
                    "files": sorted(revolut_files, key=lambda x: x["name"], reverse=True),
                    "total": len(revolut_files),
                    "pending": sum(1 for f in revolut_files if not f["is_synced"]),
                },
                "bnp": {
                    "label": "BNP Épargne Entreprise (PEE / PERO)",
                    "files": sorted(bnp_files, key=lambda x: x["name"], reverse=True),
                    "total": len(bnp_files),
                    "pending": sum(1 for f in bnp_files if not f["is_synced"]),
                },
            }
        }

    def sync_all(self, session: Session) -> Dict[str, Any]:
        """
        Synchronise l'ensemble des fichiers du dossier Bourse :
        - Traite les avis d'opéré BoursoBank
        - Traite le relevé de titres BoursoBank
        - Traite les 4 CSV Revolut
        - Traite le relevé BNP EE
        - Enregistre chaque fichier traité dans DriveSyncLog avec son md5Checksum
        """
        tree = self.get_drive_tree(session)
        categories = tree.get("categories", {})

        stats = {
            "bourso_trades_imported": 0,
            "bourso_positions_updated": 0,
            "revolut_transactions_imported": 0,
            "bnp_funds_updated": 0,
            "files_processed": 0,
            "files_skipped": 0,
            "errors": [],
        }

        # Résolution dynamique des comptes cibles (R4 : sans ID en dur)
        pea_account = session.exec(
            select(Account).where(Account.account_type == AccountType.PEA)
        ).first()
        pea_account_id = pea_account.id if pea_account else 1

        revolut_account = session.exec(
            select(Account)
            .where(Account.institution == "Revolut")
            .where(Account.account_type.in_([AccountType.CTO, AccountType.CRYPTO]))
        ).first()
        if not revolut_account:
            revolut_account = session.exec(
                select(Account).where(Account.institution == "Revolut")
            ).first()
        revolut_account_id = revolut_account.id if revolut_account else 3

        # 1. BoursoBank (Avis d'opérés puis Relevé de titres)
        bourso_files = categories.get("bourso", {}).get("files", [])
        
        # Traiter d'abord les avis d'opéré
        for f in bourso_files:
            fid = f["id"]
            fname = f["name"]
            md5 = f.get("md5")

            # Anti-doublon via log
            existing_log = session.exec(
                select(DriveSyncLog).where(DriveSyncLog.drive_file_id == fid)
            ).first()
            if existing_log and (not md5 or existing_log.md5_checksum == md5):
                stats["files_skipped"] += 1
                continue

            try:
                pdf_bytes = self.download_file_bytes(fid)

                if "avis" in fname.lower() or "opéré" in fname.lower():
                    # Parse avis d'opéré
                    trade_data = BoursoTradeParser.parse_pdf_bytes(pdf_bytes)
                    if trade_data:
                        tx = BoursoTradeParser.import_trade_to_db(session, trade_data, pea_account_id=pea_account_id)
                        if tx:
                            stats["bourso_trades_imported"] += 1

                    self._record_log(
                        session=session,
                        file_id=fid,
                        file_name=fname,
                        category="bourso_trade",
                        md5=md5,
                        tx_count=1 if trade_data else 0,
                        holdings_count=0,
                        details=f"Avis d'opéré BoursoBank {trade_data.get('order_ref') if trade_data else ''}"
                    )
                    stats["files_processed"] += 1

                elif "relevé" in fname.lower() or "titre" in fname.lower():
                    # Parse relevé de titres
                    stmt_data = BoursoStatementParser.parse_pdf_bytes(pdf_bytes)
                    if stmt_data:
                        res = BoursoStatementParser.import_statement_to_db(session, stmt_data, pea_account_id=pea_account_id)
                        stats["bourso_positions_updated"] += res.get("positions_updated", 0)

                    self._record_log(
                        session=session,
                        file_id=fid,
                        file_name=fname,
                        category="bourso_statement",
                        md5=md5,
                        tx_count=0,
                        holdings_count=len(stmt_data.get("positions", [])) if stmt_data else 0,
                        details=f"Relevé PEA : solde cash {stmt_data.get('cash_balance') if stmt_data else 0} €"
                    )
                    stats["files_processed"] += 1

            except Exception as e:
                logger.error(f"Erreur traitement fichier Bourso {fname} : {e}")
                stats["errors"].append(f"{fname}: {str(e)}")

        # 2. Revolut (CSV)
        revolut_files = categories.get("revolut", {}).get("files", [])
        for f in revolut_files:
            fid = f["id"]
            fname = f["name"]
            md5 = f.get("md5")

            existing_log = session.exec(
                select(DriveSyncLog).where(DriveSyncLog.drive_file_id == fid)
            ).first()
            if existing_log and (not md5 or existing_log.md5_checksum == md5):
                stats["files_skipped"] += 1
                continue

            try:
                csv_bytes = self.download_file_bytes(fid)
                csv_text = csv_bytes.decode("utf-8", errors="replace")

                cat_type, items = RevolutCsvParser.detect_and_parse(csv_text, fname)
                imported = 0
                if cat_type in ("trading_statement", "crypto_statement") and items:
                    imported = RevolutCsvParser.import_transactions_to_db(session, items, account_id=revolut_account_id)
                    stats["revolut_transactions_imported"] += imported
                else:
                    imported = len(items)


                self._record_log(
                    session=session,
                    file_id=fid,
                    file_name=fname,
                    category=f"revolut_{cat_type}",
                    md5=md5,
                    tx_count=imported,
                    holdings_count=0,
                    details=f"Export Revolut {cat_type} ({len(items)} lignes)"
                )
                stats["files_processed"] += 1

            except Exception as e:
                logger.error(f"Erreur traitement fichier Revolut {fname} : {e}")
                stats["errors"].append(f"{fname}: {str(e)}")

        # 3. BNP Épargne Entreprise (PDF)
        bnp_files = categories.get("bnp", {}).get("files", [])
        for f in bnp_files:
            fid = f["id"]
            fname = f["name"]
            md5 = f.get("md5")

            existing_log = session.exec(
                select(DriveSyncLog).where(DriveSyncLog.drive_file_id == fid)
            ).first()
            if existing_log and (not md5 or existing_log.md5_checksum == md5):
                stats["files_skipped"] += 1
                continue

            try:
                pdf_bytes = self.download_file_bytes(fid)
                stmt_dict = PeeImportService.parse_pdf_statement(pdf_bytes)
                all_items = stmt_dict.get("all_items", [])
                res = PeeImportService.apply_imported_holdings(session, all_items)
                funds_up = res.get("updated_count", 0) + res.get("created_count", 0)
                stats["bnp_funds_updated"] += funds_up

                self._record_log(
                    session=session,
                    file_id=fid,
                    file_name=fname,
                    category="bnp_pee",
                    md5=md5,
                    tx_count=0,
                    holdings_count=funds_up,
                    details=f"Relevé BNP PEE appliqué ({funds_up} fonds actualisés)"
                )
                stats["files_processed"] += 1

            except Exception as e:
                logger.error(f"Erreur traitement relevé BNP {fname} : {e}")
                stats["errors"].append(f"{fname}: {str(e)}")

        session.commit()
        return stats

    @staticmethod
    def _record_log(
        session: Session,
        file_id: str,
        file_name: str,
        category: str,
        md5: Optional[str] = None,
        tx_count: int = 0,
        holdings_count: int = 0,
        details: Optional[str] = None,
    ):
        """Enregistre ou met à jour le journal anti-doublon."""
        log = session.exec(select(DriveSyncLog).where(DriveSyncLog.drive_file_id == file_id)).first()
        now_utc = datetime.now(timezone.utc)
        if not log:
            log = DriveSyncLog(
                drive_file_id=file_id,
                file_name=file_name,
                file_category=category,
                md5_checksum=md5,
                transactions_imported=tx_count,
                holdings_updated=holdings_count,
                status="SUCCESS",
                details=details,
                imported_at=now_utc,
            )
            session.add(log)
        else:
            log.md5_checksum = md5
            log.transactions_imported = tx_count
            log.holdings_updated = holdings_count
            log.imported_at = now_utc
            log.details = details
            session.add(log)
        session.commit()


# Instance singleton
google_drive_service = GoogleDriveService()
