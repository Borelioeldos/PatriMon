"""
PatriMon — Service de gestion des transactions.
Gère les achats, ventes, versements, retraits, dividendes,
le recalcul dynamique du PRU pondéré et l'ajustement des soldes espèces.
"""
import logging
from datetime import datetime, timezone, date
from typing import Dict, Any, List, Optional
from sqlmodel import Session, select

from app.models import (
    Transaction, TransactionCreate, TransactionRead, TransactionType,
    Account, Holding, AssetClass, INVESTMENT_ACCOUNT_TYPES
)
from app.services.market_service import market_service

logger = logging.getLogger("transaction_service")


class TransactionService:

    @staticmethod
    def create_transaction(session: Session, tx_in: TransactionCreate) -> Transaction:
        """
        Enregistre une nouvelle transaction et applique les règles de gestion :
        - Recalcul du PRU pondéré (Weighted Average Cost) sur achat
        - Calcul de la plus-value réalisée sur vente
        - Débit/Crédit automatique du solde espèces du compte
        """
        account = session.get(Account, tx_in.account_id)
        if not account:
            raise ValueError(f"Compte #{tx_in.account_id} introuvable.")

        currency = (tx_in.currency or account.currency or "EUR").upper()
        eur_rate = market_service.get_eur_rate(currency)

        # Calcul des prix convertis en EUR
        unit_price = tx_in.unit_price
        unit_price_eur = None
        if unit_price is not None:
            unit_price_eur = round(unit_price * eur_rate, 4)

        fees = tx_in.fees or 0.0
        fees_eur = round(fees * eur_rate, 2)

        # Calcul du montant total
        amount = tx_in.amount
        if (amount is None or amount == 0.0) and tx_in.quantity and unit_price:
            if tx_in.type == TransactionType.BUY:
                amount = (tx_in.quantity * unit_price) + fees
            elif tx_in.type == TransactionType.SELL:
                amount = (tx_in.quantity * unit_price) - fees
            else:
                amount = (tx_in.quantity * unit_price)

        amount_eur = round(amount * eur_rate, 2) if amount else 0.0

        # Recherche ou association du holding
        holding: Optional[Holding] = None
        if tx_in.holding_id:
            holding = session.get(Holding, tx_in.holding_id)
        elif tx_in.symbol:
            clean_sym = tx_in.symbol.strip().upper()
            holding = session.exec(
                select(Holding)
                .where(Holding.account_id == tx_in.account_id)
                .where(Holding.symbol == clean_sym)
            ).first()

        realized_gain_eur: Optional[float] = None
        symbol = tx_in.symbol.upper() if tx_in.symbol else (holding.symbol if holding else None)
        name = tx_in.name or (holding.name if holding else symbol)

        # ─── Logique Métier par Type d'Opération ───

        if tx_in.type == TransactionType.BUY:
            qty = tx_in.quantity or 0.0
            price_eur = unit_price_eur or (holding.unit_cost_eur if holding else 0.0)

            if tx_in.auto_update_holding:
                if holding:
                    # Formule du PRU pondéré (Weighted Average Cost)
                    # (Ancienne Valeur + Nouvel Achat + Frais) / Nouvelle Quantité
                    old_qty = holding.quantity
                    old_cost_eur = holding.unit_cost_eur
                    new_qty = old_qty + qty

                    if new_qty > 0:
                        total_invested_eur = (old_qty * old_cost_eur) + (qty * price_eur) + fees_eur
                        new_pru_eur = total_invested_eur / new_qty
                        holding.quantity = round(new_qty, 6)
                        holding.unit_cost_eur = round(new_pru_eur, 4)
                        holding.unit_cost = round(new_pru_eur / eur_rate, 4)
                        session.add(holding)
                elif symbol and qty > 0:
                    # Création automatique de la position si elle n'existait pas encore
                    # Récupération automatique du nom / type via MarketService
                    asset_class = AssetClass.STOCK
                    is_manual = False
                    if symbol.endswith(".PA") or "ETF" in (name or ""):
                        asset_class = AssetClass.ETF
                    elif "BTC" in symbol or "ETH" in symbol or "SOL" in symbol:
                        asset_class = AssetClass.CRYPTO

                    pru_eur = price_eur + (fees_eur / qty if qty > 0 else 0.0)
                    unit_cost_in_currency = round(pru_eur / eur_rate, 4) if eur_rate > 0 else (unit_price or pru_eur)
                    new_holding = Holding(
                        account_id=account.id,
                        symbol=symbol,
                        name=name or symbol,
                        asset_class=asset_class,
                        quantity=qty,
                        unit_cost=unit_cost_in_currency,
                        unit_cost_eur=round(pru_eur, 4),
                        current_price=unit_price,
                        currency=currency,
                        is_manual=is_manual,
                        initial_quantity=0.0,
                        initial_unit_cost_eur=0.0,
                    )
                    session.add(new_holding)
                    session.flush()
                    holding = new_holding

            # Débit du solde espèces du compte
            if tx_in.auto_update_cash:
                account.cash_balance = round(account.cash_balance - (amount_eur / market_service.get_eur_rate(account.currency)), 2)
                session.add(account)

        elif tx_in.type == TransactionType.SELL:
            qty = tx_in.quantity or 0.0
            price_eur = unit_price_eur
            if (price_eur is None or price_eur == 0.0) and qty > 0 and amount_eur > 0:
                price_eur = round((amount_eur + fees_eur) / qty, 4)
                unit_price_eur = price_eur
                if unit_price is None:
                    unit_price = round(price_eur / eur_rate, 4) if eur_rate > 0 else price_eur
            elif price_eur is None:
                price_eur = 0.0

            if holding:
                # Calcul de la plus-value réalisée : (Prix de Vente EUR - PRU EUR) * Qté - Frais EUR
                pru_eur = holding.unit_cost_eur
                realized_gain_eur = round(((price_eur - pru_eur) * qty) - fees_eur, 2)

                if tx_in.auto_update_holding:
                    new_qty = max(0.0, holding.quantity - qty)
                    holding.quantity = round(new_qty, 6)
                    session.add(holding)

            # Crédit du solde espèces du compte
            if tx_in.auto_update_cash:
                net_received_eur = amount_eur
                account.cash_balance = round(account.cash_balance + (net_received_eur / market_service.get_eur_rate(account.currency)), 2)
                session.add(account)

        elif tx_in.type == TransactionType.DEPOSIT:
            # Versement d'espèces sur le compte
            if tx_in.auto_update_cash:
                account.cash_balance = round(account.cash_balance + (amount_eur / market_service.get_eur_rate(account.currency)), 2)
                session.add(account)

        elif tx_in.type == TransactionType.WITHDRAWAL:
            # Retrait d'espèces du compte
            if tx_in.auto_update_cash:
                account.cash_balance = round(account.cash_balance - (amount_eur / market_service.get_eur_rate(account.currency)), 2)
                session.add(account)

        elif tx_in.type == TransactionType.DIVIDEND:
            # Versement de dividendes sur le compte
            if tx_in.auto_update_cash:
                account.cash_balance = round(account.cash_balance + (amount_eur / market_service.get_eur_rate(account.currency)), 2)
                session.add(account)

        # Catégorisation et enrichissement automatique si non spécifié
        category = tx_in.category
        if not category:
            from app.services.transaction_enricher import transaction_enricher
            enriched_fields = transaction_enricher.enrich_transaction_data({
                "type": tx_in.type.value if hasattr(tx_in.type, "value") else str(tx_in.type),
                "symbol": symbol,
                "name": name,
                "notes": tx_in.notes,
                "amount": amount,
            })
            category = enriched_fields.get("category")

        # Création de l'objet transaction
        transaction = Transaction(
            account_id=account.id,
            holding_id=holding.id if holding else None,
            type=tx_in.type,
            transaction_date=tx_in.transaction_date or date.today(),
            symbol=symbol,
            name=name,
            quantity=tx_in.quantity,
            unit_price=unit_price,
            unit_price_eur=unit_price_eur,
            amount=round(amount, 2),
            amount_eur=amount_eur,
            fees=fees,
            fees_eur=fees_eur,
            currency=currency,
            category=category,
            external_id=tx_in.external_id,
            realized_gain_eur=realized_gain_eur,
            notes=tx_in.notes,
        )

        session.add(transaction)
        session.commit()
        session.refresh(transaction)
        return transaction

    @staticmethod
    def delete_transaction(session: Session, transaction_id: int) -> bool:
        """
        Supprime une transaction en réajustant automatiquement le solde espèces
        du compte et en recalculant la position (quantité et PRU) depuis l'historique complet.
        """
        tx = session.get(Transaction, transaction_id)
        if not tx:
            return False

        account = session.get(Account, tx.account_id)
        holding_id = tx.holding_id
        tx_type = tx.type
        amount_eur = tx.amount_eur or 0.0

        # Si holding_id absent mais symbole présent sur le compte, retrouver la position
        if not holding_id and tx.symbol and account:
            clean_sym = tx.symbol.strip().upper()
            found_holding = session.exec(
                select(Holding)
                .where(Holding.account_id == account.id)
                .where(Holding.symbol == clean_sym)
            ).first()
            if found_holding:
                holding_id = found_holding.id

        # 1. Réajustement automatique du solde espèces du compte
        if account and amount_eur > 0:
            rate = market_service.get_eur_rate(account.currency) or 1.0
            cash_impact = amount_eur / rate

            if tx_type == TransactionType.BUY:
                # Un achat avait débité le compte -> on recrédite
                account.cash_balance = round(account.cash_balance + cash_impact, 2)
            elif tx_type in (TransactionType.SELL, TransactionType.DEPOSIT, TransactionType.DIVIDEND):
                # Une vente / versement / dividende avait crédité le compte -> on redébite
                account.cash_balance = round(account.cash_balance - cash_impact, 2)
            elif tx_type == TransactionType.WITHDRAWAL:
                # Un retrait avait débité le compte -> on recrédite
                account.cash_balance = round(account.cash_balance + cash_impact, 2)

            session.add(account)

        # 2. Suppression de la transaction
        session.delete(tx)
        session.commit()

        # 3. Recalcul propre de la position depuis l'historique restant
        if holding_id:
            TransactionService.recalculate_holding_pru(session, holding_id)

        return True

    @staticmethod
    def get_transaction_stats(session: Session) -> Dict[str, Any]:
        """Agrège les statistiques financières des transactions avec auto-réparation des gains réalisés."""
        # Vérification si des ventes n'ont pas encore leur plus-value réalisée calculée
        uncalc = session.exec(
            select(Transaction)
            .where(Transaction.type == TransactionType.SELL)
            .where(Transaction.realized_gain_eur == None)  # noqa: E711
        ).first()
        if uncalc:
            TransactionService.recalculate_all_realized_gains(session)

        tx_rows = session.exec(
            select(Transaction, Account)
            .outerjoin(Account, Transaction.account_id == Account.id)
        ).all()

        total_dividends = 0.0
        total_realized_gain = 0.0
        total_deposits = 0.0
        total_withdrawals = 0.0
        investment_deposits = 0.0
        investment_withdrawals = 0.0
        total_buys = 0.0
        total_sells = 0.0
        total_fees = 0.0

        for t, acc in tx_rows:
            total_fees += t.fees_eur or 0.0
            is_inv = acc and (acc.account_type in INVESTMENT_ACCOUNT_TYPES)

            if t.type == TransactionType.DIVIDEND:
                total_dividends += t.amount_eur or 0.0
            elif t.type == TransactionType.SELL:
                total_sells += t.amount_eur or 0.0
                if t.realized_gain_eur is not None:
                    total_realized_gain += t.realized_gain_eur
            elif t.type == TransactionType.BUY:
                total_buys += t.amount_eur or 0.0
            elif t.type == TransactionType.DEPOSIT:
                total_deposits += t.amount_eur or 0.0
                if is_inv:
                    investment_deposits += t.amount_eur or 0.0
            elif t.type == TransactionType.WITHDRAWAL:
                total_withdrawals += t.amount_eur or 0.0
                if is_inv:
                    investment_withdrawals += t.amount_eur or 0.0

        return {
            "total_transactions": len(tx_rows),
            "total_dividends_eur": round(total_dividends, 2),
            "total_realized_gain_eur": round(total_realized_gain, 2),
            "total_deposits_eur": round(total_deposits, 2),
            "total_withdrawals_eur": round(total_withdrawals, 2),
            "net_deposits_eur": round(total_deposits - total_withdrawals, 2),
            "investment_deposits_eur": round(investment_deposits, 2),
            "investment_withdrawals_eur": round(investment_withdrawals, 2),
            "net_investment_deposits_eur": round(investment_deposits - investment_withdrawals, 2),
            "total_buys_eur": round(total_buys, 2),
            "total_sells_eur": round(total_sells, 2),
            "total_fees_eur": round(total_fees, 2),
        }

    @staticmethod
    def recalculate_holding_pru(session: Session, holding_id: int) -> Optional[Holding]:
        """
        Reconstitue l'historique d'un actif depuis ses transactions pour recalculer
        avec exactitude mathématique la quantité restante, le PRU pondéré
        et la plus-value réalisée (realized_gain_eur) sur chaque ordre de vente.
        Préserve la position d'ouverture initiale (initial_quantity et initial_unit_cost_eur).
        """
        holding = session.get(Holding, holding_id)
        if not holding:
            return None

        txs = session.exec(
            select(Transaction)
            .where(Transaction.holding_id == holding_id)
            .order_by(Transaction.transaction_date.asc(), Transaction.id.asc())
        ).all()

        # Démarrer avec la position initiale saisie lors de la création de la position
        total_qty = holding.initial_quantity or 0.0
        total_cost_eur = total_qty * (holding.initial_unit_cost_eur or 0.0)

        for t in txs:
            if t.type == TransactionType.BUY:
                q = t.quantity or 0.0
                p_eur = t.unit_price_eur or 0.0
                f_eur = t.fees_eur or 0.0
                cost = ((q * p_eur) + f_eur) if p_eur > 0 else (t.amount_eur or 0.0)
                total_cost_eur += cost
                total_qty += q
            elif t.type == TransactionType.SELL:
                q = t.quantity or 0.0
                sale_proceeds = t.amount_eur or ((q * (t.unit_price_eur or 0.0)) - (t.fees_eur or 0.0))

                if total_qty > 0:
                    current_pru = total_cost_eur / total_qty
                    cost_basis = q * current_pru
                    realized_gain = round(sale_proceeds - cost_basis, 2)
                    total_qty = max(0.0, total_qty - q)
                    total_cost_eur = total_qty * current_pru
                else:
                    # Si quantité préalable inconnue ou nulle, repli sur le coût unitaire du holding
                    fallback_pru = holding.unit_cost_eur or holding.initial_unit_cost_eur or (t.unit_price_eur or 0.0)
                    cost_basis = q * fallback_pru
                    realized_gain = round(sale_proceeds - cost_basis, 2)
                    total_qty = 0.0
                    total_cost_eur = 0.0

                if t.realized_gain_eur != realized_gain:
                    t.realized_gain_eur = realized_gain
                    session.add(t)

        holding.quantity = round(total_qty, 6)
        if total_qty > 0:
            holding.unit_cost_eur = round(total_cost_eur / total_qty, 4)
            eur_rate = market_service.get_eur_rate(holding.currency or "EUR")
            holding.unit_cost = round(holding.unit_cost_eur / eur_rate, 4)
        else:
            holding.quantity = 0.0

        session.add(holding)
        session.commit()
        session.refresh(holding)
        return holding

    @staticmethod
    def recalculate_all_realized_gains(session: Session) -> int:
        """
        Parcourt l'ensemble des comptes et positions pour réconcilier toutes les ventes
        et persister les gains nets réalisés exacts (realized_gain_eur).
        Associe également les transactions orphelines (holding_id absent) par symbole.
        """
        # 1. Rattacher les transactions orphelines qui ont un symbole mais pas de holding_id
        orphan_txs = session.exec(
            select(Transaction)
            .where(Transaction.holding_id == None)  # noqa: E711
            .where(Transaction.symbol != None)  # noqa: E711
        ).all()

        for otx in orphan_txs:
            if not otx.symbol:
                continue
            sym = otx.symbol.strip().upper()
            h = session.exec(
                select(Holding)
                .where(Holding.account_id == otx.account_id)
                .where(Holding.symbol == sym)
            ).first()
            if h:
                otx.holding_id = h.id
                session.add(otx)

        session.commit()

        # 2. Recalculer le PRU et les gains de chaque holding existant
        holdings = session.exec(select(Holding)).all()
        for h in holdings:
            TransactionService.recalculate_holding_pru(session, h.id)

        # 3. Traiter d'éventuelles ventes orphelines restantes sans holding_id
        unlinked_sells = session.exec(
            select(Transaction)
            .where(Transaction.type == TransactionType.SELL)
            .where(Transaction.realized_gain_eur == None)  # noqa: E711
        ).all()

        updated_count = 0
        for s in unlinked_sells:
            if s.symbol and s.account_id:
                buys = session.exec(
                    select(Transaction)
                    .where(Transaction.account_id == s.account_id)
                    .where(Transaction.symbol == s.symbol)
                    .where(Transaction.type == TransactionType.BUY)
                    .where(Transaction.transaction_date <= s.transaction_date)
                    .order_by(Transaction.transaction_date.asc())
                ).all()
                if buys:
                    total_buy_qty = sum(b.quantity or 0.0 for b in buys)
                    total_buy_cost = sum(
                        ((b.quantity or 0.0) * (b.unit_price_eur or 0.0)) + (b.fees_eur or 0.0)
                        if (b.unit_price_eur or 0.0) > 0 else (b.amount_eur or 0.0)
                        for b in buys
                    )
                    if total_buy_qty > 0:
                        pru = total_buy_cost / total_buy_qty
                        q = s.quantity or 0.0
                        sale_amt = s.amount_eur or ((q * (s.unit_price_eur or 0.0)) - (s.fees_eur or 0.0))
                        s.realized_gain_eur = round(sale_amt - (q * pru), 2)
                        session.add(s)
                        updated_count += 1

        session.commit()
        logger.info(f"Recalcul automatique des gains réalisés terminé ({len(holdings)} holdings vérifiés).")
        return updated_count


transaction_service = TransactionService()

