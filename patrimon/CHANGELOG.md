# Changelog PatriMon

## 1.0.5
- Moteur intelligent anti-doublons DSP2 inter-comptes et intra-compte (élimination des débits miroir Carte Visa Ultim BoursoBank sur les comptes courants).
- Réconciliation automatique des opérations en attente (PDNG / `eb_`) avec les opérations comptabilisées officielles (BOOK).
- Bouton d'action rapide "Anti-doublons" dans la liste des transactions et la modale de synchronisation bancaire.
- Nettoyage préventif des doublons au démarrage de l'application et lors de chaque cycle de synchronisation.
- Suppression instantanée de transactions avec recalcul temps réel des soldes de trésorerie.
- Première version conteneurisée officielle pour Home Assistant OS et Docker.
- Unification full-stack sous conteneur unique (FastAPI + React SPA) sur le port 8000.
- Persistance automatique intégrée sous `/data` (SQLite, configurations JSON, clés RSA).
- Planificateur de synchronisation périodique automatique en tâche de fond.
- Interface haute précision Fintech (Quiet Luxury) avec thème sombre OLED et thème clair.
- Modules de stratégie financière, DCA intelligent et simulateur FIRE.
