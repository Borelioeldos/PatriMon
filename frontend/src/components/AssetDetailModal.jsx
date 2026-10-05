import React, { useState, useEffect } from 'react';
import { 
  X, TrendingUp, TrendingDown, DollarSign, Calendar, Landmark, 
  ArrowUpRight, ArrowDownRight, Coins, RefreshCw, FileText, CheckCircle2,
  PieChart, Percent, Plus
} from 'lucide-react';
import { api } from '../services/api';
import { formatEUR, formatCurrency } from '../utils/format';

export default function AssetDetailModal({
  isOpen,
  onClose,
  holdingId,
  onOpenAddTransaction
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && holdingId) {
      loadDetail();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, holdingId]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getHoldingDetail(holdingId);
      setData(res);
    } catch (err) {
      setError(err.message || "Erreur lors du chargement de la fiche valeur");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const holding = data?.holding;
  const account = data?.account;
  const stats = data?.stats;
  const transactions = data?.transactions || [];

  const isPositiveGain = (holding?.gain_eur || 0) >= 0;
  const isTotalReturnPositive = (stats?.total_return_eur || 0) >= 0;
  const isClosed = holding && holding.quantity <= 0;

  const getTypeBadge = (type) => {
    switch (type) {
      case 'BUY':
        return { label: 'Achat', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25' };
      case 'SELL':
        return { label: 'Vente', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25' };
      case 'DIVIDEND':
        return { label: 'Dividende', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25' };
      default:
        return { label: type, bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      {/* Outer Shell Double-Bezel */}
      <div 
        className="double-bezel rounded-[2rem] p-1.5 w-full max-w-4xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inner Core */}
        <div className="double-bezel-inner rounded-[calc(2rem-0.375rem)] max-h-[90vh] flex flex-col overflow-hidden">
          
          {/* En-tête */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between bg-slate-50 dark:bg-[#080D18]/80">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm tracking-tight shadow-md">
                {holding?.symbol ? holding.symbol.slice(0, 3) : <TrendingUp className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    {holding?.name || holding?.symbol || 'Fiche Valeur'}
                  </h2>
                  {isClosed ? (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] font-medium">
                      POSITION SOLDÉE
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-semibold">
                      EN PORTEFEUILLE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{holding?.symbol}</span>
                  {account && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: account.color || '#3B82F6' }}></span>
                        {account.name} ({account.institution})
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDetail}
                disabled={loading}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.06] transition-all btn-haptic"
                title="Rafraîchir les données de la position"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.06] transition-all btn-haptic"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Corps défilable */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {loading && !data && (
              <div className="py-16 text-center space-y-2">
                <RefreshCw className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Chargement de la fiche valeur et de son historique...</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-mono">
                {error}
              </div>
            )}

            {data && (
              <>
                {/* Grille de 4 KPIs principaux */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* 1. Valorisation */}
                  <div className="bg-slate-50 dark:bg-[#070B14]/80 border border-slate-200 dark:border-white/[0.06] p-4 rounded-xl">
                    <div className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Valorisation
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-mono mt-1 tabular-nums">
                      {formatEUR(holding.total_value_eur)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {holding.quantity} part{holding.quantity > 1 ? 's' : ''} à {formatEUR(holding.current_price_eur || holding.current_price)}
                    </div>
                  </div>

                  {/* 2. PRU & Coût d'achat */}
                  <div className="bg-slate-50 dark:bg-[#070B14]/80 border border-slate-200 dark:border-white/[0.06] p-4 rounded-xl">
                    <div className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Prix de Revient (PRU)
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-200 font-mono mt-1 tabular-nums">
                      {formatEUR(holding.unit_cost_eur)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Investi : {formatEUR(holding.total_invested_eur)}
                    </div>
                  </div>

                  {/* 3. Plus-Value Latente */}
                  <div className="bg-slate-50 dark:bg-[#070B14]/80 border border-slate-200 dark:border-white/[0.06] p-4 rounded-xl">
                    <div className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Plus-Value Latente
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tabular-nums ${
                      isPositiveGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isPositiveGain ? `+${formatEUR(holding.gain_eur)}` : formatEUR(holding.gain_eur)}
                    </div>
                    <div className={`text-xs font-mono mt-0.5 flex items-center gap-1 font-semibold ${
                      isPositiveGain ? 'text-emerald-700 dark:text-emerald-500' : 'text-rose-700 dark:text-rose-500'
                    }`}>
                      {isPositiveGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{isPositiveGain ? `+${holding.gain_percent}%` : `${holding.gain_percent}%`}</span>
                    </div>
                  </div>

                  {/* 4. Dividendes & Rendement */}
                  <div className="bg-slate-50 dark:bg-[#070B14]/80 border border-slate-200 dark:border-white/[0.06] p-4 rounded-xl">
                    <div className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Dividendes Perçus
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1 tabular-nums">
                      +{formatEUR(stats.total_dividends_eur)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {stats.total_dividends_count} versement{stats.total_dividends_count > 1 ? 's' : ''}
                      {stats.yield_on_cost > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 ml-1 font-semibold">
                          (YoC {stats.yield_on_cost}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bandeau de Rentabilité Totale & Réalisée */}
                <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-[#0C1322] dark:to-[#0A101C] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                      <PieChart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="font-bold text-slate-900 dark:text-white">Rentabilité Totale Historique de la Ligne</span>
                      <span className="text-[10px] text-slate-500 font-mono">(Latente + Réalisée + Dividendes)</span>
                    </div>
                    <div className={`text-2xl font-extrabold font-mono mt-1 tabular-nums ${
                      isTotalReturnPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isTotalReturnPositive ? `+${formatEUR(stats.total_return_eur)}` : formatEUR(stats.total_return_eur)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-white/[0.08] pt-2.5 sm:pt-0 sm:pl-5">
                    <div>
                      <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-semibold">PV RÉALISÉE (VENTES)</div>
                      <div className={`font-bold tabular-nums ${stats.realized_gain_eur >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {stats.realized_gain_eur >= 0 ? `+${formatEUR(stats.realized_gain_eur)}` : formatEUR(stats.realized_gain_eur)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-semibold">TOTAL ACHETÉ</div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold tabular-nums">{formatEUR(stats.total_bought_eur)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-semibold">TOTAL VENDU</div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold tabular-nums">{formatEUR(stats.total_sold_eur)}</div>
                    </div>
                  </div>
                </div>

                {/* Journal des opérations chronologique */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Historique des Opérations ({transactions.length})
                    </h3>
                    {onOpenAddTransaction && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenAddTransaction({
                            account_id: account?.id,
                            symbol: holding.symbol,
                            name: holding.name,
                            unit_price: holding.current_price_eur || holding.current_price
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-400 hover:bg-blue-600/20 border border-blue-500/30 text-xs font-semibold transition-all btn-haptic flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ajouter un ordre</span>
                      </button>
                    )}
                  </div>

                  {transactions.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-[#070B14]/80 border border-slate-200 dark:border-white/[0.06] rounded-xl p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-mono">
                      Aucune transaction détaillée enregistrée pour ce titre. La position est basée sur le solde d'ouverture.
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#070B14]/80 border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] bg-slate-50 dark:bg-white/[0.02]">
                              <th className="py-3 px-3.5">Date</th>
                              <th className="py-3 px-3.5">Type</th>
                              <th className="py-3 px-3.5 text-right">Quantité</th>
                              <th className="py-3 px-3.5 text-right">Prix unit.</th>
                              <th className="py-3 px-3.5 text-right">Montant EUR</th>
                              <th className="py-3 px-3.5 text-right">PV Réalisée</th>
                              <th className="py-3 px-3.5">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.04]">
                            {transactions.map((tx) => {
                              const badge = getTypeBadge(tx.type);
                              return (
                                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.025] transition-colors">
                                  <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                                    {tx.transaction_date}
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}>
                                      {badge.label}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                    {tx.quantity !== null && tx.quantity !== undefined ? tx.quantity : '—'}
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                    {tx.unit_price_eur ? formatEUR(tx.unit_price_eur) : tx.unit_price ? `${tx.unit_price} ${tx.currency}` : '—'}
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                                    {formatEUR(tx.amount_eur || tx.amount)}
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-mono">
                                    {tx.realized_gain_eur !== null && tx.realized_gain_eur !== undefined ? (
                                      <span className={tx.realized_gain_eur >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold tabular-nums' : 'text-rose-600 dark:text-rose-400 font-bold tabular-nums'}>
                                        {tx.realized_gain_eur >= 0 ? `+${formatEUR(tx.realized_gain_eur)}` : formatEUR(tx.realized_gain_eur)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate text-[11px]">
                                    {tx.notes || '—'}
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
              </>
            )}
          </div>

          {/* Pied de page */}
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-[#080D18]/80 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all btn-haptic"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
