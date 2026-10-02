# 📋 État du Projet & Guide de Reprise — PatriMon

> **Note pour l'Agent IA reprenant ce projet** :  
> Ce document contient l'intégralité du contexte technique, des choix d'architecture, de l'état d'avancement et des prochaines tâches. Vous pouvez vous y référer directement sans avoir à relire l'historique complet des conversations.

---

## 1. Vue d'Ensemble & Objectif du Projet

**PatriMon** est une application web personnelle de suivi de patrimoine en temps réel, conçue pour être :
- **Souveraine & locale** : les données sont stockées en local sur la machine de l'utilisateur (base SQLite `patrimoines.db`), sans abonnement payant ni dépendance cloud obligatoire.
- **Temps réel** : cotations en direct des actifs boursiers et cryptos via Yahoo Finance (`yfinance`), avec conversion automatique des devises en EUR.
- **Multi-établissements** : adaptée précisément aux comptes réels de l'utilisateur (**Borel**) :
  1. **BoursoBank** : Compte courant + PEA (ETF World CW8.PA, S&P 500...).
  2. **Revolut** : Compte courant + Coffres épargne + CTO (Actions US ex: AAPL) + Crypto (BTC, ETH...).
  3. **BNP Paribas** : Compte courant + Livrets d'épargne réglementés (Livret A, LDDS...).
  4. **BNP Épargne Entreprise (PEE)** : Fonds FCPE avec abondement entreprise.
- **Mobile-Friendly** : l'interface web est responsive et conçue pour être consultée depuis un smartphone sur le réseau Wi-Fi local, avec possibilité future de conteneurisation Docker sur un vieux PC tournant sous **Home Assistant OS**.

---

## 2. Architecture Technique & Fichiers Clés

```
Suivie_Patrimoine/
├── backend/
│   ├── app/
│   │   ├── database.py              # Configuration SQLite via SQLModel (tables: account, holding, portfoliosnapshot, transaction, bankconnection, bankaccountmapping)
│   │   ├── models.py                # Modèles SQLModel : Account, Holding, PortfolioSnapshot, Transaction, BankConnection, BankAccountMapping
│   │   ├── main.py                  # FastAPI app v3.0 avec CORS et inclusion des 12 groupes de routes
│   │   ├── routers/
│   │   │   ├── accounts.py          # CRUD comptes + endpoint /seed-initial
│   │   │   ├── holdings.py          # CRUD holdings (gère actions, crypto, fonds PEE et livrets)
│   │   │   ├── portfolio.py         # GET /api/portfolio/summary, /benchmarks, /benchmark-comparison
│   │   │   ├── market.py            # Recherche de tickers et cotation unitaire
│   │   │   ├── transactions.py      # CRUD transactions, calcul PRU, stats de flux (Phase 2)
│   │   │   ├── pee.py               # Phase 3 : Import relevés PDF/CSV BNP Épargne Entreprise & PERO
│   │   │   └── open_banking.py      # Phase 3 : Synchro bancaire DSP2 Enable Banking & Mode Démo
│   │   └── services/
│   │       ├── market_service.py    # Service yfinance avec cache 30s + conversion EUR
│   │       ├── portfolio_service.py # Agrégation financière, calculs plus-values, snapshots 30j
│   │       ├── transaction_service.py # Moteur PRU pondéré (Weighted Average Cost), cessions, ajustement cash
│   │       ├── performance_service.py # Moteur TWR (Time-Weighted Return) & MWR / TRI (XIRR)
│   │       ├── benchmark_service.py # Comparateur d'indices (MSCI World, S&P 500, CAC 40, Bitcoin)
│   │       ├── pee_import_service.py# Phase 3 : Parseur PDF officiel BNP EE (Schneider Electric) & CSV
│   │       └── open_banking_service.py# Phase 3 : Client API Enable Banking DSP2 (JWT RS256) + auto-création comptes
│   ├── certs/                       # Phase 3 : Paires de clés RSA 2048 statiques permanentes (.pem)
│   ├── open_banking_config.json     # Configuration locale sécurisée (Application ID, clés statiques)
│   ├── requirements.txt             # fastapi, uvicorn, sqlmodel, yfinance, httpx, pypdf, pyjwt, cryptography
│   ├── run.py                       # Lanceur Uvicorn sur 0.0.0.0:8000
│   └── patrimoines.db               # Base SQLite locale
├── frontend/
│   ├── src/
│   │   ├── services/api.js          # Client fetch vers /api (avec proxy Vite & routes Phase 3)
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Header avec badge live, countdown, toggle auto-refresh, boutons d'ajout et synchro
│   │   │   ├── KPICards.jsx         # 4 KPI : Patrimoine Net, Plus-Value, Liquidités, Nb comptes
│   │   │   ├── PerformanceMetrics.jsx # Phase 2 : Cartes TWR %, TRI / MWR %, Dividendes encaissés, Plus-values réalisées
│   │   │   ├── AllocationsCharts.jsx# 5 graphiques : Évolution, vs Benchmarks, Banques, Classes d'actifs, Palmarès
│   │   │   ├── AccountsList.jsx     # Liste des comptes en accordéon, badges, boutons d'import PEE et synchro DSP2
│   │   │   ├── TransactionsList.jsx # Phase 2 : Journal filtrable des achats, ventes, dépôts, dividendes
│   │   │   ├── AddTransactionModal.jsx # Phase 2 : Modal avec calcul PRU live et ajustement solde
│   │   │   ├── AddAssetModal.jsx    # Modal d'ajout à 3 onglets (Livrets, Bourse/Crypto, PEE)
│   │   │   ├── AddAccountModal.jsx  # Modal création nouveau compte
│   │   │   ├── PeeImportModal.jsx   # Phase 3 : Modal drag & drop relevé PDF/CSV BNP EE + détection PERO
│   │   │   └── BankSyncModal.jsx    # Phase 3 : Modal Open Banking DSP2 (BoursoBank, BNP, Revolut)
│   │   ├── App.jsx                  # State principal, polling 30s, gestion des modals
│   │   └── main.jsx / index.css     # Montage React et styles Tailwind CSS
│   ├── vite.config.js               # Proxy Vite vers http://127.0.0.1:8000 + host 0.0.0.0
│   └── package.json                 # React 18, Vite 5, Tailwind 3, Lucide-react, Recharts
├── start.bat                        # Lanceur Windows 1-clic (démarre backend & frontend)
├── README.md                        # Documentation utilisateur
├── plan_initial.md                  # Premier plan d'action de cadrage
├── plan_phase_3.md                  # Plan d'exécution validé Phase 3
└── PROJECT_STATUS.md                # [CE FICHIER] Guide de passation & Todo
```

---

## 3. Ce qui est Déjà Réalisé & Fonctionnel

### Phase 1 Complète
- [x] **Backend FastAPI opérationnel** :
  - Base SQLite configurée avec initialisation automatique des tables (`init_db`).
  - Prise en charge des devises étrangères avec taux de change dynamiques (`USD`, `GBP` convertis en `EUR`).
  - Cache en mémoire optimisé à 30 secondes pour les flux de cotations.
  - Endpoint de pré-remplissage (`/api/accounts/seed-initial`) avec les 4 institutions de l'utilisateur.
  - Gestion unifiée des actifs : Bourse, Crypto, Fonds manuels PEE, et Livrets d'épargne (taux fixe 1,00 €).
- [x] **Frontend React + Tailwind + Recharts** :
  - **Auto-Refresh temps réel (30 secondes)** avec indicateur vert clignotant et compte à rebours visuel.
  - **Graphiques interactifs intégrés** : Évolution 30j, Par Banque, Par Classe d'Actif, Palmarès Titres.
  - **Gestion dédiée de l'épargne / livrets BNP** (édition en 1 clic).

### Phase 2 Complète (Historique des Transactions & Calculs Financiers Avancés)
- [x] **Table des Transactions (`Transaction`) & Moteur PRU** :
  - Types d'opérations : Achat (`BUY`), Vente (`SELL`), Versement (`DEPOSIT`), Retrait (`WITHDRAWAL`), Dividende reçu (`DIVIDEND`).
  - Formule du PRU pondéré (Weighted Average Cost) calculée en temps réel lors de chaque achat :  
    `Nouveau_PRU = (Ancienne_Qté × Ancien_PRU + Qté_Achetée × Prix_Achat + Frais) / Nouvelle_Qté`.
  - Calcul automatique des plus-values réalisées lors des cessions de titres.
  - Débit / Crédit synchronisé du solde espèces (`cash_balance`) du compte associé.
  - Endpoint de recalcul rétroactif complet (`POST /api/transactions/recalculate-holding/{id}`).
- [x] **Métriques de Performance Réelles (Standards GIPS & Actuariat)** :
  - **TWR (Time-Weighted Return)** : Rendement financier pur des actifs isolant totalement les entrées/sorties de fonds.
  - **MWR / TRI (Taux de Rendement Interne / XIRR)** : Rendement effectif pondéré par l'argent prenant en compte la date exacte de chaque versement/retrait, avec réconciliation des capitaux d'origine.
  - **Composant `PerformanceMetrics.jsx`** : Cartes visuelles TWR %, TRI %, total des dividendes reçus en cash et total des plus-values réalisées.
- [x] **Comparaison avec des Indices de Référence (Benchmarks)** :
  - Indices intégrés : **MSCI World** (`CW8.PA`), **S&P 500** (`^GSPC`), **CAC 40** (`^FCHI`), **Bitcoin** (`BTC-EUR`).
  - Périodes sélectionnables : 1 mois, 3 mois, 6 mois, 1 an.
  - Graphique multi-courbes en % avec normalisation en base 0% et calcul d'**Alpha** (surperformance / sous-performance).
- [x] **Interface Journal & Modals** :
  - `TransactionsList.jsx` : Journal filtrable par type et par compte avec suppression et statuts colorés.
  - `AddTransactionModal.jsx` : Formulaire interactif avec simulation en direct du nouveau PRU et de la plus-value attendue.

### Phase 3 Complète : Automatisation des Flux Externes, DSP2 (Enable Banking), Synchro Régulière & Auto-Remplissage des Transactions

- [x] **Transition vers l'API Enable Banking (PSD2 / DSP2)** :
  - Remplacement complet de GoCardless par le standard européen ouvert **Enable Banking**.
  - Signature locale et souveraine des requêtes HTTP via **JWT asymétrique RS256** (`cryptography` et `pyjwt`).
  - Prise en charge des contraintes réglementaires européennes DSP2 (durée de validité `valid_until` bridée à 89 jours, formats ASPSP stricts).
  - Mode Démo / Simulation instantané maintenu pour tester l'UI et les flux sans compte bancaire réel.

- [x] **Clés RSA Statiques & Permanentes (Zéro Clé Dynamique)** :
  - Paire de clés RSA 2048-bit permanente stockée dans [`backend/certs/enable_banking_public.pem`](file:///c:/Users/Borel/Desktop/Suivie_Patrimoine/backend/certs/enable_banking_public.pem) et [`backend/certs/enable_banking_private.pem`](file:///c:/Users/Borel/Desktop/Suivie_Patrimoine/backend/certs/enable_banking_private.pem).
  - Protection contre les régénérations intempestives et copie 1-clic dans `BankSyncModal.jsx`.

- [x] **Synchronisation Automatique & Périodique en Tâche de Fond (`sync_scheduler_service.py`)** :
  - Moteur de planification asynchrone non bloquant intégré au cycle de vie FastAPI (`lifespan`).
  - Fréquence paramétrable en 1 clic : **1 heure**, **4 heures (recommandé)**, **12 heures**, ou **24 heures**.
  - Persistance dans [`backend/sync_scheduler_config.json`](file:///c:/Users/Borel/Desktop/Suivie_Patrimoine/backend/sync_scheduler_config.json).
  - Synchronisation automatique et conjointe :
    1. Soldes bancaires réels de tous les comptes liés.
    2. Téléchargement et intégration des nouvelles transactions.
    3. Actualisation du snapshot de patrimoine journalier (`PortfolioSnapshot`).
  - Nouvel onglet dédié dans `BankSyncModal.jsx` avec état en temps réel, compte à rebours avant la prochaine exécution, switch d'activation et bouton de déclenchement forcé.

- [x] **Remplissage Automatique & Catégorisation Intelligente des Transactions (`transaction_enricher.py`)** :
  - **Saisie manuelle assistée (`AddTransactionModal.jsx`)** :
    - Détection automatique dès la saisie du symbole / ticker (ex: `CW8.PA`, `AAPL`, `BTC-EUR`) : récupération en direct du nom officiel, du cours actuel de marché et de la devise.
    - Calcul mathématique croisé temps réel : la quantité renseigne le montant total (`quantité × cours + frais`), ou le montant renseigne la quantité suggérée.
    - Pré-remplissage automatique des catégories et suggestions d'intitulés / notes.
    - Raccourcis en 1 clic (Presets) pour les flux récurrents : *Salaire Schneider*, *Courses Carrefour*, *EDF / TotalEnergies*, *Abonnements*, *SNCF*, *Virement Épargne*.
  - **Synchronisation bancaire automatique DSP2** :
    - Détection du débit/crédit (`credit_debit_indicator`), normalisation du montant et détection de l'opération (`DEPOSIT`, `WITHDRAWAL`, `DIVIDEND`, `BUY`).
    - Nettoyage automatique des libellés bancaires bruts (suppression des préfixes techniques `PAIEMENT CARTE`, `PRLV SEPA`, dates, codes postaux) pour extraire le vrai nom du tiers / commerçant.
    - Classification automatique parmi 12 catégories intelligentes (*Alimentation & Courses*, *Logement & Énergie*, *Revenus & Salaires*, *Investissement & Épargne*, *Abonnements & Médias*, etc.).
    - Déduplication infaillible via `external_id` : aucun risque de doublon lors des synchronisations régulières.
  - **Journal des flux (`TransactionsList.jsx`)** :
    - Colonne et badges de catégories colorés.
    - Filtre par catégorie dans la barre d'outils.
    - Badge `DSP2` identifiant les opérations synchronisées automatiquement.

- [x] **Automatisation BNP Épargne Entreprise (PEE & PERO Cardif Retraite)** :
  - Parseur PDF officiel (`pee_import_service.py`) calibré sur le relevé de situation Schneider Electric France / BNP Paribas.
  - Séparation automatique entre le **PEE** (fonds 5 ans bloqués) et le **PERO Retraite** (Cardif Retraite).
  - Rétro-ingénierie automatique de la VL unitaire et du PRU unitaire à partir des plus-values et des parts du document.
  - Modal frontend ergonomique `PeeImportModal.jsx` avec prévisualisation en deux volets et injection en 1 clic dans `patrimoines.db`.

---

## 4. Ce Qu'il Reste à Faire (Feuille de Route pour les Prochaines Étapes)

### Phase 4 : Pilotage Stratégique & Aide à la Décision
- [ ] **Allocation Cible vs Réelle** :
  - Définir des cibles d'allocation personnalisables (ex: 60% Actions, 20% Épargne de sécurité, 10% PEE, 10% Crypto).
  - Calculateur de versement mensuel : "Dans quelle enveloppe investir mes 500 € ce mois-ci pour rééquilibrer mon portefeuille ?"
- [ ] **Simulateur d'Intérêts Composés & Projections Long Terme** :
  - Projection dynamique à 5, 10, 20 ans selon un rendement annuel moyen attendu et un effort d'épargne mensuel programmable.

### Phase 5 : Déploiement Permanent (Home Assistant OS / Vieux PC)
- [ ] Créer un `Dockerfile` multi-stage pour le backend FastAPI et le frontend Vite.
- [ ] Créer un `docker-compose.yml` avec volume persistant pour SQLite.
- [ ] Documenter le déploiement sur le vieux PC sous **Home Assistant OS** (via Portainer ou add-on local) pour un accès sécurisé 24/7 depuis le smartphone sur le Wi-Fi local.

---

## 5. Comment Lancer le Projet (Cheat Sheet)

### Lancement Rapide (Windows)
Double-cliquer sur `start.bat` à la racine.

### Lancement Manuel

#### Terminal 1 — Backend :
```powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
python run.py
```
- API : `http://localhost:8000`
- Swagger Docs : `http://localhost:8000/docs`

#### Terminal 2 — Frontend :
```powershell
cd frontend
npm.cmd run dev
```
- App Web : `http://localhost:5173`
- Accès Mobile : `http://<IP_LOCALE_DU_PC>:5173`

---

## 6. Règles & Retours d'Expérience Techniques
1. **Conserver la simplicité locale** : ne pas forcer de cloud payant ; SQLite suffit largement pour un patrimoine personnel.
2. **Ne jamais casser l'expérience Livrets / PEE** : ces supports n'ont pas de ticker Yahoo Finance direct, ils doivent toujours rester facilement éditables sans forcer de ticker.
3. **Spécificités Open Banking (Enable Banking DSP2)** :
   - **Réglementation DSP2** : La durée de validité du consentement (`valid_until`) ne doit jamais dépasser 180 jours (réglementation européenne). Utiliser `now + 89 jours`.
   - **Nom de banque (ASPSP)** : Doit respecter la casse officielle exacte (`Mock ASPSP`, `BBVA`, `BoursoBank`).
   - **Redirect URL** : Doit matcher au caractère près celle configurée dans la console Enable Banking (ex: `http://localhost:5173/` ou `https://localhost:5173`).
   - **Sandbox vs Production** : L'environnement Sandbox d'Enable Banking ne liste que `Mock ASPSP` et `BBVA`. Pour voir apparaître **BoursoBank**, **BNP Paribas**, **Revolut**, l'application doit être créée en environnement **Production** sur la console Enable Banking.
4. **Mettre à jour ce fichier (`PROJECT_STATUS.md`)** dès qu'une nouvelle fonctionnalité majeure est achevée.
