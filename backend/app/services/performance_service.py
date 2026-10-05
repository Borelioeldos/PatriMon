"""
PatriMon — Service de calcul des métriques de performance financière avancées.
Calcule :
- TWR (Time-Weighted Return) : performance intrinsèque indépendante des dépôts/retraits.
- MWR / TRI (Money-Weighted Return / Taux de Rendement Interne / XIRR).
- Synthèse des dividendes et plus-values réalisées.
"""
import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Tuple, Optional
from sqlmodel import Session, select

from app.models import (
    PortfolioSnapshot, Transaction, TransactionType, Account, INVESTMENT_ACCOUNT_TYPES
)
from app.services.transaction_service import transaction_service

logger = logging.getLogger("performance_service")


class PerformanceService:

    # ────────────────────── Algorithme XIRR (TRI) ──────────────────────

    @staticmethod
    def _xirr(cash_flows: List[Tuple[date, float]], guess: float = 0.1) -> Optional[float]:
        """
        Calcule le Taux de Rendement Interne (XIRR) pour des flux de trésorerie à dates irrégulières.
        cash_flows: liste de tuples (date, montant).
        Convention : les investissements / dépôts sont négatifs, la valeur finale / retraits sont positifs.
        """
        if len(cash_flows) < 2:
            return None

        # Trier chronologiquement
        sorted_flows = sorted(cash_flows, key=lambda x: x[0])
        d0 = sorted_flows[0][0]

        # Vérifier qu'il y a au moins un flux négatif et un flux positif
        has_pos = any(cf[1] > 0 for cf in sorted_flows)
        has_neg = any(cf[1] < 0 for cf in sorted_flows)
        if not (has_pos and has_neg):
            return None

        # Convertir en jours écoulés
        dated_flows = [
            ((cf[0] - d0).days / 365.25, cf[1])
            for cf in sorted_flows
        ]

        def npv(rate: float) -> float:
            if rate <= -0.9999:
                return float("inf")
            total = 0.0
            for t, amount in dated_flows:
                total += amount / ((1.0 + rate) ** t)
            return total

        def npv_prime(rate: float) -> float:
            if rate <= -0.9999:
                return float("-inf")
            total = 0.0
            for t, amount in dated_flows:
                if t > 0:
                    total -= t * amount / ((1.0 + rate) ** (t + 1.0))
            return total

        # Tentative par méthode de Newton-Raphson
        r = guess
        for _ in range(50):
            val = npv(r)
            deriv = npv_prime(r)
            if abs(deriv) < 1e-10:
                break
            new_r = r - (val / deriv)
            if new_r <= -0.99 or new_r > 50.0:  # Borne de sécurité
                break
            if abs(new_r - r) < 1e-6:
                return new_r
            r = new_r

        # Secours : dichotomie (bisection) bornée entre -95% et +500%
        low = -0.95
        high = 50.0
        val_low = npv(low)
        val_high = npv(high)

        if val_low * val_high > 0:
            # Pas de changement de signe dans l'intervalle usuel
            return None

        for _ in range(60):
            mid = (low + high) / 2.0
            val_mid = npv(mid)
            if abs(val_mid) < 1e-5:
                return mid
            if val_low * val_mid < 0:
                high = mid
                val_high = val_mid
            else:
                low = mid
                val_low = val_mid

        return (low + high) / 2.0

    # ────────────────────── Calcul du TWR (Time-Weighted Return) ──────────────────────

    @staticmethod
    def calculate_twr(session: Session, current_net_worth: float, current_invested: float) -> Dict[str, Any]:
        """
        Calcule le Time-Weighted Return (TWR).
        Neutralise l'impact des dépôts/retraits pour isoler la rentabilité financière pure des placements.
        """
        snapshots = session.exec(
            select(PortfolioSnapshot)
            .order_by(PortfolioSnapshot.snapshot_date.asc())
        ).all()

        # Récupérer les versements et retraits groupés par date UNIQUEMENT sur les comptes d'investissement
        tx_rows = session.exec(
            select(Transaction, Account)
            .join(Account, Transaction.account_id == Account.id)
            .where(Transaction.type.in_([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]))
            .where(Account.account_type.in_(INVESTMENT_ACCOUNT_TYPES))
            .order_by(Transaction.transaction_date.asc())
        ).all()

        daily_external_flows: Dict[date, float] = {}
        for t, _ in tx_rows:
            d = t.transaction_date
            flow = t.amount_eur if t.type == TransactionType.DEPOSIT else -t.amount_eur
            daily_external_flows[d] = daily_external_flows.get(d, 0.0) + flow

        # S'il y a moins de 2 snapshots, utiliser le rendement simple de la position actuelle
        if len(snapshots) < 2:
            if current_invested > 0:
                simple_return = (current_net_worth - current_invested) / current_invested
                return {
                    "twr": simple_return,
                    "twr_percent": round(simple_return * 100, 2),
                    "annualized_twr_percent": round(simple_return * 100, 2),
                    "days": 1,
                    "is_fallback": True,
                }
            return {
                "twr": 0.0,
                "twr_percent": 0.0,
                "annualized_twr_percent": 0.0,
                "days": 0,
                "is_fallback": True,
            }

        # Chaînage des rendements de sous-périodes
        compound_factor = 1.0

        for i in range(1, len(snapshots)):
            prev = snapshots[i - 1]
            curr = snapshots[i]

            prev_val = prev.investment_net_worth if (prev.investment_net_worth is not None and prev.investment_net_worth > 0) else prev.total_net_worth
            curr_val = curr.investment_net_worth if (curr.investment_net_worth is not None and curr.investment_net_worth > 0) else curr.total_net_worth

            # Neutraliser TOUS les flux externes tombés dans l'intervalle ]prev.snapshot_date, curr.snapshot_date]
            cf = sum(
                flow for d, flow in daily_external_flows.items()
                if prev.snapshot_date < d <= curr.snapshot_date
            )
            base_val = prev_val + cf

            if base_val > 0:
                sub_return = (curr_val - base_val) / base_val
                sub_return = max(-0.9, min(sub_return, 5.0))
                compound_factor *= (1.0 + sub_return)

        twr = compound_factor - 1.0

        first_date = snapshots[0].snapshot_date
        last_date = snapshots[-1].snapshot_date
        days = max(1, (last_date - first_date).days)

        if days >= 30 and (1.0 + twr) > 0:
            ann_twr = ((1.0 + twr) ** (365.25 / days)) - 1.0
        else:
            ann_twr = twr

        return {
            "twr": twr,
            "twr_percent": round(twr * 100, 2),
            "annualized_twr_percent": round(ann_twr * 100, 2),
            "days": days,
            "is_fallback": False,
        }

    # ────────────────────── Calcul du MWR / TRI (XIRR) ──────────────────────

    @staticmethod
    def calculate_mwr(
        session: Session, current_net_worth: float, current_invested: float, account_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Calcule le Money-Weighted Return / TRI (Taux de Rendement Interne).
        Prend en compte la date exacte de chaque flux de capitaux sur le périmètre investissement
        (ou sur un compte d'investissement spécifique si account_id est renseigné).
        """
        today = date.today()

        if account_id is not None:
            # Flux spécifiques à ce compte
            tx_rows = session.exec(
                select(Transaction, Account)
                .join(Account, Transaction.account_id == Account.id)
                .where(Transaction.account_id == account_id)
                .where(Transaction.type.in_([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]))
                .order_by(Transaction.transaction_date.asc())
            ).all()
        else:
            # Récupérer les transactions de versements / retraits sur tous les comptes d'investissement
            tx_rows = session.exec(
                select(Transaction, Account)
                .join(Account, Transaction.account_id == Account.id)
                .where(Transaction.type.in_([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]))
                .where(Account.account_type.in_(INVESTMENT_ACCOUNT_TYPES))
                .order_by(Transaction.transaction_date.asc())
            ).all()

        txs = [r[0] for r in tx_rows]
        cash_flows: List[Tuple[date, float]] = []

        total_dep = sum(t.amount_eur for t in txs if t.type == TransactionType.DEPOSIT)
        total_with = sum(t.amount_eur for t in txs if t.type == TransactionType.WITHDRAWAL)
        net_deposits = total_dep - total_with

        # S'il n'y a pas de dépôts explicites pour ce compte (ex: PEA avec avis d'opérés d'achats purs),
        # utiliser les dates des ordres d'achat comme dates d'apport en capital
        if not txs and account_id is not None:
            buy_txs = session.exec(
                select(Transaction)
                .where(Transaction.account_id == account_id)
                .where(Transaction.type == TransactionType.BUY)
                .order_by(Transaction.transaction_date.asc())
            ).all()
            if buy_txs:
                total_bought = sum(b.amount_eur for b in buy_txs)
                cash_remain = max(0.0, current_invested - total_bought)
                earliest = buy_txs[0].transaction_date
                if cash_remain > 0:
                    cash_flows.append((earliest, -cash_remain))
                for b in buy_txs:
                    cash_flows.append((b.transaction_date, -abs(b.amount_eur)))

        if not cash_flows:
            # Réconciliation du capital initial antérieur au journal
            untracked_capital = max(0.0, current_invested - net_deposits)
            earliest_date = txs[0].transaction_date if txs else (today - timedelta(days=60))

            if untracked_capital > 0:
                cash_flows.append((earliest_date, -untracked_capital))

            for t in txs:
                if t.type == TransactionType.DEPOSIT:
                    cash_flows.append((t.transaction_date, -abs(t.amount_eur)))
                elif t.type == TransactionType.WITHDRAWAL:
                    cash_flows.append((t.transaction_date, abs(t.amount_eur)))

        # Point final : valeur de liquidation aujourd'hui
        if current_net_worth > 0:
            cash_flows.append((today, current_net_worth))

        gain_pct = ((current_net_worth - current_invested) / current_invested * 100) if current_invested > 0 else 0.0
        earliest_flow_date = min((cf[0] for cf in cash_flows), default=today)
        days = max(1, (today - earliest_flow_date).days)

        xirr_rate = PerformanceService._xirr(cash_flows)

        if xirr_rate is not None:
            # Si l'historique est court (< 90 jours), le XIRR annualisé exponentiel peut dépasser 100%
            # On affiche le rendement de la période pour plus de lisibilité, avec le taux annualisé en complément
            display_rate = xirr_rate if days >= 90 else (gain_pct / 100.0)
            return {
                "mwr": display_rate,
                "mwr_percent": round(display_rate * 100, 2),
                "annualized_mwr_percent": round(xirr_rate * 100, 2),
                "is_calculated": True,
                "is_annualized": days >= 90,
                "days": days,
            }
        else:
            return {
                "mwr": (gain_pct / 100),
                "mwr_percent": round(gain_pct, 2),
                "annualized_mwr_percent": round(gain_pct, 2),
                "is_calculated": False,
                "is_annualized": False,
                "days": days,
            }

    # ────────────────────── Analyse des Dividendes ──────────────────────

    @staticmethod
    def get_dividend_analytics(session: Session) -> Dict[str, Any]:
        """Analyse complète des dividendes perçus (par mois, année et actif)."""
        div_txs = session.exec(
            select(Transaction)
            .where(Transaction.type == TransactionType.DIVIDEND)
            .order_by(Transaction.transaction_date.asc())
        ).all()

        total_eur = 0.0
        by_year: Dict[str, float] = {}
        by_month: Dict[str, Dict[str, Any]] = {}
        by_asset: Dict[str, Dict[str, Any]] = {}

        MONTH_NAMES_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]

        for t in div_txs:
            amt = round(t.amount_eur or 0.0, 2)
            total_eur += amt
            d = t.transaction_date
            y_str = str(d.year)
            ym = f"{d.year}-{d.month:02d}"

            by_year[y_str] = round(by_year.get(y_str, 0.0) + amt, 2)

            if ym not in by_month:
                m_label = f"{MONTH_NAMES_FR[d.month - 1]} {d.year}"
                by_month[ym] = {
                    "period": ym,
                    "year": d.year,
                    "month": d.month,
                    "label": m_label,
                    "amount_eur": 0.0,
                    "count": 0,
                }
            by_month[ym]["amount_eur"] = round(by_month[ym]["amount_eur"] + amt, 2)
            by_month[ym]["count"] += 1

            sym = t.symbol or "AUTRE"
            if sym not in by_asset:
                by_asset[sym] = {
                    "symbol": sym,
                    "name": t.name or sym,
                    "total_eur": 0.0,
                    "count": 0,
                    "last_date": d.isoformat(),
                }
            by_asset[sym]["total_eur"] = round(by_asset[sym]["total_eur"] + amt, 2)
            by_asset[sym]["count"] += 1
            if d.isoformat() > by_asset[sym]["last_date"]:
                by_asset[sym]["last_date"] = d.isoformat()

        monthly_series = sorted(by_month.values(), key=lambda x: x["period"])
        assets_ranked = sorted(by_asset.values(), key=lambda x: x["total_eur"], reverse=True)

        return {
            "total_eur": round(total_eur, 2),
            "operations_count": len(div_txs),
            "by_year": by_year,
            "monthly_series": monthly_series,
            "assets_ranked": assets_ranked,
        }

    # ────────────────────── Ventilation de Performance par Compte ──────────────────────

    @classmethod
    def get_performance_by_account(
        cls, session: Session, accounts: List[Account], holdings_by_acc: Dict[int, List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        """Calcule la rentabilité financière détaillée pour chaque enveloppe d'investissement."""
        from app.services.market_service import market_service
        results = []

        for acc in accounts:
            if acc.account_type not in INVESTMENT_ACCOUNT_TYPES:
                continue

            acc_cash_eur = acc.cash_balance * market_service.get_eur_rate(acc.currency)
            acc_holdings = holdings_by_acc.get(acc.id, [])
            acc_holdings_val = sum(h["total_value_eur"] for h in acc_holdings)
            acc_invested_val = sum(h["total_invested_eur"] for h in acc_holdings)

            acc_net_worth = acc_cash_eur + acc_holdings_val
            acc_total_invested = acc_cash_eur + acc_invested_val

            acc_gain_eur = acc_net_worth - acc_total_invested
            acc_gain_pct = ((acc_gain_eur / acc_total_invested) * 100) if acc_total_invested > 0 else 0.0

            mwr_data = cls.calculate_mwr(session, acc_net_worth, acc_total_invested, account_id=acc.id)

            divs = session.exec(
                select(Transaction)
                .where(Transaction.account_id == acc.id)
                .where(Transaction.type == TransactionType.DIVIDEND)
            ).all()
            div_sum = sum(d.amount_eur or 0.0 for d in divs)

            sells = session.exec(
                select(Transaction)
                .where(Transaction.account_id == acc.id)
                .where(Transaction.type == TransactionType.SELL)
            ).all()
            realized_sum = sum(s.realized_gain_eur or 0.0 for s in sells)

            active_h = [h for h in acc_holdings if h.get("quantity", 0) > 0]
            closed_h = [h for h in acc_holdings if h.get("quantity", 0) <= 0]

            results.append({
                "account_id": acc.id,
                "name": acc.name,
                "institution": acc.institution,
                "account_type": acc.account_type.value,
                "color": acc.color or "#3B82F6",
                "net_worth_eur": round(acc_net_worth, 2),
                "invested_eur": round(acc_total_invested, 2),
                "gain_eur": round(acc_gain_eur, 2),
                "gain_percent": round(acc_gain_pct, 2),
                "mwr": mwr_data,
                "dividends_eur": round(div_sum, 2),
                "dividends_count": len(divs),
                "realized_gain_eur": round(realized_sum, 2),
                "active_holdings_count": len(active_h),
                "closed_holdings_count": len(closed_h),
            })

        return sorted(results, key=lambda x: x["net_worth_eur"], reverse=True)

    # ────────────────────── Synthèse Globale ──────────────────────

    @classmethod
    def get_full_performance_metrics(
        cls,
        session: Session,
        total_net_worth: float,
        total_invested: float,
        accounts: Optional[List[Account]] = None,
        holdings_by_acc: Optional[Dict[int, List[Dict[str, Any]]]] = None,
    ) -> Dict[str, Any]:
        """Retourne l'ensemble des KPIs de performance réelle (TWR, MWR, dividendes, plus-values, ventilation par compte et analytics dividendes)."""
        stats = transaction_service.get_transaction_stats(session)
        twr_data = cls.calculate_twr(session, total_net_worth, total_invested)
        mwr_data = cls.calculate_mwr(session, total_net_worth, total_invested)
        dividend_analytics = cls.get_dividend_analytics(session)

        by_account = []
        if accounts and holdings_by_acc is not None:
            by_account = cls.get_performance_by_account(session, accounts, holdings_by_acc)

        return {
            "twr": twr_data,
            "mwr": mwr_data,
            "stats": stats,
            "dividend_analytics": dividend_analytics,
            "by_account": by_account,
        }


performance_service = PerformanceService()
