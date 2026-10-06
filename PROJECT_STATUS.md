# 📋 État du Projet & Guide de Reprise — PatriMon

> **Note pour l'Agent IA reprenant ce projet** :  
> Ce document contient l'intégralité du contexte technique, des choix d'architecture, de l'état d'avancement et des prochaines tâches. Vous pouvez vous y référer directement sans avoir à relire l'historique complet des conversations.

---

## 1. Vue d'Ensemble & Objectif du Projet

**PatriMon** est une application web personnelle de suivi de patrimoine en temps réel, conçue pour être :
- **Souveraine & locale** : les données sont stockées en local sur la machine de l'utilisateur (base SQLite patrimoines.db), sans abonnement payant ni dépendance cloud obligatoire.
- **Temps réel** : cotations en direct des actifs boursiers et cryptos via Yahoo Finance (yfinance), avec conversion automatique des devises en EUR.
- **Multi-établissements** : adaptée précisément aux comptes réels de l'utilisateur (**Borel**) :
  1. **BoursoBank** : Compte courant + PEA (ETF World CW8.PA, S&P 500...).
  2. **Revolut** : Compte courant + Coffres épargne + CTO (Actions US ex: AAPL) + Crypto (BTC, ETH...).
  3. **BNP Paribas** : Compte courant + Livrets d'épargne réglementés (Livret A, LDDS...).
  4. **BNP Épargne Entreprise (PEE)** : Fonds FCPE avec abondement entreprise.
- **Mobile-Friendly** : l'interface web est responsive et conçue pour être consultée depuis un smartphone sur le réseau Wi-Fi local, avec possibilité future de conteneurisation Docker sur un vieux PC tournant sous **Home Assistant OS**.

---

## 2. Architecture Technique & Fichiers Clés


Suivie_Patrimoine/
├── backend/
│   ├── app/
│   │   ├── database.py              # Configuration SQLite via SQLModel (tables: account, holding, portfoliosnapshot, transaction, bankconnection, bankaccountmapping, drivesynclog)
│   │   ├── models.py                # Modèles SQLModel : Account, Holding, PortfolioSnapshot, Transaction, BankConnection, BankAccountMapping, DriveSyncLog
│   │   ├── main.py                  # FastAPI app v3.0 avec CORS et inclusion des 13 groupes de routes
│   │   ├── routers/
│   │   │   ├── accounts.py          # CRUD comptes + endpoint /seed-initial
│   │   │   ├── holdings.py          # CRUD holdings (gère actions, crypto, fonds PEE et livrets)
│   │   │   ├── portfolio.py         # GET /api/portfolio/summary, /benchmarks, /benchmark-comparison
│   │   │   ├── market.py            # Recherche de tickers et cotation unitaire
│   │   │   ├── transactions.py      # CRUD transactions, calcul PRU, stats de flux (Phase 2)
│   │   │   ├── pee.py               # Phase 3 : Import relevés PDF/CSV BNP Épargne Entreprise & PERO
│   │   │   ├── open_banking.py      # Phase 3 : Synchro bancaire DSP2 Enable Banking & Mode Démo
│   │   │   └── google_drive.py      # Phase 3 : Synchro cloud Google Drive Bourse (arborescence, import 1-clic, logs)
│   │   └── services/
│   │       ├── market_service.py    # Service yfinance avec cache 30s + conversion EUR et alias (BMW.DE, IUSA.DE, SX5E.AS, BTC-EUR)
│   │       ├── portfolio_service.py # Agrégation financière, calculs plus-values, snapshots 30j
│   │       ├── transaction_service.py # Moteur PRU pondéré (Weighted Average Cost), cessions, ajustement cash
│   │       ├── performance_service.py # Moteur TWR (Time-Weighted Return) & MWR / TRI (XIRR)
│   │       ├── benchmark_service.py # Comparateur d'indices (MSCI World, S&P 500, CAC 40, Bitcoin)
│   │       ├── pee_import_service.py# Phase 3 : Parseur PDF officiel BNP EE (Schneider Electric) & CSV
│   │       ├── open_banking_service.py# Phase 3 : Client API Enable Banking DSP2 (JWT RS256) + auto-création comptes
│   │       ├── google_drive_service.py# Phase 3 : Client Google Drive API v3 (OAuth auto-refresh, stream mémoire, md5Checksum)
│   │       ├── bourso_trade_parser.py # Phase 3 : Parseur avis d'opérés BoursoBank PEA (ordres, PRU, dédoublonnage)
│   │       ├── bourso_statement_parser.py # Phase 3 : Parseur relevé de titres mensuel BoursoBank PEA (cash + ETF)
│   │       └── revolut_csv_parser.py  # Phase 3 : Parseur multi-CSV Revolut (CTO, PnL, Crypto BTC, dividendes 57,18 €)
│   ├── certs/                       # Phase 3 : Paires de clés RSA 2048 statiques permanentes (.pem)
│   ├── open_banking_config.json     # Configuration locale sécurisée (Application ID, clés statiques)
│   ├── requirements.txt             # fastapi, uvicorn, sqlmodel, yfinance, httpx, pypdf, pyjwt, cryptography, google-api-python-client, google-auth
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
│   │   │   ├── BankSyncModal.jsx    # Phase 3 : Modal Open Banking DSP2 (BoursoBank, BNP, Revolut)
│   │   │   └── DriveSyncModal.jsx   # Phase 3 : Modal Google Drive Bourse (état cloud, synchro 1-clic, logs)
│   │   ├── App.jsx                  # State principal, polling 30s, gestion des modals
│   │   └── main.jsx / index.css     # Montage React et styles Tailwind CSS
│   ├── vite.config.js               # Proxy Vite vers http://127.0.0.1:8000 + host 0.0.0.0
│   └── package.json                 # React 18, Vite 5, Tailwind 3, Lucide-react, Recharts
├── start.bat                        # Lanceur Windows 1-clic (démarre backend & frontend)
├── README.md                        # Documentation utilisateur
├── plan_initial.md                  # Premier plan d'action de cadrage
├── plan_phase_3.md                  # Plan d'exécution validé Phase 3
└── PROJECT_STATUS.md                # [CE FICHIER] Guide de passation & Todo


---

## 3. Ce qui est Déjà Réalisé & Fonctionnel

### Phase 1 Complète
- [x] **Backend FastAPI opérationnel** :
  - Base SQLite configurée avec initialisation automatique des tables (init_db).
  - Prise en charge des devises étrangères avec taux de change dynamiques (USD, GBP convertis en EUR).
  - Cache en mémoire optimisé à 30 secondes pour les flux de cotations.
  - Endpoint de pré-remplissage (/api/accounts/seed-initial) avec les 4 institutions de l'utilisateur.
  - Gestion unifiée des actifs : Bourse, Crypto, Fonds manuels PEE, et Livrets d'épargne (taux fixe 1,00 €).
- [x] **Frontend React + Tailwind + Recharts** :
  - **Auto-Refresh temps réel (30 secondes)** avec indicateur vert clignotant et compte à rebours visuel.
  - **Graphiques interactifs intégrés** : Évolution 30j, Par Banque, Par Classe d'Actif, Palmarès Titres.
  - **Gestion dédiée de l'épargne / livrets BNP** (édition en 1 clic).

### Phase 2 Complète (Historique des Transactions & Calculs Financiers Avancés)
- [x] **Table des Transactions (Transaction) & Moteur PRU** :
  - Types d'opérations : Achat (BUY), Vente (SELL), Versement (DEPOSIT), Retrait (WITHDRAWAL), Dividende reçu (DIVIDEND).
  - Formule du PRU pondéré (Weighted Average Cost) calculée en temps réel lors de chaque achat :  
    Nouveau_PRU = (Ancienne_Qté × Ancien_PRU + Qté_Achetée × Prix_Achat + Frais) / Nouvelle_Qté.
  - Calcul automatique des plus-values réalisées lors des cessions de titres.
  - Débit / Crédit synchronisé du solde espèces (cash_balance) du compte associé.
  - Endpoint de recalcul rétroactif complet (POST /api/transactions/recalculate-holding/{id}).
- [x] **Métriques de Performance Réelles (Standards GIPS & Actuariat)** :
  - **TWR (Time-Weighted Return)** : Rendement financier pur des actifs isolant totalement les entrées/sorties de fonds.
  - **MWR / TRI (Taux de Rendement Interne / XIRR)** : Rendement effectif pondéré par l'argent prenant en compte la date exacte de chaque versement/retrait, avec réconciliation des capitaux d'origine.
  - **Composant PerformanceMetrics.jsx** : Cartes visuelles TWR %, TRI %, total des dividendes reçus en cash et total des plus-values réalisées.
- [x] **Comparaison avec des Indices de Référence (Benchmarks)** :
  - Indices intégrés : **MSCI World** (CW8.PA), **S&P 500** (^GSPC), **CAC 40** (^FCHI), **Bitcoin** (BTC-EUR).
  - Périodes sélectionnables : 1 mois, 3 mois, 6 mois, 1 an.
  - Graphique multi-courbes en % avec normalisation en base 0% et calcul d'**Alpha** (surperformance / sous-performance).
- [x] **Interface Journal & Modals** :
  - TransactionsList.jsx : Journal filtrable par type et par compte avec suppression et statuts colorés.
  - AddTransactionModal.jsx : Formulaire interactif avec simulation en direct du nouveau PRU et de la plus-value attendue.

### Phase 3 Complète : Automatisation des Flux Externes, DSP2 (Enable Banking), Synchro Régulière & Auto-Remplissage des Transactions

- [x] **Transition vers l'API Enable Banking (PSD2 / DSP2)** :
  - Remplacement complet de GoCardless par le standard européen ouvert **Enable Banking**.
  - Signature locale et souveraine des requêtes HTTP via **JWT asymétrique RS256** (cryptography et pyjwt).
  - Prise en charge des contraintes réglementaires européennes DSP2 (durée de validité valid_until bridée à 89 jours, formats ASPSP stricts).
  - Mode Démo / Simulation instantané maintenu pour tester l'UI et les flux sans compte bancaire réel.

- [x] **Clés RSA Statiques & Permanentes (Zéro Clé Dynamique)** :
  - Paire de clés RSA 2048-bit permanente stockée dans [backend/certs/enable_banking_public.pem](file:///c:/Users/Borel/Desktop/Suivie_Patrimoine/backend/certs/enable_banking_public.pem) et [backend/certs/enable_banking_private.pem](file:///c:/Users/Borel/Desktop/Suivie_Patrimoine/backend/certs/enable_banking_private.pem).
  - Protection contre les régénérations intempestives et copie 1-clic dans BankSyncModal.jsx.

- [x] **Synchronisation Automatique & Périodique en Tâche de Fond (sync_scheduler_service.py)** :
  - Moteur de planification asynchrone non bloquant intégré au cycle de vie FastAPI (lifespan).
  - Fréquence paramétrable en 1 clic : **1 heure**, **4 heures (recommandé)**, **12 heures**, ou **24 heures**.
  - Persistance dans [backend/sync_scheduler_config.json](file:///c:/Users/Borel/Desktop/Suivie_Patrimoine/backend/sync_scheduler_config.json).
  - Synchronisation automatique et conjointe :
    1. Soldes bancaires réels de tous les comptes liés.
    2. Téléchargement et intégration des nouvelles transactions.
    3. Actualisation du snapshot de patrimoine journalier (PortfolioSnapshot).
  - Nouvel onglet dédié dans BankSyncModal.jsx avec état en temps réel, compte à rebours avant la prochaine exécution, switch d'activation et bouton de déclenchement forcé.

- [x] **Remplissage Automatique & Catégorisation Intelligente des Transactions (transaction_enricher.py)** :
  - **Saisie manuelle assistée (AddTransactionModal.jsx)** :
    - Détection automatique dès la saisie du symbole / ticker (ex: CW8.PA, AAPL, BTC-EUR) : récupération en direct du nom officiel, du cours actuel de marché et de la devise.
    - Calcul mathématique croisé temps réel : la quantité renseigne le montant total (quantité × cours + frais), ou le montant renseigne la quantité suggérée.
    - Pré-remplissage automatique des catégories et suggestions d'intitulés / notes.
    - Raccourcis en 1 clic (Presets) pour les flux récurrents : *Salaire Schneider*, *Courses Carrefour*, *EDF / TotalEnergies*, *Abonnements*, *SNCF*, *Virement Épargne*.
  - **Synchronisation bancaire automatique DSP2** :
    - Détection du débit/crédit (credit_debit_indicator), normalisation du montant et détection de l'opération (DEPOSIT, WITHDRAWAL, DIVIDEND, BUY).
    - Nettoyage automatique des libellés bancaires bruts (suppression des préfixes techniques PAIEMENT CARTE, PRLV SEPA, dates, codes postaux) pour extraire le vrai nom du tiers / commerçant.
    - Classification automatique parmi 12 catégories intelligentes (*Alimentation & Courses*, *Logement & Énergie*, *Revenus & Salaires*, *Investissement & Épargne*, *Abonnements & Médias*, etc.).
    - Déduplication infaillible via external_id : aucun risque de doublon lors des synchronisations régulières.
  - **Journal des flux (TransactionsList.jsx)** :
    - Colonne et badges de catégories colorés.
    - Filtre par catégorie dans la barre d'outils.
    - Badge DSP2 identifiant les opérations synchronisées automatiquement.

- [x] **Automatisation BNP Épargne Entreprise (PEE & PERO Cardif Retraite)** :
  - Parseur PDF officiel (pee_import_service.py) calibré sur le relevé de situation Schneider Electric France / BNP Paribas.
  - Séparation automatique entre le **PEE** (fonds 5 ans bloqués) et le **PERO Retraite** (Cardif Retraite).
  - Rétro-ingénierie automatique de la VL unitaire et du PRU unitaire à partir des plus-values et des parts du document.
  - Modal frontend ergonomique PeeImportModal.jsx avec prévisualisation en deux volets et injection en 1 clic dans patrimoines.db.

- [x] **Synchronisation Directe Cloud Google Drive Bourse (API v3 & Parseurs Spécialisés)** :
  - **Connexion Cloud Officielle (google_drive_service.py)** :
    - Connexion directe à l'API Google Drive v3 via OAuth avec rafraîchissement automatique de jeton d'accès sans dépendance sur un disque local.
    - Exploration récursive du dossier officiel Document_perso > Bourse (1nA7R5KYPgqV6Y6PwvysZDp4B3A3-urmQ).
    - Dédoublonnage strict par empreinte md5Checksum et historique stocké dans la table SQLite DriveSyncLog.
  - **Moteur BoursoBank PEA (bourso_trade_parser.py & bourso_statement_parser.py)** :
    - Ingestion de **18 avis d'opérés réels** d'ETF (*Amundi Emerging ESG, BNP S&P 500, iShares MSCI World, Euro Stoxx 50*).
    - Extraction automatique des cours d'exécution, quantités, frais de courtage, dates et dédoublonnage par référence d'ordre unique (external_id = bourso_trade_...).
    - Recalcul dynamique du PRU pondéré et mise à jour du solde espèces PEA (**85,80 €**) et des positions via le relevé mensuel.
  - **Moteur Multi-CSV Revolut CTO & Crypto (revolut_csv_parser.py)** :
    - Détection et parsing automatique des 4 exports (trading-account-statement, trading-pnl-statement, crypto-account-statement, consolidated-statement).
    - Gestion fine des ordres d'actions US et européennes avec conversion dynamique des devises via FX Rate.
    - **Dividendes Encaissés (57,18 €)** : Ingestion et consolidation des 25 opérations de dividendes perçus (Apple, Nvidia, LVMH, Stellantis, Siemens, Volkswagen, TSMC, iShares S&P 500) avec catégorisation en Revenus de capitaux.
    - **Cryptomonnaies (Bitcoin BTC-EUR)** : Ingestion des 10 ordres d'achat réels avec parsing insensible aux séparateurs de milliers (ex: €93,126.88), normalisation des dates avec espaces insécables unicode (\u202f), PRU pondéré exact (**78 721,87 €**), capital investi réel (**1 408,57 €**), cotation live Yahoo Finance (BTC-EUR) et calcul de performance mathématiquement exact (**-3,67% / -51,76 €**).
- [x] **Améliorations Lot B & Expérience Utilisateur** :
  - **Saisie assistée d'ordres & Presets** : Autocomplétion intelligente par ticker, conversion instantanée cours/devises, presets de dépenses récurrentes (Salaires, Prélèvements, Versements programmés).
  - **Unification de marque BoursoBank** : Harmonisation complète sur la dénomination officielle "BoursoBank" (éliminant toute confusion avec l'ancien nom Boursorama).
  - **Précision financière BMW (WKN 853292)** : Résolution dynamique sur `BMW.DE` avec calcul validé des plus-values latentes et du PRU pondéré.
  - **Modal d'inspection détaillée d'actif (AssetDetailModal.jsx)** : Consultation en 1 clic de la fiche complète de chaque position (performance, poids, valeur actuelle, historique).

- [x] **Refonte Graphique "Quiet Luxury / High-End Fintech" & Ergonomie** :
  - **Typographie de prestige** : Adoption de `Plus Jakarta Sans` pour les interfaces et `JetBrains Mono` pour les données financières chiffrées tabulaires.
  - **Floating Glass Island Header (Navbar.jsx)** :
    - Élimination des éléments anxiogènes (badge "LIVE FEED", pastille verte clignotante, sous-titres techniques à décompte perpétuel).
    - Identité visuelle épurée avec emblème d'ascension patrimoniale et typographie contrastée.
    - Décompte d'actualisation élégamment logé dans le bouton auto-refresh (ex: `14s`, `30s`), date et heure dans l'infobulle.
  - **Grille de KPI Rééquilibrée (KPICards.jsx)** :
    - Suppression des doubles cadres concentriques ("Doppelrand") et des textes monospace criards.
    - 4 cartes indépendantes et homogènes : *Patrimoine Net Total*, *Investissements (Bourse & PEE)* avec TRI, *Trésorerie & Épargne* avec ratio de sécurité, et *Dividendes perçus* avec compteur d'opérations.
  - **Mode Confidentialité Instantané** : Touche clavier `P` ou bouton "Discret" pour flouter l'ensemble des chiffres sensibles lors de consultations en public.
  - **Validation & Zéro Régression** : 8/8 tests unitaires financiers passants, build Vite (`npm run build`) validé à 100%.

---

- [x] **Phase 4 Complète : Pilotage Stratégique, Allocation Cible & Projections FIRE (L'Outil Décisionnel)** :
  - **Matrice d'Allocation Cible & Presets Stratégiques** :
    - Presets professionnels en 1 clic : *Équilibré 60/30/10*, *Offensif Dynamique 75/15/10*, *All-Weather / Résilient*, *Prudent*, et mode *Sur-mesure*.
    - Persistance locale de la configuration dans `strategy_config.json`.
    - Analyse en temps réel des écarts (Deltas % et €) avec statuts visuels (*À renforcer*, *Conforme*, *Surpondéré*).
  - **Calculateur de Versement Mensuel (DCA Intelligent Sans Vente)** :
    - Algorithme d'optimisation financière sans frottement fiscal ni frais de courtage superflus.
    - Saisie d'un montant d'apport (presets +200 €, +300 €, +500 €, +1 000 €, +2 000 € ou montant libre).
    - Ventilation mathématique optimale comblant les déficits par ordre de priorité avec enveloppes d'investissement suggérées (PEA, CTO, PEE, Livrets).
    - Visualisation de la réduction des écarts (Delta avant vs Delta après versement).
  - **Simulateur d'Intérêts Composés & Projections Long Terme** :
    - Projections dynamiques multi-horizons (5 à 35 ans) avec capitalisation mensuelle discrète.
    - Sliders interactifs en direct : Capital initial (pré-rempli avec le patrimoine net live), Épargne mensuelle, Rendement espéré (World 7,5%, S&P 10%), Horizon et Inflation.
    - Graphique AreaChart empilé matérialisant l'effet boule de neige : *Capital Initial* vs *Versements Cumulés* vs *Intérêts Composés Générés*.
    - Détection automatique de l'**Année Crossover** (croisement où les intérêts annuels dépassent les versements annuels).
  - **Module d'Indépendance Financière (FIRE)** :
    - Calcul du capital cible d'indépendance financière selon la règle des 4% (*Safe Withdrawal Rate*).
    - Paliers *Lean FIRE (75%)*, *Standard FIRE (100%)* et *Fat FIRE (130%)*.
    - Rente mensuelle brute et réelle (pouvoir d'achat net d'inflation) générée à terme.
    - Pourcentage d'avancement et année prévisionnelle d'atteinte du FIRE.
  - **Refonte UI/UX Complète — Design Fintech Haute Précision (Stripe/Linear/Mercury/Revolut)** :
    - Installation et exploitation des compétences d'élite : `impeccable`, `emil-design-eng`, `vercel-react-best-practices`, `web-design-guidelines`, `data-visualization`.
    - **Suppression définitive du Doppelrand / Double-Bezel** : passage à une architecture de conteneurs uniques haut de gamme (`.fintech-card`, `.surface-subtle`).
    - **Palette & Maillage** : Thème sombre OLED Obsidian (`#06090F` avec mesh radial discret bleu/émeraude/indigo) et thème clair Porcelaine Suisse (`#F8FAFC`).
    - **Command Bar & Navigation** : Header flottant avec îlot central, toggle thème sombre/clair, toggle mode confidentialité (floutage 1-clic avec raccourci clavier `P`), auto-refresh 30s et accès rapide outils DSP2 / Google Drive.
    - **Journal des Opérations Rehaussé** : Mini-stats de trésorerie en direct (entrées, sorties, solde net), filtrage instantané multi-critères avec reset, tableau typographique haute lisibilité avec badges DSP2 et actions contextuelles.
    - **Modals Modernisés** : Dialogues à coque unique avec `backdrop-blur-md`, coins arrondis 2xl, inputs unifiés `.input-field` et fermeture au clic sur le fond.
    - **Retours Tactiles Physique** : Micro-interactions `.btn-haptic` (`active:scale-[0.98]`).
  - **Validation & Zéro Régression** : 12/12 tests unitaires passants (`backend/tests/`), build Vite (`npm run build`) validé à 100%.

---

- [x] **Phase 5 Complète : Conteneurisation Docker & Déploiement Permanent (Home Assistant OS / Vieux PC)** :
  - **Unification Full-Stack sous Conteneur Unique (Port 8000)** :
    - Dockerfile multi-stage (`node:20-alpine` + `python:3.12-slim`) servant simultanément les routes d'API, Swagger et la SPA React Vite sur le port `8000`.
    - Healthcheck Docker intégré interrogeant `/api/portfolio/summary`.
    - Fichier `.dockerignore` complet éliminant `node_modules`, `.git`, bases locales et caches du build context.
  - **Architecture de Persistance Centralisée (`/data`)** :
    - Base SQLite (`patrimoines.db`), configurations JSON (`open_banking_config.json`, `strategy_config.json`, `sync_scheduler_config.json`) et clés RSA stockées dans le volume persistant `/data`.
    - Migration douce et automatique : toute configuration existante est préservée et copiée vers `/data` sans friction.
  - **Module Complémentaire Local Home Assistant OS (Add-on Local)** :
    - Prise en charge native avec `config.yaml`, `DOCS.md`, `CHANGELOG.md`, `icon.png` et `logo.png` pour installation dans `/addons/patrimon`.
    - Démarrage automatique au boot, watchdog, et intégration dans la barre latérale ou dashboard via carte Page Web.
  - **Support Portainer & Docker Compose** :
    - `docker-compose.yml` de production avec politique `unless-stopped` et volumes nommés.
  - **Outils & Documentation Complète** :
    - Script 1-clic `scripts/prepare_docker_data.py` / `prepare_docker_data.bat` regroupant instantanément toutes les données dans `./data/`.
    - Guide exhaustif `DOCKER_DEPLOYMENT.md` détaillant l'installation Home Assistant OS, Portainer, l'accès smartphone 24/7 (PWA) et l'accès distant sécurisé (WireGuard / Tailscale).

---

## 4. Ce Qu'il Reste à Faire (Perspectives Futures)

Toutes les 5 phases de conception et de déploiement sont désormais **100% achevées et opérationnelles** :
- [x] Phase 1 : Cœur temps réel & multi-établissements (BoursoBank, BNP, Revolut, PEE).
- [x] Phase 2 : Transactions, moteur PRU pondéré & métriques financières avancées (TWR, TRI/MWR, Benchmarks).
- [x] Phase 3 : Automatisation externe DSP2 (Enable Banking), synchro périodique, import PEE Schneider et Google Drive Bourse.
- [x] Phase 4 : Pilotage stratégique, allocation cible, DCA intelligent et projections FIRE.
- [x] Phase 5 : Conteneurisation Docker & intégration Home Assistant OS pour accès permanent smartphone 24/7.

### Pistes d'Évolutions Futures (Optionnelles) :
- [ ] Notifications push / alertes (ex: via Home Assistant notify ou Webhooks) lors des dividendes perçus ou déviations fortes d'allocation.
- [ ] Module fiscal annuel (estimation de plus-values imposables selon flat tax ou barème).

---

## 5. Comment Lancer le Projet (Cheat Sheet)

### Lancement Rapide (Windows)
Double-cliquer sur start.bat à la racine.

### Lancement Manuel

#### Terminal 1 — Backend :
powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
python run.py

- API : http://localhost:8000
- Swagger Docs : http://localhost:8000/docs

#### Terminal 2 — Frontend :
powershell
cd frontend
npm.cmd run dev

- App Web : http://localhost:5173
- Accès Mobile : http://<IP_LOCALE_DU_PC>:5173

---

## 6. Règles & Retours d'Expérience Techniques
1. **Conserver la simplicité locale** : ne pas forcer de cloud payant ; SQLite suffit largement pour un patrimoine personnel.
2. **Ne jamais casser l'expérience Livrets / PEE** : ces supports n'ont pas de ticker Yahoo Finance direct, ils doivent toujours rester facilement éditables sans forcer de ticker.
3. **Spécificités Open Banking (Enable Banking DSP2)** :
   - **Réglementation DSP2** : La durée de validité du consentement (`valid_until`) ne doit jamais dépasser 180 jours (réglementation européenne). Utiliser `now + 89 jours`.
   - **Nom de banque (ASPSP)** : Doit respecter la casse officielle exacte (`Mock ASPSP`, `BBVA`, `BoursoBank`).
   - **Redirect URL** : Doit matcher au caractère près celle configurée dans la console Enable Banking (ex: `http://localhost:5173/` ou `https://localhost:5173`).
   - **Sandbox vs Production** : L'environnement Sandbox d'Enable Banking ne liste que `Mock ASPSP` et `BBVA`. Pour voir apparaître **BoursoBank**, **BNP Paribas**, **Revolut**, l'application doit être créée en environnement **Production** sur la console Enable Banking.
4. **Google Drive API (v3) & Authentification OAuth** :
   - Les requêtes vers Google Drive utilisent le jeton OAuth avec rafraîchissement automatique via `https://oauth2.googleapis.com/token`.
   - Ne jamais dépendre d'une lettre de lecteur local (ex: `G:\`) : l'API Cloud directe garantit une souveraineté totale et prépare la conteneurisation Docker.
5. **Robustesse du Parsing CSV Financier (Revolut & Courtiers)** :
   - **Séparateurs de milliers** : Toujours détecter si une virgule précède un point (ex: `€93,126.88`) afin de supprimer la virgule de milliers au lieu de la convertir en point, ce qui évite les plantages silencieux de `float()`.
   - **Espaces insécables Unicode (`\u202f`, `\xa0`)** : Très fréquents dans les exports de dates (ex: `10:35:44\u202fPM`). Toujours normaliser en espace standard avant `strptime`.
   - **Propagation de `amount_eur` & `fees_eur`** : Tout calcul GIPS (KPI dividendes, flux de capitaux TRI / MWR) s'appuie sur `Transaction.amount_eur`. Toujours renseigner `amount_eur` lors de la création d'un enregistrement.
6. **Résolution d'Alias Yahoo Finance** :
   - `853292` (WKN BMW sur Revolut) -> `BMW.DE`
   - `IUSA` (iShares S&P 500 UCITS ETF) -> `IUSA.DE`
   - `CSX5.PA` (Euro Stoxx 50 UCITS ETF) -> `CSX5.AS` (Euronext Amsterdam / Paris)
   - `BTC` -> `BTC-EUR`
7. **Mettre à jour ce fichier (`PROJECT_STATUS.md`)** dès qu'une nouvelle fonctionnalité majeure est achevée.
