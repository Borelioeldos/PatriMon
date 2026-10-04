"""
PatriMon — Service de comparaison avec les indices de référence (Benchmarks).
Supporte :
- MSCI World (CW8.PA)
- S&P 500 (^GSPC)
- CAC 40 (^FCHI)
- Bitcoin (BTC-EUR)
"""
import logging
import time
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
import yfinance as yf
from sqlmodel import Session, select

from app.models import PortfolioSnapshot

logger = logging.getLogger("benchmark_service")

BENCHMARKS_INFO = {
    "CW8.PA": {"name": "MSCI World (Amundi PEA)", "symbol": "CW8.PA", "type": "ETF"},
    "^GSPC": {"name": "S&P 500", "symbol": "^GSPC", "type": "Index"},
    "^FCHI": {"name": "CAC 40", "symbol": "^FCHI", "type": "Index"},
    "BTC-EUR": {"name": "Bitcoin (EUR)", "symbol": "BTC-EUR", "type": "Crypto"},
}


class BenchmarkService:
    def __init__(self, cache_ttl_seconds: int = 1800):
        # Cache des historiques boursiers : key = f"{symbol}_{period}"
        self._history_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = cache_ttl_seconds

    def get_available_benchmarks(self) -> List[Dict[str, str]]:
        """Liste des indices disponibles pour comparaison."""
        return list(BENCHMARKS_INFO.values())

    def get_benchmark_history(self, symbol: str, period: str = "1mo") -> Dict[str, float]:
        """
        Récupère l'historique des prix de clôture quotidiens pour un symbole.
        Retourne un dictionnaire { 'YYYY-MM-DD': prix_cloture }.
        """
        clean_sym = symbol.strip().upper()
        cache_key = f"{clean_sym}_{period}"
        now = time.time()

        if cache_key in self._history_cache:
            entry = self._history_cache[cache_key]
            if now - entry["timestamp"] < self.cache_ttl:
                return entry["data"]

        try:
            ticker = yf.Ticker(clean_sym)
            hist = ticker.history(period=period)
            prices: Dict[str, float] = {}

            if not hist.empty:
                for idx, row in hist.iterrows():
                    d_str = idx.strftime("%Y-%m-%d")
                    close_val = float(row["Close"])
                    if close_val and close_val > 0:
                        prices[d_str] = round(close_val, 2)

            self._history_cache[cache_key] = {"data": prices, "timestamp": now}
            return prices
        except Exception as e:
            logger.error(f"Erreur récupération historique benchmark {clean_sym}: {e}")
            return {}

    def compare_with_portfolio(
        self,
        session: Session,
        benchmark_symbol: str = "CW8.PA",
        period: str = "1mo"
    ) -> Dict[str, Any]:
        """
        Compare la performance en % du portefeuille avec un indice de référence sur la même période.
        Normalise les deux courbes en base 0% à la date de départ.
        """
        clean_sym = benchmark_symbol.strip().upper()
        if clean_sym not in BENCHMARKS_INFO:
            clean_sym = "CW8.PA"

        bench_info = BENCHMARKS_INFO[clean_sym]
        bench_prices = self.get_benchmark_history(clean_sym, period=period)

        # Récupérer l'historique réel des snapshots du portefeuille
        all_snapshots = session.exec(
            select(PortfolioSnapshot)
            .order_by(PortfolioSnapshot.snapshot_date.asc())
        ).all()

        sorted_dates = sorted(bench_prices.keys())
        if sorted_dates and len(all_snapshots) > 1:
            min_bench_date = date.fromisoformat(sorted_dates[0])
            snapshots_in_period = [s for s in all_snapshots if s.snapshot_date >= min_bench_date]
            prior_snapshots = [s for s in all_snapshots if s.snapshot_date < min_bench_date]
            if prior_snapshots and (not snapshots_in_period or snapshots_in_period[0].snapshot_date > min_bench_date):
                snapshots = [prior_snapshots[-1]] + snapshots_in_period
            else:
                snapshots = snapshots_in_period
        else:
            snapshots = all_snapshots

        comparison_series: List[Dict[str, Any]] = []

        if len(snapshots) >= 2:
            base_snapshot = snapshots[0]
            base_worth = base_snapshot.total_net_worth or 1.0

            # Trouver le prix du benchmark à la date du premier snapshot ou la date la plus proche
            base_date_str = base_snapshot.snapshot_date.isoformat()

            # Prix initial du benchmark
            base_bench_price = bench_prices.get(base_date_str)
            if not base_bench_price and sorted_dates:
                # Trouver la date la plus proche égale ou postérieure
                matching_dates = [d for d in sorted_dates if d >= base_date_str]
                base_bench_price = bench_prices[matching_dates[0]] if matching_dates else bench_prices[sorted_dates[0]]

            if not base_bench_price or base_bench_price <= 0:
                base_bench_price = 1.0

            last_bench_price = base_bench_price

            for s in snapshots:
                d_str = s.snapshot_date.isoformat()
                port_pct = round(((s.total_net_worth - base_worth) / base_worth) * 100, 2)

                if d_str in bench_prices:
                    last_bench_price = bench_prices[d_str]

                bench_pct = round(((last_bench_price - base_bench_price) / base_bench_price) * 100, 2)
                alpha = round(port_pct - bench_pct, 2)

                comparison_series.append({
                    "date": s.snapshot_date.strftime("%d/%m"),
                    "full_date": d_str,
                    "portfolio_net_worth": s.total_net_worth,
                    "portfolio_pct": port_pct,
                    "benchmark_price": last_bench_price,
                    "benchmark_pct": bench_pct,
                    "alpha_pct": alpha,
                })
        else:
            # S'il y a un seul snapshot (ou 0), nous présentons l'évolution du benchmark sur la période
            # pour que l'utilisateur visualise immédiatement l'indice face à son point de valorisation !
            sorted_bench_dates = sorted(bench_prices.keys())
            if sorted_bench_dates:
                first_price = bench_prices[sorted_bench_dates[0]]
                current_worth = snapshots[0].total_net_worth if snapshots else 0.0

                for d_str in sorted_bench_dates:
                    p = bench_prices[d_str]
                    bench_pct = round(((p - first_price) / first_price) * 100, 2)
                    d_obj = datetime.strptime(d_str, "%Y-%m-%d")

                    comparison_series.append({
                        "date": d_obj.strftime("%d/%m"),
                        "full_date": d_str,
                        "portfolio_net_worth": current_worth,
                        "portfolio_pct": 0.0,
                        "benchmark_price": p,
                        "benchmark_pct": bench_pct,
                        "alpha_pct": -bench_pct,
                    })

        portfolio_total_return = comparison_series[-1]["portfolio_pct"] if comparison_series else 0.0
        benchmark_total_return = comparison_series[-1]["benchmark_pct"] if comparison_series else 0.0
        alpha = round(portfolio_total_return - benchmark_total_return, 2)

        return {
            "benchmark": bench_info,
            "available_benchmarks": list(BENCHMARKS_INFO.values()),
            "series": comparison_series,
            "portfolio_total_return_pct": portfolio_total_return,
            "benchmark_total_return_pct": benchmark_total_return,
            "alpha_pct": alpha,
            "outperforming": alpha >= 0,
        }


benchmark_service = BenchmarkService()
