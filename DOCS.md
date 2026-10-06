# PatriMon — Module Complémentaire Home Assistant

Bienvenue sur le module complémentaire **PatriMon** pour Home Assistant OS !

## Fonctionnalités
- **Suivi de patrimoine temps réel** : cotations en direct des actifs (Actions, ETF, Crypto, PEE BNP Schneider, Livrets d'épargne BNP).
- **Synchronisation bancaire DSP2** : connexion sécurisée européenne (BoursoBank, BNP Paribas, Revolut...).
- **Planificateur automatique** : actualisation régulière en tâche de fond (toutes les 4 heures par défaut) des soldes et des transactions.
- **Stratégie & Projections FIRE** : allocation cible, calcul de versement mensuel d'optimisation (DCA) et simulateur d'intérêts composés.
- **Mode Discret** : floutage instantané des chiffres sensibles lors de consultations en public.
- **Accès Mobile 24/7** : consultable depuis votre smartphone sur le réseau Wi-Fi local sans quitter votre canapé.

## Configuration & Ports
- Le port par défaut est **8000**.
- Vous pouvez ouvrir l'interface web en cliquant sur **"Ouvrir l'interface Web"** dans la page du module, ou en vous rendant directement sur `http://<IP_DE_VOTRE_HOME_ASSISTANT>:8000`.

## Persistance des Données
Toutes vos données (base de données SQLite `patrimoines.db`, configurations Open Banking, clés RSA, presets d'allocation) sont stockées dans le répertoire persistant `/data` de l'add-on. Elles sont automatiquement conservées lors des redémarrages, des mises à jour de version et incluses dans les sauvegardes (Backups) de Home Assistant.

## Intégration dans le Tableau de Bord Home Assistant
Pour intégrer directement PatriMon dans votre tableau de bord Lovelace ou dans la barre latérale, vous pouvez ajouter une carte **Page Web** (iFrame) ou une entrée dans votre fichier `configuration.yaml` :

```yaml
panel_iframe:
  patrimon:
    title: "PatriMon"
    icon: mdi:chart-line
    url: "http://<IP_HOME_ASSISTANT>:8000"
```
Remplacez `<IP_HOME_ASSISTANT>` par l'adresse IP locale de votre machine Home Assistant (ex: `192.168.1.50`).
