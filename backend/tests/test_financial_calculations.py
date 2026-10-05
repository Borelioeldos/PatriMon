import unittest
import time
import os
import sys
from datetime import date, timedelta

# Ajouter le répertoire backend au PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    Account, Holding, Transaction, TransactionCreate, TransactionType,
    AccountType, PortfolioSnapshot, AssetClass, INVESTMENT_ACCOUNT_TYPES
)
from app.services.transaction_service import transaction_service
from app.services.performance_service import performance_service
from app.services.market_service import MarketService


class TestFinancialCalculations(unittest.TestCase):

    def setUp(self):
        """Initialise une base SQLite en mémoire pour chaque test."""
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        # Création des comptes de test
        self.pea_account = Account(
            name="BoursoBank PEA",
            institution="BoursoBank",
            account_type=AccountType.PEA,
            cash_balance=10000.0,
            currency="EUR",
        )
        self.checking_account = Account(
            name="Compte Courant BNP",
            institution="BNP Paribas",
            account_type=AccountType.CHECKING,
            cash_balance=2500.0,
            currency="EUR",
        )
        self.session.add(self.pea_account)
        self.session.add(self.checking_account)
        self.session.commit()
        self.session.refresh(self.pea_account)
        self.session.refresh(self.checking_account)

    def tearDown(self):
        self.session.close()

    def test_buy_and_weighted_pru(self):
        """Vérifie le calcul exact du PRU pondéré avec frais (B7)."""
        # 1er achat : 10 parts à 100€ + 2€ de frais -> PRU = (1000 + 2) / 10 = 100.20€
        tx1 = transaction_service.create_transaction(
            self.session,
            TransactionCreate(
                account_id=self.pea_account.id,
                type=TransactionType.BUY,
                symbol="CW8.PA",
                name="Amundi MSCI World",
                quantity=10.0,
                unit_price=100.0,
                fees=2.0,
                auto_update_holding=True,
                auto_update_cash=True,
            )
        )
        holding = self.session.get(Holding, tx1.holding_id)
        self.assertIsNotNone(holding)
        self.assertEqual(holding.quantity, 10.0)
        self.assertEqual(holding.unit_cost_eur, 100.2)
        self.assertEqual(holding.unit_cost, 100.2)
        # Cash débité : 10000 - (1000 + 2) = 8998€
        self.session.refresh(self.pea_account)
        self.assertEqual(self.pea_account.cash_balance, 8998.0)

        # 2ème achat : 10 parts à 120€ + 2€ de frais
        # Nouveau PRU = (10 * 100.2 + 10 * 120 + 2) / 20 = (1002 + 1200 + 2) / 20 = 2204 / 20 = 110.20€
        transaction_service.create_transaction(
            self.session,
            TransactionCreate(
                account_id=self.pea_account.id,
                type=TransactionType.BUY,
                symbol="CW8.PA",
                quantity=10.0,
                unit_price=120.0,
                fees=2.0,
                auto_update_holding=True,
                auto_update_cash=True,
            )
        )
        self.session.refresh(holding)
        self.assertEqual(holding.quantity, 20.0)
        self.assertEqual(holding.unit_cost_eur, 110.2)
        self.session.refresh(self.pea_account)
        self.assertEqual(self.pea_account.cash_balance, 7796.0)

    def test_sell_and_realized_gain(self):
        """Vérifie le calcul de la plus-value réalisée lors d'une vente."""
        # Créer position initiale de 10 parts à 100€ (PRU = 100€)
        holding = Holding(
            account_id=self.pea_account.id,
            symbol="CW8.PA",
            name="CW8",
            quantity=10.0,
            unit_cost=100.0,
            unit_cost_eur=100.0,
            initial_quantity=10.0,
            initial_unit_cost_eur=100.0,
        )
        self.session.add(holding)
        self.session.commit()
        self.session.refresh(holding)

        # Vendre 4 parts à 150€ avec 3€ de frais
        # Plus-value = (150 - 100) * 4 - 3 = 200 - 3 = 197€
        sell_tx = transaction_service.create_transaction(
            self.session,
            TransactionCreate(
                account_id=self.pea_account.id,
                holding_id=holding.id,
                type=TransactionType.SELL,
                quantity=4.0,
                unit_price=150.0,
                fees=3.0,
                auto_update_holding=True,
                auto_update_cash=True,
            )
        )
        self.assertEqual(sell_tx.realized_gain_eur, 197.0)
        self.session.refresh(holding)
        self.assertEqual(holding.quantity, 6.0)
        # Cash crédité de 600 - 3 = 597€
        self.session.refresh(self.pea_account)
        self.assertEqual(self.pea_account.cash_balance, 10597.0)

    def test_sell_without_unit_price(self):
        """Vérifie la vente sans unit_price (montant seul, B6)."""
        holding = Holding(
            account_id=self.pea_account.id,
            symbol="CW8.PA",
            name="Amundi MSCI World",
            quantity=10.0,
            unit_cost=100.0,
            unit_cost_eur=100.0,
            initial_quantity=10.0,
            initial_unit_cost_eur=100.0,
        )
        self.session.add(holding)
        self.session.commit()
        self.session.refresh(holding)

        # Vente de 5 parts avec montant total 750€ (prix unitaire implicite 150€)
        sell_tx = transaction_service.create_transaction(
            self.session,
            TransactionCreate(
                account_id=self.pea_account.id,
                holding_id=holding.id,
                type=TransactionType.SELL,
                quantity=5.0,
                amount=750.0,
                fees=0.0,
                auto_update_holding=True,
                auto_update_cash=True,
            )
        )
        # PV = (150 - 100) * 5 = 250€ (et non négatif comme avant le bugfix)
        self.assertEqual(sell_tx.realized_gain_eur, 250.0)

    def test_delete_transaction_readjusts_cash_and_holding(self):
        """Vérifie que supprimer une transaction rétablit le cash et recalcule la position (B3 & Question 4)."""
        initial_cash = self.pea_account.cash_balance

        # 1. Achat
        buy_tx = transaction_service.create_transaction(
            self.session,
            TransactionCreate(
                account_id=self.pea_account.id,
                type=TransactionType.BUY,
                symbol="CW8.PA",
                quantity=10.0,
                unit_price=100.0,
                fees=0.0,
                auto_update_holding=True,
                auto_update_cash=True,
            )
        )
        holding_id = buy_tx.holding_id
        holding = self.session.get(Holding, holding_id)
        self.assertEqual(holding.quantity, 10.0)
        self.session.refresh(self.pea_account)
        self.assertEqual(self.pea_account.cash_balance, initial_cash - 1000.0)

        # 2. Suppression de la transaction
        success = transaction_service.delete_transaction(self.session, buy_tx.id)
        self.assertTrue(success)

        # Le cash doit être restauré
        self.session.refresh(self.pea_account)
        self.assertEqual(self.pea_account.cash_balance, initial_cash)

        # La position doit être recalculée à 0
        self.session.refresh(holding)
        self.assertEqual(holding.quantity, 0.0)

    def test_recalculate_preserves_initial_opening_position(self):
        """Vérifie que recalculate_holding_pru préserve la quantité initiale avant transactions (B5)."""
        # Position d'ouverture sans transactions : 50 parts à 400€
        holding = Holding(
            account_id=self.pea_account.id,
            symbol="CW8.PA",
            name="Amundi MSCI World",
            quantity=50.0,
            unit_cost=400.0,
            unit_cost_eur=400.0,
            initial_quantity=50.0,
            initial_unit_cost_eur=400.0,
        )
        self.session.add(holding)
        self.session.commit()
        self.session.refresh(holding)

        # Import d'un ordre d'exécution : Achat de 2 parts à 500€
        tx = Transaction(
            account_id=self.pea_account.id,
            holding_id=holding.id,
            type=TransactionType.BUY,
            transaction_date=date.today(),
            symbol="CW8.PA",
            quantity=2.0,
            unit_price=500.0,
            unit_price_eur=500.0,
            amount=1000.0,
            amount_eur=1000.0,
            fees=0.0,
            fees_eur=0.0,
        )
        self.session.add(tx)
        self.session.commit()

        # Recalcul de la position
        recalculated = transaction_service.recalculate_holding_pru(self.session, holding.id)
        # La quantité doit être 50 + 2 = 52 parts (et NON 2 parts comme avant le bugfix !)
        self.assertEqual(recalculated.quantity, 52.0)
        # PRU = (50 * 400 + 2 * 500) / 52 = (20000 + 1000) / 52 = 21000 / 52 ≈ 403.8462
        self.assertAlmostEqual(recalculated.unit_cost_eur, 403.8462, places=3)

    def test_twr_neutralizes_flows_between_snapshots_and_ignores_checking(self):
        """Vérifie le TWR sur intervalle ]prev, curr] et l'exclusion des comptes courants (Lot 1 & Question 3)."""
        d1 = date.today() - timedelta(days=10)
        d2 = date.today() - timedelta(days=5)
        d3 = date.today()

        # Snapshots du portefeuille d'investissement
        s1 = PortfolioSnapshot(
            snapshot_date=d1,
            total_net_worth=10000.0,
            total_invested=10000.0,
            total_gain=0.0,
            total_gain_percent=0.0,
            investment_net_worth=10000.0,
            investment_invested=10000.0,
        )
        s2 = PortfolioSnapshot(
            snapshot_date=d3,
            total_net_worth=12000.0,
            total_invested=11000.0,
            total_gain=1000.0,
            total_gain_percent=9.09,
            investment_net_worth=12000.0,
            investment_invested=11000.0,
        )
        self.session.add(s1)
        self.session.add(s2)

        # Versement de 1 000 € sur le PEA le jour d2 (entre d1 et d3)
        inv_tx = Transaction(
            account_id=self.pea_account.id,
            type=TransactionType.DEPOSIT,
            transaction_date=d2,
            amount=1000.0,
            amount_eur=1000.0,
        )
        # Mouvement sur compte courant (courses de 200 € le jour d2)
        checking_tx = Transaction(
            account_id=self.checking_account.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=d2,
            amount=200.0,
            amount_eur=200.0,
        )
        self.session.add(inv_tx)
        self.session.add(checking_tx)
        self.session.commit()

        twr_res = performance_service.calculate_twr(self.session, 12000.0, 11000.0)
        # Calcul attendu :
        # Base = 10 000 + 1 000 (versement PEA neutralisé) = 11 000 €
        # (les 200 € de courses sur checking sont bien ignorés !)
        # sub_return = (12 000 - 11 000) / 11 000 = 1 000 / 11 000 ≈ +9.09%
        self.assertAlmostEqual(twr_res["twr_percent"], 9.09, places=1)

    def test_currency_cache_per_currency(self):
        """Vérifie que le cache devises a un timestamp par devise (B8)."""
        market = MarketService(cache_ttl=60)
        market._currency_rates["USD"] = 0.91
        market._currency_cache_times["USD"] = time.time()

        # Simuler un fetch GBP ultérieur
        market._currency_rates["GBP"] = 1.18
        market._currency_cache_times["GBP"] = time.time() + 10

        self.assertIn("USD", market._currency_cache_times)
        self.assertIn("GBP", market._currency_cache_times)
        self.assertNotEqual(market._currency_cache_times["USD"], market._currency_cache_times["GBP"])

    def test_dividend_analytics_and_account_performance(self):
        """Vérifie le calcul analytique des dividendes et la ventilation par compte (Lot B)."""
        today = date.today()
        # Ajouter une holding PEA
        holding = Holding(
            account_id=self.pea_account.id,
            symbol="CW8.PA",
            name="Amundi MSCI World",
            asset_class=AssetClass.ETF,
            quantity=10.0,
            unit_cost=400.0,
            unit_cost_eur=400.0,
            current_price=500.0,
            currency="EUR",
        )
        self.session.add(holding)
        self.session.commit()
        self.session.refresh(holding)

        # Ajouter des dividendes
        tx_div = Transaction(
            account_id=self.pea_account.id,
            holding_id=holding.id,
            type=TransactionType.DIVIDEND,
            transaction_date=today,
            symbol="CW8.PA",
            amount=50.0,
            amount_eur=50.0,
        )
        self.session.add(tx_div)
        self.session.commit()

        # Test dividend analytics
        analytics = performance_service.get_dividend_analytics(self.session)
        self.assertEqual(analytics["total_eur"], 50.0)
        self.assertEqual(analytics["operations_count"], 1)
        self.assertEqual(len(analytics["assets_ranked"]), 1)
        self.assertEqual(analytics["assets_ranked"][0]["symbol"], "CW8.PA")

        # Test performance by account
        holdings_by_acc = {
            self.pea_account.id: [{
                "symbol": "CW8.PA",
                "quantity": 10.0,
                "total_value_eur": 5000.0,
                "total_invested_eur": 4000.0,
            }]
        }
        acc_perfs = performance_service.get_performance_by_account(
            self.session, [self.pea_account, self.checking_account], holdings_by_acc
        )
        self.assertEqual(len(acc_perfs), 1)  # Only PEA is investment account
        self.assertEqual(acc_perfs[0]["account_id"], self.pea_account.id)
        self.assertEqual(acc_perfs[0]["dividends_eur"], 50.0)
        self.assertEqual(acc_perfs[0]["dividends_count"], 1)


if __name__ == "__main__":
    unittest.main()
