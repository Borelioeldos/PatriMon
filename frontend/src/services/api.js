const API_BASE = '/api';

export const api = {
  // ─── Portfolio ───
  async getSummary(forceRefresh = false) {
    const res = await fetch(`${API_BASE}/portfolio/summary?force_refresh=${forceRefresh}`);
    if (!res.ok) throw new Error("Erreur lors de la récupération du patrimoine");
    return res.json();
  },

  // ─── Comptes ───
  async getAccounts() {
    const res = await fetch(`${API_BASE}/accounts/`);
    if (!res.ok) throw new Error("Erreur lors de la récupération des comptes");
    return res.json();
  },

  async createAccount(accountData) {
    const res = await fetch(`${API_BASE}/accounts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountData),
    });
    if (!res.ok) throw new Error("Erreur lors de la création du compte");
    return res.json();
  },

  async updateAccount(accountId, accountData) {
    const res = await fetch(`${API_BASE}/accounts/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountData),
    });
    if (!res.ok) throw new Error("Erreur lors de la mise à jour du compte");
    return res.json();
  },

  async deleteAccount(accountId) {
    const res = await fetch(`${API_BASE}/accounts/${accountId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error("Erreur lors de la suppression du compte");
    return res.json();
  },

  async seedInitialAccounts() {
    const res = await fetch(`${API_BASE}/accounts/seed-initial`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur lors de l'initialisation des comptes");
    return res.json();
  },

  // ─── Positions / Actifs (Holdings) ───
  async createHolding(holdingData) {
    const res = await fetch(`${API_BASE}/holdings/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdingData),
    });
    if (!res.ok) throw new Error("Erreur lors de l'ajout de l'actif");
    return res.json();
  },

  async updateHolding(holdingId, holdingData) {
    const res = await fetch(`${API_BASE}/holdings/${holdingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdingData),
    });
    if (!res.ok) throw new Error("Erreur lors de la modification de l'actif");
    return res.json();
  },

  async deleteHolding(holdingId) {
    const res = await fetch(`${API_BASE}/holdings/${holdingId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error("Erreur lors de la suppression de l'actif");
    return res.json();
  },

  // ─── Marché & Recherche ───
  async searchMarket(query) {
    if (!query || query.length < 1) return [];
    const res = await fetch(`${API_BASE}/market/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  },

  async getQuote(symbol) {
    const res = await fetch(`${API_BASE}/market/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    return res.json();
  },

  /** Vide le cache des cotations pour forcer un rechargement complet. */
  async refreshMarketCache() {
    const res = await fetch(`${API_BASE}/market/refresh`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur lors du rafraîchissement du cache");
    return res.json();
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
    const url = `${API_BASE}/transactions/${qs ? `?${qs}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erreur lors de la récupération des transactions");
    return res.json();
  },

  async createTransaction(txData) {
    const res = await fetch(`${API_BASE}/transactions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Erreur lors de la création de la transaction");
    }
    return res.json();
  },

  async deleteTransaction(txId) {
    const res = await fetch(`${API_BASE}/transactions/${txId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error("Erreur lors de la suppression de la transaction");
    return res.json();
  },

  async getTransactionStats() {
    const res = await fetch(`${API_BASE}/transactions/stats`);
    if (!res.ok) throw new Error("Erreur lors de la récupération des statistiques de transactions");
    return res.json();
  },

  async recalculateHolding(holdingId) {
    const res = await fetch(`${API_BASE}/transactions/recalculate-holding/${holdingId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur lors du recalcul de la position");
    return res.json();
  },

  // ─── Benchmarks ───
  async getBenchmarks() {
    const res = await fetch(`${API_BASE}/portfolio/benchmarks`);
    if (!res.ok) return [];
    return res.json();
  },

  async getBenchmarkComparison(benchmark = 'CW8.PA', period = '1mo') {
    const res = await fetch(`${API_BASE}/portfolio/benchmark-comparison?benchmark=${encodeURIComponent(benchmark)}&period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error("Erreur lors de la comparaison avec l'indice de référence");
    return res.json();
  },

  // ─── Épargne Entreprise (BNP PEE & PERO) ───
  async previewPeeStatement(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/pee/preview-statement`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Erreur lors de l'analyse du relevé");
    }
    return res.json();
  },

  async confirmPeeImport(data) {
    const res = await fetch(`${API_BASE}/pee/confirm-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Erreur lors de la confirmation de l'import");
    }
    return res.json();
  },

  // ─── Open Banking (GoCardless DSP2) ───
  async getOpenBankingStatus() {
    const res = await fetch(`${API_BASE}/open-banking/status`);
    if (!res.ok) throw new Error("Erreur lors de la récupération de l'état Open Banking");
    return res.json();
  },

  async updateOpenBankingConfig(config) {
    const res = await fetch(`${API_BASE}/open-banking/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Erreur mise à jour configuration");
    return res.json();
  },

  async getOpenBankingInstitutions(country = 'FR') {
    const res = await fetch(`${API_BASE}/open-banking/institutions?country=${country}`);
    if (!res.ok) return [];
    return res.json();
  },

  async connectBank(institutionId, redirectUri = window.location.origin) {
    const res = await fetch(`${API_BASE}/open-banking/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ institution_id: institutionId, redirect_uri: redirectUri }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Erreur lors de la connexion bancaire");
    }
    return res.json();
  },

  async syncBankBalances() {
    const res = await fetch(`${API_BASE}/open-banking/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur lors de la synchronisation des comptes bancaires");
    return res.json();
  },

  async deleteBankConnection(connectionId) {
    const res = await fetch(`${API_BASE}/open-banking/connection/${connectionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error("Erreur lors de la suppression de la liaison bancaire");
    return res.json();
  },

  async exchangeOpenBankingSession(code, state = null) {
    const res = await fetch(`${API_BASE}/open-banking/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Erreur validation session");
    }
    return res.json();
  },

  async getOpenBankingKeys() {
    const res = await fetch(`${API_BASE}/open-banking/keys`);
    if (!res.ok) return { has_keys: false, public_key: '' };
    return res.json();
  },

  async generateOpenBankingKeyPair(force = false) {
    const res = await fetch(`${API_BASE}/open-banking/generate-keys?force=${force}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur lors de la récupération des clés RSA");
    return res.json();
  },

  // ─── Auto-enrichissement & Catégories ───
  async enrichTransaction(payload) {
    const res = await fetch(`${API_BASE}/transactions/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return payload;
    return res.json();
  },

  async getTransactionCategories() {
    const res = await fetch(`${API_BASE}/transactions/categories`);
    if (!res.ok) return [];
    return res.json();
  },

  // ─── Planification & Synchro Automatique Régulière ───
  async getSchedulerStatus() {
    const res = await fetch(`${API_BASE}/open-banking/scheduler`);
    if (!res.ok) throw new Error("Erreur récupération état synchronisation automatique");
    return res.json();
  },

  async updateSchedulerConfig(config) {
    const res = await fetch(`${API_BASE}/open-banking/scheduler/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Erreur mise à jour planification");
    return res.json();
  },

  async triggerSchedulerSync() {
    const res = await fetch(`${API_BASE}/open-banking/scheduler/trigger`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur déclenchement synchronisation");
    return res.json();
  },

  async syncBankTransactions() {
    const res = await fetch(`${API_BASE}/open-banking/sync-transactions`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur synchronisation transactions");
    return res.json();
  },

  // ─── Google Drive Bourse & Investissements ───
  async getDriveTree() {
    const res = await fetch(`${API_BASE}/google-drive/tree`);
    if (!res.ok) throw new Error("Erreur récupération arborescence Google Drive");
    return res.json();
  },

  async syncDriveBourse() {
    const res = await fetch(`${API_BASE}/google-drive/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error("Erreur synchronisation Google Drive Bourse");
    return res.json();
  },

  async getDriveLogs(limit = 30) {
    const res = await fetch(`${API_BASE}/google-drive/logs?limit=${limit}`);
    if (!res.ok) throw new Error("Erreur récupération historique Google Drive");
    return res.json();
  },
};


