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
│   │   │   └── open_banking.py      # Phase 3 : Synchro bancaire DSP2 GoCardless & Mode Démo
│   │   └── services/
│   │       ├── market_service.py    # Service yfinance avec cache 30s + conversion EUR
│   │       ├── portfolio_service.py # Agrégation financière, calculs plus-values, snapshots 30j
│   │       ├── transaction_service.py # Moteur PRU pondéré (Weighted Average Cost), cessions, ajustement cash
│   │       ├── performance_service.py # Moteur TWR (Time-Weighted Return) & MWR / TRI (XIRR)
│   │       ├── benchmark_service.py # Comparateur d'indices (MSCI World, S&P 500, CAC 40, Bitcoin)
│   │       ├── pee_import_service.py# Phase 3 : Parseur PDF officiel BNP EE (Schneider Electric) & CSV
│   │       └── open_banking_service.py# Phase 3 : Client API GoCardless DSP2 + simulateur de flux temps réel
│   ├── requirements.txt             # fastapi, uvicorn, sqlmodel, yfinance, httpx, pypdf, python-multipart
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

### Phase 3 Complète (Automatisation des Flux Externes, DSP2 & BNP PEE/PERO)
- [x] **Connecteur Open Banking (DSP2 — Enable Banking)** :
  - Intégration de l'API européenne moderne **Enable Banking** (successeur de Nordigen pour les projets personnels et le self-hosted).
  - Signature cryptographique locale des requêtes via **JWT RS256** (avec bibliothèque Python `cryptography` et `pyjwt`).
  - **Générateur intégré de clés RSA (2048 bits) en 1-clic** : permet à l'utilisateur de générer sa clé privée et d'exporter sa clé publique directement vers la console Enable Banking.
  - **Mode Démo / Simulation instantané** : permet de tester immédiatement la synchronisation des liquidités sans clé API.
  - Endpoints complets : statut, configuration, catalogue banques françaises, lien de connexion, échange de code session et synchronisation automatique.
  - Modal frontend dédié `BankSyncModal.jsx` avec suivi des soldes, connexion directe d'établissements et configuration assistée.
- [x] **Automatisation BNP Épargne Entreprise (PEE & PERO Cardif Retraite)** :
  - Parseur PDF officiel et CSV (`pee_import_service.py`) calibré et validé directement sur le relevé de situation Schneider Electric France / BNP Paribas.
  - Détection automatique et séparation propre entre le **PEE** (Schneider Actionnariat, HSBC EE Actions Monde, Schneider Dynamique) et le **PERO Retraite** (Cardif Retraite : BNP Paribas Easy MSCI Europe SRI, Morgan Stanley Global Opportunity, Multipar Actions PME-ETI).
  - Calcul rétro-ingénierie automatique de la VL unitaire et du PRU unitaire d'après les plus-values et les parts du relevé.
  - Création/mise à jour automatique de l'enveloppe `BNP Cardif - PERO Retraite` et de l'enveloppe PEE avec mise à jour des positions holdings à l'euro près.
  - Modal frontend ergonomique `PeeImportModal.jsx` avec drag & drop du PDF, aperçu visuel en deux volets et validation en 1 clic.

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

## 6. Règles de Contribution pour le Prochain Modèle
1. **Conserver la simplicité locale** : ne pas forcer de cloud payant ; SQLite suffit largement pour un patrimoine personnel.
2. **Ne jamais casser l'expérience Livrets / PEE** : ces supports n'ont pas de ticker Yahoo Finance direct, ils doivent toujours rester facilement éditables sans forcer de ticker.
3. **Mettre à jour ce fichier (`PROJECT_STATUS.md`)** dès qu'une nouvelle fonctionnalité majeure est achevée.
