"""
PatriMon — Service d'automatisation et d'importation des relevés BNP Épargne & Retraite Entreprises.
Supporte les relevés officiels PDF (PEE & PERO de Schneider Electric et autres entreprises) et les exports CSV.
"""
import io
import re
import logging
from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple
from pypdf import PdfReader
from sqlmodel import Session, select

from app.models import Account, Holding, AccountType, AssetClass

logger = logging.getLogger("pee_import_service")


class PeeImportService:

    @staticmethod
    def _clean_number(val_str: str) -> float:
        """Nettoie une chaîne numérique au format français (ex: '13 617,08 €' -> 13617.08)."""
        if not val_str:
            return 0.0
        cleaned = val_str.replace("€", "").replace("\xa0", "").replace(" ", "").replace(",", ".")
        cleaned = re.sub(r"[^\d.-]", "", cleaned)
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    @classmethod
    def parse_pdf_statement(cls, file_bytes: bytes) -> Dict[str, Any]:
        """
        Analyse le PDF officiel émis par BNP Paribas Épargne & Retraite Entreprises / BNP Paribas Cardif.
        Extrait les dispositifs PEE et PERO, les fonds associés, le nombre de parts, le montant et les plus-values.
        """
        reader = PdfReader(io.BytesIO(file_bytes))
        full_text = ""
        pages_text = []

        for p in reader.pages:
            t = p.extract_text() or ""
            pages_text.append(t)
            full_text += t + "\n"

        # ── 1. Métadonnées générales ──
        statement_date = None
        date_match = re.search(r"au\s+(\d{2}/\d{2}/\d{4})", full_text, re.IGNORECASE)
        if not date_match:
            date_match = re.search(r"édité\s+le\s+(\d{2}/\d{2}/\d{4})", full_text, re.IGNORECASE)
        if date_match:
            statement_date = date_match.group(1)

        company_name = None
        comp_match = re.search(r"Entreprise\s*:\s*(.+)", full_text)
        if comp_match:
            company_name = comp_match.group(1).strip()

        # Montant total et plus-value globale (Page 1)
        total_gross_amount = 0.0
        tot_match = re.search(r"MONTANT\s+BRUT\s+TOTAL\s+([\d\s,.]+)\s*€", full_text, re.IGNORECASE)
        if tot_match:
            total_gross_amount = cls._clean_number(tot_match.group(1))

        global_gain = 0.0
        gain_match = re.search(r"Plus\s+ou\s+moins-value\s+globale[^\n]*\s+([+\-]?[\d\s,.]+)\s*€", full_text, re.IGNORECASE)
        if gain_match:
            global_gain = cls._clean_number(gain_match.group(1))

        # ── 2. Extraction détaillée par dispositif (Page 3) ──
        # Recherche de la section "RÉPARTITION DE VOTRE ÉPARGNE"
        lines = full_text.split("\n")
        items: List[Dict[str, Any]] = []

        current_dispositif = "PEE"
        current_pero_subgain = 0.0

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            # Détection du dispositif
            if re.match(r"^PEE\s+[\d\s,.]+\s*€", line_str, re.IGNORECASE):
                current_dispositif = "PEE"
                continue
            elif "PERO" in line_str.upper() and ("N°" in line_str or "VERSEMENTS" in line_str.upper()):
                current_dispositif = "PERO"
                # Extraction de la plus-value globale du PERO si présente sur la ligne d'en-tête
                pv_match = re.search(r"([+\-][\d\s,.]+)\s*€\s*$", line_str)
                if pv_match:
                    current_pero_subgain = cls._clean_number(pv_match.group(1))
                continue

            # Ignorer les lignes de sous-échéances qui commencent par une date de disponibilité (ex: "01/06/2029 7,8757...")
            if re.match(r"^\d{2}/\d{2}/\d{4}", line_str):
                continue

            # Ignorer les en-têtes de tableau et bas de page
            if any(h in line_str for h in [
                "Dispositif / Compartiment", "Quantité", "Montant brut",
                "BNP Paribas et Cardif Retraite", "Pour en savoir plus",
                "INFORMATIONS SUR VOS", "RÉPARTITION DE VOTRE ÉPARGNE",
                "Document édité le"
            ]):
                continue

            # Motif 1 : Ligne de fonds PEE avec plus-value explicite
            # Ex: "SCHNEIDER ACTIONNARIAT 18,3686 13 617,08 € +4 995,76 €"
            m_pee = re.match(
                r"^(.+?)\s+([\d,.]+)\s+([\d\s,.]+)\s*€\s+([+\-][\d\s,.]+)\s*€",
                line_str
            )
            if m_pee:
                fund_name = m_pee.group(1).strip()
                qty = cls._clean_number(m_pee.group(2))
                val = cls._clean_number(m_pee.group(3))
                gain = cls._clean_number(m_pee.group(4))

                if qty > 0 and val > 0:
                    unit_price = round(val / qty, 4)
                    cost_total = val - gain
                    unit_cost = round(cost_total / qty, 4) if qty > 0 else unit_price

                    items.append({
                        "dispositif": "PEE",
                        "fund_name": fund_name,
                        "symbol": re.sub(r"[^\w]+", "-", fund_name).strip("-").upper()[:20],
                        "quantity": qty,
                        "current_price": unit_price,
                        "unit_cost": unit_cost,
                        "total_value": val,
                        "gain_eur": gain,
                        "gain_percent": round((gain / cost_total * 100), 2) if cost_total > 0 else 0.0,
                    })
                continue

            # Motif 2 : Ligne de fonds PERO / Retraite
            # Ex: "BNP PARIBAS EASY MSCI EUROPE SRI PAB [UCITS ETF, C] Retraite 23,53688 942,65 € -"
            m_pero = re.match(
                r"^(.+?)\s+Retraite\s+([\d,.]+)\s+([\d\s,.]+)\s*€",
                line_str,
                re.IGNORECASE
            )
            if m_pero:
                fund_name = m_pero.group(1).strip()
                qty = cls._clean_number(m_pero.group(2))
                val = cls._clean_number(m_pero.group(3))

                if qty > 0 and val > 0:
                    unit_price = round(val / qty, 4)
                    items.append({
                        "dispositif": "PERO",
                        "fund_name": fund_name,
                        "symbol": re.sub(r"[^\w]+", "-", fund_name).strip("-").upper()[:20],
                        "quantity": qty,
                        "current_price": unit_price,
                        "unit_cost": unit_price,  # Sera ajusté si PRU disponible
                        "total_value": val,
                        "gain_eur": 0.0,
                        "gain_percent": 0.0,
                    })
                continue

            # Motif 3 : Ligne générique (ex: fonds sans label Retraite)
            m_gen = re.match(
                r"^([A-Z0-9\s\-–\(\)\[\],.]+?)\s+([\d,.]+)\s+([\d\s,.]+)\s*€",
                line_str
            )
            if m_gen:
                name_candidate = m_gen.group(1).strip()
                # Éviter les faux positifs sur les totaux
                if not any(skip in name_candidate.upper() for skip in ["TOTAL", "PERO", "PEE", "GESTION"]):
                    qty = cls._clean_number(m_gen.group(2))
                    val = cls._clean_number(m_gen.group(3))
                    if qty > 0 and val > 0 and not any(it["fund_name"] == name_candidate for it in items):
                        unit_price = round(val / qty, 4)
                        items.append({
                            "dispositif": current_dispositif,
                            "fund_name": name_candidate,
                            "symbol": re.sub(r"[^\w]+", "-", name_candidate).strip("-").upper()[:20],
                            "quantity": qty,
                            "current_price": unit_price,
                            "unit_cost": unit_price,
                            "total_value": val,
                            "gain_eur": 0.0,
                            "gain_percent": 0.0,
                        })

        pee_items = [it for it in items if it["dispositif"] == "PEE"]
        pero_items = [it for it in items if it["dispositif"] == "PERO"]

        total_extracted = sum(it["total_value"] for it in items)

        return {
            "success": len(items) > 0,
            "statement_date": statement_date or date.today().strftime("%d/%m/%Y"),
            "company_name": company_name or "Schneider Electric France",
            "total_gross_amount": total_gross_amount or total_extracted,
            "total_extracted_amount": round(total_extracted, 2),
            "global_gain": global_gain,
            "pee_items": pee_items,
            "pero_items": pero_items,
            "all_items": items,
            "pages_count": len(reader.pages),
        }

    @classmethod
    def parse_csv_statement(cls, file_content: str) -> Dict[str, Any]:
        """Analyse un fichier d'export CSV issu du portail BNP Épargne Entreprise."""
        lines = file_content.strip().split("\n")
        items: List[Dict[str, Any]] = []

        delimiter = ";" if ";" in lines[0] else ","

        for line in lines[1:]:
            parts = [p.strip().strip('"') for p in line.split(delimiter)]
            if len(parts) >= 3:
                name = parts[0]
                qty = cls._clean_number(parts[1])
                val = cls._clean_number(parts[2])
                price = cls._clean_number(parts[3]) if len(parts) > 3 else (val / qty if qty > 0 else 1.0)

                if qty > 0:
                    items.append({
                        "dispositif": "PEE",
                        "fund_name": name,
                        "symbol": re.sub(r"[^\w]+", "-", name).strip("-").upper()[:20],
                        "quantity": qty,
                        "current_price": round(price, 4),
                        "unit_cost": round(price, 4),
                        "total_value": round(val, 2),
                        "gain_eur": 0.0,
                        "gain_percent": 0.0,
                    })

        total_extracted = sum(it["total_value"] for it in items)
        return {
            "success": len(items) > 0,
            "statement_date": date.today().strftime("%d/%m/%Y"),
            "company_name": "BNP Épargne Entreprise",
            "total_gross_amount": total_extracted,
            "total_extracted_amount": round(total_extracted, 2),
            "global_gain": 0.0,
            "pee_items": items,
            "pero_items": [],
            "all_items": items,
        }

    @classmethod
    def apply_imported_holdings(
        cls,
        session: Session,
        items: List[Dict[str, Any]],
        target_pee_account_id: Optional[int] = None,
        create_pero_account_if_needed: bool = True,
    ) -> Dict[str, Any]:
        """
        Applique les positions extraites en base de données.
        Met à jour les fonds existants ou en crée de nouveaux.
        """
        # Trouver ou créer le compte PEE principal
        pee_account = None
        if target_pee_account_id:
            pee_account = session.get(Account, target_pee_account_id)
        if not pee_account:
            pee_account = session.exec(
                select(Account).where(Account.account_type == AccountType.PEE)
            ).first()

        if not pee_account:
            pee_account = Account(
                name="BNP - Épargne Entreprise (PEE)",
                institution="BNP Épargne Entreprise",
                account_type=AccountType.PEE,
                cash_balance=0.0,
                color="#10B981",
                notes="PEE entreprise avec abondement",
            )
            session.add(pee_account)
            session.commit()
            session.refresh(pee_account)

        # Trouver ou créer le compte PERO (Retraite) si des fonds PERO sont présents
        has_pero = any(it.get("dispositif") == "PERO" for it in items)
        pero_account = None

        if has_pero and create_pero_account_if_needed:
            pero_account = session.exec(
                select(Account).where(Account.account_type == AccountType.PERO)
            ).first()

            if not pero_account:
                pero_account = Account(
                    name="BNP Cardif - PERO Retraite",
                    institution="BNP Épargne Entreprise",
                    account_type=AccountType.PERO,
                    cash_balance=0.0,
                    color="#059669",
                    notes="Plan d'Épargne Retraite Obligatoire (Schneider Electric / Cardif)",
                )
                session.add(pero_account)
                session.commit()
                session.refresh(pero_account)

        updated_count = 0
        created_count = 0

        for it in items:
            dest_acc = pero_account if (it.get("dispositif") == "PERO" and pero_account) else pee_account
            clean_sym = it["symbol"].upper()

            # Recherche d'un holding existant portant le même symbole ou nom
            existing = session.exec(
                select(Holding)
                .where(Holding.account_id == dest_acc.id)
                .where((Holding.symbol == clean_sym) | (Holding.name == it["fund_name"]))
            ).first()

            if existing:
                existing.quantity = it["quantity"]
                existing.current_price = it["current_price"]
                existing.unit_cost = it["unit_cost"]
                existing.unit_cost_eur = it["unit_cost"]
                existing.is_manual = True
                existing.last_price_updated_at = datetime.utcnow()
                session.add(existing)
                updated_count += 1
            else:
                new_h = Holding(
                    account_id=dest_acc.id,
                    symbol=clean_sym,
                    name=it["fund_name"],
                    asset_class=AssetClass.FUND,
                    quantity=it["quantity"],
                    unit_cost=it["unit_cost"],
                    unit_cost_eur=it["unit_cost"],
                    current_price=it["current_price"],
                    currency="EUR",
                    is_manual=True,
                    notes=f"Dispositif {it.get('dispositif', 'PEE')}",
                )
                session.add(new_h)
                created_count += 1

        session.commit()

        return {
            "success": True,
            "updated_count": updated_count,
            "created_count": created_count,
            "pee_account_id": pee_account.id,
            "pero_account_id": pero_account.id if pero_account else None,
            "total_items": len(items),
        }


pee_import_service = PeeImportService()
