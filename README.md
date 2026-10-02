# 📊 PatriMon — Suivi de Patrimoine Intelligent & Temps Réel

**PatriMon** est un tableau de bord moderne, unifié et automatisé pour piloter l'ensemble de votre patrimoine financier :
- **BoursoBank** : Compte courant, PEA (ETF World, S&P 500, actions européennes...)
- **Revolut** : Compte courant, Coffres / Épargne, CTO (Actions US), Crypto (Bitcoin, Ethereum...)
- **BNP Paribas** : Compte courant, Livret A, LDDS, Épargne de précaution
- **BNP Épargne Entreprise (PEE)** : Fonds d'entreprise (FCPE), abondement

> 📖 **Pour les développeurs & Agents IA** : Consultez [`PROJECT_STATUS.md`](PROJECT_STATUS.md) pour retrouver l'état d'avancement complet, l'architecture détaillée et la feuille de route sans avoir à réexplorer tout le contexte.

---

## 🚀 Démarrage Rapide

### Méthode 1 : En 1 Clic (Windows)
Double-cliquez simplement sur le fichier **`start.bat`** à la racine du projet. Deux fenêtres s'ouvriront pour le backend et le frontend.

### Méthode 2 : En Ligne de Commande

#### 1. Lancer le Backend (FastAPI - Python)
Dans un premier terminal PowerShell :
```powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
python run.py
```
- L'API tourne sur : `http://localhost:8000`
- La documentation interactive Swagger est disponible sur : `http://localhost:8000/docs`

#### 2. Lancer le Frontend (React + Vite + Tailwind)
Dans un second terminal PowerShell :
```powershell
cd frontend
npm run dev
```
- L'application web s'ouvre sur : `http://localhost:5173`

---

## 📱 Accéder depuis votre Téléphone (Mobile)

Le frontend écoute sur `0.0.0.0`, ce qui le rend accessible à tous les appareils connectés à votre réseau Wi-Fi local :
1. Sur votre PC Windows, ouvrez un terminal et tapez `ipconfig` pour trouver votre adresse IPv4 locale (ex: `192.168.1.45`).
2. Sur votre smartphone (connecté au même Wi-Fi), ouvrez Safari / Chrome et tapez : `http://192.168.1.45:5173`
3. *(Optionnel)* Cliquez sur **"Ajouter à l'écran d'accueil"** pour transformer le site en véritable application mobile avec icône plein écran !

---

## 🛠️ Fonctionnalités Déployées

### Phase 1 : Cœur Temps Réel & Multi-Établissements
1. **Cotations Boursières & Crypto en Temps Réel** :
   - Requêtes automatiques via Yahoo Finance (`yfinance`) pour les actions françaises/européennes (ex: `CW8.PA`, `AI.PA`), américaines (`AAPL`, `MSFT`), cryptomonnaies (`BTC-EUR`, `ETH-EUR`).
   - Conversion automatique des devises étrangères en Euros (ex: USD -> EUR).
   - Cache intelligent pour des temps de chargement instantanés.
2. **Support Spécifique PEE & Livrets d'Épargne** :
   - Mode manuel dédié aux fonds FCPE de BNP Épargne Entreprise avec actualisation facile du nombre de parts et de la valeur liquidative.
   - Onglet rapide Livrets d'épargne (Livret A, LDDS, LEP) avec cours fixe garanti à 1,00 €.
3. **Tableau de Bord Visuel Fintech** :
   - **KPIs clés** : Valeur nette totale, Plus/moins-value latente (€ et %), Liquidités de sécurité, Nombre d'enveloppes.
   - **Graphiques interactifs** : Donut de répartition par banque, Donut par classe d'actif, Graphique d'évolution temporelle, Palmarès des titres.
   - **Gestion des comptes & liquidités** : Édition directe du solde espèces d'un compte en un clic.

### Phase 2 : Transactions, Moteur PRU & Calculs Financiers Avancés
4. **Journal des Transactions & Recalcul Automatique du PRU** :
   - Enregistrement des opérations : **Achats**, **Ventes**, **Versements**, **Retraits**, **Dividendes perçus**.
   - Calcul mathématique en temps réel du **PRU pondéré (Weighted Average Cost)** à chaque renforcement de position.
   - Calcul des plus-values réalisées lors des cessions et ajustement synchronisé du solde espèces.
5. **Métriques de Performance Financière Réelles (Standards GIPS)** :
   - **TWR (Time-Weighted Return)** : Mesure la rentabilité pure des investissements indépendamment des flux d'argent injectés ou retirés.
   - **MWR / TRI (Taux de Rendement Interne / XIRR)** : Rendement effectif de l'investisseur tenant compte de la date exacte de chaque apport de capital.
   - Suivi consolidé des **dividendes encaissés** et des **gains matérialisés**.
6. **Comparaison avec des Indices de Référence (Benchmarks)** :
   - Comparateur dynamique multi-courbes en % avec les indices majeurs : **MSCI World** (`CW8.PA`), **S&P 500** (`^GSPC`), **CAC 40** (`^FCHI`), **Bitcoin** (`BTC-EUR`).
   - Périodes ajustables (1 mois, 3 mois, 6 mois, 1 an) et calcul automatique de l'**Alpha** (surperformance relative).

### Phase 3 : Automatisation des Flux Externes, DSP2, Synchro Périodique & Transactions Intelligentes
7. **Synchronisation Bancaire Automatique & Régulière (DSP2 — Enable Banking)** :
   - Intégration de l'API européenne moderne **Enable Banking** pour synchroniser en direct les liquidités (BoursoBank, BNP Paribas, Revolut...).
   - **Planificateur de fond automatique (`sync_scheduler_service`)** : synchronisation périodique autonome (toutes les heures, 4 heures, 12 heures ou 24 heures) sans action manuelle requise.
   - Authentification sécurisée par signature **JWT RS256** avec générateur de clés RSA statiques permanentes.
   - **Mode Démo / Simulation instantané** pour tester immédiatement avec des comptes et transactions réalistes.
8. **Remplissage Automatique & Catégorisation Intelligente des Transactions** :
   - **Saisie assistée instantanée** : la saisie d'un ticker (ex: `CW8.PA`, `AAPL`, `BTC-EUR`) télécharge automatiquement en direct la cotation, le nom officiel, la devise et calcule le montant total net (`quantité × cours + frais`).
   - Raccourcis 1-clic pour les opérations récurrentes (*Salaire*, *Courses*, *Factures*, *Abonnements*, *Virements*).
   - **Synchronisation bancaire continue** : nettoyage automatique des libellés bancaires bruts (vrais noms des commerçants) et classification automatique dans 12 catégories intelligentes (*Alimentation*, *Logement*, *Revenus*, *Investissement*...).
   - Déduplication infaillible par identifiant unique de transaction (`external_id`).
9. **Import Automatique Relevé BNP Épargne Entreprise (PEE & PERO Cardif Retraite)** :
   - Module d'import en **1 clic** par glisser-déposer de votre relevé officiel PDF ou CSV (calibré sur Schneider Electric France / BNP Paribas Cardif Retraite).
   - Détection et séparation automatique entre **PEE** et **PERO Retraite**.
   - Rétro-ingénierie automatique de la VL unitaire et du PRU unitaire.

---

## 🎯 Prochaines Étapes de la Feuille de Route
- **Phase 4** : Pilotage stratégique (Allocation cible vs réelle, calculateur de rééquilibrage de portefeuille, simulateur d'intérêts composés long terme).
- **Phase 5 & Déploiement** : Conteneurisation Docker pour hébergement 24/7 sur votre vieux PC équipé de **Home Assistant OS**.
