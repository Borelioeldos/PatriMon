import React, { useState, useEffect } from 'react';
import { 
  X, Coins, Calendar, TrendingUp, DollarSign, 
  BarChart3, PieChart, Layers, ArrowUpRight, Landmark, Building2
} from 'lucide-react';
import { api } from '../services/api';
import { formatEUR, formatDate } from '../utils/format';

export default function DividendsModal({
  isOpen,
  onClose,
  dividendAnalytics = {},
  accounts = []
}) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'breakdown' | 'monthly'
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  const totalEur = dividendAnalytics.total_eur || 0;
  const count = dividendAnalytics.operations_count || 0;
  const byYear = dividendAnalytics.by_year || {};
  const monthlySeries = dividendAnalytics.monthly_series || [];
  const assetsRanked = dividendAnalytics.assets_ranked || [];

  // Charger les transactions de dividendes
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingTx(true);
    api.getTransactions({ type: 'dividend', limit: 100 })
      .then(res => {
        const items = res.transactions || res || [];
        setTransactions(items);
      })
      .catch(err => {
        console.error("Erreur chargement transactions dividendes:", err);
      })
      .finally(() => {
        setIsLoadingTx(false);
      });
  }, [isOpen]);

  // Fermeture par touche Echap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxMonthly = Math.max(...monthlySeries.map(m => m.amount_eur || 0), 1);

  const accountMap = {};
  accounts.forEach(acc => {
    accountMap[acc.id] = acc;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="double-bezel rounded-[2rem] p-1.5 w-full max-w-3xl shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="double-bezel-inner rounded-[calc(2rem-0.375rem)] overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between bg-slate-50 dark:bg-[#080D18]/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                <Coins className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Dividendes & Revenus Passifs
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-mono font-semibold">
                    {count} versements
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Rendements de distribution encaissés sur vos actions et ETF
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Synthèse Chiffrée & Années */}
          <div className="p-4 sm:p-5 bg-slate-100/70 dark:bg-[#070B14]/70 border-b border-slate-200 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="surface-subtle rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Total encaissé</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight tabular-nums">
                +{formatEUR(totalEur)}
              </div>
            </div>

            <div className="surface-subtle rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Actifs contributeurs</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tracking-tight tabular-nums">
                {assetsRanked.length} <span className="text-xs font-sans text-slate-500 dark:text-slate-400 font-normal">titres</span>
              </div>
            </div>

            <div className="surface-subtle rounded-2xl p-3.5 flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Cumuls par exercice</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.keys(byYear).length > 0 ? (
                  Object.entries(byYear).map(([yr, val]) => (
                    <span key={yr} className="px-2 py-0.5 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[11px] font-mono shadow-xs">
                      <span className="text-slate-500 dark:text-slate-400">{yr}: </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{formatEUR(val)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 font-mono">En attente</span>
                )}
              </div>
            </div>
          </div>

          {/* Onglets de navigation */}
          <div className="px-4 sm:px-5 pt-3 border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-2 bg-slate-50/50 dark:bg-[#080D18]/50 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                activeTab === 'list'
                  ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-white/[0.04]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Journal des versements ({transactions.length || count})</span>
            </button>

            <button
              onClick={() => setActiveTab('breakdown')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                activeTab === 'breakdown'
                  ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-white/[0.04]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <PieChart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Par Titre ({assetsRanked.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                activeTab === 'monthly'
                  ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-white/[0.04]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Saisonnalité mensuelle</span>
            </button>
          </div>

          {/* Corps modal scrollable */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
            {/* 1. Onglet Liste Chronologique */}
            {activeTab === 'list' && (
              <div className="space-y-2">
                {isLoadingTx ? (
                  <div className="text-center py-10 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Chargement des transactions de dividendes...
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs font-mono">
                    Aucun détachement de dividende enregistré.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-[#070B14] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-white/[0.06]">
                          <tr>
                            <th className="py-3 px-3.5">Date</th>
                            <th className="py-3 px-3.5">Titre / Symbole</th>
                            <th className="py-3 px-3.5">Compte</th>
                            <th className="py-3 px-3.5 text-right">Montant perçu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.04]">
                          {transactions.map((tx) => {
                            const acc = accountMap[tx.account_id];
                            const amountEur = tx.amount_eur || tx.amount || 0;
                            return (
                              <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap">
                                  {formatDate(tx.transaction_date)}
                                </td>
                                <td className="py-3 px-3.5">
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {tx.name || tx.symbol || 'Dividende'}
                                  </div>
                                  {tx.symbol && (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                      {tx.symbol}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {acc ? (
                                    <span className="inline-flex items-center gap-1.5 text-[11px]">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color || '#3B82F6' }} />
                                      <span className="font-medium">{acc.name}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">Compte #{tx.account_id}</span>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                                  +{formatEUR(amountEur)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Onglet Par Titre */}
            {activeTab === 'breakdown' && (
              <div className="space-y-3">
                {assetsRanked.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs font-mono">
                    Aucune ventilation par titre disponible.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assetsRanked.map((asset, idx) => {
                      const pct = totalEur > 0 ? ((asset.total_eur / totalEur) * 100).toFixed(1) : '0';
                      return (
                        <div 
                          key={asset.symbol} 
                          className="surface-subtle rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono text-xs font-bold">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs">
                                {asset.name}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {asset.symbol} • {asset.count} versement{asset.count > 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <div className="text-right">
                              <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                                +{formatEUR(asset.total_eur)}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {pct}% du total
                              </div>
                            </div>
                            <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full" 
                                style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. Onglet Saisonnalité Mensuelle */}
            {activeTab === 'monthly' && (
              <div className="space-y-3">
                {monthlySeries.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs font-mono">
                    Aucune saisonnalité mensuelle disponible.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {monthlySeries.map(m => {
                      const pctOfMax = (m.amount_eur / maxMonthly) * 100;
                      return (
                        <div key={m.period} className="surface-subtle rounded-2xl p-3.5 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-mono">
                            <span className="font-semibold">{m.label}</span>
                            <span className="text-[10px]">{m.count}x</span>
                          </div>
                          <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mb-2 tabular-nums">
                            +{formatEUR(m.amount_eur)}
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${Math.max(pctOfMax, 5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#080D18]/80 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-mono">
              Source : Relevés & opérations enregistrées
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all btn-haptic"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
