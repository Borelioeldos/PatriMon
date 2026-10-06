# 🚀 Guide de Déploiement Permanent & Docker — PatriMon

Bienvenue dans le guide de déploiement permanent de **PatriMon**.  
Ce guide vous permet d'installer PatriMon sur votre **vieux PC tournant sous Home Assistant OS** (ou tout serveur Docker / Linux) pour un suivi de patrimoine autonome, permanent et accessible **24h/24 et 7j/7 depuis votre smartphone et vos ordinateurs sur le réseau Wi-Fi local**.

---

## 📑 Sommaire
1. [Architecture & Fonctionnement](#1-architecture--fonctionnement)
2. [Étape Préalable : Exportation de vos Données Locales (1 Clic)](#2-étape-préalable--exportation-de-vos-données-locales-1-clic)
3. [Méthode 1 : Module Complémentaire Local Home Assistant OS (Recommandé)](#3-méthode-1--module-complémentaire-local-home-assistant-os-recommandé)
4. [Méthode 2 : Déploiement via Portainer (Docker Compose)](#4-méthode-2--déploiement-via-portainer-docker-compose)
5. [Méthode 3 : Ligne de Commande Standard (Docker Compose CLI)](#5-méthode-3--ligne-de-commande-standard-docker-compose-cli)
6. [Accès Smartphone & Raccourci Écran d'Accueil (PWA)](#6-accès-smartphone--raccourci-écran-daccueil-pwa)
7. [Intégration dans le Tableau de Bord Home Assistant](#7-intégration-dans-le-tableau-de-bord-home-assistant)
8. [Accès Distant Sécurisé Hors Domicile (Optionnel)](#8-accès-distant-sécurisé-hors-domicile-optionnel)
9. [Sauvegardes & Mises à Jour](#9-sauvegardes--mises-à-jour)

---

## 1. Architecture & Fonctionnement

PatriMon est empaqueté dans une image Docker ultra-légère multi-stage :
- **Port Unique (8000)** : Le backend FastAPI sert à la fois les endpoints `/api/*`, la documentation interactive `/docs` et l'interface web React SPA compilée.
- **Volume Persistant (`/data`)** : Toutes les données dynamiques et sensibles sont conservées dans `/data` :
  - `patrimoines.db` (base SQLite contenant tous vos comptes, transactions, PRU et historique).
  - `open_banking_config.json` (identifiants d'application et paire de clés RSA 2048 Enable Banking).
  - `strategy_config.json` (allocations cibles et paramètres de stratégie financière).
  - `sync_scheduler_config.json` (fréquence et statut du planificateur de synchronisation).
  - `certs/` (clés de signature permanentes).
- **Consommation minimale** : ~150 Mo de RAM, réveil léger toutes les 4h pour la synchro bancaire automatique.

---

## 2. Étape Préalable : Exportation de vos Données Locales (1 Clic)

Pour transférer l'intégralité de vos comptes réels et transactions déjà configurés sur votre PC Windows vers votre serveur :

1. Sur votre PC Windows, double-cliquez sur :
   ```text
   scripts/prepare_docker_data.bat
   ```
   *(ou lancez `python scripts/prepare_docker_data.py` dans un terminal)*.
2. Le script crée automatiquement un dossier `data/` à la racine contenant :
   - `patrimoines.db`
   - `open_banking_config.json`
   - `strategy_config.json`
   - `sync_scheduler_config.json`
   - `certs/`

Ce dossier `data/` est prêt à être copié sur votre machine Home Assistant OS.

---

## 3. Méthode 1 : Module Complémentaire Local Home Assistant OS (Recommandé)

Home Assistant OS permet d'exécuter des modules complémentaires (*Add-ons*) directement gérés par son superviseur.

### Étape 1 : Accéder au dossier `/addons` de Home Assistant
Vous pouvez accéder au système de fichiers de Home Assistant via :
- **Samba share** (Add-on officiel dans la Boutique Home Assistant) : ouvrez l'explorateur Windows sur `\\<IP_HOME_ASSISTANT>\addons`.
- **Visual Studio Code / File Editor** (Add-on Home Assistant).
- **Terminal & SSH** (Add-on officiel) : connectez-vous en SSH sur votre Home Assistant.

### Étape 2 : Copier PatriMon dans le dossier `/addons/patrimon`
- Créez un dossier `patrimon` dans le répertoire `/addons`.
- Copiez-y les fichiers du projet (ou faites `git clone https://github.com/Borelioeldos/PatriMon.git /addons/patrimon`).
- Vérifiez la présence des fichiers clés dans `/addons/patrimon` :
  - `config.yaml`
  - `Dockerfile`
  - `DOCS.md`
  - `icon.png` & `logo.png`
  - Les dossiers `backend/` et `frontend/`.

### Étape 3 : Transférer vos données existantes
- Copiez le contenu de votre dossier `data/` (généré à l'étape 2) dans `/addons/patrimon/data/` (ou directement dans `/data` si vous utilisez SSH).
- Si vous démarrez sans copier de données, PatriMon initialisera automatiquement une base neuve et prête à l'emploi.

### Étape 4 : Installer le module dans Home Assistant
1. Ouvrez l'interface web de votre Home Assistant.
2. Allez dans **Paramètres** > **Modules complémentaires** > **Boutique des modules complémentaires**.
3. Cliquez sur les **trois points verticaux (⋮)** en haut à droite > **Vérifier les mises à jour** (ou *Recharger*).
4. Une section **"Modules complémentaires locaux"** apparaît en haut, contenant **PatriMon**.
5. Cliquez sur **PatriMon**, puis sur **Installer**. *(Le premier build prend environ 2 à 3 minutes car Home Assistant compile le frontend et installe les paquets Python)*.

### Étape 5 : Démarrer et configurer
1. Cochez les options souhaitées :
   - ✅ **Démarrer au démarrage du système** (*Boot auto*)
   - ✅ **Chien de garde (Watchdog)** (*Redémarrage automatique en cas d'anomalie*)
   - ✅ **Afficher dans la barre latérale**
2. Cliquez sur **Démarrer**.
3. Vérifiez les logs dans l'onglet **Journal** : vous devez voir `Démarrage de l'API PatriMon sur http://0.0.0.0:8000`.
4. Cliquez sur **Ouvrir l'interface Web** !

---

## 4. Méthode 2 : Déploiement via Portainer (Docker Compose)

Si vous utilisez déjà **Portainer** sur votre machine Home Assistant OS ou sur un serveur Linux dédié :

1. Ouvrez l'interface web de **Portainer**.
2. Allez dans **Stacks** > **Add stack**.
3. Nommez la stack `patrimon`.
4. Sélectionnez **Web editor** et collez le contenu du fichier [docker-compose.yml](file:///c:/Users/Borel/Desktop/Suivie_Patrimoine/docker-compose.yml) :
   ```yaml
   services:
     patrimon:
       build:
         context: https://github.com/Borelioeldos/PatriMon.git
         dockerfile: Dockerfile
       image: patrimon:latest
       container_name: patrimon
       restart: unless-stopped
       ports:
         - "8000:8000"
       volumes:
         - patrimon-data:/data
       environment:
         - PATRIMON_DATA_DIR=/data
         - PATRIMON_DB_PATH=/data/patrimoines.db
         - PATRIMON_HOST=0.0.0.0
         - PATRIMON_PORT=8000
         - PATRIMON_RELOAD=false
         - PATRIMON_CORS_ORIGINS=*
       healthcheck:
         test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/portfolio/summary')"]
         interval: 30s
         timeout: 5s
         retries: 3

   volumes:
     patrimon-data:
       driver: local
   ```
5. Cliquez sur **Deploy the stack**.
6. Accédez à l'application sur `http://<IP_DE_VOTRE_MACHINE>:8000`.

---

## 5. Méthode 3 : Ligne de Commande Standard (Docker Compose CLI)

Pour lancer PatriMon sur n'importe quel PC équipé de Docker :

```bash
# 1. Cloner le dépôt
git clone https://github.com/Borelioeldos/PatriMon.git
cd PatriMon

# 2. Exporter vos données si vous en avez (optionnel)
python scripts/prepare_docker_data.py

# 3. Démarrer en arrière-plan
docker compose up -d --build

# 4. Suivre les logs
docker compose logs -f
```

L'application est disponible immédiatement sur `http://localhost:8000`.

---

## 6. Accès Smartphone & Raccourci Écran d'Accueil (PWA)

PatriMon a été conçu pour offrir une ergonomie digne d'une application bancaire native sur smartphone :

1. Connectez votre smartphone au réseau **Wi-Fi de votre maison**.
2. Ouvrez votre navigateur mobile (Safari sur iOS, Chrome sur Android).
3. Entrez l'adresse de votre Home Assistant :
   ```text
   http://192.168.x.y:8000
   ```
   *(Remplacez 192.168.x.y par l'adresse IP locale de votre vieux PC / Home Assistant)*.

### Créer l'icône sur l'écran d'accueil :
- **Sur iPhone (Safari)** :
  1. Appuyez sur le bouton **Partager** (icône rectangle avec une flèche vers le haut).
  2. Faites défiler et sélectionnez **Sur l'écran d'accueil**.
  3. Nommez l'application **PatriMon** et appuyez sur **Ajouter**.
- **Sur Android (Chrome)** :
  1. Appuyez sur les **trois points (⋮)** en haut à droite.
  2. Sélectionnez **Ajouter à l'écran d'accueil** (ou *Installer l'application*).

L'application s'ouvrira en plein écran sans barre d'adresse, avec ses graphiques interactifs, son floutage rapide (mode discret) et son auto-refresh silencieux.

---

## 7. Intégration dans le Tableau de Bord Home Assistant

Pour visualiser votre patrimoine sans quitter Home Assistant :

### Option A : Ajout dans la barre latérale Home Assistant
Ajoutez ces lignes dans votre fichier `configuration.yaml` de Home Assistant :
```yaml
panel_iframe:
  patrimon:
    title: "PatriMon"
    icon: mdi:chart-line
    url: "http://192.168.x.y:8000"
```
*(Remplacez `192.168.x.y` par l'IP de votre machine)*.

### Option B : Carte Tableau de Bord Lovelace
Dans l'un de vos tableaux de bord Home Assistant :
1. Cliquez sur **Ajouter une carte**.
2. Choisissez la carte **Page Web** (Webpage card).
3. Renseignez l'URL : `http://192.168.x.y:8000`.
4. Hauteur recommandée : `600px` ou `100%`.

---

## 8. Accès Distant Sécurisé Hors Domicile (Optionnel)

Si vous souhaitez consulter votre patrimoine à l'extérieur de chez vous (en 4G/5G) :

> [!CAUTION]
> Ne jamais exposer directement le port 8000 sur Internet sans chiffrement SSL ni authentification.

Solutions recommandées :
1. **VPN Privé (WireGuard ou Tailscale — Gratuit & Recommandé)** :
   - Installez l'add-on **WireGuard** ou **Tailscale** dans Home Assistant.
   - Activez le VPN sur votre smartphone. Vous accédez à `http://192.168.x.y:8000` comme si vous étiez dans votre salon, de façon totalement chiffrée.
2. **Cloudflare Zero Trust / Cloudflare Tunnel** :
   - Utilisez l'add-on officiel Cloudflare Tunnel dans Home Assistant pour router un nom de domaine sécurisé avec authentification à deux facteurs.
3. **Nginx Proxy Manager + Let's Encrypt** :
   - Créez un nom d'hôte avec certificat SSL HTTPS (`https://patrimon.votredomaine.fr`).

---

## 9. Sauvegardes & Mises à Jour

### Sauvegarder vos données
- **Dans Home Assistant** : Les sauvegardes standards (*Paramètres > Système > Sauvegardes*) sauvegardent automatiquement tout le contenu du répertoire `/data` de l'add-on.
- **Manuelle** : Copiez simplement le fichier `/data/patrimoines.db` sur une clé USB ou un service cloud.

### Mettre à jour l'application
- **Dans Home Assistant** :
  Rendez-vous dans *Boutique des modules complémentaires*, faites *Vérifier les mises à jour*, puis cliquez sur **Reconstruire** (*Rebuild*). Vos données dans `/data` ne sont jamais écrasées.
- **Avec Docker Compose** :
  ```bash
  docker compose pull || git pull
  docker compose up -d --build
  ```

---

*Félicitations ! Votre instance PatriMon est maintenant opérationnelle 24/7 de manière 100% souveraine sur votre matériel.*
