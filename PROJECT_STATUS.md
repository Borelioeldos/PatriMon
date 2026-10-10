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
- **Mobile-Friendly & Home Assistant** : l'interface web est responsive et conçue pour être consultée depuis un smartphone, déployée en tant que **Module Complémentaire (Add-on) officiel Home Assistant OS avec Ingress natif**.

---

## 2. Architecture Technique & Fichiers Clés

```
Suivie_Patrimoine/
├── GEMINI.md                        # Règles directrices absolues (cycle de dév, validation locale, Ingress, DSP2)
├── repository.yaml / json           # Déclaration du dépôt officiel d'Add-ons Home Assistant
├── DOCKER_DEPLOYMENT.md             # Guide complet de déploiement Docker, HA OS et accès smartphone PWA
├── docker-compose.yml               # Déploiement de production multi-plateforme autonome
├── Dockerfile                       # Dockerfile racine multi-stage (Node 20 + Python 3.12)
├── patrimon/                        # Module Complémentaire (Add-on) Home Assistant
│   ├── config.yaml                  # Configuration HA Add-on (v1.0.4, Ingress natif, ports, volumes share & config)
│   ├── Dockerfile                   # Build autonome multi-stage pour le Supervisor Home Assistant
│   ├── DOCS.md                      # Documentation intégrée à l'UI Home Assistant
│   ├── CHANGELOG.md                 # Historique des versions de l'Add-on (v1.0.0 à v1.0.4)
│   ├── icon.png / logo.png          # Iconographie officielle de l'add-on
├── backend/
│   ├── app/
│   │   ├── database.py              # Configuration SQLite via SQLModel (paths dynamiques PATRIMON_DB_PATH)
│   │   ├── models.py                # Modèles SQLModel : Account, Holding, PortfolioSnapshot, Transaction, BankConnection, BankAccountMapping, DriveSyncLog
│   │   ├── main.py                  # FastAPI app avec CORS, Ingress static mount et routes API
│   │   ├── routers/
│   │   │   ├── accounts.py          # CRUD comptes + endpoint /seed-initial
│   │   │   ├── holdings.py          # CRUD holdings (gère actions, crypto, fonds PEE et livrets)
│   │   │   ├── portfolio.py         # GET /api/portfolio/summary, /benchmarks, /benchmark-comparison
│   │   │   ├── market.py            # Recherche de tickers et cotation unitaire
│   │   │   ├── transactions.py      # CRUD transactions, calcul PRU, stats de flux
│   │   │   ├── pee.py               # Import relevés PDF/CSV BNP Épargne Entreprise & PERO
│   │   │   ├── open_banking.py      # Synchro bancaire DSP2 Enable Banking & Mode Démo
│   │   │   └── google_drive.py      # Synchro cloud Google Drive Bourse (arborescence, import 1-clic, logs)
│   │   └── services/
│   │       ├── market_service.py    # Service yfinance avec cache 30s + conversion EUR et alias (BMW.DE, IUSA.DE, SX5E.AS, BTC-EUR)
│   │       ├── portfolio_service.py # Agrégation financière, calculs plus-values, snapshots 30j
│   │       ├── transaction_service.py # Moteur PRU pondéré (Weighted Average Cost), cessions, ajustement cash
│   │       ├── performance_service.py # Moteur TWR (Time-Weighted Return) & MWR / TRI (XIRR)
│   │       ├── benchmark_service.py # Comparateur d'indices (MSCI World, S&P 500, CAC 40, Bitcoin)
│   │       ├── pee_import_service.py# Parseur PDF officiel BNP EE (Schneider Electric) & CSV
│   │       ├── open_banking_service.py # Client Enable Banking DSP2 (JWT RS256, date_from dynamique, PDNG + BOOK, pagination, auto-guérison)
│   │       ├── google_drive_service.py # Client Google Drive API v3 (détection miroir /config/patrimon/ & /data/, md5Checksum)
│   │       ├── sync_scheduler_service.py # Planificateur de synchronisation automatique périodique
│   │       ├── transaction_enricher.py   # Nettoyage libellés bancaires, catégorisation intelligente, déduplication
│   │       ├── bourso_trade_parser.py    # Parseur avis d'opérés BoursoBank PEA (ordres, PRU, dédoublonnage)
│   │       ├── bourso_statement_parser.py# Parseur relevé de titres mensuel BoursoBank PEA (cash + ETF)
│   │       └── revolut_csv_parser.py     # Parseur multi-CSV Revolut (CTO, PnL, Crypto BTC, dividendes)
│   ├── certs/                       # Paires de clés RSA 2048 statiques permanentes (.pem)
│   ├── open_banking_config.json     # Configuration Open Banking locale sécurisée
│   ├── requirements.txt             # Dépendances Python
│   ├── run.py                       # Lanceur Uvicorn sur 0.0.0.0:8000 avec auto-migration des données
│   └── patrimoines.db               # Base SQLite locale PC
├── frontend/
│   ├── src/
│   │   ├── services/api.js          # Helper getApiBase() normalisé Ingress & proxy Vite
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Floating Glass Island Header, thème sombre/clair, mode discret P, auto-refresh
│   │   │   ├── KPICards.jsx         # 4 KPI haute précision : Patrimoine Net, Investissements, Trésorerie, Dividendes
│   │   │   ├── PerformanceMetrics.jsx # Cartes TWR %, TRI / MWR %, Dividendes encaissés, Plus-values réalisées
│   │   │   ├── AllocationsCharts.jsx# Graphiques interactifs : Évolution, vs Benchmarks, Banques, Classes d'actifs, Palmarès
│   │   │   ├── AccountsList.jsx     # Accordéon des comptes, badges, import PEE, synchro DSP2
│   │   │   ├── TransactionsList.jsx # Journal filtrable des transactions avec rafraîchissement réactif
│   │   │   ├── AddTransactionModal.jsx # Modal ajout transaction assistée (calcul PRU live, presets)
│   │   │   ├── AddAssetModal.jsx    # Modal d'ajout à 3 onglets (Livrets, Bourse/Crypto, PEE)
│   │   │   ├── AddAccountModal.jsx  # Modal création nouveau compte
│   │   │   ├── PeeImportModal.jsx   # Modal drag & drop relevé PDF/CSV BNP EE + détection PERO
│   │   │   ├── BankSyncModal.jsx    # Modal Open Banking DSP2 & ordonnanceur périodique
│   │   │   ├── DriveSyncModal.jsx   # Modal Google Drive Bourse (état cloud, synchro 1-clic, logs)
│   │   │   ├── StrategyModal.jsx    # Matrice d'allocation cible, calculateur DCA et projections FIRE
│   │   │   └── AssetDetailModal.jsx # Consultation fiche détaillée par actif
│   │   ├── App.jsx                  # État global, polling 30s, gestion des modals
│   │   └── main.jsx / index.css     # Montage React, tokens CSS Fintech, polices Plus Jakarta Sans & JetBrains Mono
│   ├── vite.config.js               # base: './', proxy Vite vers http://127.0.0.1:8000, host 0.0.0.0
│   └── package.json                 # React 18, Vite 5, Tailwind 3, Lucide-react, Recharts
├── scripts/
│   ├── prepare_docker_data.py       # Script d'initialisation et de copie des données vers ./data/
│   └── prepare_docker_data.bat      # Lanceur Windows 1-clic pour prepare_docker_data
├── start.bat                        # Lanceur Windows 1-clic (démarre backend & frontend locaux)
├── README.md                        # Documentation générale utilisateur
└── PROJECT_STATUS.md                # [CE FICHIER] Guide de passation, état d'avancement & Todo
```

---

## 3. Ce qui est Déjà Réalisé & Fonctionnel

### Phase 1 Complète : Socle Temps Réel & Multi-Établissements
- [x] **Backend FastAPI opérationnel** :
  - Base SQLite configurée avec initialisation automatique des tables (`init_db`).
  - Prise en charge des devises étrangères avec conversion automatique des devises en EUR via `yfinance`.
  - Cache mémoire à 30 secondes pour les flux de cotations et 600 secondes pour les taux de change.
  - Endpoint de pré-remplissage (`/api/accounts/seed-initial`) avec les 4 institutions de Borel.
  - Gestion unifiée des actifs : Bourse, Crypto, Fonds PEE, et Livrets d'épargne (taux fixe 1,00 €).
- [x] **Frontend React + Tailwind + Recharts** :
  - Auto-Refresh temps réel (30s) avec compte à rebours discret.
  - Graphiques interactifs : Évolution 30j, Par Banque, Par Classe d'Actif, Palmarès Titres.
  - Gestion dédiée de l'épargne / livrets BNP (édition directe en 1 clic).

---

### Phase 2 Complète : Historique des Transactions & Calculs Financiers Avancés
- [x] **Table des Transactions & Moteur PRU** :
  - Types d'opérations : Achat (`BUY`), Vente (`SELL`), Versement (`DEPOSIT`), Retrait (`WITHDRAWAL`), Dividende reçu (`DIVIDEND`).
  - Formule du PRU pondéré (*Weighted Average Cost*) calculée en direct à chaque achat.
  - Calcul automatique des plus-values réalisées lors des cessions de titres.
  - Débit / Crédit synchronisé du solde espèces (`cash_balance`) du compte associé.
  - Endpoint de recalcul rétroactif complet (`POST /api/transactions/recalculate-holding/{id}`).
- [x] **Métriques de Performance Réelles (Standards GIPS & Actuariat)** :
  - **TWR (Time-Weighted Return)** : Rendement financier pur des actifs isolant totalement les flux de capitaux.
  - **MWR / TRI (Taux de Rendement Interne / XIRR)** : Rendement effectif pondéré par l'argent avec réconciliation des capitaux d'origine.
  - **Composant `PerformanceMetrics.jsx`** : Cartes visuelles TWR %, TRI %, dividendes perçus et plus-values réalisées.
- [x] **Comparaison avec des Indices de Référence (Benchmarks)** :
  - Indices intégrés : **MSCI World** (`CW8.PA`), **S&P 500** (`^GSPC`), **CAC 40** (`^FCHI`), **Bitcoin** (`BTC-EUR`).
  - Périodes sélectionnables : 1 mois, 3 mois, 6 mois, 1 an avec normalisation base 0% et calcul d'Alpha.

---

### Phase 3 Complète : Automatisation Externe, DSP2 (Enable Banking), Synchro Régulière & Auto-Remplissage
- [x] **Intégration API Enable Banking (PSD2 / DSP2)** :
  - Standard européen ouvert avec signature locale par **JWT asymétrique RS256**.
  - Paires de clés RSA 2048-bit statiques stockées dans `backend/certs/`.
  - Durée de validité bridée à 89 jours (norme DSP2).
- [x] **Synchronisation Périodique en Tâche de Fond (`sync_scheduler_service.py`)** :
  - Planificateur non bloquant intégré au cycle de vie FastAPI.
  - Fréquence paramétrable (1h, 4h, 12h, 24h) persistée dans `sync_scheduler_config.json`.
  - Actualisation conjointe des soldes, des nouvelles transactions et du snapshot journalier.
- [x] **Remplissage Automatique & Catégorisation Intelligente (`transaction_enricher.py`)** :
  - Saisie manuelle assistée avec détection automatique du ticker, calcul croisé montant/quantité et presets récurrents.
  - Nettoyage des libellés bancaires bruts (suppression préfixes techniques) et classification parmi 12 catégories.
  - Déduplication stricte via `external_id`.
- [x] **Automatisation BNP Épargne Entreprise (PEE & PERO Cardif Retraite)** :
  - Parseur PDF officiel Schneider Electric / BNP Paribas avec séparation PEE (bloqué 5 ans) et PERO.
  - Rétro-ingénierie automatique de la VL unitaire et du PRU unitaire.
- [x] **Synchronisation Directe Cloud Google Drive Bourse (API v3)** :
  - Connexion Cloud directe avec dédoublonnage par empreinte `md5Checksum` (table `DriveSyncLog`).
  - Parseurs BoursoBank PEA (18 avis d'opérés d'ETF, relevé de titres mensuel).
  - Parseur multi-CSV Revolut (ordres US/EU, 25 dividendes encaissés pour 57,18 €, 10 achats Bitcoin BTC-EUR).

---

### Phase 4 Complète : Pilotage Stratégique, Allocation Cible & Projections FIRE
- [x] **Matrice d'Allocation Cible & Presets Stratégiques** :
  - Presets en 1 clic (*Équilibré 60/30/10*, *Offensif 75/15/10*, *All-Weather*, *Prudent*, *Sur-mesure*) persistés dans `strategy_config.json`.
  - Analyse en temps réel des écarts (Deltas % et €) avec statuts visuels (*À renforcer*, *Conforme*, *Surpondéré*).
- [x] **Calculateur de Versement Mensuel (DCA Intelligent Sans Vente)** :
  - Optimisation financière sans frottement fiscal avec suggestions d'enveloppes (PEA, CTO, PEE, Livrets).
- [x] **Simulateur d'Intérêts Composés & Projections Long Terme** :
  - Projections multi-horizons (5 à 35 ans) avec capitalisation mensuelle et détection de l'**Année Crossover**.
- [x] **Module d'Indépendance Financière (FIRE)** :
  - Calcul du capital cible selon la règle des 4% (*Safe Withdrawal Rate*), paliers Lean / Standard / Fat FIRE.
- [x] **Refonte Visuelle "Quiet Luxury / High-End Fintech"** :
  - Suppression définitive du double-cadre ("Doppelrand"), cartes `.fintech-card`, thème OLED Obsidian et Porcelaine Suisse.
  - Mode confidentialité instantané (touche clavier `P` ou bouton "Discret").

---

### Phase 5 Complète : Conteneurisation Docker, Add-on Home Assistant & Ingress Natif (v1.0.0 ➔ v1.0.4)

- [x] **Architecture Multi-Stage & Conteneur Unique (Port 8000)** :
  - `Dockerfile` multi-stage (`node:20-alpine` + `python:3.12-slim`) servant simultanément l'API FastAPI et la SPA React compilée.
  - Variables d'environnement standardisées (`PATRIMON_DATA_DIR`, `PATRIMON_DB_PATH`, `PATRIMON_STATIC_DIR`, `PATRIMON_PORT`).
  - Healthcheck Docker intégré sur `/api/portfolio/summary`.
- [x] **Module Complémentaire Officiel Home Assistant (`patrimon/`)** :
  - Dépôt HA structuré avec `repository.yaml`, `repository.json`, et sous-dossier `patrimon/`.
  - `config.yaml` conforme aux spécifications Supervisor : support multi-architectures (`amd64`, `aarch64`, `armv7`, etc.), démarrage automatique, mapping des volumes `share:rw` et `config:rw`.
- [x] **Intégration Native Home Assistant Ingress (v1.0.1 & v1.0.2)** :
  - Activation native via `ingress: true` et `ingress_port: 8000` permettant le switch standard **"Afficher dans la barre latérale"** dans l'UI Home Assistant.
  - **Résolution du bug de la page blanche Ingress (v1.0.2)** :
    - Préservation du `request.scope["root_path"]` dans FastAPI pour empêcher l'altération des chemins `StaticFiles` (qui causait une 404 sur les scripts JS et CSS).
    - Configuration de Vite avec `base: './'`.
    - Helper dynamique `getApiBase()` dans `frontend/src/services/api.js` qui calcule automatiquement le préfixe relatif pour fonctionner indifféremment en direct (`http://localhost:8000`), via Vite dev (`http://localhost:5173`) ou encapsulé dans l'Ingress Home Assistant (`/api/hassio_ingress/...`).
- [x] **Persistance Multi-Environnements Résistante aux Rebuilds (v1.0.3)** :
  - Base de données SQLite persistée sous `/data/patrimoines.db`.
  - Miroir dynamique des fichiers de configuration sensibles (`open_banking_config.json`, `mcp_oauth_tokens.json`) sous `/config/patrimon/`.
  - Permet aux jetons Google Drive OAuth et aux identifiants bancaires de survivre aux reconstructions de conteneur et d'être inclus dans les sauvegardes automatiques de Home Assistant.
- [x] **Résolution Intégrale de la Synchronisation DSP2 Enable Banking (v1.0.4)** :
  - **Plage temporelle dynamique `date_from`** : passage d'une date de début dynamique (jusqu'à 88 jours norme PSD2, ou 14 jours avant la plus récente transaction existante) résolvant le blocage où BoursoBank ne renvoyait qu'une seule transaction au lieu de tout l'historique.
  - **Prise en charge des statuts `BOOK` et `PDNG`** : interrogation conjointe des transactions comptabilisées et des autorisations en cours, assurant l'affichage immédiat des paiements par carte récents.
  - **Pagination complète** : parcours exhaustif via `continuation_key` jusqu'à épuisement des pages de transactions.
  - **Auto-guérison des liaisons bancaires** : détection et recréation automatique des comptes bancaires manquants en base de données (ex: Carte Visa Ultim BoursoBank réassociée sans erreur).
  - **Rafraîchissement réactif du frontend** : actualisation automatique de la liste des transactions (`await fetchTransactions()`) dans `TransactionsList.jsx` dès la fin d'une synchronisation.
  - Résultat validé en local : 4 comptes synchronisés avec succès, 6 nouvelles transactions ingérées et catégorisées sans doublon.

---

## 4. Protocole de Développement & Déploiement (Règle Absolue)

Inscrit dans le fichier racine `GEMINI.md`, ce protocole doit être **scrupuleusement respecté par tout agent IA** :

```
┌────────────────────────────────────────────────────────────────────────┐
│               CYCLE DE DÉVELOPPEMENT & DÉPLOIEMENT PATRIMON            │
├────────────────────────────────────────────────────────────────────────┤
│ 1. DÉVELOPPEMENT & TESTS LOCAUX                                       │
│    - Modifier le code dans backend/ ou frontend/                       │
│    - Lancer et tester en local sur le PC de Borel (FastAPI / Vite)     │
│    - Vérifier les logs, l'absence de régression et le build Vite       │
├────────────────────────────────────────────────────────────────────────┤
│ 2. VÉRIFICATION PAR L'UTILISATEUR                                      │
│    - L'utilisateur teste directement sur son poste                     │
│    - L'utilisateur constate le bon fonctionnement                      │
├────────────────────────────────────────────────────────────────────────┤
│ 3. VALIDATION EXPLICITE OBLIGATOIRE (POINT D'ARRÊT STRICT)             │
│    - ATTENDRE le message clair de l'utilisateur :                      │
│      "C'est validé", "Tu peux déployer", "Passe à la release"...        │
│    - NE JAMAIS builder Docker, bumper de version ni pousser sur Git    │
│      avant cette validation explicite !                                │
├────────────────────────────────────────────────────────────────────────┤
│ 4. PACKAGING, BUMP DE VERSION & DÉPLOIEMENT                            │
│    - Bumper la version (patrimon/config.yaml, patrimon/Dockerfile)     │
│    - Compiler le frontend (npm run build)                              │
│    - Git commit & push sur la branche main                             │
│    - Mettre à jour l'Add-on sur Home Assistant (via MCP si demandé)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Comment Lancer le Projet (Cheat Sheet)

### Lancement Rapide en Local (PC Borel)
Double-cliquer sur `start.bat` à la racine (démarre automatiquement le backend FastAPI et le frontend Vite).

### Lancement Manuel en Local

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
- Application Web : `http://localhost:5173`
- Accès Mobile Réseau Local : `http://<IP_LOCALE_DU_PC>:5173`

### Lancement via Docker Autonome (PC ou Serveur)
```powershell
python scripts/prepare_docker_data.py
docker-compose up -d --build
```
- Application disponible sur `http://localhost:8000`

### Utilisation sur Home Assistant OS
1. Dans Home Assistant : **Paramètres** ➔ **Modules complémentaires** ➔ **Boutique de modules complémentaires** ➔ Menu trois points ➔ **Dépôts**.
2. Ajouter le dépôt Git : `https://github.com/Borelioeldos/PatriMon`.
3. Installer le module **PatriMon**.
4. Activer le toggle **"Afficher dans la barre latérale"** et cliquer sur **Démarrer**.
5. Ouvrir PatriMon directement depuis la barre latérale ou via le bouton "Ouvrir l'interface Web".

---

## 6. Règles & Retours d'Expérience Techniques

1. **Test local et validation préalable obligatoire** : Ne jamais déclencher de build Docker, de bump de version, de commit de release ou de mise à jour Home Assistant sans validation explicite préalable de l'utilisateur sur son poste local.
2. **Intégration Home Assistant Ingress** :
   - Toujours conserver `ingress: true` et `ingress_port: 8000` dans `patrimon/config.yaml`.
   - Ne **jamais** modifier `request.scope["root_path"]` dans un middleware FastAPI pour Ingress, sous peine de corrompre le routage de `StaticFiles` (page blanche / 404 sur les assets JS et CSS).
   - Dans le frontend SPA Vite, conserver `base: './'` et utiliser le helper dynamique `getApiBase()` dans `frontend/src/services/api.js`.
3. **Persistance multi-environnements** :
   - La base de production en conteneur réside sous `/data/patrimoines.db`.
   - Les configurations sensibles (`open_banking_config.json`, `mcp_oauth_tokens.json`) doivent être détectées et sauvegardées en miroir sous `/config/patrimon/` afin de survivre aux reconstructions de conteneur et d'être incluses dans les sauvegardes Home Assistant.
4. **Synchronisation DSP2 (Enable Banking)** :
   - Toujours passer un paramètre `date_from` (maximum 88 jours norme PSD2) pour que les banques (notamment BoursoBank) renvoient l'historique complet.
   - Interroger conjointement les statuts `BOOK` (comptabilisé) et `PDNG` (en attente) pour capturer les paiements par carte récents en direct.
   - Toujours consommer la `continuation_key` jusqu'à épuisement des pages de transactions.
   - En cas d'incohérence ou de compte supprimé/manquant en base, réassocier automatiquement le compte pour éviter les ruptures de synchronisation.
    - Signature asymétrique RS256 souveraine via les clés permanentes dans `backend/certs/`. Durée de validité `valid_until` bridée à 89 jours.
    - **Gestion anti-doublons et réconciliation `BOOK` vs `PDNG`** :
      - Comparaison multi-critères : montant à 1 centime près, même type d'opération, fenêtre temporelle tolérante de ±4 jours (décalage autorisation vs débit carte/SEPA), et proximité du libellé marchand/tokens signifiants.
      - Réconciliation ascendante : lorsqu'une opération comptabilisée (`BOOK`) arrive avec son identifiant bancaire officiel, elle met à jour et absorbe automatiquement l'opération temporaire (`eb_`) correspondante au lieu de créer un doublon.
      - Déduplication intra-lot : élimination des doublons entre pages et suppression automatique des autorisations en cours lorsque la version comptabilisée est présente dans le même flux.
      - Purge automatique au démarrage (`init_db`) et à chaque synchronisation (`cleanup_duplicate_transactions`).
5. **Conserver la simplicité locale** : SQLite (`patrimoines.db`) suffit largement pour un patrimoine personnel ; pas de dépendance cloud payante obligatoire.
6. **Ne jamais casser l'expérience Livrets / PEE** : Ces supports n'ont pas de ticker Yahoo Finance direct, ils doivent toujours rester facilement éditables sans forcer de ticker boursier.
7. **Google Drive API (v3)** : Authentification OAuth avec rafraîchissement automatique de token, stream mémoire et dédoublonnage strict par empreinte `md5Checksum`.
8. **Robustesse du Parsing CSV Financier (Revolut & Courtiers)** :
   - Séparateurs de milliers : supprimer la virgule de milliers précédant un point (`€93,126.88`) pour éviter les plantages silencieux de `float()`.
   - Espaces insécables Unicode (`\u202f`, `\xa0`) : normaliser systématiquement en espaces standards avant `strptime`.
   - Toujours renseigner `amount_eur` et `fees_eur` lors de la création d'une transaction pour fiabiliser les calculs GIPS (TRI/MWR, TWR, dividendes).
9. **Résolution d'Alias Yahoo Finance** :
   - `853292` (BMW sur Revolut) -> `BMW.DE`
   - `IUSA` -> `IUSA.DE`
   - `CSX5.PA` -> `CSX5.AS`
   - `BTC` -> `BTC-EUR`
10. **Mettre à jour ce fichier (`PROJECT_STATUS.md`)** dès qu'une nouvelle fonctionnalité majeure ou correction de déploiement est achevée.

---

## 7. État Actuel & Prochaines Étapes

### État Actuel
- **Code source local** : Prêt pour validation utilisateur en local sur PC.
- **Dédoublonnage DSP2** :
  - Algorithme de réconciliation implémenté et testé avec 19 tests unitaires validés (`Ran 19 tests, OK`).
  - Nettoyage des 3 doublons historiques de la base de données locale (`backend/patrimoines.db`).
  - Boutons anti-doublons ajoutés dans la modale de synchronisation et la liste des transactions.
  - Purge automatique intégrée au démarrage du backend.

### Prochaines Étapes Envisagées :
- [ ] Test et vérification par l'utilisateur en local sur son PC.
- [ ] Validation explicite de l'utilisateur avant toute étape de packaging Docker ou de déploiement Home Assistant.

