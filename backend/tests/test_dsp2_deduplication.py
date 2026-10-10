"""
Tests de validation de l'algorithme anti-doublons DSP2 et réconciliation Open Banking.
"""
import unittest
import os
import sys
from datetime import date, timedelta
from sqlmodel import Session, SQLModel, create_engine, select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import (
    Account, BankConnection, BankAccountMapping, Transaction, TransactionType, AccountType
)
from app.services.open_banking_service import open_banking_service


class TestDsp2Deduplication(unittest.TestCase):

    def setUp(self):
        """Initialise une base SQLite en mémoire pour chaque test."""
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        # Compte bancaire de test
        self.account = Account(
            name="BNP Paribas - Compte Courant",
            institution="BNP Paribas",
            account_type=AccountType.CHECKING,
            cash_balance=1500.0,
            currency="EUR",
        )
        self.session.add(self.account)
        self.session.commit()
        self.session.refresh(self.account)

    def tearDown(self):
        self.session.close()

    def test_are_transactions_matching_exact(self):
        """Deux transactions avec même montant, même type, même date et même libellé doivent correspondre."""
        d = date(2026, 10, 5)
        res = open_banking_service.are_transactions_matching(
            267.59, TransactionType.WITHDRAWAL, d, "LEMFI 77 LOWER CAMD",
            267.59, TransactionType.WITHDRAWAL, d, "LEMFI 77 LOWER CAMD"
        )
        self.assertTrue(res)

    def test_are_transactions_matching_date_drift(self):
        """Une transaction par carte peut être comptabilisée 2 jours après l'autorisation."""
        d_auth = date(2026, 10, 3)
        d_book = date(2026, 10, 5)
        res = open_banking_service.are_transactions_matching(
            267.59, TransactionType.WITHDRAWAL, d_auth, "Carte DU 031026 Lemfi 77 Lower Camd Carte 4974xxxxxxxx5629",
            267.59, TransactionType.WITHDRAWAL, d_book, "Carte DU 031026 Lemfi 77 Lower Camd Carte 4974xxxxxxxx5629",
            max_days=4
        )
        self.assertTrue(res)

    def test_are_transactions_matching_sepa_label_expansion(self):
        """Un libellé SEPA temporaire court et un libellé étendu avec mandats doivent correspondre."""
        d = date(2026, 10, 5)
        res = open_banking_service.are_transactions_matching(
            11.56, TransactionType.WITHDRAWAL, d, "PRLV SEPA BOUYGUES TELECO MDT/BT1150T1QLG6",
            11.56, TransactionType.WITHDRAWAL, d, "PRLV SEPA BOUYGUES TELECOM ECH/051026 ID EMETTEUR/FR35ZZZ418323 MDT/BT1150T1QLG69 REF/PAGP0110H2IMLE LIB/06XXXXX466",
            max_days=4
        )
        self.assertTrue(res)

    def test_are_transactions_matching_different_merchants(self):
        """Deux montants identiques mais commerçants distincts ne doivent pas correspondre."""
        d = date(2026, 9, 28)
        res = open_banking_service.are_transactions_matching(
            10.0, TransactionType.WITHDRAWAL, d, "Citiz LPA",
            10.0, TransactionType.WITHDRAWAL, d, "Défi d'épargne Revolut",
            max_days=4
        )
        self.assertFalse(res)

    def test_are_transactions_matching_different_types(self):
        """Un retrait et un dépôt de même montant ne doivent pas correspondre."""
        d = date(2026, 10, 5)
        res = open_banking_service.are_transactions_matching(
            100.0, TransactionType.WITHDRAWAL, d, "Virement",
            100.0, TransactionType.DEPOSIT, d, "Virement",
            max_days=4
        )
        self.assertFalse(res)

    def test_cleanup_duplicate_transactions_purges_obsolete_eb(self):
        """cleanup_duplicate_transactions doit purger les temporaires 'eb_' dont la version BOOK officielle existe."""
        d = date(2026, 10, 5)

        # 1. Opération temporaire créée lors d'une synchro précédente en PDNG
        tx_pending = Transaction(
            account_id=self.account.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=d,
            name="Bouygues Teleco Mdt/bt1150t1qlg6",
            amount=11.56,
            amount_eur=11.56,
            currency="EUR",
            external_id="eb_2026-10-05_11.56_d5401467f199",
            notes="Synchronisé automatiquement via Open Banking"
        )
        # 2. Deuxième temporaire créée suite à un libellé SEPA étendu
        tx_pending2 = Transaction(
            account_id=self.account.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=d,
            name="Bouygues Telecom Ech/051026",
            amount=11.56,
            amount_eur=11.56,
            currency="EUR",
            external_id="eb_2026-10-05_11.56_d6771b6d90c5",
            notes="Synchronisé automatiquement via Open Banking"
        )
        # 3. Opération officielle comptabilisée
        tx_booked = Transaction(
            account_id=self.account.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=d,
            name="Bouygues Telecom",
            amount=11.56,
            amount_eur=11.56,
            currency="EUR",
            external_id="000025324006670338",
            notes="Synchronisé automatiquement via Open Banking"
        )
        self.session.add_all([tx_pending, tx_pending2, tx_booked])
        self.session.commit()

        # Vérifier qu'on a bien 3 transactions avant nettoyage
        count_before = len(self.session.exec(select(Transaction).where(Transaction.account_id == self.account.id)).all())
        self.assertEqual(count_before, 3)

        # Nettoyage des doublons
        purged = open_banking_service.cleanup_duplicate_transactions(self.session)
        self.assertEqual(purged, 2)

        # Vérifier qu'il ne reste que la transaction officielle
        txs_after = self.session.exec(select(Transaction).where(Transaction.account_id == self.account.id)).all()
        self.assertEqual(len(txs_after), 1)
        self.assertEqual(txs_after[0].external_id, "000025324006670338")

    def test_cleanup_preserves_legitimate_pending(self):
        """Une transaction en cours qui n'a pas encore de contrepartie comptabilisée doit être conservée."""
        d = date(2026, 10, 6)
        tx_pending = Transaction(
            account_id=self.account.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=d,
            name="Lemfi 77 Lower Camd",
            amount=23.0,
            amount_eur=23.0,
            currency="EUR",
            external_id="eb_2026-10-06_23.0_1f172b693a8b",
            notes="Synchronisé automatiquement via Open Banking"
        )
        self.session.add(tx_pending)
        self.session.commit()

        purged = open_banking_service.cleanup_duplicate_transactions(self.session)
        self.assertEqual(purged, 0)

        txs = self.session.exec(select(Transaction).where(Transaction.account_id == self.account.id)).all()
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].external_id, "eb_2026-10-06_23.0_1f172b693a8b")

    def test_cleanup_cross_account_boursobank_card_duplicates(self):
        """
        Dans BoursoBank, un paiement par carte est renvoyé sur le compte courant et sur le compte carte
        avec le même external_id (avis-...). Le doublon sur la carte doit être supprimé.
        """
        # Compte courant BoursoBank
        checking = Account(
            name="BoursoBank - M KOUETE TCHOFFO INGRID BOREL",
            institution="BoursoBank",
            account_type=AccountType.CHECKING,
            cash_balance=424.21,
            currency="EUR",
        )
        # Compte carte BoursoBank (solde 0)
        card = Account(
            name="BoursoBank - Carte Visa Ultim - MR INGRID BOREL KOUETE TCHOFFO",
            institution="BoursoBank",
            account_type=AccountType.CHECKING,
            cash_balance=0.0,
            currency="EUR",
        )
        self.session.add_all([checking, card])
        self.session.commit()
        self.session.refresh(checking)
        self.session.refresh(card)

        # Connexion & Mappings
        conn = BankConnection(
            institution_id="BOURSOBANK_FR",
            institution_name="BoursoBank",
            requisition_id="req_test",
        )
        self.session.add(conn)
        self.session.commit()
        self.session.refresh(conn)

        m_checking = BankAccountMapping(
            connection_id=conn.id,
            external_account_id="bourso_checking_uid",
            patrimon_account_id=checking.id,
            iban="FR7640618803700004092100160",
            name="M KOUETE TCHOFFO INGRID BOREL",
        )
        m_card = BankAccountMapping(
            connection_id=conn.id,
            external_account_id="bourso_card_uid",
            patrimon_account_id=card.id,
            iban="1000000018317519",
            name="Carte Visa Ultim",
        )
        self.session.add_all([m_checking, m_card])
        self.session.commit()

        # Deux transactions miroir partageant le même avis-...
        tx_checking = Transaction(
            account_id=checking.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=date(2026, 10, 9),
            name="Gaillot Distribution",
            amount=218.51,
            amount_eur=218.51,
            currency="EUR",
            external_id="avis-b4540445c62332b4bf62a6aa9ef7a392",
            notes="Synchronisé automatiquement via Open Banking"
        )
        tx_card = Transaction(
            account_id=card.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=date(2026, 10, 9),
            name="Gaillot Distribution",
            amount=218.51,
            amount_eur=218.51,
            currency="EUR",
            external_id="avis-b4540445c62332b4bf62a6aa9ef7a392",
            notes="Synchronisé automatiquement via Open Banking"
        )
        self.session.add_all([tx_checking, tx_card])
        self.session.commit()

        # Avant nettoyage : 2 transactions
        txs = self.session.exec(select(Transaction).where(Transaction.external_id == "avis-b4540445c62332b4bf62a6aa9ef7a392")).all()
        self.assertEqual(len(txs), 2)

        # Nettoyage
        purged = open_banking_service.cleanup_duplicate_transactions(self.session)
        self.assertEqual(purged, 1)

        # Après nettoyage : seule celle du compte courant checking subsiste
        txs_after = self.session.exec(select(Transaction).where(Transaction.external_id == "avis-b4540445c62332b4bf62a6aa9ef7a392")).all()
        self.assertEqual(len(txs_after), 1)
        self.assertEqual(txs_after[0].account_id, checking.id)

    def test_cleanup_cross_account_mirror_without_exact_id(self):
        """
        Si un compte carte et un compte courant de la même banque ont une opération identique
        (montant, type, date proche, libellé) même sans external_id identique, la version carte est purgée.
        """
        checking = Account(
            name="BoursoBank - Compte Courant",
            institution="BoursoBank",
            account_type=AccountType.CHECKING,
            cash_balance=500.0,
            currency="EUR",
        )
        card = Account(
            name="BoursoBank - Carte Visa Ultim",
            institution="BoursoBank",
            account_type=AccountType.CHECKING,
            cash_balance=0.0,
            currency="EUR",
        )
        self.session.add_all([checking, card])
        self.session.commit()
        self.session.refresh(checking)
        self.session.refresh(card)

        conn = BankConnection(institution_id="BOURSOBANK_FR", institution_name="BoursoBank", requisition_id="req_m")
        self.session.add(conn)
        self.session.commit()
        self.session.refresh(conn)

        self.session.add_all([
            BankAccountMapping(connection_id=conn.id, external_account_id="c_chk", patrimon_account_id=checking.id, iban="FR7640618803700004092100160"),
            BankAccountMapping(connection_id=conn.id, external_account_id="c_crd", patrimon_account_id=card.id, iban="1000000018317519", name="Carte Visa Ultim"),
        ])
        self.session.commit()

        tx_main = Transaction(
            account_id=checking.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=date(2026, 10, 10),
            name="Eurofins Feyzin FR",
            amount=40.0,
            amount_eur=40.0,
            currency="EUR",
            external_id="book_main_123",
        )
        tx_card = Transaction(
            account_id=card.id,
            type=TransactionType.WITHDRAWAL,
            transaction_date=date(2026, 10, 9),
            name="Eurofins Feyzin",
            amount=40.0,
            amount_eur=40.0,
            currency="EUR",
            external_id="card_auth_456",
        )
        self.session.add_all([tx_main, tx_card])
        self.session.commit()

        purged = open_banking_service.cleanup_duplicate_transactions(self.session)
        self.assertEqual(purged, 1)

        # La transaction sur le compte principal doit subsister
        remaining = self.session.exec(select(Transaction).where(Transaction.amount == 40.0)).all()
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0].account_id, checking.id)


if __name__ == "__main__":
    unittest.main()
