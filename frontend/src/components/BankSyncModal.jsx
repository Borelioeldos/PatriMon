import React, { useState, useEffect } from 'react';
import { 
  X, RefreshCw, CheckCircle2, AlertCircle, Building2, 
  ShieldCheck, ArrowRight, Zap, Key, Link as LinkIcon, 
  Trash2, ExternalLink, Check, Info, Landmark, Copy, Download
} from 'lucide-react';
import { api } from '../services/api';

export default function BankSyncModal({ 
  isOpen, 
  onClose, 
  onSyncSuccess 
}) {
  const [activeTab, setActiveTab] = useState('connections'); // 'connections', 'connect', 'settings'
  const [status, setStatus] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectingId, setConnectingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [syncResult, setSyncResult] = useState(null);

  // Settings form Enable Banking
  const [simulationMode, setSimulationMode] = useState(true);
  const [applicationId, setApplicationId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [generatedPublicKey, setGeneratedPublicKey] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

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
      const [statusData, instData] = await Promise.all([
        api.getOpenBankingStatus(),
        api.getOpenBankingInstitutions('FR')
      ]);
      setStatus(statusData);
      setInstitutions(instData);
      setSimulationMode(statusData.simulation_mode ?? true);
      setApplicationId(statusData.application_id || '');
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
      setSuccessMsg(result.message || "Soldes bancaires synchronisés avec succès !");
      await loadData();
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectInstitution = async (instId) => {
    setConnectingId(instId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.connectBank(instId, window.location.origin);
      if (res.is_simulation) {
        setSuccessMsg(`Banque connectée en mode Démo ! Les soldes ont été synchronisés.`);
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

  const handleGenerateKeyPair = async () => {
    setIsGeneratingKey(true);
    setErrorMsg('');
    try {
      const data = await api.generateOpenBankingKeyPair();
      setPrivateKey(data.private_key);
      setGeneratedPublicKey(data.public_key);
      setSuccessMsg("Paire de clés RSA générée avec succès ! Copiez la clé publique ci-dessous.");
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la génération de clés");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111827] border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Synchronisation Bancaire DSP2</h3>
                {isSimulation ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase font-semibold">
                    Mode Démo
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase font-semibold">
                    Enable Banking API
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                BoursoBank, BNP Paribas, Revolut • Actualisation directe des liquidités
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-800 px-5 bg-slate-900/40 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('connections')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'connections'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Banques Connectées ({connections.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('connect')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
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
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Configuration Enable Banking</span>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Comptes & Soldes synchronisés</h4>
                      <p className="text-xs text-slate-400">
                        Liquidités réelles issues de vos comptes bancaires
                      </p>
                    </div>

                    <button
                      onClick={handleSyncAll}
                      disabled={syncing || connections.length === 0}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>{syncing ? 'Synchronisation...' : 'Synchroniser les soldes'}</span>
                    </button>
                  </div>

                  {/* Résumé de dernière synchro */}
                  {syncResult && syncResult.updated_accounts && syncResult.updated_accounts.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-xs space-y-1.5">
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>Mise à jour réussie :</span>
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
                        Connectez vos comptes BoursoBank, BNP Paribas ou Revolut pour récupérer automatiquement vos liquidités et soldes de livrets.
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

              {/* TAB 2: CONNECTER UNE BANQUE */}
              {activeTab === 'connect' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Sélectionnez votre banque</h4>
                    <p className="text-xs text-slate-400">
                      Accès sécurisé DSP2 lecture seule (aucun virement, uniquement les soldes et liquidités).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {institutions.map((inst) => {
                      const isConnecting = connectingId === inst.id;
                      const isAlreadyConnected = connections.some(c => c.institution_id.toLowerCase() === inst.id.toLowerCase());

                      return (
                        <div
                          key={inst.id}
                          className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs">
                                {inst.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-white">{inst.name}</h5>
                                <span className="text-[11px] text-slate-400">France • DSP2 Live</span>
                              </div>
                            </div>
                            {isAlreadyConnected && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                                Connecté
                              </span>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                            <button
                              onClick={() => handleConnectInstitution(inst.id)}
                              disabled={isConnecting}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                                isAlreadyConnected
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                              } disabled:opacity-50`}
                            >
                              {isConnecting ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Connexion...</span>
                                </>
                              ) : isAlreadyConnected ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Resynchroniser</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>{isSimulation ? "Connecter (Démo)" : "Connecter ma banque"}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Section de validation manuelle de code de retour si besoin */}
                  {!isSimulation && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-300">
                        Code d'autorisation bancaire (si retour de redirection) :
                      </div>
                      <form onSubmit={handleValidateSessionCode} className="flex gap-2">
                        <input
                          type="text"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          placeholder="Collez ici le code retourné dans l'URL par votre banque"
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={isValidatingCode || !manualCode.trim()}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isValidatingCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Valider</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CONFIGURATION ENABLE BANKING */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-blue-200">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      <span>Comment fonctionne Enable Banking ?</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed">
                      <li>Créez un compte gratuit sur le portail <strong>Enable Banking</strong> (gratuit pour vos propres comptes).</li>
                      <li>Cliquez sur <strong>"Générer une paire de clés RSA"</strong> ci-dessous.</li>
                      <li>Copiez la <strong>Clé Publique</strong> et collez-la dans les paramètres de votre application Enable Banking.</li>
                      <li>Collez votre <strong>Application ID</strong> ci-dessous et enregistrez !</li>
                    </ol>
                  </div>

                  {/* Toggle Simulation */}
                  <div className="flex items-center justify-between p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                    <div>
                      <div className="text-sm font-bold text-white">Mode Simulation / Démo</div>
                      <div className="text-xs text-slate-400">
                        Simule les réponses DSP2 de BoursoBank, BNP et Revolut sans clés externes
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={simulationMode} 
                        onChange={(e) => setSimulationMode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Générateur de clés RSA */}
                  <div className="p-4 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Assistant Clés RSA (Enable Banking)</div>
                        <div className="text-[11px] text-slate-400">Générez une clé en 1 clic pour l'enregistrer chez Enable Banking</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateKeyPair}
                        disabled={isGeneratingKey}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        {isGeneratingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                        <span>Générer mes clés</span>
                      </button>
                    </div>

                    {generatedPublicKey && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Clé Publique à coller sur Enable Banking :</span>
                          <button
                            type="button"
                            onClick={handleCopyPublicKey}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                          >
                            {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedKey ? 'Copié !' : 'Copier la clé'}</span>
                          </button>
                        </div>
                        <textarea
                          readOnly
                          rows={3}
                          value={generatedPublicKey}
                          className="w-full font-mono text-[10px] bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300 focus:outline-none"
                        />
                      </div>
                    )}
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
