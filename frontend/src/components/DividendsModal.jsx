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

  // Calcul du max mensuel pour l'histogramme
  const maxMonthly = Math.max(...monthlySeries.map(m => m.amount_eur || 0), 1);

  // Map des comptes pour affichage institution
  const accountMap = {};
  accounts.forEach(acc => {
    accountMap[acc.id] = acc;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-[#0E1524] border border-[#1E293B] w-full max-w-3xl rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1C2638] flex items-center justify-between bg-[#0B101C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-sm">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Dividendes & Revenus Passifs
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                  {count} versements
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rendements de distribution encaissés sur vos actions et ETF
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Synthèse Chiffrée & Années */}
        <div className="p-4 sm:p-5 bg-[#090D17] border-b border-[#1C2638] grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#0E1524] border border-[#1E293B] rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-1">Total encaissé</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">
              +{formatEUR(totalEur)}
            </div>
          </div>

          <div className="bg-[#0E1524] border border-[#1E293B] rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-1">Actifs contributeurs</span>
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {assetsRanked.length} <span className="text-xs font-sans text-slate-400 font-normal">titres</span>
            </div>
          </div>

          <div className="bg-[#0E1524] border border-[#1E293B] rounded-xl p-3 flex flex-col justify-center">
            <span className="text-[11px] text-slate-400 block mb-1.5">Cumuls par exercice</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.keys(byYear).length > 0 ? (
                Object.entries(byYear).map(([yr, val]) => (
                  <span key={yr} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono">
                    <span className="text-slate-400">{yr}: </span>
                    <span className="text-emerald-400 font-semibold">+{formatEUR(val)}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 font-mono">En attente</span>
              )}
            </div>
          </div>
        </div>

        {/* Onglets de navigation */}
        <div className="px-4 sm:px-5 pt-3 border-b border-[#1C2638] flex items-center gap-2 bg-[#0B101C]">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-emerald-400 text-white bg-white/[0.04]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Journal des versements ({transactions.length || count})</span>
          </button>

          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'breakdown'
                ? 'border-emerald-400 text-white bg-white/[0.04]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-blue-400" />
            <span>Par Titre ({assetsRanked.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'monthly'
                ? 'border-emerald-400 text-white bg-white/[0.04]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Saisonnalité mensuelle</span>
          </button>
        </div>

        {/* Corps modal scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* 1. Onglet Liste Chronologique */}
          {activeTab === 'list' && (
            <div className="space-y-2">
              {isLoadingTx ? (
                <div className="text-center py-10 text-xs text-slate-400 font-mono">
                  Chargement des transactions de dividendes...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Aucun détachement de dividende enregistré.
                </div>
              ) : (
                <div className="border border-[#1E293B] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#090D17] text-slate-400 font-mono uppercase text-[10px] border-b border-[#1E293B]">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Titre / Symbole</th>
                          <th className="py-2.5 px-3">Compte</th>
                          <th className="py-2.5 px-3 text-right">Montant perçu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1C2638] font-sans">
                        {transactions.map((tx) => {
                          const acc = accountMap[tx.account_id];
                          const amountEur = tx.amount_eur || tx.amount || 0;
                          return (
                            <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                                {formatDate(tx.transaction_date)}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-white">
                                  {tx.name || tx.symbol || 'Dividende'}
                                </div>
                                {tx.symbol && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {tx.symbol}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                                {acc ? (
                                  <span className="inline-flex items-center gap-1 text-[11px]">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color || '#3B82F6' }} />
                                    <span>{acc.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-500">Compte #{tx.account_id}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
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
                <div className="text-center py-10 text-slate-400 text-xs">
                  Aucune ventilation par titre disponible.
                </div>
              ) : (
                <div className="space-y-2">
                  {assetsRanked.map((asset, idx) => {
                    const pct = totalEur > 0 ? ((asset.total_eur / totalEur) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={asset.symbol} 
                        className="bg-[#090D17] border border-[#1E293B] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-600/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-mono text-xs font-bold">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-xs">
                              {asset.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {asset.symbol} • {asset.count} versement{asset.count > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="text-right">
                            <div className="text-xs font-bold font-mono text-emerald-400">
                              +{formatEUR(asset.total_eur)}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {pct}% du total
                            </div>
                          </div>
                          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-emerald-400 h-full rounded-full" 
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
                <div className="text-center py-10 text-slate-400 text-xs">
                  Aucune saisonnalité mensuelle disponible.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {monthlySeries.map(m => {
                    const pctOfMax = (m.amount_eur / maxMonthly) * 100;
                    return (
                      <div key={m.period} className="bg-[#090D17] border border-[#1E293B] rounded-xl p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
                          <span>{m.label}</span>
                          <span className="text-[10px] text-slate-500">{m.count}x</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-emerald-400 mb-2">
                          +{formatEUR(m.amount_eur)}
                        </div>
                        <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
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
        <div className="p-3.5 sm:p-4 bg-[#090D17] border-t border-[#1C2638] flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] font-mono">
            Source : Exports Revolut & ordres enregistrés
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
