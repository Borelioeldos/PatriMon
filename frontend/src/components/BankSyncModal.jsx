import React, { useState, useEffect } from 'react';
import { 
  X, RefreshCw, CheckCircle2, AlertCircle, Building2, 
  ShieldCheck, ArrowRight, Zap, Key, Link as LinkIcon, 
  Trash2, ExternalLink, Check, Info, Landmark, Copy, Download,
  Clock, Play, CheckCircle, Sliders, Calendar
} from 'lucide-react';
import { api } from '../services/api';

export default function BankSyncModal({ 
  isOpen, 
  onClose, 
  onSyncSuccess 
}) {
  const [activeTab, setActiveTab] = useState('connections'); // 'connections', 'scheduler', 'connect', 'settings'
  const [status, setStatus] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectingId, setConnectingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);

  // Settings form Enable Banking
  const [simulationMode, setSimulationMode] = useState(true);
  const [applicationId, setApplicationId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [generatedPublicKey, setGeneratedPublicKey] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Scheduler state
  const [isUpdatingScheduler, setIsUpdatingScheduler] = useState(false);
  const [isTriggeringScheduler, setIsTriggeringScheduler] = useState(false);

  // Code de validation de session manuelle si besoin
  const [manualCode, setManualCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [statusData, instData, schedData] = await Promise.all([
        api.getOpenBankingStatus(),
        api.getOpenBankingInstitutions('FR'),
        api.getSchedulerStatus()
      ]);
      setStatus(statusData);
      setInstitutions(instData);
      setSchedulerStatus(schedData);
      setSimulationMode(statusData.simulation_mode ?? true);
      setApplicationId(statusData.application_id || '');
      if (statusData.public_key) {
        setGeneratedPublicKey(statusData.public_key);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Impossible de charger les données Open Banking.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSyncAll = async () => {
    setSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');
    setSyncResult(null);

    try {
      const result = await api.syncBankBalances();
      setSyncResult(result);
      setSuccessMsg(result.message || "Soldes et transactions synchronisés avec succès !");
      await loadData();
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    setCleaningDuplicates(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.cleanupDuplicateTransactions();
      setSuccessMsg(res.message || "Nettoyage des doublons terminé avec succès.");
      await loadData();
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors du nettoyage des doublons");
    } finally {
      setCleaningDuplicates(false);
    }
  };

  const handleToggleScheduler = async (newVal) => {
    setIsUpdatingScheduler(true);
    try {
      const updated = await api.updateSchedulerConfig({ enabled: newVal });
      setSchedulerStatus(updated);
      setSuccessMsg(newVal ? "Synchronisation automatique activée !" : "Synchronisation automatique désactivée.");
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la mise à jour de la planification");
    } finally {
      setIsUpdatingScheduler(false);
    }
  };

  const handleChangeSchedulerInterval = async (minutes) => {
    setIsUpdatingScheduler(true);
    try {
      const updated = await api.updateSchedulerConfig({ interval_minutes: minutes });
      setSchedulerStatus(updated);
      setSuccessMsg(`Intervalle mis à jour : ${updated.interval_label}`);
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors du changement d'intervalle");
    } finally {
      setIsUpdatingScheduler(false);
    }
  };

  const handleTriggerSchedulerSync = async () => {
    setIsTriggeringScheduler(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.triggerSchedulerSync();
      if (res.success) {
        setSuccessMsg(`Synchronisation réussie ! ${res.accounts_synced} compte(s) et ${res.transactions_new} transaction(s) mises à jour.`);
      } else {
        setErrorMsg(res.error || "Erreur lors de la synchronisation");
      }
      await loadData();
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'exécution de la synchronisation");
    } finally {
      setIsTriggeringScheduler(false);
    }
  };

  const handleConnectInstitution = async (instId) => {
    setConnectingId(instId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.connectBank(instId, window.location.origin);
      if (res.is_simulation) {
        setSuccessMsg(`Banque connectée en mode Démo ! Les comptes et transactions ont été synchronisés.`);
        await loadData();
        if (onSyncSuccess) onSyncSuccess();
        setActiveTab('connections');
      } else if (res.auth_link || res.link) {
        // En mode réel, on redirige vers le portail bancaire sécurisé
        window.open(res.auth_link || res.link, '_blank');
        setSuccessMsg("Portail d'autorisation bancaire ouvert dans un nouvel onglet. Après validation, votre compte sera synchronisé.");
      }
    } catch (err) {
      setErrorMsg(err.message || "Erreur de connexion bancaire");
    } finally {
      setConnectingId(null);
    }
  };

  const handleValidateSessionCode = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setIsValidatingCode(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.exchangeOpenBankingSession(manualCode.trim());
      setSuccessMsg(res.message || "Session bancaire activée avec succès !");
      setManualCode('');
      await loadData();
      if (onSyncSuccess) onSyncSuccess();
      setActiveTab('connections');
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la validation du code");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleGenerateKeyPair = async (force = false) => {
    if (force && !window.confirm("Attention : si vous régénérez une nouvelle clé, vous devrez impérativement mettre à jour la clé publique dans la console Enable Banking. Voulez-vous continuer ?")) {
      return;
    }
    setIsGeneratingKey(true);
    setErrorMsg('');
    try {
      const data = await api.generateOpenBankingKeyPair(force);
      if (data.private_key) setPrivateKey(data.private_key);
      if (data.public_key) setGeneratedPublicKey(data.public_key);
      setSuccessMsg(data.message || (force ? "Nouvelle paire de clés générée !" : "Clé statique permanente chargée avec succès."));
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la récupération des clés");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleCopyPublicKey = () => {
    if (generatedPublicKey) {
      navigator.clipboard.writeText(generatedPublicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
    }
  };

  const handleDeleteConnection = async (connId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir déconnecter cette liaison bancaire ?")) return;

    try {
      await api.deleteBankConnection(connId);
      await loadData();
      setSuccessMsg("Liaison bancaire déconnectée.");
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la déconnexion");
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.updateOpenBankingConfig({
        application_id: applicationId,
        private_key: privateKey,
        simulation_mode: simulationMode
      });
      setSuccessMsg("Configuration Enable Banking enregistrée avec succès.");
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || "Erreur d'enregistrement");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const formatEUR = (val) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const connections = status?.connections || [];
  const isSimulation = status?.simulation_mode ?? true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-md animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[#0C111C] border border-slate-200/90 dark:border-white/[0.1] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#080D18]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm">
              <Landmark className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Synchronisation Bancaire DSP2</h3>
                {isSimulation ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25 uppercase font-semibold">
                    Mode Démo
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 uppercase font-semibold">
                    DSP2 Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                BoursoBank, BNP Paribas, Revolut • Actualisation continue des soldes et transactions
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-800 px-5 bg-slate-900/40 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('connections')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'connections'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Banques Connectées ({connections.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('scheduler')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'scheduler'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Synchro Automatique ⏱️</span>
            {schedulerStatus?.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('connect')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'connect'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Connecter une Banque</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Configuration API</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
              <p className="text-xs text-slate-400">Chargement de la liaison bancaire...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: BANQUES CONNECTÉES */}
              {activeTab === 'connections' && (
                <div className="space-y-4">
                  {/* Bandeau d'état de l'auto-synchro */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">Synchronisation automatique continue</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            schedulerStatus?.enabled 
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {schedulerStatus?.enabled ? 'Active' : 'Désactivée'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          {schedulerStatus?.enabled 
                            ? `${schedulerStatus.interval_label} • Prochaine exécution dans : ${schedulerStatus.time_until_next || 'quelques instants'}`
                            : "La synchronisation en tâche de fond est actuellement inactive"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('scheduler')}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-semibold text-[11px] transition-all self-start sm:self-auto whitespace-nowrap"
                    >
                      Régler l'intervalle ⏱️
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Comptes & Soldes synchronisés</h4>
                      <p className="text-xs text-slate-400">
                        Liquidités réelles et transactions issues de vos comptes bancaires
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCleanupDuplicates}
                        disabled={cleaningDuplicates || connections.length === 0}
                        title="Vérifie et purge les doublons éventuels de transactions bancaires DSP2"
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ShieldCheck className={`w-3.5 h-3.5 ${cleaningDuplicates ? 'animate-spin' : 'text-emerald-400'}`} />
                        <span>{cleaningDuplicates ? 'Purge...' : 'Anti-doublons'}</span>
                      </button>

                      <button
                        onClick={handleSyncAll}
                        disabled={syncing || connections.length === 0}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                        <span>{syncing ? 'Synchronisation...' : 'Synchroniser tout'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Résumé de dernière synchro */}
                  {syncResult && syncResult.updated_accounts && syncResult.updated_accounts.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-xs space-y-2">
                      <div className="font-semibold text-emerald-400 flex items-center justify-between flex-wrap gap-1">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-4 h-4" />
                          Mise à jour réussie :
                        </span>
                        <div className="flex items-center gap-1.5">
                          {syncResult.reconciled_transactions > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 font-bold text-[11px]">
                              {syncResult.reconciled_transactions} réconciliée(s)
                            </span>
                          )}
                          {syncResult.duplicates_purged > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">
                              {syncResult.duplicates_purged} doublon(s) purgé(s)
                            </span>
                          )}
                          {syncResult.new_transactions_imported !== undefined && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">
                              +{syncResult.new_transactions_imported} transactions
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {syncResult.updated_accounts.map((acc, idx) => (
                          <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                            <span className="text-slate-300 font-medium">{acc.account_name}</span>
                            <span className="text-white font-bold">{formatEUR(acc.new_balance)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {connections.length === 0 ? (
                    <div className="py-10 text-center bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3 p-6">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                        <Landmark className="w-6 h-6" />
                      </div>
                      <h5 className="text-sm font-semibold text-white">Aucune liaison bancaire active</h5>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Connectez vos comptes BoursoBank, BNP Paribas ou Revolut pour récupérer automatiquement vos liquidités et vos flux de transactions.
                      </p>
                      <button
                        onClick={() => setActiveTab('connect')}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Connecter ma première banque</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {connections.map((conn) => (
                        <div 
                          key={conn.id}
                          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700/80 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                              {(conn.institution_id || 'BK').substring(0, 3).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white">{conn.institution_name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                                  {conn.status}
                                </span>
                                {conn.is_simulation && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                                    Démo
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{conn.accounts ? conn.accounts.length : 0} compte(s) lié(s)</span>
                                <span>•</span>
                                <span>Dernière synchro : {conn.last_synced_at || 'Jamais'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              onClick={() => handleDeleteConnection(conn.id)}
                              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                              title="Déconnecter cette banque"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SYNCHRONISATION AUTOMATIQUE & PLANIFICATEUR */}
              {activeTab === 'scheduler' && (
                <div className="space-y-5 text-xs">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Planification Automatique des Comptes & Transactions
                    </h4>
                    <p className="text-slate-400 mt-1">
                      Le serveur FastAPI actualise automatiquement vos soldes bancaires, télécharge les nouvelles transactions, et met à jour votre historique de patrimoine selon l'intervalle de votre choix.
                    </p>
                  </div>

                  {/* Interrupteur Activation */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">Activer la synchronisation automatique</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Fonctionne en arrière-plan sans avoir à garder le navigateur ouvert
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={schedulerStatus?.enabled ?? true}
                        onChange={(e) => handleToggleScheduler(e.target.checked)}
                        disabled={isUpdatingScheduler}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Choix de l'intervalle régulier */}
                  <div className="space-y-2">
                    <label className="block text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                      Fréquence de rafraîchissement
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { minutes: 60, label: "Toutes les heures", desc: "60 min" },
                        { minutes: 240, label: "Toutes les 4 heures", desc: "Recommandé" },
                        { minutes: 720, label: "Toutes les 12 heures", desc: "2x par jour" },
                        { minutes: 1440, label: "Une fois par jour", desc: "24 heures" },
                      ].map((freq) => (
                        <button
                          key={freq.minutes}
                          type="button"
                          onClick={() => handleChangeSchedulerInterval(freq.minutes)}
                          disabled={isUpdatingScheduler || !schedulerStatus?.enabled}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            schedulerStatus?.interval_minutes === freq.minutes
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          } disabled:opacity-50`}
                        >
                          <div className="font-bold text-xs">{freq.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{freq.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* État en direct & prochaine exécution */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <span className="text-slate-400">Statut actuel du service :</span>
                      <span className="flex items-center gap-1.5 font-bold text-white">
                        <span className={`w-2 h-2 rounded-full ${schedulerStatus?.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                        {schedulerStatus?.enabled ? 'Actif & En attente' : 'Inactif'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <span className="text-slate-400">Prochaine exécution programmée :</span>
                      <span className="font-mono font-bold text-blue-400">
                        {schedulerStatus?.next_run ? `${schedulerStatus.next_run} (dans ${schedulerStatus.time_until_next})` : 'Aucune'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <span className="text-slate-400">Dernier cycle automatique :</span>
                      <span className="font-mono text-slate-300">
                        {schedulerStatus?.last_run || 'Aucun cycle exécuté'}
                      </span>
                    </div>

                    {schedulerStatus?.last_summary && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex justify-between items-center">
                        <span>Dernier résultat :</span>
                        <span className="font-semibold text-emerald-400">
                          {schedulerStatus.last_summary.accounts_synced || 0} comptes • {schedulerStatus.last_summary.transactions_new || 0} transactions
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bouton de déclenchement forcé immédiat */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleTriggerSchedulerSync}
                      disabled={isTriggeringScheduler}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Play className={`w-3.5 h-3.5 ${isTriggeringScheduler ? 'animate-spin' : ''}`} />
                      <span>{isTriggeringScheduler ? 'Synchronisation en cours...' : 'Exécuter un cycle complet maintenant'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: CONNECTER UNE BANQUE */}
              {activeTab === 'connect' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Sélectionnez votre établissement</h4>
                    <p className="text-xs text-slate-400">
                      Connexion directe et sécurisée DSP2 conforme à la réglementation européenne
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {institutions.map((inst) => {
                      const isConnecting = connectingId === inst.id;
                      return (
                        <div
                          key={inst.id}
                          className="bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 flex items-center justify-between gap-3 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-white text-xs group-hover:border-blue-500/40">
                              {inst.logo ? (
                                <img src={inst.logo} alt={inst.name} className="w-7 h-7 object-contain" />
                              ) : (
                                inst.name.substring(0, 3).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                                {inst.name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {inst.title || inst.country}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleConnectInstitution(inst.id)}
                            disabled={isConnecting}
                            className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isConnecting ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowRight className="w-3.5 h-3.5" />
                            )}
                            <span>{isSimulation ? 'Lier' : 'Connecter'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Section de validation manuelle de session */}
                  <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-slate-300">Validation manuelle du code de session</h5>
                      <p className="text-[11px] text-slate-500">
                        Si votre navigateur n'a pas redirigé automatiquement, collez le paramètre <code>code=...</code> ici :
                      </p>
                    </div>

                    <form onSubmit={handleValidateSessionCode} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: 884b2382-7e9b-4399-..."
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={isValidatingCode || !manualCode.trim()}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        {isValidatingCode ? 'Validation...' : 'Valider'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 4: CONFIGURATION API ENABLE BANKING */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
                  <div>
                    <h4 className="text-sm font-bold text-white">Paramètres Enable Banking & Clés RSA</h4>
                    <p className="text-slate-400 mt-0.5">
                      Configurez votre environnement de production Enable Banking pour synchroniser vos véritables comptes français.
                    </p>
                  </div>

                  {/* Bascule Mode Simulation / Réel */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">Mode Simulation / Démo</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Testez l'application instantanément avec des soldes et transactions réalistes sans compte réel.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={simulationMode}
                        onChange={(e) => setSimulationMode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </label>
                  </div>

                  {/* Section Clé Publique Permanente */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-slate-200">Votre Clé Publique RSA Statique</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                          Fixe & Permanente
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPublicKey}
                        disabled={!generatedPublicKey}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey ? 'Copié !' : 'Copier la clé'}</span>
                      </button>
                    </div>

                    <textarea
                      readOnly
                      rows={4}
                      value={generatedPublicKey || "Chargement de la clé publique statique..."}
                      className="w-full font-mono text-[10px] bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 select-all focus:outline-none focus:border-blue-500"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">
                        Stockée localement dans <code className="text-slate-400">backend/certs/enable_banking_public.pem</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGenerateKeyPair(true)}
                        disabled={isGeneratingKey}
                        className="text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors"
                      >
                        Régénérer une nouvelle paire (avancé)
                      </button>
                    </div>
                  </div>

                  {/* Identifiants réels Enable Banking */}
                  <div className={`space-y-3 transition-opacity ${simulationMode ? 'opacity-60' : 'opacity-100'}`}>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Application ID (Enable Banking)
                      </label>
                      <input
                        type="text"
                        value={applicationId}
                        onChange={(e) => setApplicationId(e.target.value)}
                        placeholder="Ex: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Clé Privée RSA (Format PEM ou générée ci-dessus)
                      </label>
                      <textarea
                        rows={4}
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                        className="w-full font-mono text-xs px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <a 
                        href="https://enablebanking.com/sign-in/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                      >
                        <span>Ouvrir la console Enable Banking</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingConfig}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Enregistrer la configuration</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Chiffrement local RSA • Aucun mot de passe bancaire stocké</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
