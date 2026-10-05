"""
PatriMon — Parseur des Avis d'Opéré BoursoBank PEA (PDF).
Extrait les ordres d'achat et de vente d'ETF et d'actions, calcule les frais,
et crée les transactions avec dédoublonnage via la référence d'ordre unique.
"""
import io
import re
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from pypdf import PdfReader
from sqlmodel import Session, select

from app.models import Transaction, TransactionType, Account, Holding, AssetClass
from app.services.transaction_service import transaction_service

logger = logging.getLogger("bourso_trade_parser")

# Correspondance des codes ISIN vers Tickers Yahoo Finance & Noms standardisés
ISIN_TO_TICKER = {
    "FR0013412020": {
        "symbol": "PAASI.PA",
        "name": "Amundi PEA MSCI Emerging ESG Leaders UCITS ETF",
        "asset_class": AssetClass.ETF,
    },
    "FR0011550185": {
        "symbol": "ESE.PA",
        "name": "BNP Paribas Easy S&P 500 UCITS ETF",
        "asset_class": AssetClass.ETF,
    },
    "IE0002XZSHO1": {
        "symbol": "WPEA.PA",
        "name": "iShares MSCI World Swap PEA UCITS ETF",
        "asset_class": AssetClass.ETF,
    },
    "IE00B53L3W79": {
        "symbol": "CSX5.PA",
        "name": "iShares Core EURO STOXX 50 UCITS ETF",
        "asset_class": AssetClass.ETF,
    },
    "FR0011869353": {
        "symbol": "CW8.PA",
        "name": "Amundi MSCI World UCITS ETF",
        "asset_class": AssetClass.ETF,
    },
}


class BoursoTradeParser:

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
        """Extrait les détails d'un avis d'opéré PDF officiel BoursoBank."""
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            full_text = ""
            for p in reader.pages:
                full_text += (p.extract_text() or "") + "\n"

            if "OPERATION DE BOURSE" not in full_text and "AVIS D'OPERE" not in full_text.upper():
                return None

            # 1. Type d'opération
            tx_type = TransactionType.BUY
            if "VENTE COMPTANT" in full_text:
                tx_type = TransactionType.SELL
            elif "ACHAT COMPTANT" in full_text:
                tx_type = TransactionType.BUY

            # 2. Référence d'ordre unique
            ref_match = re.search(r"Référence\s*:\s*([A-Za-z0-9]+)", full_text)
            order_ref = ref_match.group(1).strip() if ref_match else ""

            # 3. Code ISIN
            isin_match = re.search(r"Code\s+ISIN\s*:\s*([A-Z]{2}[A-Z0-9]{9}[0-9])", full_text)
            isin = isin_match.group(1).strip() if isin_match else ""

            # 4. Cours exécuté
            cours_match = re.search(r"Cours\s+exécuté\s*:\s*([\d\s,.]+)\s*EUR", full_text)
            unit_price = cls._clean_num(cours_match.group(1)) if cours_match else 0.0

            # 5. Date d'exécution & Quantité
            date_match = re.search(r"(\d{2}/\d{2}/\d{4})\s*\n\s*(\d{2}:\d{2}:\d{2})\s*\n\s*(\d+(?:[.,]\d+)?)", full_text)
            if date_match:
                exec_date = datetime.strptime(date_match.group(1), "%d/%m/%Y").date()
                quantity = cls._clean_num(date_match.group(3))
            else:
                simple_date = re.search(r"(\d{2}/\d{2}/\d{4})", full_text)
                exec_date = datetime.strptime(simple_date.group(1), "%d/%m/%Y").date() if simple_date else date.today()
                qty_match = re.search(r"Quantité[^\n]*\n.*?(\d+(?:[.,]\d+)?)", full_text)
                quantity = cls._clean_num(qty_match.group(1)) if qty_match else 0.0

            # 6. Nom de la valeur
            val_match = re.search(r"\d+(?:[.,]\d+)?\s+([A-Z0-9\s.\-_]+?)\s+Référence\s*:", full_text)
            val_name = val_match.group(1).strip() if val_match else ""

            # 7. Montants et Frais
            brut_match = re.search(
                r"Montant\s+brut[^\n]*\n([\d\s,.]+)\s*EUR\s+([\d\s,.]*)\s*EUR\s+([\d\s,.]+)\s*EUR",
                full_text
            )
            fees = 0.0
            net_amount = 0.0
            if brut_match:
                fees = cls._clean_num(brut_match.group(2)) if brut_match.group(2) else 0.0
                net_amount = cls._clean_num(brut_match.group(3))
            else:
                net_m = re.search(r"Montant\s+net[^\n]*\n.*?([\d\s,.]+)\s*EUR", full_text)
                if net_m:
                    net_amount = cls._clean_num(net_m.group(1))
                if net_amount > 0 and unit_price > 0 and quantity > 0:
                    brut_calc = round(quantity * unit_price, 2)
                    fees = max(0.0, round(net_amount - brut_calc, 2))

            # 8. Résolution ticker & métadonnées
            meta = ISIN_TO_TICKER.get(isin, {})
            symbol = meta.get("symbol") or isin or "ETF-BOURSO"
            display_name = meta.get("name") or val_name or symbol
            asset_class = meta.get("asset_class") or AssetClass.ETF

            return {
                "order_ref": order_ref,
                "type": tx_type,
                "isin": isin,
                "symbol": symbol,
                "name": display_name,
                "asset_class": asset_class,
                "date": exec_date,
                "quantity": quantity,
                "unit_price": unit_price,
                "fees": fees,
                "net_amount": net_amount,
                "external_id": f"bourso_trade_{order_ref}" if order_ref else None,
            }

        except Exception as e:
            logger.error(f"Erreur lors du parsing de l'avis d'opéré BoursoBank : {e}")
            return None

    @classmethod
    def import_trade_to_db(cls, session: Session, trade_data: Dict[str, Any], pea_account_id: int = 1) -> Optional[Transaction]:
        """
        Enregistre la transaction d'avis d'opéré dans la base de données.
        Dédoublonne infailliblement via external_id ou (date + compte + isin + quantite).
        """
        ext_id = trade_data.get("external_id")
        exec_date = trade_data["date"]
        symbol = trade_data["symbol"]
        qty = trade_data["quantity"]
        unit_price = trade_data["unit_price"]
        net_amount = trade_data["net_amount"]
        tx_type = trade_data["type"]

        # 1. Vérification doublon
        if ext_id:
            existing = session.exec(
                select(Transaction).where(Transaction.external_id == ext_id)
            ).first()
            if existing:
                logger.debug(f"Avis d'opéré déjà importé (external_id={ext_id})")
                return None

        # Vérification doublon par attributs
        existing_dup = session.exec(
            select(Transaction).where(
                Transaction.account_id == pea_account_id,
                Transaction.transaction_date == exec_date,
                Transaction.symbol == symbol,
                Transaction.quantity == qty,
            )
        ).first()
        if existing_dup:
            logger.debug(f"Avis d'opéré identique déjà existant ({exec_date} {symbol} {qty})")
            return None

        # 2. Trouver ou créer la position Holding correspondante
        holding = session.exec(
            select(Holding).where(
                Holding.account_id == pea_account_id,
                (Holding.symbol == symbol) | (Holding.name == trade_data["name"])
            )
        ).first()

        if not holding:
            holding = Holding(
                account_id=pea_account_id,
                symbol=symbol,
                name=trade_data["name"],
                asset_class=trade_data.get("asset_class", AssetClass.ETF),
                quantity=qty if tx_type == TransactionType.BUY else 0.0,
                unit_cost=unit_price,
                unit_cost_eur=unit_price,
                current_price=unit_price,
                currency="EUR",
                is_manual=False,
                notes=f"Créé via avis d'opéré BoursoBank PEA (ISIN: {trade_data.get('isin')})",
            )
            session.add(holding)
            session.commit()
            session.refresh(holding)

        # 3. Création de la Transaction
        new_tx = Transaction(
            account_id=pea_account_id,
            holding_id=holding.id,
            type=tx_type,
            transaction_date=exec_date,
            symbol=symbol,
            name=trade_data["name"],
            quantity=qty,
            unit_price=unit_price,
            unit_price_eur=unit_price,
            amount=net_amount,
            amount_eur=net_amount,
            fees=trade_data.get("fees", 0.0),
            fees_eur=trade_data.get("fees", 0.0),
            currency="EUR",
            category="Investissement & Épargne",
            external_id=ext_id,
            notes=f"Ordre d'exécution BoursoBank Ref: {trade_data.get('order_ref')} (ISIN: {trade_data.get('isin')})",
        )
        session.add(new_tx)
        session.commit()
        session.refresh(new_tx)

        # 4. Recalcul propre du PRU pondéré du holding
        try:
            transaction_service.recalculate_holding_pru(session, holding.id)
        except Exception as e:
            logger.warning(f"Note recalcul PRU pour {symbol}: {e}")

        logger.info(f"Avis d'opéré BoursoBank importé : {tx_type.value} {qty}x {symbol} @ {unit_price} € (Ref: {trade_data.get('order_ref')})")
        return new_tx
