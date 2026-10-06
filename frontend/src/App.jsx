import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import KPICards from './components/KPICards';
import PerformanceMetrics from './components/PerformanceMetrics';
import AllocationsCharts from './components/AllocationsCharts';
import AccountsList from './components/AccountsList';
import TransactionsList from './components/TransactionsList';
import AddAssetModal from './components/AddAssetModal';
import AddAccountModal from './components/AddAccountModal';
import AddTransactionModal from './components/AddTransactionModal';
import PeeImportModal from './components/PeeImportModal';
import BankSyncModal from './components/BankSyncModal';
import DriveSyncModal from './components/DriveSyncModal';
import DividendsModal from './components/DividendsModal';
import StrategyView from './components/StrategyView';
import { api } from './services/api';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL_SECONDS = 30;

export default function App() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  
  // Perspective active (navigation par onglets)
  const [activeView, setActiveView] = useState('overview'); // 'overview' | 'accounts' | 'analytics' | 'transactions'

  // Auto-refresh temps réel
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);

  // Mode Sombre / Mode Clair
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('patrimon_theme');
      if (saved) return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (_) {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('patrimon_theme', theme);
    } catch (_) {}
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Mode Confidentialité (floutage en 1-clic des montants sensibles)
  const [privacyMode, setPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem('patrimon_privacy_mode') === 'true';
    } catch (_) {
      return false;
    }
  });

  const handleTogglePrivacyMode = useCallback(() => {
    setPrivacyMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('patrimon_privacy_mode', String(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Raccourci clavier 'P' pour basculer en mode discret
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handleTogglePrivacyMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePrivacyMode]);

  // Modals state
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isPeeImportOpen, setIsPeeImportOpen] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);
  const [isDriveSyncOpen, setIsDriveSyncOpen] = useState(false);
  const [isDividendsModalOpen, setIsDividendsModalOpen] = useState(false);
  const [activeAccountForAsset, setActiveAccountForAsset] = useState(null);
  const [activeAccountForTransaction, setActiveAccountForTransaction] = useState(null);

  // Trigger pour recharger le journal des transactions
  const [txRefreshTrigger, setTxRefreshTrigger] = useState(0);

  const isFetchingRef = useRef(false);

  const fetchPortfolio = useCallback(async (forceRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (forceRefresh) setIsRefreshing(true);
      setError(null);
      const data = await api.getSummary(forceRefresh);
      setSummary(data);

      let timeStr = '';
      if (data.updated_at) {
        const d = new Date(data.updated_at);
        timeStr = isNaN(d.getTime()) ? data.updated_at : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } else {
        timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      setLastUpdated(timeStr);
      setCountdown(REFRESH_INTERVAL_SECONDS);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les données du patrimoine. Vérifiez que le backend FastAPI est bien lancé.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    fetchPortfolio(false);
  }, [fetchPortfolio]);

  // Détection du retour d'autorisation bancaire Open Banking (?code=... ou ?state=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsLoading(true);
      api.exchangeOpenBankingSession(code, state)
        .then((res) => {
          alert(res.message || "Votre banque a été synchronisée et vos comptes ont été créés avec succès !");
          fetchPortfolio(true);
        })
        .catch((err) => {
          alert("Erreur lors de la synchronisation bancaire : " + err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [fetchPortfolio]);

  // Boucle de compte à rebours et rafraîchissement temps réel automatique (F1 & F2)
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTimeout(() => fetchPortfolio(false), 0);
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

  const handleOpenAddTransaction = (account = null) => {
    setActiveAccountForTransaction(account);
    setIsAddTransactionOpen(true);
  };

  const handleDeleteAccount = async (accountId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce compte et toutes ses positions associées ?")) {
      try {
        await api.deleteAccount(accountId);
        fetchPortfolio(false);
        setTxRefreshTrigger(prev => prev + 1);
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
        setTxRefreshTrigger(prev => prev + 1);
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
      setTxRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.message);
      setIsLoading(false);
    }
  };

  const handleTransactionAdded = () => {
    fetchPortfolio(true);
    setTxRefreshTrigger(prev => prev + 1);
  };

  const handleTransactionDeleted = () => {
    fetchPortfolio(true);
    setTxRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] dark:bg-[#070A11] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200 ${privacyMode ? 'privacy-active' : ''}`}>
      <Navbar
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenAddAsset={() => handleOpenAddAsset(null)}
        onOpenAddAccount={() => setIsAddAccountOpen(true)}
        onOpenAddTransaction={() => handleOpenAddTransaction(null)}
        onOpenBankSync={() => setIsBankSyncOpen(true)}
        onOpenPeeImport={() => setIsPeeImportOpen(true)}
        onOpenDriveSync={() => setIsDriveSyncOpen(true)}
        lastUpdated={lastUpdated}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={handleToggleAutoRefresh}
        countdown={countdown}
        activeView={activeView}
        onSelectView={setActiveView}
        privacyMode={privacyMode}
        onTogglePrivacyMode={handleTogglePrivacyMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Erreur de connexion */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between gap-3 text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchPortfolio(false)}
              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium transition-all"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Chargement initial */}
        {isLoading && !summary ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            <p className="text-xs text-slate-400 font-mono">Connexion aux flux boursiers et lecture du portefeuille...</p>
          </div>
        ) : (
          <>
            {/* Si aucun compte n'est configuré */}
            {summary?.accounts?.length === 0 ? (
              <div className="fintech-card p-8 sm:p-10 text-center max-w-lg mx-auto my-12 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20 shadow-sm">
                  <Sparkles className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Bienvenue sur votre suivi de patrimoine</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Aucun compte n'est encore configuré. Vous pouvez pré-configurer automatiquement vos 4 enveloppes (BoursoBank, Revolut, BNP Paribas, PEE) ou créer vos comptes manuellement.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    onClick={handleSeedAccounts}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all btn-haptic"
                  >
                    Initialiser mes enveloppes
                  </button>
                  <button
                    onClick={() => setIsAddAccountOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-white/[0.08] transition-all btn-haptic"
                  >
                    Créer un compte personnalisé
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Vue d'ensemble (KPIs + Performance + Allocations + Comptes + Transactions) */}
                {activeView === 'overview' && (
                  <div className="space-y-5 animate-fadeIn">
                    <KPICards summary={summary} onOpenDividendsModal={() => setIsDividendsModalOpen(true)} />
                    <PerformanceMetrics summary={summary} onOpenDividendsModal={() => setIsDividendsModalOpen(true)} />
                    <AllocationsCharts summary={summary} theme={theme} onSelectView={setActiveView} />
                    <AccountsList
                      accounts={summary.accounts}
                      onDeleteAccount={handleDeleteAccount}
                      onUpdateAccount={handleUpdateAccount}
                      onDeleteHolding={handleDeleteHolding}
                      onOpenAddAssetForAccount={handleOpenAddAsset}
                      onOpenPeeImport={() => setIsPeeImportOpen(true)}
                      onOpenBankSync={() => setIsBankSyncOpen(true)}
                      onOpenAddTransaction={handleOpenAddTransaction}
                      onHoldingUpdated={() => {
                        fetchPortfolio(false);
                        setTxRefreshTrigger(prev => prev + 1);
                      }}
                    />
                    <TransactionsList
                      onOpenAddTransaction={() => handleOpenAddTransaction(null)}
                      accounts={summary.accounts}
                      refreshTrigger={txRefreshTrigger}
                      onTransactionDeleted={handleTransactionDeleted}
                    />
                  </div>
                )}

                {/* 2. Vue Comptes & Positions */}
                {activeView === 'accounts' && (
                  <div className="space-y-5 animate-fadeIn">
                    <KPICards summary={summary} onOpenDividendsModal={() => setIsDividendsModalOpen(true)} />
                    <AccountsList
                      accounts={summary.accounts}
                      onDeleteAccount={handleDeleteAccount}
                      onUpdateAccount={handleUpdateAccount}
                      onDeleteHolding={handleDeleteHolding}
                      onOpenAddAssetForAccount={handleOpenAddAsset}
                      onOpenPeeImport={() => setIsPeeImportOpen(true)}
                      onOpenBankSync={() => setIsBankSyncOpen(true)}
                      onOpenAddTransaction={handleOpenAddTransaction}
                      onHoldingUpdated={() => {
                        fetchPortfolio(false);
                        setTxRefreshTrigger(prev => prev + 1);
                      }}
                    />
                  </div>
                )}

                {/* 3. Vue Performance & Indices */}
                {activeView === 'analytics' && (
                  <div className="space-y-5 animate-fadeIn">
                    <KPICards summary={summary} onOpenDividendsModal={() => setIsDividendsModalOpen(true)} />
                    <PerformanceMetrics summary={summary} onOpenDividendsModal={() => setIsDividendsModalOpen(true)} />
                    <AllocationsCharts summary={summary} theme={theme} onSelectView={setActiveView} />
                  </div>
                )}

                {/* 4. Vue Stratégie & Projections (Phase 4) */}
                {activeView === 'strategy' && (
                  <div className="space-y-5 animate-fadeIn">
                    <StrategyView summary={summary} theme={theme} />
                  </div>
                )}

                {/* 5. Vue Journal des Transactions */}
                {activeView === 'transactions' && (
                  <div className="space-y-5 animate-fadeIn">
                    <TransactionsList
                      onOpenAddTransaction={() => handleOpenAddTransaction(null)}
                      accounts={summary.accounts}
                      refreshTrigger={txRefreshTrigger}
                      onTransactionDeleted={handleTransactionDeleted}
                    />
                  </div>
                )}
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

      <AddTransactionModal
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
        accounts={summary?.accounts || []}
        initialAccount={activeAccountForTransaction}
        onTransactionAdded={handleTransactionAdded}
      />

      <PeeImportModal
        isOpen={isPeeImportOpen}
        onClose={() => setIsPeeImportOpen(false)}
        onImportSuccess={() => fetchPortfolio(true)}
      />

      <BankSyncModal
        isOpen={isBankSyncOpen}
        onClose={() => setIsBankSyncOpen(false)}
        onSyncSuccess={() => {
          fetchPortfolio(true);
          setTxRefreshTrigger(prev => prev + 1);
        }}
      />

      <DriveSyncModal
        isOpen={isDriveSyncOpen}
        onClose={() => setIsDriveSyncOpen(false)}
        onSyncSuccess={() => {
          fetchPortfolio(true);
          setTxRefreshTrigger(prev => prev + 1);
        }}
      />

      <DividendsModal
        isOpen={isDividendsModalOpen}
        onClose={() => setIsDividendsModalOpen(false)}
        dividendAnalytics={summary?.performance_metrics?.dividend_analytics || {}}
        accounts={summary?.accounts || []}
      />

      <footer className="border-t border-white/[0.06] py-8 text-center text-[11px] text-slate-500 font-mono">
        <p className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-slate-400 font-semibold">PatriMon</span>
          <span>•</span>
          <span>Ingénierie Patrimoniale de Précision</span>
          <span>•</span>
          <span>Flux Live Euronext, US & Crypto</span>
        </p>
      </footer>
    </div>
  );
}
