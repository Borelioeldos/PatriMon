import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import KPICards from './components/KPICards';
import AllocationsCharts from './components/AllocationsCharts';
import AccountsList from './components/AccountsList';
import AddAssetModal from './components/AddAssetModal';
import AddAccountModal from './components/AddAccountModal';
import { api } from './services/api';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL_SECONDS = 30;

export default function App() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  
  // Auto-refresh temps réel
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);

  // Modals state
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [activeAccountForAsset, setActiveAccountForAsset] = useState(null);

  const fetchPortfolio = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setIsRefreshing(true);
      setError(null);
      const data = await api.getSummary(forceRefresh);
      setSummary(data);
      setLastUpdated(data.updated_at || new Date().toLocaleTimeString('fr-FR'));
      setCountdown(REFRESH_INTERVAL_SECONDS);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les données du patrimoine. Vérifiez que le backend FastAPI est bien lancé.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    fetchPortfolio(false);
  }, [fetchPortfolio]);

  // Boucle de compte à rebours et rafraîchissement temps réel automatique
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchPortfolio(true);
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, fetchPortfolio]);

  const handleRefresh = () => {
    fetchPortfolio(true);
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    if (!autoRefresh) setCountdown(REFRESH_INTERVAL_SECONDS);
  };

  const handleOpenAddAsset = (account = null) => {
    setActiveAccountForAsset(account);
    setIsAddAssetOpen(true);
  };

  const handleDeleteAccount = async (accountId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce compte et toutes ses positions associées ?")) {
      try {
        await api.deleteAccount(accountId);
        fetchPortfolio(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleUpdateAccount = async (accountId, data) => {
    try {
      await api.updateAccount(accountId, data);
      fetchPortfolio(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteHolding = async (holdingId) => {
    if (window.confirm("Supprimer cette position ?")) {
      try {
        await api.deleteHolding(holdingId);
        fetchPortfolio(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleSeedAccounts = async () => {
    try {
      setIsLoading(true);
      await api.seedInitialAccounts();
      fetchPortfolio(true);
    } catch (err) {
      alert(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col font-sans">
      <Navbar
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenAddAsset={() => handleOpenAddAsset(null)}
        onOpenAddAccount={() => setIsAddAccountOpen(true)}
        lastUpdated={lastUpdated}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={handleToggleAutoRefresh}
        countdown={countdown}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Erreur de connexion */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-rose-300 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchPortfolio(false)}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium transition-all"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Chargement initial */}
        {isLoading && !summary ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-400">Connexion aux marchés et chargement de votre patrimoine...</p>
          </div>
        ) : (
          <>
            {/* Si aucun compte n'est configuré */}
            {summary?.accounts?.length === 0 ? (
              <div className="bg-[#111827] border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto my-12 shadow-2xl space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white">Bienvenue sur votre suivi de patrimoine !</h2>
                <p className="text-sm text-slate-400">
                  Aucun compte n'est encore configuré. Vous pouvez pré-configurer automatiquement vos 4 enveloppes (BoursoBank, Revolut, BNP Paribas, PEE) ou créer vos comptes manuellement.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleSeedAccounts}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all"
                  >
                    Initialiser mes enveloppes (Recommandé)
                  </button>
                  <button
                    onClick={() => setIsAddAccountOpen(true)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
                  >
                    Créer un compte personnalisé
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. KPIs majeurs */}
                <KPICards summary={summary} />

                {/* 2. Graphiques interactifs riches (Évolution, Banques, Classes d'actifs, Palmarès) */}
                <AllocationsCharts summary={summary} />

                {/* 3. Liste détaillée des comptes & actifs */}
                <AccountsList
                  accounts={summary.accounts}
                  onDeleteAccount={handleDeleteAccount}
                  onUpdateAccount={handleUpdateAccount}
                  onDeleteHolding={handleDeleteHolding}
                  onOpenAddAssetForAccount={handleOpenAddAsset}
                />
              </>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AddAssetModal
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        accounts={summary?.accounts || []}
        initialAccount={activeAccountForAsset}
        onAssetAdded={() => fetchPortfolio(true)}
      />

      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onAccountAdded={() => fetchPortfolio(true)}
      />

      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-400">
        <p>PatriMon • Suivi de patrimoine automatisé • Flux Euronext, US & Crypto en direct</p>
      </footer>
    </div>
  );
}
