const API_BASE = '/api';

/**
 * Helper générique d'appel API avec gestion centralisée des erreurs FastAPI (detail).
 */
async function request(endpoint, options = {}, defaultError = "Une erreur est survenue") {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const config = { ...options };

  // Sérialisation JSON automatique sauf si FormData
  if (config.body && !(config.body instanceof FormData)) {
    config.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    if (typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }
  }

  const res = await fetch(url, config);

  if (!res.ok) {
    let detail = null;
    try {
      const errJson = await res.json();
      detail = errJson.detail || errJson.message;
    } catch (_) {
      try {
        detail = await res.text();
      } catch (_) {}
    }
    throw new Error(detail || defaultError);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ─── Portfolio ───
  async getSummary(forceRefresh = false) {
    return request(`/portfolio/summary?force_refresh=${forceRefresh}`, {}, "Erreur lors de la récupération du patrimoine");
  },

  async takeSnapshot() {
    return request(`/portfolio/snapshot`, { method: 'POST' }, "Erreur lors de l'enregistrement de l'instantané");
  },

  // ─── Comptes ───
  async getAccounts() {
    return request('/accounts/', {}, "Erreur lors de la récupération des comptes");
  },

  async createAccount(accountData) {
    return request('/accounts/', { method: 'POST', body: accountData }, "Erreur lors de la création du compte");
  },

  async updateAccount(accountId, accountData) {
    return request(`/accounts/${accountId}`, { method: 'PUT', body: accountData }, "Erreur lors de la mise à jour du compte");
  },

  async deleteAccount(accountId) {
    return request(`/accounts/${accountId}`, { method: 'DELETE' }, "Erreur lors de la suppression du compte");
  },

  async seedInitialAccounts() {
    return request('/accounts/seed-initial', { method: 'POST' }, "Erreur lors de l'initialisation des comptes");
  },

  // ─── Positions / Actifs (Holdings) ───
  async createHolding(holdingData) {
    return request('/holdings/', { method: 'POST', body: holdingData }, "Erreur lors de l'ajout de l'actif");
  },

  async updateHolding(holdingId, holdingData) {
    return request(`/holdings/${holdingId}`, { method: 'PUT', body: holdingData }, "Erreur lors de la modification de l'actif");
  },

  async deleteHolding(holdingId) {
    return request(`/holdings/${holdingId}`, { method: 'DELETE' }, "Erreur lors de la suppression de l'actif");
  },

  async getHoldingDetail(holdingId) {
    return request(`/holdings/${holdingId}/detail`, {}, "Erreur lors de la récupération de la fiche valeur");
  },

  // ─── Marché & Recherche ───
  async searchMarket(query) {
    if (!query || query.length < 1) return [];
    try {
      return await request(`/market/search?q=${encodeURIComponent(query)}`);
    } catch (_) {
      return [];
    }
  },

  async getQuote(symbol) {
    try {
      return await request(`/market/quote?symbol=${encodeURIComponent(symbol)}`);
    } catch (_) {
      return null;
    }
  },

  /** Vide le cache des cotations pour forcer un rechargement complet. */
  async refreshMarketCache() {
    return request('/market/refresh', { method: 'POST' }, "Erreur lors du rafraîchissement du cache");
  },

  // ─── Transactions & PRU ───
  async getTransactions(params = {}) {
    const query = new URLSearchParams();
    if (params.accountId) query.set('account_id', params.accountId);
    if (params.holdingId) query.set('holding_id', params.holdingId);
    if (params.type) query.set('type', params.type);
    if (params.category) query.set('category', params.category);
    if (params.limit) query.set('limit', params.limit);
    if (params.offset) query.set('offset', params.offset);

    const qs = query.toString();
    const url = `/transactions/${qs ? `?${qs}` : ''}`;
    return request(url, {}, "Erreur lors de la récupération des transactions");
  },

  async createTransaction(txData) {
    return request('/transactions/', { method: 'POST', body: txData }, "Erreur lors de la création de la transaction");
  },

  async deleteTransaction(txId) {
    return request(`/transactions/${txId}`, { method: 'DELETE' }, "Erreur lors de la suppression de la transaction");
  },

  async getTransactionStats() {
    return request('/transactions/stats', {}, "Erreur lors de la récupération des statistiques de transactions");
  },

  async recalculateHolding(holdingId) {
    return request(`/transactions/recalculate-holding/${holdingId}`, { method: 'POST' }, "Erreur lors du recalcul de la position");
  },

  async recalculateAllTransactions() {
    return request('/transactions/recalculate-all', { method: 'POST' }, "Erreur lors du recalcul global des transactions");
  },

  // ─── Benchmarks ───
  async getBenchmarks() {
    try {
      return await request('/portfolio/benchmarks');
    } catch (_) {
      return [];
    }
  },

  async getBenchmarkComparison(benchmark = 'CW8.PA', period = '1mo') {
    return request(`/portfolio/benchmark-comparison?benchmark=${encodeURIComponent(benchmark)}&period=${encodeURIComponent(period)}`, {}, "Erreur lors de la comparaison avec l'indice de référence");
  },

  // ─── Épargne Entreprise (BNP PEE & PERO) ───
  async previewPeeStatement(file) {
    const formData = new FormData();
    formData.append('file', file);
    return request('/pee/preview-statement', { method: 'POST', body: formData }, "Erreur lors de l'analyse du relevé");
  },

  async confirmPeeImport(data) {
    return request('/pee/confirm-import', { method: 'POST', body: data }, "Erreur lors de la confirmation de l'import");
  },

  // ─── Open Banking (Enable Banking DSP2) ───
  async getOpenBankingStatus() {
    return request('/open-banking/status', {}, "Erreur lors de la récupération de l'état Open Banking");
  },

  async updateOpenBankingConfig(config) {
    return request('/open-banking/config', { method: 'POST', body: config }, "Erreur mise à jour configuration");
  },

  async getOpenBankingInstitutions(country = 'FR') {
    try {
      return await request(`/open-banking/institutions?country=${country}`);
    } catch (_) {
      return [];
    }
  },

  async connectBank(institutionId, redirectUri = window.location.origin) {
    return request('/open-banking/connect', { method: 'POST', body: { institution_id: institutionId, redirect_uri: redirectUri } }, "Erreur lors de la connexion bancaire");
  },

  async syncBankBalances() {
    return request('/open-banking/sync', { method: 'POST' }, "Erreur lors de la synchronisation des comptes bancaires");
  },

  async deleteBankConnection(connectionId) {
    return request(`/open-banking/connection/${connectionId}`, { method: 'DELETE' }, "Erreur lors de la suppression de la liaison bancaire");
  },

  async exchangeOpenBankingSession(code, state = null) {
    return request('/open-banking/session', { method: 'POST', body: { code, state } }, "Erreur validation session");
  },

  async getOpenBankingKeys() {
    try {
      return await request('/open-banking/keys');
    } catch (_) {
      return { has_keys: false, public_key: '' };
    }
  },

  async generateOpenBankingKeyPair(force = false) {
    return request(`/open-banking/generate-keys?force=${force}`, { method: 'POST' }, "Erreur lors de la récupération des clés RSA");
  },

  // ─── Auto-enrichissement & Catégories ───
  async enrichTransaction(payload) {
    try {
      return await request('/transactions/enrich', { method: 'POST', body: payload });
    } catch (_) {
      return payload;
    }
  },

  async getTransactionCategories() {
    try {
      return await request('/transactions/categories');
    } catch (_) {
      return [];
    }
  },

  // ─── Planification & Synchro Automatique Régulière ───
  async getSchedulerStatus() {
    return request('/open-banking/scheduler', {}, "Erreur récupération état synchronisation automatique");
  },

  async updateSchedulerConfig(config) {
    return request('/open-banking/scheduler/config', { method: 'POST', body: config }, "Erreur mise à jour planification");
  },

  async triggerSchedulerSync() {
    return request('/open-banking/scheduler/trigger', { method: 'POST' }, "Erreur déclenchement synchronisation");
  },

  async syncBankTransactions() {
    return request('/open-banking/sync-transactions', { method: 'POST' }, "Erreur synchronisation transactions");
  },

  // ─── Google Drive Bourse & Investissements ───
  async getDriveTree() {
    return request('/google-drive/tree', {}, "Erreur récupération arborescence Google Drive");
  },

  async syncDriveBourse() {
    return request('/google-drive/sync', { method: 'POST' }, "Erreur synchronisation Google Drive Bourse");
  },

  async getDriveLogs(limit = 30) {
    return request(`/google-drive/logs?limit=${limit}`, {}, "Erreur récupération historique Google Drive");
  },

  // ─── Pilotage Stratégique, Allocation Cible & Projections FIRE (Phase 4) ───
  async getStrategyAllocation() {
    return request('/strategy/allocation', {}, "Erreur récupération de la stratégie d'allocation");
  },

  async updateStrategyAllocation(allocations, presetId = 'custom') {
    return request('/strategy/allocation', {
      method: 'POST',
      body: { allocations, preset_id: presetId },
    }, "Erreur enregistrement de l'allocation cible");
  },

  async simulateRebalance(contributionAmount = 500, customTargets = null) {
    return request('/strategy/rebalance-simulate', {
      method: 'POST',
      body: { contribution_amount: contributionAmount, custom_targets: customTargets },
    }, "Erreur calcul du rééquilibrage");
  },

  async calculateProjections(params = {}) {
    return request('/strategy/projections', {
      method: 'POST',
      body: params,
    }, "Erreur calcul des projections d'intérêts composés");
  },

  async getStrategyPresets() {
    return request('/strategy/presets', {}, "Erreur récupération des presets");
  },
};
