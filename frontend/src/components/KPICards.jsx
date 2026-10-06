import React from 'react';
import { 
  TrendingUp, PiggyBank, Landmark, 
  ArrowUpRight, ArrowDownRight, Coins, ChevronRight, Sparkles
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
  const mwr = metrics?.mwr?.mwr_percent;
  const dividends = metrics?.stats?.total_dividends_eur || metrics?.dividend_analytics?.total_eur || 0;

  const isPositive = gain >= 0;
  const isInvPositive = invGain >= 0;
  const cashRatio = netWorth > 0 ? ((totalCash / netWorth) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ── 1. Patrimoine Total Net ── */}
      <div className="fintech-card p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Patrimoine Net Global
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Landmark className="w-4 h-4 stroke-[2]" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums font-mono mt-3 mb-1">
            {formatEURPrecise(netWorth)}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-semibold text-[11px] tabular-nums ${
            isPositive 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>{isPositive ? `+${formatEUR(gain)}` : formatEUR(gain)}</span>
            <span className="opacity-80">({isPositive ? `+${gainPct.toFixed(2)}%` : `${gainPct.toFixed(2)}%`})</span>
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-mono truncate">
            sur {formatEUR(invested)}
          </span>
        </div>
      </div>

      {/* ── 2. Portefeuille d'Investissement ── */}
      <div className="fintech-card p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Actifs Financiers & PEE
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <TrendingUp className="w-4 h-4 stroke-[2]" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums font-mono mt-3 mb-1">
            {formatEUR(invNetWorth)}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-semibold text-[11px] tabular-nums ${
            isInvPositive 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}>
            {isInvPositive ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>{isInvPositive ? `+${formatEUR(invGain)}` : formatEUR(invGain)}</span>
            <span className="opacity-80">({isInvPositive ? `+${invGainPct.toFixed(1)}%` : `${invGainPct.toFixed(1)}%`})</span>
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
            {mwr !== undefined ? `TRI : ${formatPercent(mwr)}` : 'Investi'}
          </span>
        </div>
      </div>

      {/* ── 3. Trésorerie & Épargne ── */}
      <div className="fintech-card p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Trésorerie & Épargne
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <PiggyBank className="w-4 h-4 stroke-[2]" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums font-mono mt-3 mb-1">
            {formatEUR(totalCash)}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold tabular-nums font-mono">
            {cashRatio}% du portefeuille
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Sécurisé
          </span>
        </div>
      </div>

      {/* ── 4. Dividendes & Revenus Passifs ── */}
      <div 
        onClick={() => onOpenDividendsModal && onOpenDividendsModal()}
        className={`fintech-card p-5 flex flex-col justify-between cursor-pointer group hover:border-emerald-500/40 transition-all btn-haptic`}
        title="Consulter le journal des dividendes encaissés"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Dividendes Encaissés
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <Coins className="w-4 h-4 stroke-[2]" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums font-mono mt-3 mb-1">
            {formatEUR(dividends)}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="text-[11px] group-hover:text-emerald-500 transition-colors font-medium">
            25 détachements
          </span>
          <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
            <span>Détails</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
