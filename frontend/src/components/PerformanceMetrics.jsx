import React, { useState } from 'react';
import { 
  Award, TrendingUp, Landmark, Coins, 
  BarChart3, PieChart, Info, ArrowUpRight
} from 'lucide-react';
import { formatEUR, formatPercent } from '../utils/format';

export default function PerformanceMetrics({ summary, onOpenDividendsModal }) {
  const metrics = summary?.performance_metrics || {};
  const twr = metrics.twr || {};
  const mwr = metrics.mwr || {};
  const stats = metrics.stats || {};
  const byAccount = metrics.by_account || [];
  const dividendAnalytics = metrics.dividend_analytics || {};

  const [showDividendsDetail, setShowDividendsDetail] = useState(false);

  const isTwrPos = (twr.twr_percent || 0) >= 0;
  const isMwrPos = (mwr.mwr_percent || 0) >= 0;
  const isRealizedPos = (stats.total_realized_gain_eur || 0) >= 0;

  const monthlySeries = dividendAnalytics.monthly_series || [];
  const assetsRanked = dividendAnalytics.assets_ranked || [];
  const byYear = dividendAnalytics.by_year || {};
  const maxMonthlyDiv = Math.max(...monthlySeries.map(m => m.amount_eur || 0), 1);

  return (
    <div className="space-y-4">
      {/* ── 1. KPIs Globaux de Performance (GIPS & TRI) ── */}
      <div className="fintech-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.06] pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Award className="w-4 h-4 stroke-[2]" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Rendement Réel & Standards GIPS
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Périmètre d'investissement (PEA, CTO, PEE, PERO, Crypto) isolant les comptes de consommation
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono bg-slate-100/80 dark:bg-white/[0.03] px-3 py-1 rounded-full border border-slate-200/80 dark:border-white/[0.08]">
              <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Calcul continu sur l'historique complet</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* TWR */}
            <div className="surface-subtle rounded-2xl p-4 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">TWR (Pondéré)</span>
                <span 
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-semibold"
                  title="Time-Weighted Return : neutralise les flux d'apports pour mesurer la performance intrinsèque de vos choix d'actifs."
                >
                  Standard GIPS
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono tracking-tight tabular-nums mt-1 ${isTwrPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatPercent(twr.twr_percent || 0)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Performance brute des actifs choisis
              </p>
            </div>

            {/* MWR / TRI */}
            <div className="surface-subtle rounded-2xl p-4 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">TRI / MWR</span>
                <span 
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 font-semibold"
                  title="Taux de Rentabilité Interne : prend en compte le montant et la date de chacun de vos versements et retraits."
                >
                  Rendement Portefeuille
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono tracking-tight tabular-nums mt-1 ${isMwrPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatPercent(mwr.mwr_percent || 0)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Rentabilité réelle pondérée des apports
              </p>
            </div>

            {/* Plus-Values Réalisées */}
            <div className="surface-subtle rounded-2xl p-4 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gains nets réalisés</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Ventes clôturées</span>
              </div>
              <div className={`text-2xl font-bold font-mono tracking-tight tabular-nums mt-1 ${isRealizedPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isRealizedPos ? `+${formatEUR(stats.total_realized_gain_eur || 0)}` : formatEUR(stats.total_realized_gain_eur || 0)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Plus-values définitivement encaissées
              </p>
            </div>

            {/* Dividendes & Intérêts */}
            <div 
              onClick={() => {
                if (onOpenDividendsModal) {
                  onOpenDividendsModal();
                } else {
                  setShowDividendsDetail(!showDividendsDetail);
                  document.getElementById('dividend-analytics')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="surface-subtle rounded-2xl p-4 hover:border-emerald-500/50 cursor-pointer transition-all group"
              title="Cliquer pour voir le détail des dividendes et détachements"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Dividendes perçus
                </span>
                <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 font-semibold">
                  {dividendAnalytics.operations_count || 0} versements
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums mt-1">
                +{formatEUR(stats.total_dividends_eur || dividendAnalytics.total_eur || 0)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                <span>Flux passifs cumulés</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline text-[11px] flex items-center gap-0.5">
                  Détails →
                </span>
              </p>
            </div>
          </div>
        </div>

      {/* ── 2. Décloisonnement des Performances par Enveloppe ── */}
      {byAccount.length > 0 && (
        <div className="fintech-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.06] pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Landmark className="w-4 h-4 stroke-[2]" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Performance Ventilée par Enveloppe Fiscale
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  TRI individuel, plus-values et flux de trésorerie isolés pour chaque compte
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.03] px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/[0.08]">
                {byAccount.length} enveloppes d'investissement
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {byAccount.map((acc) => {
                const isGainPos = (acc.gain_eur || 0) >= 0;
                const accMwr = acc.mwr?.mwr_percent;
                const hasMwr = accMwr !== null && accMwr !== undefined;
                const isMwrPositive = hasMwr && accMwr >= 0;

                return (
                  <div 
                    key={acc.account_id}
                    className="surface-subtle rounded-2xl p-4 flex flex-col justify-between transition-all group"
                  >
                    <div>
                      {/* En-tête enveloppe */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: acc.color || '#3B82F6' }}
                          ></span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={acc.name}>
                            {acc.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] flex-shrink-0 font-medium">
                          {acc.institution}
                        </span>
                      </div>

                      {/* Valorisation & Investi */}
                      <div className="space-y-0.5 mt-2.5">
                        <div className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                          {formatEUR(acc.net_worth_eur)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Investi : {formatEUR(acc.invested_eur)}
                        </div>
                      </div>

                      {/* Plus-value latente */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Plus-value :</span>
                        <span className={`font-semibold tabular-nums ${isGainPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isGainPos ? `+${formatEUR(acc.gain_eur)}` : formatEUR(acc.gain_eur)} ({isGainPos ? `+${acc.gain_percent}%` : `${acc.gain_percent}%`})
                        </span>
                      </div>

                      {/* TRI / MWR individuel */}
                      <div className="mt-1 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">TRI (MWR) :</span>
                        {hasMwr ? (
                          <span className={`font-bold tabular-nums ${isMwrPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatPercent(accMwr)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </div>
                    </div>

                    {/* Pied de carte : dividendes & positions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/[0.05] flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>
                        {acc.dividends_eur > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{formatEUR(acc.dividends_eur)} divs</span>
                        ) : (
                          "0 div"
                        )}
                      </span>
                      <span>
                        {acc.active_holdings_count} active{acc.active_holdings_count > 1 ? 's' : ''}
                        {acc.closed_holdings_count > 0 && ` • ${acc.closed_holdings_count} soldée${acc.closed_holdings_count > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
      )}

      {/* ── 3. Module Analytique Avancé des Dividendes ── */}
      {(showDividendsDetail || dividendAnalytics.operations_count > 0) && (
        <div id="dividend-analytics" className="fintech-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.06] pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Coins className="w-4 h-4 stroke-[2]" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Analytique des Dividendes & Flux Passifs
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Saisonnalité mensuelle, ventilation par exercice et part contributive par titre
                </p>
              </div>

              {/* Cumuls par Année */}
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(byYear).map(([yr, val]) => (
                  <div key={yr} className="bg-slate-100 dark:bg-white/[0.03] px-3 py-1 rounded-full border border-slate-200 dark:border-white/[0.08] font-mono text-xs">
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5">{yr} :</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{formatEUR(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Histogramme mensuel */}
              <div className="lg:col-span-2 surface-subtle rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Saisonnalité mensuelle des versements
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Total perçu : +{formatEUR(dividendAnalytics.total_eur || 0)}
                  </span>
                </div>

                {monthlySeries.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 font-mono">
                    Aucun versement de dividende enregistré.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="h-44 flex items-end gap-1.5 sm:gap-2.5 pt-4 px-1">
                      {monthlySeries.map((m) => {
                        const heightPercent = Math.max((m.amount_eur / maxMonthlyDiv) * 100, 8);
                        return (
                          <div 
                            key={m.period}
                            className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                          >
                            {/* Tooltip au survol */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-9 bg-white dark:bg-[#1A2538] border border-slate-200 dark:border-white/20 text-slate-900 dark:text-white text-[10px] font-mono py-1 px-2.5 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-xl">
                              {m.label} : +{formatEUR(m.amount_eur)} ({m.count}x)
                            </div>

                            <div 
                              className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md group-hover:from-emerald-500 group-hover:to-emerald-300 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                              style={{ height: `${heightPercent}%` }}
                            ></div>
                            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 rotate-[-45deg] origin-top-left mt-2 block sm:rotate-0 sm:origin-center">
                              {m.period.slice(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-slate-500 text-right pt-2 font-mono">
                      Montants nets perçus en euros
                    </div>
                  </div>
                )}
              </div>

              {/* Top actifs pourvoyeurs de dividendes */}
              <div className="surface-subtle rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-3">
                    <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Top contributeurs dividendes
                  </span>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {assetsRanked.map((asset, idx) => {
                      const pctOfTotal = dividendAnalytics.total_eur > 0 
                        ? Math.round((asset.total_eur / dividendAnalytics.total_eur) * 100) 
                        : 0;

                      return (
                        <div key={asset.symbol} className="text-xs font-mono space-y-1 bg-white/70 dark:bg-white/[0.02] p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.04]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-slate-400 text-[10px] font-bold">#{idx + 1}</span>
                              <span className="font-bold text-slate-900 dark:text-slate-200 truncate">{asset.symbol}</span>
                            </div>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                              +{formatEUR(asset.total_eur)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="truncate max-w-[130px]">{asset.name}</span>
                            <span>{asset.count}x • {pctOfTotal}%</span>
                          </div>

                          {/* Barre de progression */}
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full"
                              style={{ width: `${pctOfTotal}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-200/80 dark:border-white/[0.06] mt-2 font-mono">
                  {assetsRanked.length} actifs ont versé des dividendes
                </div>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
