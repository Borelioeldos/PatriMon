import React from 'react';
import { 
  TrendingUp, TrendingDown, PiggyBank, Landmark, 
  ArrowUpRight, ArrowDownRight, Wallet, Coins, ChevronRight
} from 'lucide-react';
import { formatEUR, formatEURPrecise, formatPercent } from '../utils/format';

export default function KPICards({ summary, onOpenDividendsModal }) {
  const netWorth = summary?.total_net_worth || 0;
  const invested = summary?.total_invested || 0;
  const gain = summary?.total_gain || 0;
  const gainPct = summary?.total_gain_percent || 0;
  const totalCash = summary?.total_cash_and_savings ?? summary?.total_cash ?? 0;
  
  // Périmètre investissement pur
  const invNetWorth = summary?.investment_net_worth ?? Math.max(netWorth - totalCash, 0);
  const invInvested = summary?.investment_invested ?? Math.max(invested - totalCash, 0);
  const invGain = summary?.investment_gain ?? (invNetWorth - invInvested);
  const invGainPct = summary?.investment_gain_percent ?? (invInvested > 0 ? (invGain / invInvested) * 100 : 0);

  const metrics = summary?.performance_metrics || {};
  const twr = metrics?.twr?.twr_percent;
  const mwr = metrics?.mwr?.mwr_percent;
  const dividends = metrics?.stats?.total_dividends_eur || metrics?.dividend_analytics?.total_eur || 0;

  const isPositive = gain >= 0;
  const isInvPositive = invGain >= 0;
  const cashRatio = netWorth > 0 ? ((totalCash / netWorth) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {/* ── 1. Patrimoine Total Net ── */}
      <div className="double-bezel rounded-[1.75rem] p-1.5 transition-all duration-300">
        <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] p-4 sm:p-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                Patrimoine net global
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Landmark className="w-4 h-4 stroke-[2]" />
              </div>
            </div>

            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums font-mono">
              {formatEURPrecise(netWorth)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-[11px] tabular-nums ${
              isPositive 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25' 
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25'
            }`}>
              {isPositive ? <ArrowUpRight className="w-3 h-3 stroke-[2.5]" /> : <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />}
              <span>{isPositive ? `+${formatEUR(gain)}` : formatEUR(gain)}</span>
              <span className="opacity-75">({isPositive ? `+${gainPct.toFixed(2)}%` : `${gainPct.toFixed(2)}%`})</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-mono truncate">
              sur {formatEUR(invested)}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Portefeuille d'Investissement ── */}
      <div className="double-bezel rounded-[1.75rem] p-1.5 transition-all duration-300">
        <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] p-4 sm:p-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                Actifs Financiers & PEE
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-4 h-4 stroke-[2]" />
              </div>
            </div>

            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums font-mono">
              {formatEUR(invNetWorth)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-[11px] tabular-nums ${
              isInvPositive 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25' 
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25'
            }`}>
              {isInvPositive ? `+${formatEUR(invGain)}` : formatEUR(invGain)}
              <span className="opacity-75">({isInvPositive ? `+${invGainPct.toFixed(1)}%` : `${invGainPct.toFixed(1)}%`})</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
              {mwr !== undefined ? `TRI : ${formatPercent(mwr)}` : 'Exposition'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Trésorerie & Épargne ── */}
      <div className="double-bezel rounded-[1.75rem] p-1.5 transition-all duration-300">
        <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] p-4 sm:p-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                Trésorerie & Épargne
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <PiggyBank className="w-4 h-4 stroke-[2]" />
              </div>
            </div>

            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums font-mono">
              {formatEUR(totalCash)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 text-[11px] font-semibold tabular-nums font-mono">
              {cashRatio}% du total
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
              Capital garanti
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Dividendes & Revenus Passifs ── */}
      <div 
        onClick={() => onOpenDividendsModal && onOpenDividendsModal()}
        className={`double-bezel rounded-[1.75rem] p-1.5 transition-all duration-300 ${
          onOpenDividendsModal ? 'cursor-pointer group' : ''
        }`}
        title="Cliquer pour voir le détail des dividendes et détachements"
      >
        <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] p-4 sm:p-5 flex flex-col justify-between h-full group-hover:border-emerald-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Dividendes perçus
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Coins className="w-4 h-4 stroke-[2]" />
              </div>
            </div>

            <div className="text-2xl sm:text-[26px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums font-mono">
              +{formatEUR(dividends)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold tabular-nums font-mono">
              {metrics?.dividend_analytics?.operations_count || 0} versements
            </span>
            <span className="text-blue-600 dark:text-blue-400 group-hover:underline text-[11px] font-semibold flex items-center gap-0.5">
              <span>Détails</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
