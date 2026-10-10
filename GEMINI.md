# Directives et Règles du Projet PatriMon

## 1. Cycle de Développement et Déploiement (Règle Absolue)
- **Phase de Test Local et Validation Préalable Obligatoire** :
  - Avant toute étape de conteneurisation Docker, bump de version (`config.yaml`, `Dockerfile`), création de commit/push de release Git, ou déploiement sur Home Assistant :
    1. Le code modifié doit être préparé et testé **en local sur le PC de l'utilisateur** (backend FastAPI local et/ou frontend Vite local).
    2. Laisser l'utilisateur tester et vérifier le bon fonctionnement directement sur son poste.
    3. **Attendre impérativement la validation explicite de l'utilisateur** (ex: *"C'est validé"*, *"Tu peux déployer"*).
  - **Ne jamais** déclencher de build Docker, de packaging d'add-on, de push de nouvelle version de release ou de mise à jour Home Assistant sans cette validation préalable.

## 2. Intégration Home Assistant & Ingress
- **Ingress Natif** : Toute intégration web Home Assistant doit impérativement utiliser Ingress (`ingress: true`, `ingress_port: 8000`). Ne jamais recourir à `panel_iframe`.
- **Assets Statiques & FastAPI** : Ne pas modifier `request.scope["root_path"]` dans un middleware FastAPI pour Ingress, afin d'éviter la corruption des routes `StaticFiles` (erreur 404 sur les assets JS/CSS).
- **Frontend SPA (Vite)** :
  - Conserver `base: './'` dans `frontend/vite.config.js`.
  - Normalisation des URLs API via le helper dynamique `getApiBase()` dans `frontend/src/services/api.js`.
- **Persistance des Données Multi-Environnements** :
  - La base de données de production en conteneur réside sous `/data/patrimoines.db`.
  - Les configurations sensibles (`open_banking_config.json`, `mcp_oauth_tokens.json`) doivent être sauvegardées et détectées en miroir sous `/config/patrimon/` pour survivre aux reconstructions de conteneur et être incluses dans les sauvegardes Home Assistant.

## 3. Synchronisation DSP2 & Transactions
- **Plage Temporelle Dynamique** : Toujours fournir un paramètre `date_from` (maximum 88 jours norme PSD2) pour garantir la récupération exhaustive de l'historique sur toutes les banques (notamment BoursoBank).
- **Statuts d'Opérations** : Interroger conjointement les transactions comptabilisées (`BOOK`) et les autorisations/opérations en cours (`PDNG`) pour garantir la fraîcheur temps réel des données.
- **Pagination** : Toujours suivre la `continuation_key` jusqu'à épuisement des pages de transactions.
- **Auto-Guérison des Liaisons** : En cas de suppression ou d'absence d'un compte lié en base, recréer et réassocier automatiquement le compte pour éviter les ruptures de synchronisation.
