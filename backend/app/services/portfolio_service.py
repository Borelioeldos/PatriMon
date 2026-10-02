"""
Service de valorisation du portefeuille.
Calcule les KPIs, l'allocation, et gère les snapshots journaliers.
"""
from datetime import date, datetime, timezone
from typing import Dict, Any, List

from sqlmodel import Session, select

from app.models import Account, Holding, PortfolioSnapshot, AssetClass
from app.services.market_service import market_service
from app.services.performance_service import performance_service


class PortfolioService:

    # ────────────────── Enrichissement d'une position ──────────────────

    @staticmethod
    def enrich_holding(holding: Holding, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Calcule les métriques en direct pour une ligne d'actif :
        valorisation actuelle, plus-value (basée sur unit_cost_eur permanent), devise.
        """
        current_price = holding.current_price
        currency = holding.currency or "EUR"
        name = holding.name
        change_day_pct = 0.0

        # ── Cas livret / liquidités : pas de risque, pas de cotation ──
        if holding.asset_class in (AssetClass.SAVINGS, AssetClass.CASH):
            return {
                "id": holding.id,
                "account_id": holding.account_id,
                "symbol": holding.symbol,
                "name": name or holding.symbol,
                "asset_class": holding.asset_class,
                "quantity": holding.quantity,
                "unit_cost": 1.0,
                "unit_cost_eur": 1.0,
                "current_price": 1.0,
                "current_price_eur": 1.0,
                "currency": "EUR",
                "total_value_eur": round(holding.quantity, 2),
                "total_invested_eur": round(holding.quantity, 2),
                "gain_eur": 0.0,
                "gain_percent": 0.0,
                "change_day_percent": 0.0,
                "is_manual": True,
                "notes": holding.notes,
            }

        # ── Cotation en direct pour titres cotés ──
        if not holding.is_manual and holding.symbol:
            quote = market_service.get_quote(holding.symbol, force_refresh=force_refresh)
            if quote.get("success") and quote.get("current_price"):
                current_price = quote["current_price"]
                currency = quote["currency"]
                change_day_pct = quote.get("change_day_percent", 0.0)
                if not holding.name or holding.name == holding.symbol:
                    name = quote["name"]

        # ── Conversion du prix actuel en EUR ──
        eur_rate = market_service.get_eur_rate(currency)
        price_eur = (current_price * eur_rate) if current_price is not None else 0.0

        # ── P&L basé sur le PRU en EUR (stocké au moment de l'achat) ──
        unit_cost_eur = holding.unit_cost_eur
        if unit_cost_eur == 0:
            # Fallback pour anciennes données sans unit_cost_eur
            unit_cost_eur = holding.unit_cost * eur_rate

        total_value_eur = holding.quantity * price_eur
        total_invested_eur = holding.quantity * unit_cost_eur
        gain_eur = total_value_eur - total_invested_eur
        gain_pct = ((gain_eur / total_invested_eur) * 100) if total_invested_eur > 0 else 0.0

        return {
            "id": holding.id,
            "account_id": holding.account_id,
            "symbol": holding.symbol,
            "name": name,
            "asset_class": holding.asset_class,
            "quantity": holding.quantity,
            "unit_cost": holding.unit_cost,
            "unit_cost_eur": round(unit_cost_eur, 2),
            "current_price": round(current_price, 4) if current_price else None,
            "current_price_eur": round(price_eur, 4) if price_eur else None,
            "currency": currency,
            "total_value_eur": round(total_value_eur, 2),
            "total_invested_eur": round(total_invested_eur, 2),
            "gain_eur": round(gain_eur, 2),
            "gain_percent": round(gain_pct, 2),
            "change_day_percent": round(change_day_pct, 2),
            "is_manual": holding.is_manual,
            "notes": holding.notes,
        }

    # ────────────────── Synthèse globale du patrimoine ──────────────────

    @classmethod
    def get_portfolio_summary(cls, session: Session, force_refresh: bool = False) -> Dict[str, Any]:
        """Génère la vue consolidée du patrimoine complet."""
        accounts = session.exec(select(Account)).all()
        holdings = session.exec(select(Holding)).all()

        total_net_worth = 0.0
        total_invested = 0.0
        total_cash = 0.0

        # Répartition par institution
        by_institution: Dict[str, Dict[str, Any]] = {}

        # Répartition par classe d'actifs
        by_asset_class: Dict[str, float] = {
            "Actions & ETF": 0.0,
            "Livrets & Épargne": 0.0,
            "Épargne Entreprise (PEE)": 0.0,
            "Crypto": 0.0,
            "Autre": 0.0,
        }

        # Enrichir toutes les positions et grouper par compte
        holdings_by_acc: Dict[int, List[Dict[str, Any]]] = {}
        all_enriched_holdings: List[Dict[str, Any]] = []

        for h in holdings:
            enriched = cls.enrich_holding(h, force_refresh=force_refresh)
            holdings_by_acc.setdefault(h.account_id, []).append(enriched)
            all_enriched_holdings.append(enriched)

        accounts_data: List[Dict[str, Any]] = []

        for acc in accounts:
            acc_cash_eur = acc.cash_balance * market_service.get_eur_rate(acc.currency)

            acc_holdings = holdings_by_acc.get(acc.id, [])
            acc_holdings_val = sum(h["total_value_eur"] for h in acc_holdings)
            acc_invested_val = sum(h["total_invested_eur"] for h in acc_holdings)

            acc_total_val = acc_cash_eur + acc_holdings_val
            acc_total_invested = acc_cash_eur + acc_invested_val

            # Cumuls globaux
            total_cash += acc_cash_eur
            total_net_worth += acc_total_val
            total_invested += acc_total_invested

            # ── Répartition par institution ──
            inst = acc.institution or "Autre"
            if inst not in by_institution:
                by_institution[inst] = {
                    "name": inst,
                    "total_value": 0.0,
                    "accounts_count": 0,
                    "color": acc.color or "#6B7280",
                }
            by_institution[inst]["total_value"] += acc_total_val
            by_institution[inst]["accounts_count"] += 1

            # ── Répartition par classe d'actifs ──
            # Cash du compte → catégorie Épargne
            if acc_cash_eur > 0:
                by_asset_class["Livrets & Épargne"] += acc_cash_eur

            for h in acc_holdings:
                val = h["total_value_eur"]
                ac = h["asset_class"]
                if ac in (AssetClass.STOCK, AssetClass.ETF):
                    by_asset_class["Actions & ETF"] += val
                elif ac == AssetClass.CRYPTO:
                    by_asset_class["Crypto"] += val
                elif ac in (AssetClass.SAVINGS, AssetClass.CASH):
                    by_asset_class["Livrets & Épargne"] += val
                elif ac == AssetClass.FUND or acc.account_type.value == "pee":
                    by_asset_class["Épargne Entreprise (PEE)"] += val
                else:
                    by_asset_class["Autre"] += val

            # ── Données enrichies du compte ──
            gain_eur = acc_total_val - acc_total_invested
            gain_pct = ((gain_eur / acc_total_invested) * 100) if acc_total_invested > 0 else 0.0

            accounts_data.append({
                "id": acc.id,
                "name": acc.name,
                "institution": acc.institution,
                "account_type": acc.account_type,
                "cash_balance": acc.cash_balance,
                "currency": acc.currency,
                "color": acc.color,
                "total_value_eur": round(acc_total_val, 2),
                "total_invested_eur": round(acc_total_invested, 2),
                "gain_eur": round(gain_eur, 2),
                "gain_percent": round(gain_pct, 2),
                "holdings": acc_holdings,
            })

        total_gain = total_net_worth - total_invested
        total_gain_pct = ((total_gain / total_invested) * 100) if total_invested > 0 else 0.0

        # ── Snapshot journalier automatique ──
        cls._record_daily_snapshot(
            session, total_net_worth, total_invested, total_gain, total_gain_pct
        )

        # ── Allocations pour graphiques ──
        allocation_institution = [
            {"name": k, "value": round(v["total_value"], 2), "color": v["color"]}
            for k, v in by_institution.items()
            if v["total_value"] > 0
        ]

        allocation_asset_class = [
            {"name": k, "value": round(v, 2)}
            for k, v in by_asset_class.items()
            if v > 0
        ]

        # ── Historique réel (snapshots uniquement, pas de simulation) ──
        snapshots = session.exec(
            select(PortfolioSnapshot)
            .order_by(PortfolioSnapshot.snapshot_date.asc())
            .limit(90)
        ).all()

        history = [
            {
                "date": s.snapshot_date.strftime("%d/%m"),
                "full_date": s.snapshot_date.isoformat(),
                "total_net_worth": s.total_net_worth,
                "total_invested": s.total_invested,
                "total_gain": s.total_gain,
            }
            for s in snapshots
        ]

        # ── Palmarès des performances par titre ──
        performance_by_asset = sorted(
            [
                {
                    "name": h["name"] or h["symbol"],
                    "symbol": h["symbol"],
                    "gain_eur": h["gain_eur"],
                    "gain_percent": h["gain_percent"],
                    "total_value_eur": h["total_value_eur"],
                    "asset_class": h["asset_class"],
                }
                for h in all_enriched_holdings
                if h["total_value_eur"] > 0
            ],
            key=lambda x: x["gain_percent"],
            reverse=True,
        )

        # ── Métriques de performance financière avancées (TWR, MWR / TRI, stats) ──
        perf_metrics = performance_service.get_full_performance_metrics(
            session, total_net_worth, total_invested
        )

        return {
            "total_net_worth": round(total_net_worth, 2),
            "total_invested": round(total_invested, 2),
            "total_cash": round(total_cash, 2),
            "total_gain": round(total_gain, 2),
            "total_gain_percent": round(total_gain_pct, 2),
            "accounts": accounts_data,
            "allocation_institution": allocation_institution,
            "allocation_asset_class": allocation_asset_class,
            "history": history,
            "performance_by_asset": performance_by_asset,
            "performance_metrics": perf_metrics,
            "updated_at": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        }

    # ────────────────── Snapshot journalier ──────────────────

    @staticmethod
    def _record_daily_snapshot(
        session: Session,
        total_net_worth: float,
        total_invested: float,
        total_gain: float,
        total_gain_percent: float,
    ) -> None:
        """Enregistre ou met à jour le snapshot de valorisation du jour."""
        if total_net_worth <= 0:
            return

        today = date.today()
        existing = session.exec(
            select(PortfolioSnapshot).where(PortfolioSnapshot.snapshot_date == today)
        ).first()

        if existing:
            existing.total_net_worth = round(total_net_worth, 2)
            existing.total_invested = round(total_invested, 2)
            existing.total_gain = round(total_gain, 2)
            existing.total_gain_percent = round(total_gain_percent, 2)
            session.add(existing)
        else:
            snapshot = PortfolioSnapshot(
                snapshot_date=today,
                total_net_worth=round(total_net_worth, 2),
                total_invested=round(total_invested, 2),
                total_gain=round(total_gain, 2),
                total_gain_percent=round(total_gain_percent, 2),
            )
            session.add(snapshot)

        session.commit()
