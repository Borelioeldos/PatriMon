import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  FolderSync,
  RefreshCw,
  CheckCircle2,
  FileText,
  AlertCircle,
  Clock,
  TrendingUp,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';

export default function DriveSyncModal({ isOpen, onClose, onSyncSuccess }) {
  const [treeData, setTreeData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('folders'); // 'folders' | 'logs'
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      setSyncResult(null);
      setError(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tree, syncLogs] = await Promise.all([
        api.getDriveTree().catch(() => null),
        api.getDriveLogs(20).catch(() => []),
      ]);
      setTreeData(tree);
      setLogs(syncLogs || []);
    } catch (err) {
      setError(err.message || "Erreur lors du chargement des informations Drive");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSyncResult(null);

      const res = await api.syncDriveBourse();
      setSyncResult(res.stats || {});
      
      // Recharger les données et notifier le dashboard
      await loadData();
      if (onSyncSuccess) {
        onSyncSuccess();
      }
    } catch (err) {
      setError(err.message || "Erreur lors de la synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  const categories = treeData?.categories || {};
  const bourso = categories.bourso || { files: [], total: 0, pending: 0 };
  const revolut = categories.revolut || { files: [], total: 0, pending: 0 };
  const bnp = categories.bnp || { files: [], total: 0, pending: 0 };

  const totalPending = (bourso.pending || 0) + (revolut.pending || 0) + (bnp.pending || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-[#121824] border border-[#222E42] rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Google Drive Bourse & Investissements
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connecté Cloud
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dossier cloud <code className="text-blue-300 font-mono">Bourse/</code> • Relevés PEA, Avis d'opérés, CSV Revolut & BNP PEE
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800/60 bg-slate-900/60">
          <button
            onClick={() => setActiveTab('folders')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'folders'
                ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Dossiers Cloud & Fichiers ({treeData?.total_files || 0})</span>
            {totalPending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                {totalPending} nouveau{totalPending > 1 ? 'x' : ''}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historique des Traitements ({logs.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {syncResult && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Synchronisation Google Drive réussie !</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-200">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-500/20">
                  <div className="text-[11px] text-slate-400">Avis d'opéré Bourso</div>
                  <div className="font-bold text-sm text-emerald-400">+{syncResult.bourso_trades_imported || 0}</div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-500/20">
                  <div className="text-[11px] text-slate-400">Positions PEA actualisées</div>
                  <div className="font-bold text-sm text-blue-400">{syncResult.bourso_positions_updated || 0}</div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-500/20">
                  <div className="text-[11px] text-slate-400">Transactions Revolut</div>
                  <div className="font-bold text-sm text-indigo-400">+{syncResult.revolut_transactions_imported || 0}</div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-500/20">
                  <div className="text-[11px] text-slate-400">Fonds BNP PEE</div>
                  <div className="font-bold text-sm text-amber-400">{syncResult.bnp_funds_updated || 0}</div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Inspection du dossier Google Drive en cours...</p>
            </div>
          ) : activeTab === 'folders' ? (
            <div className="space-y-4">
              {/* 1. BoursoBank */}
              <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                      B
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">BoursoBank PEA</h3>
                      <p className="text-[11px] text-slate-400">Dossier <code className="text-blue-400">Bourso/</code> • Relevés de titres & Avis d'opérés</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {bourso.files.length} fichier{bourso.files.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {bourso.files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <span className="truncate text-slate-200" title={f.name}>{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {f.is_synced ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Traité
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            À synchroniser
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Revolut */}
              <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
                      R
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Revolut (CTO & Crypto)</h3>
                      <p className="text-[11px] text-slate-400">Dossier <code className="text-indigo-400">Revolut/</code> • 4 exports CSV mensuels</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {revolut.files.length} fichier{revolut.files.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {revolut.files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="truncate text-slate-200" title={f.name}>{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {f.is_synced ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Traité
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            À synchroniser
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. BNP EE */}
              <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      B
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">BNP Épargne Entreprise (PEE & PERO)</h3>
                      <p className="text-[11px] text-slate-400">Dossier <code className="text-emerald-400">BNP_epargne entreprise/</code> • Relevés de situation</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {bnp.files.length} fichier{bnp.files.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {bnp.files.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 italic bg-slate-900/40 rounded-xl border border-slate-800/40">
                      Aucun fichier déposé pour l'instant. Déposez votre relevé Schneider Electric dans ce dossier !
                    </div>
                  ) : (
                    bnp.files.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="truncate text-slate-200" title={f.name}>{f.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {f.is_synced ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Traité
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                              À synchroniser
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Logs Tab */
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Aucun historique d'import pour le moment.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{log.file_name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                          {log.file_category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {log.details || 'Fichier traité sans anomalie'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-emerald-400 font-bold text-xs">
                        {log.transactions_imported > 0 && `+${log.transactions_imported} tx `}
                        {log.holdings_updated > 0 && `${log.holdings_updated} positions`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(log.imported_at).toLocaleDateString()} {new Date(log.imported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Anti-doublons activé via empreinte md5 cloud</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              Fermer
            </button>

            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Synchronisation en cours...' : 'Synchroniser depuis Google Drive'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
