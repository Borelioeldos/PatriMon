"""
PatriMon — Parseur des Relevés de Titres Mensuels BoursoBank PEA (PDF).
Extrait le solde espèces du PEA, ainsi que l'inventaire des positions détenues (ETF/Actions),
les quantités exactes, les cours du jour et les PRU fiscaux.
"""
import io
import re
import logging
from datetime import datetime, date, timezone
from typing import Dict, Any, List, Optional
from pypdf import PdfReader
from sqlmodel import Session, select

from app.models import Account, Holding, AccountType, AssetClass
from app.services.bourso_trade_parser import ISIN_TO_TICKER

logger = logging.getLogger("bourso_statement_parser")


class BoursoStatementParser:

    @staticmethod
    def _clean_num(val_str: Optional[str]) -> float:
        if not val_str:
            return 0.0
        cleaned = (
            val_str.replace("EUR", "")
            .replace("€", "")
            .replace("\xa0", "")
            .replace(" ", "")
            .replace(",", ".")
            .strip()
        )
        cleaned = re.sub(r"[^\d.-]", "", cleaned)
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    @classmethod
    def parse_pdf_bytes(cls, pdf_bytes: bytes) -> Optional[Dict[str, Any]]:
        """Extrait le solde espèces et les positions d'un relevé de compte titres / PEA BoursoBank."""
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            full_text = ""
            for p in reader.pages:
                full_text += (p.extract_text() or "") + "\n"

            if "RELEVE COMPTE TITRES" not in full_text and "SOLDE ESPECES" not in full_text:
                return None

            # 1. Date de valorisation
            date_m = re.search(r"Valorisé\s+au\s+(\d{2}/\d{2}/\d{4})", full_text)
            val_date = datetime.strptime(date_m.group(1), "%d/%m/%Y").date() if date_m else date.today()

            # 2. Solde espèces
            cash_m = re.search(r"SOLDE\s+ESPECES\s*\(EUR\)\s*([\d\s,.]+)\s*EUR", full_text)
            cash_balance = cls._clean_num(cash_m.group(1)) if cash_m else 0.0

            # 3. Total portefeuille
            port_m = re.search(r"TOTAL\s+DU\s+PORTEFEUILLE\s*([\d\s,.]+)\s*EUR", full_text)
            portfolio_total = cls._clean_num(port_m.group(1)) if port_m else 0.0

            # 4. Positions de titres
            # Exemple : 78 AM.PEA EM.ES.T.ACC (FR0013412020)  *  36,585 2 853,63 44,19 32,261
            # Analyse robuste ligne par ligne avec détection de l'ISIN
            positions: List[Dict[str, Any]] = []
            
            for line in full_text.split("\n"):
                line_str = line.strip()
                isin_match = re.search(r"\(([A-Z]{2}[A-Z0-9]{9}[0-9])\)", line_str)
                if not isin_match:
                    continue

                isin = isin_match.group(1)
                
                # Découper avant l'ISIN pour obtenir quantité et nom
                before_isin = line_str[:isin_match.start()].strip()
                after_isin = line_str[isin_match.end():].strip()

                qty_match = re.match(r"^(\d+(?:[.,]\d+)?)\s+(.+)$", before_isin)
                if not qty_match:
                    continue

                quantity = cls._clean_num(qty_match.group(1))
                val_name = qty_match.group(2).strip()

                # Nettoyage de la partie numérique après l'ISIN (retirer astérisques)
                num_part = re.sub(r"^[^\d]+", "", after_isin).strip()
                # Les nombres peuvent contenir des espaces en tant que séparateurs de milliers
                # Le dernier nombre est le PRU fiscal
                tokens = [t.strip() for t in re.split(r"\s{2,}|\s(?=\d{1,3}(?:[.,]\d+))", num_part) if t.strip()]
                
                # Extraction par expression régulière des groupes de nombres
                all_numbers = re.findall(r"\d[\d\s]*[.,]\d+|\d+", num_part)
                clean_numbers = [cls._clean_num(n) for n in all_numbers if cls._clean_num(n) > 0]

                if len(clean_numbers) >= 3:
                    current_price = clean_numbers[0]
                    pru = clean_numbers[-1]
                    valuation = clean_numbers[1] if len(clean_numbers) >= 4 else round(quantity * current_price, 2)
                else:
                    current_price = clean_numbers[0] if clean_numbers else 0.0
                    pru = current_price
                    valuation = round(quantity * current_price, 2)

                meta = ISIN_TO_TICKER.get(isin, {})
                symbol = meta.get("symbol") or isin
                display_name = meta.get("name") or val_name or symbol
                asset_class = meta.get("asset_class") or AssetClass.ETF

                positions.append({
                    "isin": isin,
                    "symbol": symbol,
                    "name": display_name,
                    "asset_class": asset_class,
                    "quantity": quantity,
                    "unit_cost": pru,
                    "current_price": current_price,
                    "valuation": valuation,
                })

            return {
                "date": val_date,
                "cash_balance": cash_balance,
                "portfolio_total": portfolio_total,
                "positions": positions,
            }

        except Exception as e:
            logger.error(f"Erreur lors du parsing du relevé de titres BoursoBank : {e}")
            return None

    @classmethod
    def import_statement_to_db(cls, session: Session, stmt_data: Dict[str, Any], pea_account_id: int = 1) -> Dict[str, Any]:
        """
        Applique le solde espèces et met à jour l'ensemble des positions en portefeuille du compte PEA.
        """
        account = session.get(Account, pea_account_id)
        if not account:
            # Recherche par type PEA
            account = session.exec(select(Account).where(Account.account_type == AccountType.PEA)).first()

        if not account:
            raise ValueError("Compte PEA introuvable pour appliquer le relevé de titres.")

        # 1. Mise à jour du solde espèces PEA
        cash_bal = stmt_data.get("cash_balance", 0.0)
        account.cash_balance = round(cash_bal, 2)
        account.updated_at = datetime.now(timezone.utc)
        session.add(account)

        # 2. Mise à jour des Holdings
        updated_count = 0
        now_utc = datetime.now(timezone.utc)

        for pos in stmt_data.get("positions", []):
            symbol = pos["symbol"]
            qty = pos["quantity"]
            pru = pos["unit_cost"]
            price = pos["current_price"]
            name = pos["name"]

            holding = session.exec(
                select(Holding).where(
                    Holding.account_id == account.id,
                    (Holding.symbol == symbol) | (Holding.name == name)
                )
            ).first()

            if holding:
                holding.quantity = qty
                if pru > 0:
                    holding.unit_cost = pru
                    holding.unit_cost_eur = pru
                if price > 0:
                    holding.current_price = price
                    holding.last_price_updated_at = now_utc
                holding.name = name
                session.add(holding)
            else:
                holding = Holding(
                    account_id=account.id,
                    symbol=symbol,
                    name=name,
                    asset_class=pos.get("asset_class", AssetClass.ETF),
                    quantity=qty,
                    unit_cost=pru or price,
                    unit_cost_eur=pru or price,
                    current_price=price,
                    currency="EUR",
                    is_manual=False,
                    last_price_updated_at=now_utc,
                    notes=f"Importé du relevé de titres BoursoBank (ISIN: {pos.get('isin')})",
                )
                session.add(holding)

            updated_count += 1

        session.commit()
        session.refresh(account)

        logger.info(f"Relevé PEA appliqué : solde cash={cash_bal} €, {updated_count} positions actualisées.")
        return {
            "success": True,
            "account_id": account.id,
            "cash_balance": cash_bal,
            "positions_updated": updated_count,
        }
