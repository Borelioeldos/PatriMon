"""
PatriMon — Parseur spécialisé des exports CSV Revolut (Trading CTO & Crypto).
Traite automatiquement les 4 fichiers d'export :
1. trading-account-statement (Ordres actions CTO, top-up cash, dividendes)
2. trading-pnl-statement (P&L réalisé actions et PRU fiscaux)
3. crypto-account-statement (Ordres cryptomonnaies BTC, ETH... et frais)
4. consolidated-statement (Synthèses fiscales et gains)
"""
import io
import csv
import re
import logging
from datetime import datetime, date, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlmodel import Session, select

from app.models import Account, Holding, Transaction, TransactionType, AssetClass, AccountType
from app.services.transaction_service import transaction_service

logger = logging.getLogger("revolut_csv_parser")


class RevolutCsvParser:

    @staticmethod
    def _clean_num(val_str: Optional[str]) -> float:
        if not val_str:
            return 0.0
        # Retirer symboles monétaires et espaces insécables
        s = (
            str(val_str)
            .replace("EUR", "")
            .replace("USD", "")
            .replace("€", "")
            .replace("$", "")
            .replace("\xa0", " ")
            .replace("\u202f", " ")
            .strip()
        )
        # Détection séparateurs milliers vs décimaux
        if "," in s and "." in s:
            # e.g. 93,126.88 -> la virgule est le séparateur des milliers
            if s.rfind(",") < s.rfind("."):
                s = s.replace(",", "")
            else:
                # e.g. 1.234,56
                s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            # Virgule seule : vérification décimale (ex: 12,50) ou milliers (ex: 1,000)
            parts = s.split(",")
            if len(parts[-1]) <= 2:
                s = s.replace(",", ".")
            else:
                s = s.replace(",", "")

        s = re.sub(r"[^\d.-]", "", s)
        try:
            return float(s)
        except ValueError:
            return 0.0

    @classmethod
    def _parse_revolut_date(cls, date_str: str) -> date:
        """Parse les divers formats de date Revolut (ISO ou US format)."""
        date_str = date_str.strip()
        if "T" in date_str:
            try:
                return datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()
            except Exception:
                pass
        # Remplacer les espaces insécables / non-ASCII (\u202f, \xa0) par un espace standard
        clean_d = re.sub(r"[^\x00-\x7F]+", " ", date_str).strip()
        clean_d = re.sub(r"\s+", " ", clean_d)

        formats = [
            "%b %d, %Y, %I:%M:%S %p",
            "%b %d, %Y",
            "%Y-%m-%d",
            "%d/%m/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(clean_d, fmt).date()
            except Exception:
                continue
        # Fallback date
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})", date_str)
        if date_match:
            return datetime.strptime(date_match.group(1), "%Y-%m-%d").date()
        return date.today()

    @classmethod
    def detect_and_parse(cls, csv_text: str, filename: str = "") -> Tuple[str, List[Dict[str, Any]]]:
        """Détecte automatiquement le type d'export Revolut et extrait les éléments."""
        lines = [l for l in csv_text.strip().split("\n") if l.strip()]
        if not lines:
            return "unknown", []

        header = lines[0].lower()

        # 1. Trading Account Statement (CTO Transactions)
        if "ticker" in header and "type" in header and "price per share" in header:
            return "trading_statement", cls._parse_trading_statement(csv_text)

        # 2. Crypto Account Statement
        if "symbol" in header and "quantity" in header and "fees" in header:
            return "crypto_statement", cls._parse_crypto_statement(csv_text)

        # 3. Trading PnL Statement
        if "date acquired" in header or "gross pnl" in header or "income from sells" in lines[0].lower():
            return "trading_pnl", cls._parse_trading_pnl(csv_text)

        # 4. Consolidated Statement
        if "crypto summaries" in lines[0].lower() or "capital gains" in csv_text.lower():
            return "consolidated", []

        return "unknown", []

    @classmethod
    def _parse_trading_statement(cls, csv_text: str) -> List[Dict[str, Any]]:
        """Parse les transactions du compte d'actions CTO Revolut."""
        results = []
        reader = csv.DictReader(io.StringIO(csv_text))
        for row in reader:
            t_type_raw = (row.get("Type") or "").strip().upper()
            ticker = (row.get("Ticker") or "").strip().upper()
            qty_raw = (row.get("Quantity") or "").strip()
            date_raw = (row.get("Date") or "").strip()
            amt_raw = (row.get("Total Amount") or "").strip()
            curr = (row.get("Currency") or "EUR").strip().upper()
            fx_raw = (row.get("FX Rate") or "1").strip()
            price_raw = (row.get("Price per share") or "").strip()

            if not date_raw:
                continue

            parsed_date = cls._parse_revolut_date(date_raw)
            total_amt = cls._clean_num(amt_raw)
            quantity = cls._clean_num(qty_raw)
            fx_rate = cls._clean_num(fx_raw) or 1.0
            unit_price = cls._clean_num(price_raw)

            # Conversion en EUR
            amount_eur = round(total_amt / fx_rate, 2) if curr == "USD" and fx_rate > 0 else round(total_amt, 2)
            unit_price_eur = round(unit_price / fx_rate, 2) if curr == "USD" and fx_rate > 0 else round(unit_price, 2)

            if "BUY" in t_type_raw:
                op_type = TransactionType.BUY
            elif "SELL" in t_type_raw:
                op_type = TransactionType.SELL
            elif "DIVIDEND" in t_type_raw:
                op_type = TransactionType.DIVIDEND
            elif "TOP-UP" in t_type_raw or "DEPOSIT" in t_type_raw:
                op_type = TransactionType.DEPOSIT
            else:
                continue

            ext_id = f"revolut_cto_{date_raw}_{ticker}_{op_type.value}_{quantity}_{total_amt}"

            results.append({
                "category": "trading",
                "type": op_type,
                "date": parsed_date,
                "symbol": ticker,
                "name": ticker,
                "quantity": quantity,
                "unit_price": unit_price,
                "unit_price_eur": unit_price_eur,
                "amount": total_amt,
                "amount_eur": amount_eur,
                "fees": 0.0,
                "fees_eur": 0.0,
                "currency": curr,
                "fx_rate": fx_rate,
                "external_id": ext_id,
            })
        return results

    @classmethod
    def _parse_crypto_statement(cls, csv_text: str) -> List[Dict[str, Any]]:
        """Parse les transactions de cryptomonnaies Revolut (ex: BTC)."""
        results = []
        reader = csv.DictReader(io.StringIO(csv_text))
        for row in reader:
            sym = (row.get("Symbol") or "").strip().upper()
            op_raw = (row.get("Type") or "").strip().upper()
            q_raw = (row.get("Quantity") or "").strip()
            p_raw = (row.get("Price") or "").strip()
            v_raw = (row.get("Value") or "").strip()
            f_raw = (row.get("Fees") or "").strip()
            d_raw = (row.get("Date") or "").strip()

            if not d_raw or sym == "EUR" or "OTHER" in op_raw:
                continue

            parsed_date = cls._parse_revolut_date(d_raw)
            quantity = cls._clean_num(q_raw)
            unit_price_eur = cls._clean_num(p_raw)
            val_eur = cls._clean_num(v_raw)
            fees_eur = cls._clean_num(f_raw)

            if "BUY" in op_raw:
                op_type = TransactionType.BUY
            elif "SELL" in op_raw:
                op_type = TransactionType.SELL
            else:
                continue

            ticker = f"{sym}-EUR"
            ext_id = f"revolut_crypto_{d_raw}_{sym}_{op_type.value}_{quantity}"

            results.append({
                "category": "crypto",
                "type": op_type,
                "date": parsed_date,
                "symbol": ticker,
                "name": f"{sym} (Crypto)",
                "asset_class": AssetClass.CRYPTO,
                "quantity": quantity,
                "unit_price": unit_price_eur,
                "unit_price_eur": unit_price_eur,
                "amount": val_eur,
                "amount_eur": val_eur,
                "fees": fees_eur,
                "fees_eur": fees_eur,
                "currency": "EUR",
                "external_id": ext_id,
            })
        return results

    @classmethod
    def _parse_trading_pnl(cls, csv_text: str) -> List[Dict[str, Any]]:
        """Parse le relevé de pertes et profits réalisé pour enrichir l'historique."""
        results = []
        # Sauter la première ligne si c'est "Income from Sells"
        content = csv_text
        if "income from sells" in content[:50].lower():
            lines = content.split("\n", 1)
            content = lines[1] if len(lines) > 1 else ""

        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            sym = (row.get("Symbol") or "").strip().upper()
            if not sym:
                continue
            d_sold = (row.get("Date sold") or "").strip()
            q_raw = (row.get("Quantity") or "").strip()
            cost_raw = (row.get("Cost basis") or "").strip()
            proceeds_raw = (row.get("Gross proceeds") or "").strip()
            pnl_raw = (row.get("Gross PnL") or "").strip()
            curr = (row.get("Currency") or "USD").strip().upper()

            results.append({
                "symbol": sym,
                "name": (row.get("Security name") or sym).strip(),
                "isin": (row.get("ISIN") or "").strip(),
                "date_sold": cls._parse_revolut_date(d_sold) if d_sold else date.today(),
                "quantity": cls._clean_num(q_raw),
                "cost_basis": cls._clean_num(cost_raw),
                "proceeds": cls._clean_num(proceeds_raw),
                "pnl": cls._clean_num(pnl_raw),
                "currency": curr,
            })
        return results

    @classmethod
    def import_transactions_to_db(
        cls, session: Session, items: List[Dict[str, Any]], account_id: int = 3
    ) -> int:
        """
        Enregistre les transactions Revolut dans la base de données.
        Dédoublonne infailliblement via external_id.
        """
        account = session.get(Account, account_id)
        if not account:
            account = session.exec(select(Account).where(Account.account_type == AccountType.CTO)).first()

        if not account:
            logger.warning("Compte Revolut CTO / Crypto introuvable.")
            return 0

        imported_count = 0
        now_utc = datetime.now(timezone.utc)

        for item in items:
            ext_id = item.get("external_id")
            if ext_id:
                existing = session.exec(
                    select(Transaction).where(Transaction.external_id == ext_id)
                ).first()
                if existing:
                    continue

            # Trouver ou créer le Holding si applicable
            holding_id = None
            symbol = item.get("symbol")
            if symbol and symbol != "CASH":
                holding = session.exec(
                    select(Holding).where(
                        Holding.account_id == account.id,
                        Holding.symbol == symbol
                    )
                ).first()

                if not holding:
                    asset_cls = item.get("asset_class", AssetClass.STOCK)
                    holding = Holding(
                        account_id=account.id,
                        symbol=symbol,
                        name=item.get("name") or symbol,
                        asset_class=asset_cls,
                        quantity=item.get("quantity", 0.0) if item["type"] == TransactionType.BUY else 0.0,
                        unit_cost=item.get("unit_price", 0.0),
                        unit_cost_eur=item.get("unit_price_eur", 0.0),
                        current_price=item.get("unit_price_eur", 0.0),
                        currency=item.get("currency", "EUR"),
                        is_manual=False,
                        last_price_updated_at=now_utc,
                        notes=f"Créé automatiquement via export CSV Revolut {item.get('category', '')}",
                    )
                    session.add(holding)
                    session.commit()
                    session.refresh(holding)

                holding_id = holding.id

            amount_val = item.get("amount", 0.0)
            amount_eur_val = item.get("amount_eur", amount_val)
            fees_val = item.get("fees", 0.0)
            fees_eur_val = item.get("fees_eur", fees_val)
            tx_type = item["type"]
            cat_name = "Dividendes & Intérêts" if tx_type == TransactionType.DIVIDEND else "Investissement & Épargne"


            tx = Transaction(
                account_id=account.id,
                holding_id=holding_id,
                type=tx_type,
                transaction_date=item["date"],
                symbol=symbol if symbol != "CASH" else None,
                name=item.get("name"),
                quantity=item.get("quantity"),
                unit_price=item.get("unit_price"),
                unit_price_eur=item.get("unit_price_eur"),
                amount=amount_val,
                amount_eur=amount_eur_val,
                fees=fees_val,
                fees_eur=fees_eur_val,
                currency=item.get("currency", "EUR"),
                category=cat_name,
                external_id=ext_id,
                notes=f"Transaction Revolut {item.get('category', '')}",
            )
            session.add(tx)
            imported_count += 1

            # Recalcul PRU si holding
            if holding_id:
                try:
                    transaction_service.recalculate_holding_pru(session, holding_id)
                except Exception:
                    pass

        session.commit()
        logger.info(f"{imported_count} nouvelles transactions Revolut importées avec succès.")
        return imported_count
