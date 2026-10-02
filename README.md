# 📊 PatriMon — Suivi de Patrimoine Intelligent & Temps Réel

**PatriMon** est un tableau de bord moderne, unifié et automatisé pour piloter l'ensemble de votre patrimoine financier :
- **BoursoBank** : Compte courant, PEA (ETF World, S&P 500, actions européennes...)
- **Revolut** : Compte courant, Coffres / Épargne, CTO (Actions US), Crypto (Bitcoin, Ethereum...)
- **BNP Paribas** : Compte courant, Livret A, LDDS, Épargne de précaution
- **BNP Épargne Entreprise (PEE)** : Fonds d'entreprise (FCPE), abondement

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

## 🛠️ Fonctionnalités Déployées (Phase 1)

1. **Cotations Boursières & Crypto en Temps Réel** :
   - Requêtes automatiques via Yahoo Finance (`yfinance`) pour les actions françaises/européennes (ex: `CW8.PA`, `AI.PA`), américaines (`AAPL`, `MSFT`), cryptomonnaies (`BTC-EUR`, `ETH-EUR`).
   - Conversion automatique des devises étrangères en Euros (ex: USD -> EUR).
   - Cache intelligent pour des temps de chargement instantanés.
2. **Support Spécifique PEE** :
   - Mode manuel dédié aux fonds FCPE de BNP Épargne Entreprise avec actualisation facile du nombre de parts et de la valeur liquidative.
3. **Tableau de Bord Visuel Fintech** :
   - **KPIs clés** : Valeur nette totale, Plus/moins-value latente (€ et %), Liquidités de sécurité, Nombre d'enveloppes.
   - **Graphiques interactifs** : Donut de répartition par banque, Donut par classe d'actif, Graphique de suivi historique.
   - **Gestion des comptes & liquidités** : Édition directe du solde espèces d'un compte en un clic.
   - **Moteur de recherche assisté** de tickers boursiers lors de l'ajout d'une position.
4. **Base de Données Locale & Souveraine** :
   - SQLite (`backend/patrimoines.db`), zéro fuite de données, exportable en 1 fichier.

---

## 🎯 Prochaines Étapes de la Feuille de Route
- **Phase 2** : Calculs TWR/MWR (taux de rendement pondéré dans le temps), historique d'opérations d'achats/ventes et dividendes.
- **Phase 3** : Connecteurs Open Banking automatiques (API GoCardless gratuite) et import automatique des relevés BNP PEE.
- **Phase 4 & Déploiement** : Conteneurisation Docker pour hébergement 24/7 sur votre vieux PC équipé de **Home Assistant OS**.
