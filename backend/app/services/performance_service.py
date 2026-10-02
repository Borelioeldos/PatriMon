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
    PortfolioSnapshot, Transaction, TransactionType, Account
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

        # Récupérer tous les versements et retraits groupés par date
        txs = session.exec(
            select(Transaction)
            .where(Transaction.type.in_([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]))
            .order_by(Transaction.transaction_date.asc())
        ).all()

        daily_external_flows: Dict[date, float] = {}
        for t in txs:
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
                }
            return {
                "twr": 0.0,
                "twr_percent": 0.0,
                "annualized_twr_percent": 0.0,
                "days": 0,
            }

        # Chaînage des rendements de sous-périodes
        compound_factor = 1.0

        for i in range(1, len(snapshots)):
            prev = snapshots[i - 1]
            curr = snapshots[i]

            prev_val = prev.total_net_worth
            curr_val = curr.total_net_worth

            cf = daily_external_flows.get(curr.snapshot_date, 0.0)
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
        }

    # ────────────────────── Calcul du MWR / TRI (XIRR) ──────────────────────

    @staticmethod
    def calculate_mwr(session: Session, current_net_worth: float, current_invested: float) -> Dict[str, Any]:
        """
        Calcule le Money-Weighted Return / TRI (Taux de Rendement Interne).
        Prend en compte la date exacte de chaque flux de capitaux.
        """
        today = date.today()

        # Récupérer les transactions de versements / retraits
        txs = session.exec(
            select(Transaction)
            .where(Transaction.type.in_([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]))
            .order_by(Transaction.transaction_date.asc())
        ).all()

        cash_flows: List[Tuple[date, float]] = []

        total_dep = sum(t.amount_eur for t in txs if t.type == TransactionType.DEPOSIT)
        total_with = sum(t.amount_eur for t in txs if t.type == TransactionType.WITHDRAWAL)
        net_deposits = total_dep - total_with

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

    # ────────────────────── Synthèse Globale ──────────────────────

    @classmethod
    def get_full_performance_metrics(
        cls, session: Session, total_net_worth: float, total_invested: float
    ) -> Dict[str, Any]:
        """Retourne l'ensemble des KPIs de performance réelle (TWR, MWR, dividendes, plus-values)."""
        stats = transaction_service.get_transaction_stats(session)
        twr_data = cls.calculate_twr(session, total_net_worth, total_invested)
        mwr_data = cls.calculate_mwr(session, total_net_worth, total_invested)

        return {
            "twr": twr_data,
            "mwr": mwr_data,
            "stats": stats,
        }


performance_service = PerformanceService()
