"""
PatriMon — Service d'enrichissement et catégorisation automatique des transactions.
Nettoie les libellés bancaires bruts, détecte automatiquement le commerçant / tiers,
assigne intelligemment la catégorie de dépenses ou revenus, et pré-remplit les cotations de marché.
"""
import re
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import date

from app.models import TransactionType

logger = logging.getLogger("transaction_enricher")

# Catégories officielles PatriMon
CATEGORY_FOOD = "Alimentation & Courses"
CATEGORY_HOUSING = "Logement & Énergie"
CATEGORY_SALARY = "Revenus & Salaires"
CATEGORY_INVEST = "Investissement & Épargne"
CATEGORY_DIVIDENDS = "Dividendes & Intérêts"
CATEGORY_SUBSCRIPTIONS = "Abonnements & Médias"
CATEGORY_TRANSPORT = "Transports & Véhicule"
CATEGORY_HEALTH = "Santé & Bien-être"
CATEGORY_LEISURE = "Loisirs & Shopping"
CATEGORY_FEES = "Frais bancaires & Taxes"
CATEGORY_TRANSFER = "Virement interne"
CATEGORY_OTHER = "Autre"

ALL_CATEGORIES = [
    CATEGORY_FOOD,
    CATEGORY_HOUSING,
    CATEGORY_SALARY,
    CATEGORY_INVEST,
    CATEGORY_DIVIDENDS,
    CATEGORY_SUBSCRIPTIONS,
    CATEGORY_TRANSPORT,
    CATEGORY_HEALTH,
    CATEGORY_LEISURE,
    CATEGORY_FEES,
    CATEGORY_TRANSFER,
    CATEGORY_OTHER,
]

# Règles de classification basées sur mots-clés
# Règles de classification basées sur mots-clés
KEYWORD_RULES = [
    # Abonnements & Médias (doit être prioritaire sur les salaires pour Amazon Prime)
    (CATEGORY_SUBSCRIPTIONS, [
        r"amazon prime", r"prime video", r"netflix", r"spotify", r"apple\.com", r"itunes",
        r"deezer", r"disney", r"youtube", r"canal\+", r"free telecom", r"free mobile",
        r"\borange\b", r"\bsfr\b", r"bouygues tel", r"chatgpt", r"openai", r"google one",
        r"icloud", r"playstation", r"xbox"
    ]),
    # Alimentation & Courses
    (CATEGORY_FOOD, [
        r"uber\s*\*?\s*eats", r"deliveroo", r"just eat", r"carrefour", r"leclerc", r"auchan",
        r"monoprix", r"lidl", r"intermarche", r"picard", r"franprix", r"boulangerie",
        r"supermarche", r"hypermarche", r"casino", r"biocoop", r"naturalia", r"boucherie",
        r"grand frais", r"primeur", r"fruits?", r"legumes?", r"vival", r"bergerie",
        r"too good to go", r"boulanger", r"paul\b"
    ]),
    # Transports & Véhicule
    (CATEGORY_TRANSPORT, [
        r"citiz", r"leo&go", r"sncf", r"ratp", r"ter\b", r"tgv\b", r"uber\s*\*?\s*trip",
        r"uber(?!\s*\*?\s*eats)", r"\bbolt\b", r"\btaxi\b", r"parking", r"indigo",
        r"\blpa\b", r"q-park", r"station avia", r"\bavia\b", r"total access", r"station essence",
        r"shell", r"esso", r"bp france", r"electra", r"airserv", r"air\s*serv",
        r"peage", r"vinci autoroutes", r"aprr", r"sanef", r"blablacar", r"air france",
        r"easyjet", r"ryanair", r"lime", r"dott", r"tier", r"velib", r"velov"
    ]),
    # Investissement & Épargne
    (CATEGORY_INVEST, [
        r"defi d'epargne", r"défi d'épargne", r"\bcoffre\b", r"\bvault\b", r"\bpea\b",
        r"\bcw8\b", r"\bmsci\b", r"amundi", r"ishares", r"vanguard", r"achat titre",
        r"courtage", r"boursobank.*titre", r"\bbourse\b", r"binance", r"kraken",
        r"coinbase", r"\bcrypto\b", r"trade republic", r"degiro", r"revolut trading",
        r"bnp epargne", r"cardif", r"\bfcpe\b"
    ]),
    # Virement & Recharges
    (CATEGORY_TRANSFER, [
        r"top-up", r"recharge", r"virement", r"vir sepa", r"transfert", r"versement"
    ]),
    # Dividendes & Intérêts
    (CATEGORY_DIVIDENDS, [
        r"\bdividende\b", r"\bcoupon\b", r"interet.*livret", r"remuneration compte"
    ]),
    # Loisirs & Shopping
    (CATEGORY_LEISURE, [
        r"action\s*\d*", r"bon coin", r"leboncoin", r"amazon payments", r"amazon(?!\s*prime)",
        r"fnac", r"darty", r"zara", r"h&m", r"decathlon", r"cinema", r"pathe", r"ugc",
        r"restaurant", r"brasserie", r"bistrot", r"\bbar\b", r"\bpub\b", r"\bcafe\b",
        r"starbucks", r"mcdonald", r"burger king", r"ikea", r"leroy merlin"
    ]),
    # Logement & Énergie
    (CATEGORY_HOUSING, [
        r"\bedf\b", r"\bengie\b", r"totalenergies", r"total energies", r"veolia",
        r"suez", r"eau de paris", r"\bloyer\b", r"syndic", r"assurance habitation",
        r"direct energie", r"enedis", r"grdf"
    ]),
    # Santé & Bien-être
    (CATEGORY_HEALTH, [
        r"pharmacie", r"doctolib", r"medecin", r"dentiste", r"\bameli\b",
        r"mutuelle", r"\balan\b", r"harmonie mutuelle", r"optique", r"laboratoire",
        r"kinesitherapeute", r"hopital", r"clinique"
    ]),
    # Frais bancaires & Taxes
    (CATEGORY_FEES, [
        r"cotisation carte", r"frais de tenue", r"agios", r"commission intervention",
        r"frais bancaire", r"dgfip", r"tresor public", r"impot", r"taxe fonciere",
        r"taxe habitation"
    ]),
    # Revenus & Salaires
    (CATEGORY_SALARY, [
        r"\bsalaire\b", r"\bpaie\b", r"\bpaye\b", r"remuneration", r"schneider electric",
        r"virement employeur", r"\bcaf\b", r"\bcpam\b", r"pole emploi", r"france travail",
        r"prime d'activite", r"prime de fin d'annee", r"indemnite", r"remboursement cpam"
    ]),
]


class TransactionEnricher:
    """Moteur d'enrichissement et d'auto-remplissage des transactions."""

    @staticmethod
    def clean_label(raw_label: str) -> str:
        """
        Nettoie un libellé bancaire brut en supprimant les préfixes techniques,
        dates et identifiants cryptiques pour extraire un nom de commerçant clair.
        Ex: 'PAIEMENT CARTE 02/10 CARREFOUR CITY PARIS 75011' -> 'Carrefour City'
        """
        if not raw_label:
            return ""

        text = raw_label.strip()

        # Remplacement direct pour marchands très fréquents
        lower_t = text.lower()
        if "uber *eats" in lower_t or "uber eats" in lower_t:
            return "Uber Eats"
        if "citiz" in lower_t:
            return "Citiz LPA"
        if "top-up" in lower_t:
            return "Recharge Revolut"
        if "amazon prime" in lower_t:
            return "Amazon Prime"
        if "amazon payments" in lower_t:
            return "Amazon"
        if "electra" in lower_t:
            return "Electra Bornes"
        if "bon coin" in lower_t or "leboncoin" in lower_t:
            return "Leboncoin"
        if "station avia" in lower_t or ("avia" in lower_t and "station" in lower_t):
            return "Station Avia"
        if "grand frais" in lower_t:
            return "Grand Frais"
        if "carrefour" in lower_t:
            return "Carrefour"
        if "auchan" in lower_t:
            return "Auchan"
        if "action 4" in lower_t or "action " in lower_t:
            return "Action"
        if "indigo" in lower_t:
            return "Parking Indigo"
        if "lpa " in lower_t or lower_t.startswith("lpa"):
            return "Parking LPA"
        if "defi d'epargne" in lower_t or "défi d'épargne" in lower_t:
            return "Défi d'épargne Revolut"

        # Supprimer les préfixes bancaires courants
        prefixes = [
            r"^PAIEMENT\s+(PAR\s+)?CARTE(\s+(DU\s+)?\d{2}/\d{2}(/\d{2,4})?)?\s*",
            r"^ACHAT\s+CB(\s+\d{2}[\./]\d{2}[\./]\d{2,4})?\s*",
            r"^CB\s*\*[0-9]{4}\s*",
            r"^PRLV\s+SEPA\s*",
            r"^PRELEVEMENT\s+SEPA\s*",
            r"^VIR\s+SEPA\s*(RECU|EMIS)?\s*",
            r"^VIREMENT\s+DE\s*",
            r"^VIREMENT\s+EN\s+FAVEUR\s+DE\s*",
            r"^VIREMENT\s+INTERNET\s*",
            r"^RETRAIT\s+DAB\s*",
            r"^FACTURE\s*",
            r"^COTIS\s*",
            r"^NYX\*",
        ]
        for p in prefixes:
            text = re.sub(p, "", text, flags=re.IGNORECASE).strip()

        # Supprimer codes postaux ou numéros de terminaison (ex: 75011, FR, 01/10/24)
        text = re.sub(r"\b\d{5}\b", "", text)
        text = re.sub(r"\b\d{2}/\d{2}(/\d{2,4})?\b", "", text)
        text = re.sub(r"\b(FRANCE|PARIS|LYON|MARSEILLE|CEDEX)\b", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\b(SAS|SARL|SA|LTD|GMBH|BV)\b", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s+", " ", text).strip(" -/*_")

        # Capitalisation soignée (Title Case) si tout en majuscules
        if text.isupper() and len(text) > 3:
            words = [w.capitalize() if len(w) > 2 else w for w in text.split()]
            text = " ".join(words)

        return text or raw_label

    @staticmethod
    def categorize(text: str, default: str = CATEGORY_OTHER) -> str:
        """Détermine automatiquement la catégorie selon le libellé."""
        if not text:
            return default

        clean = text.lower()
        for category, patterns in KEYWORD_RULES:
            for pattern in patterns:
                if re.search(pattern, clean, re.IGNORECASE):
                    return category

        return default

    @classmethod
    def deduce_type_and_category(
        cls, 
        amount: float, 
        raw_label: str
    ) -> Tuple[TransactionType, str]:
        """
        Déduit le type d'opération (achat, dépôt, retrait, dividende)
        et la catégorie à partir du montant et du libellé.
        """
        category = cls.categorize(raw_label)
        label_lower = raw_label.lower()

        if "dividende" in label_lower or "coupon" in label_lower:
            return TransactionType.DIVIDEND, CATEGORY_DIVIDENDS

        if "achat" in label_lower and ("titre" in label_lower or "action" in label_lower or "etf" in label_lower):
            return TransactionType.BUY, CATEGORY_INVEST

        if "vente" in label_lower and ("titre" in label_lower or "action" in label_lower or "etf" in label_lower):
            return TransactionType.SELL, CATEGORY_INVEST

        # Un débit ne peut jamais être un salaire
        if amount < 0 and category == CATEGORY_SALARY:
            category = CATEGORY_OTHER

        # Épargne & Virement interne Revolut
        if "defi d'epargne" in label_lower or "défi d'épargne" in label_lower:
            if amount > 0:
                return TransactionType.DEPOSIT, CATEGORY_INVEST
            else:
                return TransactionType.WITHDRAWAL, CATEGORY_INVEST

        if "top-up" in label_lower or "recharge" in label_lower:
            return TransactionType.DEPOSIT, CATEGORY_TRANSFER

        if amount > 0:
            return TransactionType.DEPOSIT, category if category != CATEGORY_OTHER else CATEGORY_SALARY
        else:
            return TransactionType.WITHDRAWAL, category

    @classmethod
    def enrich_transaction_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Auto-remplit et enrichit les champs manquants d'une transaction :
        - Symbole / Ticker -> Nom complet, cotation en direct, devise, catégorie
        - Libellé -> Nom nettoyé, catégorie déduite
        - Quantité / Prix -> Montant total
        - Montant / Prix -> Quantité suggérée
        - Notes intelligentes
        """
        enriched = dict(data)
        from app.services.market_service import market_service

        tx_type = enriched.get("type", "buy")
        symbol = (enriched.get("symbol") or "").strip().upper()
        name = enriched.get("name") or ""
        quantity = enriched.get("quantity")
        unit_price = enriched.get("unit_price")
        amount = enriched.get("amount")
        fees = enriched.get("fees") or 0.0
        currency = (enriched.get("currency") or "EUR").upper()
        category = enriched.get("category")
        notes = enriched.get("notes") or ""

        # 1. Enrichissement via Market Service si un Ticker est spécifié
        if symbol:
            try:
                quote = market_service.get_quote(symbol)
                if quote:
                    if not name or name == symbol:
                        name = quote.get("name") or symbol
                        enriched["name"] = name

                    if unit_price is None or unit_price == 0.0:
                        unit_price = quote.get("current_price") or quote.get("price")
                        enriched["unit_price"] = unit_price

                    if not enriched.get("currency"):
                        currency = quote.get("currency", "EUR")
                        enriched["currency"] = currency

                    if not category:
                        category = CATEGORY_INVEST
                        enriched["category"] = category
            except Exception as e:
                logger.debug(f"Cotation live indisponible pour {symbol}: {e}")

        # 2. Nettoyage du libellé et catégorisation si name/notes renseignés
        if name and not category:
            category = cls.categorize(f"{name} {notes}")
            enriched["category"] = category

        # 3. Calculs mathématiques croisés (Quantité <-> Prix <-> Montant)
        if quantity and unit_price and (amount is None or amount == 0.0):
            qty_num = float(quantity)
            price_num = float(unit_price)
            fees_num = float(fees or 0.0)
            if tx_type == "buy":
                amount = round((qty_num * price_num) + fees_num, 2)
            elif tx_type == "sell":
                amount = round(max(0.0, (qty_num * price_num) - fees_num), 2)
            else:
                amount = round(qty_num * price_num, 2)
            enriched["amount"] = amount

        elif amount and unit_price and (quantity is None or quantity == 0.0):
            amt_num = float(amount)
            price_num = float(unit_price)
            fees_num = float(fees or 0.0)
            if price_num > 0:
                net_amt = max(0.0, amt_num - fees_num) if tx_type == "buy" else (amt_num + fees_num)
                quantity = round(net_amt / price_num, 4)
                enriched["quantity"] = quantity

        # 4. Conversion EUR
        eur_rate = market_service.get_eur_rate(currency)
        if unit_price is not None:
            enriched["unit_price_eur"] = round(float(unit_price) * eur_rate, 4)
        if amount is not None:
            enriched["amount_eur"] = round(float(amount) * eur_rate, 2)
        if fees is not None:
            enriched["fees_eur"] = round(float(fees) * eur_rate, 2)

        # 5. Suggestions de notes si vide
        if not notes:
            if tx_type == "buy" and symbol and quantity:
                enriched["notes"] = f"Achat de {quantity} {name or symbol} à {unit_price} {currency}"
            elif tx_type == "sell" and symbol and quantity:
                enriched["notes"] = f"Vente de {quantity} {name or symbol} à {unit_price} {currency}"
            elif tx_type == "dividend" and (name or symbol):
                enriched["notes"] = f"Dividende perçu pour {name or symbol}"
            elif tx_type == "deposit":
                enriched["notes"] = f"Versement : {name or 'Alimentation du compte'}"
            elif tx_type == "withdrawal":
                enriched["notes"] = f"Dépense : {name or 'Retrait de fonds'}"

        if not enriched.get("category"):
            enriched["category"] = CATEGORY_OTHER

        return enriched


transaction_enricher = TransactionEnricher()
