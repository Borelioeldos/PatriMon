import unittest
import os
import sys
import math
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, SQLModel, create_engine
from app.models import Account, Holding, AccountType, AssetClass
from app.services.strategy_service import strategy_service, DEFAULT_PRESETS


class TestStrategyService(unittest.TestCase):

    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        # Création d'un portefeuille de test réaliste (Total = 10 000 €)
        # PEA : 4 000 € (Actions & ETF)
        self.pea = Account(
            name="BoursoBank PEA",
            institution="BoursoBank",
            account_type=AccountType.PEA,
            cash_balance=500.0,
            currency="EUR",
        )
        # Livrets : 4 000 € (Livrets & Épargne)
        self.livret = Account(
            name="Livret A BNP",
            institution="BNP Paribas",
            account_type=AccountType.SAVINGS,
            cash_balance=4000.0,
            currency="EUR",
        )
        # PEE : 1 500 € (Épargne Entreprise)
        self.pee = Account(
            name="BNP PEE",
            institution="BNP Épargne Entreprise",
            account_type=AccountType.PEE,
            cash_balance=0.0,
            currency="EUR",
        )
        # Crypto : 500 € (Crypto)
        self.crypto = Account(
            name="Revolut Crypto",
            institution="Revolut",
            account_type=AccountType.CRYPTO,
            cash_balance=0.0,
            currency="EUR",
        )

        self.session.add_all([self.pea, self.livret, self.pee, self.crypto])
        self.session.commit()

        # Holdings
        # ETF PEA : 3500 €
        self.h_etf = Holding(
            account_id=self.pea.id,
            symbol="CW8.PA",
            name="Amundi MSCI World",
            asset_class=AssetClass.ETF,
            quantity=7.0,
            unit_cost=450.0,
            unit_cost_eur=450.0,
            current_price=500.0,
            currency="EUR",
            is_manual=True,
        )
        # PEE FCPE : 1500 €
        self.h_pee = Holding(
            account_id=self.pee.id,
            symbol="FCPE-SCHN",
            name="Fonds Schneider",
            asset_class=AssetClass.FUND,
            quantity=15.0,
            unit_cost=80.0,
            unit_cost_eur=80.0,
            current_price=100.0,
            currency="EUR",
            is_manual=True,
        )
        # Crypto BTC : 500 €
        self.h_btc = Holding(
            account_id=self.crypto.id,
            symbol="BTC-EUR",
            name="Bitcoin",
            asset_class=AssetClass.CRYPTO,
            quantity=0.01,
            unit_cost=40000.0,
            unit_cost_eur=40000.0,
            current_price=50000.0,
            currency="EUR",
            is_manual=True,
        )

        self.session.add_all([self.h_etf, self.h_pee, self.h_btc])
        self.session.commit()

    def tearDown(self):
        self.session.close()

    def test_allocation_analysis(self):
        """Vérifie l'analyse de déviation entre allocation réelle et cible."""
        analysis = strategy_service.get_allocation_analysis(self.session)
        self.assertIn("total_net_worth", analysis)
        # 3500 (ETF) + 500 (Cash PEA) + 4000 (Livret A) + 1500 (PEE) + 500 (Crypto) = 10 000 €
        self.assertAlmostEqual(analysis["total_net_worth"], 10000.0, delta=1.0)

        # Vérifier que les deltas sont bien calculés
        items = {item["asset_class"]: item for item in analysis["analysis"]}
        self.assertIn("Actions & ETF", items)
        self.assertIn("Livrets & Épargne", items)

        # Dans notre preset par défaut (Actions 55%, Livrets 25%),
        # Actions est à 35% -> delta négatif (UNDERWEIGHT)
        # Livrets est à 45% (4000 livret + 500 cash pea) -> delta positif (OVERWEIGHT)
        self.assertLess(items["Actions & ETF"]["delta_percent"], 0)
        self.assertEqual(items["Actions & ETF"]["status"], "UNDERWEIGHT")

    def test_dca_rebalance_prioritizes_underweight(self):
        """Vérifie que l'algorithme DCA injecte les fonds en priorité sur l'actif le plus sous-pondéré."""
        # On injecte 500 €
        res = strategy_service.simulate_dca_rebalance(
            self.session,
            contribution_amount=500.0,
            custom_targets={
                "Actions & ETF": 60.0,
                "Livrets & Épargne": 20.0,
                "Épargne Entreprise (PEE)": 15.0,
                "Crypto": 5.0,
            }
        )

        self.assertEqual(res["contribution_amount"], 500.0)
        self.assertAlmostEqual(res["new_total_net_worth"], 10500.0, delta=1.0)

        plan = {p["asset_class"]: p for p in res["plan"]}
        allocated_sum = sum(p["allocated_amount"] for p in res["plan"])
        # La somme totale allouée doit égaler rigoureusement 500 € au centime près
        self.assertAlmostEqual(allocated_sum, 500.0, places=2)

        # Actions & ETF étant fortement sous-pondéré, il doit recevoir la grande majorité des 500 €
        self.assertGreater(plan["Actions & ETF"]["allocated_amount"], 300.0)
        # Livrets étant surpondéré, il ne doit rien recevoir
        self.assertEqual(plan["Livrets & Épargne"]["allocated_amount"], 0.0)

        # L'écart absolu après versement doit être inférieur ou égal à l'écart avant
        delta_before = abs(plan["Actions & ETF"]["delta_before"])
        delta_after = abs(plan["Actions & ETF"]["delta_after"])
        self.assertLess(delta_after, delta_before)

    def test_dca_rebalance_large_contribution(self):
        """Quand l'apport dépasse le déficit, le reliquat est ventilé selon la cible."""
        res = strategy_service.simulate_dca_rebalance(
            self.session,
            contribution_amount=10000.0,
            custom_targets={
                "Actions & ETF": 60.0,
                "Livrets & Épargne": 20.0,
                "Épargne Entreprise (PEE)": 15.0,
                "Crypto": 5.0,
            }
        )
        allocated_sum = sum(p["allocated_amount"] for p in res["plan"])
        self.assertAlmostEqual(allocated_sum, 10000.0, places=2)

    def test_compound_interest_and_fire_projections(self):
        """Vérifie le calcul des intérêts composés, l'inflation et le capital FIRE."""
        proj = strategy_service.calculate_projections(
            initial_capital=10000.0,
            monthly_contribution=500.0,
            annual_return_pct=7.0,
            years=10,
            inflation_rate_pct=2.0,
            swr_pct=4.0,
            desired_monthly_expense=2500.0,
        )

        summary = proj["summary"]
        self.assertGreater(summary["final_nominal_portfolio"], summary["total_deposited"])
        self.assertGreater(summary["total_interest_earned"], 0.0)
        self.assertLess(summary["final_real_portfolio"], summary["final_nominal_portfolio"])

        # Vérification mathématique sur 10 ans :
        # Total versé = 10 000 + 500 * 120 = 70 000 €
        self.assertEqual(summary["total_deposited"], 70000.0)
        # Portefeuille nominal avec 7% annuel composé mensuel doit être ~106k-108k€
        self.assertGreater(summary["final_nominal_portfolio"], 100000.0)
        self.assertLess(summary["final_nominal_portfolio"], 120000.0)

        # FIRE Target pour 2500€/mois avec 4% SWR :
        # Target = (2500 * 12) / 0.04 = 750 000 €
        fire = proj["fire"]
        self.assertEqual(fire["target_fire_capital"], 750000.0)
        self.assertEqual(fire["lean_fire_capital"], 562500.0) # 75%
        self.assertEqual(fire["fat_fire_capital"], 975000.0)  # 130%
        # Progrès actuel : 10 000 / 750 000 = 1.33%
        self.assertAlmostEqual(fire["fire_progress_percent"], 1.3, delta=0.2)


if __name__ == "__main__":
    unittest.main()
