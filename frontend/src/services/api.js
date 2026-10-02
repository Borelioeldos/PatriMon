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
};
