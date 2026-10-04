"""
Service de cotations boursières & devises via Yahoo Finance.
Cache intelligent avec TTL configurable.
"""
import logging
import time
from typing import Dict, Any, List

import yfinance as yf

from app.config import MARKET_CACHE_TTL, CURRENCY_CACHE_TTL

logger = logging.getLogger("market_service")


class MarketService:
    def __init__(self, cache_ttl: int = MARKET_CACHE_TTL):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = cache_ttl
        self._currency_rates: Dict[str, float] = {"EUR": 1.0}
        self._currency_cache_times: Dict[str, float] = {}
        self._names_cache: Dict[str, str] = {}


    # ────────────────────── Devises ──────────────────────

    def get_eur_rate(self, from_currency: str) -> float:
        """Retourne le taux de conversion ``from_currency`` → EUR."""
        curr = from_currency.upper().strip()
        if curr in ("EUR", ""):
            return 1.0

        now = time.time()
        last_fetch = self._currency_cache_times.get(curr, 0.0)
        if (now - last_fetch) < CURRENCY_CACHE_TTL and curr in self._currency_rates:
            return self._currency_rates[curr]

        try:
            pair = f"{curr}EUR=X"
            ticker = yf.Ticker(pair)
            price = ticker.fast_info.get("lastPrice")

            if not price:
                inv_pair = f"EUR{curr}=X"
                inv_ticker = yf.Ticker(inv_pair)
                inv_price = inv_ticker.fast_info.get("lastPrice")
                if inv_price and inv_price > 0:
                    price = 1.0 / inv_price

            if price and price > 0:
                self._currency_rates[curr] = float(price)
                self._currency_cache_times[curr] = now
                return float(price)
        except Exception as e:
            logger.warning(f"Taux de change indisponible pour {curr}: {e}")

        # Valeurs de secours usuelles
        fallback = {"USD": 0.92, "GBP": 1.17, "CHF": 1.05, "CAD": 0.68, "JPY": 0.006}
        return fallback.get(curr, 1.0)

    # ────────────────────── Cotations ──────────────────────

    def get_quote(self, symbol: str, force_refresh: bool = False) -> Dict[str, Any]:
        """Récupère la cotation en direct d'un symbole boursier, ETF ou crypto."""
        clean = symbol.strip().upper()
        # Normalisation automatique des actions allemandes et ETF
        alias_map = {
            "SIE": "SIE.DE",
            "VOW3": "VOW3.DE",
            "CSX5.PA": "CSX5.AS",
            "853292": "BMW.DE",
            "IUSA": "IUSA.DE",
            "BTC": "BTC-EUR",
        }
        lookup_symbol = alias_map.get(clean, clean)
        now = time.time()

        # Vérification du cache
        if not force_refresh and clean in self._cache:
            entry = self._cache[clean]
            if now - entry["timestamp"] < self.cache_ttl:
                return entry["data"]

        try:
            ticker = yf.Ticker(lookup_symbol)
            fast = ticker.fast_info

            current_price = fast.get("lastPrice")
            prev_close = fast.get("previousClose") or fast.get("regularMarketPreviousClose")
            currency = fast.get("currency") or "EUR"

            # Fallback sur l'historique si prix absent (marché fermé, ticker exotique)
            if not current_price:
                hist = ticker.history(period="5d")
                if not hist.empty:
                    current_price = float(hist["Close"].iloc[-1])
                    if len(hist) > 1:
                        prev_close = float(hist["Close"].iloc[-2])
                    else:
                        prev_close = current_price

            # Récupérer le nom officiel (mis en cache permanente pour éviter les appels lents à ticker.info)
            if clean in self._names_cache:
                name = self._names_cache[clean]
            else:
                name = clean
                try:
                    info = ticker.info
                    name = info.get("shortName") or info.get("longName") or clean
                except Exception:
                    pass
                if name and name != clean:
                    self._names_cache[clean] = name


            eur_rate = self.get_eur_rate(currency)
            price_eur = current_price * eur_rate if current_price else None

            change_day_pct = 0.0
            if current_price and prev_close and prev_close > 0:
                change_day_pct = ((current_price - prev_close) / prev_close) * 100

            data: Dict[str, Any] = {
                "symbol": clean,
                "name": name,
                "current_price": round(current_price, 4) if current_price else None,
                "current_price_eur": round(price_eur, 4) if price_eur else None,
                "previous_close": round(prev_close, 4) if prev_close else None,
                "change_day_percent": round(change_day_pct, 2),
                "currency": currency,
                "eur_rate": round(eur_rate, 4),
                "success": current_price is not None,
            }

            self._cache[clean] = {"data": data, "timestamp": now}
            return data

        except Exception as e:
            logger.error(f"Erreur cotation {clean}: {e}")
            return {
                "symbol": clean,
                "name": clean,
                "current_price": None,
                "current_price_eur": None,
                "previous_close": None,
                "change_day_percent": 0.0,
                "currency": "EUR",
                "eur_rate": 1.0,
                "success": False,
                "error": str(e),
            }

    # ────────────────────── Cache ──────────────────────

    def clear_cache(self) -> None:
        """Vide le cache des cotations et des devises."""
        self._cache.clear()
        self._currency_rates = {"EUR": 1.0}
        self._currency_cache_time = 0.0

    # ────────────────────── Recherche ──────────────────────

    def search_symbol(self, query: str) -> List[Dict[str, Any]]:
        """Recherche de suggestions de tickers boursiers."""
        clean_q = query.strip()
        if not clean_q:
            return []

        POPULAR: List[Dict[str, str]] = [
            {"symbol": "CW8.PA",    "name": "Amundi MSCI World UCITS ETF (PEA)",       "asset_class": "etf"},
            {"symbol": "EWLD.PA",   "name": "Lyxor PEA MSCI World UCITS ETF (PEA)",    "asset_class": "etf"},
            {"symbol": "ESE.PA",    "name": "BNP Paribas Easy S&P 500 UCITS ETF (PEA)","asset_class": "etf"},
            {"symbol": "PE500.PA",  "name": "Amundi PEA S&P 500 UCITS ETF (PEA)",      "asset_class": "etf"},
            {"symbol": "PAASI.PA",  "name": "Amundi PEA MSCI Emerging Asia (PEA)",      "asset_class": "etf"},
            {"symbol": "AI.PA",     "name": "Air Liquide SA",                            "asset_class": "stock"},
            {"symbol": "MC.PA",     "name": "LVMH Moët Hennessy",                       "asset_class": "stock"},
            {"symbol": "OR.PA",     "name": "L'Oréal SA",                               "asset_class": "stock"},
            {"symbol": "TTE.PA",    "name": "TotalEnergies SE",                          "asset_class": "stock"},
            {"symbol": "SAN.PA",    "name": "Sanofi SA",                                 "asset_class": "stock"},
            {"symbol": "AAPL",      "name": "Apple Inc.",                                "asset_class": "stock"},
            {"symbol": "MSFT",      "name": "Microsoft Corporation",                     "asset_class": "stock"},
            {"symbol": "NVDA",      "name": "NVIDIA Corporation",                        "asset_class": "stock"},
            {"symbol": "AMZN",      "name": "Amazon.com, Inc.",                          "asset_class": "stock"},
            {"symbol": "GOOGL",     "name": "Alphabet Inc.",                             "asset_class": "stock"},
            {"symbol": "BTC-EUR",   "name": "Bitcoin (EUR)",                             "asset_class": "crypto"},
            {"symbol": "ETH-EUR",   "name": "Ethereum (EUR)",                            "asset_class": "crypto"},
            {"symbol": "SOL-EUR",   "name": "Solana (EUR)",                              "asset_class": "crypto"},
        ]

        q_upper = clean_q.upper()
        results = [
            t for t in POPULAR
            if q_upper in t["symbol"] or q_upper in t["name"].upper()
        ]

        # Si le ticker tapé n'est pas dans les populaires, valider en direct
        if not any(r["symbol"] == q_upper for r in results):
            quote = self.get_quote(q_upper)
            if quote.get("success"):
                results.insert(0, {
                    "symbol": quote["symbol"],
                    "name": quote["name"],
                    "asset_class": "stock",
                    "price": quote["current_price"],
                    "currency": quote["currency"],
                })

        return results[:8]


# Singleton du service marché
market_service = MarketService()
