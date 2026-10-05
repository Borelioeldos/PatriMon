import React from 'react';
import { 
  TrendingUp, TrendingDown, PiggyBank, Landmark, 
  ArrowUpRight, ArrowDownRight, Wallet, Coins
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
      <div className="bg-[#0D131F] border border-[#1E293B] hover:border-slate-600/60 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-2.5">
            <span className="text-xs font-medium text-slate-300">
              Patrimoine net total
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Landmark className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="text-2xl sm:text-[26px] font-bold text-white tracking-tight tabular-nums">
            {formatEURPrecise(netWorth)}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1C2638] flex items-center justify-between text-xs">
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-semibold text-[11px] tabular-nums ${
            isPositive 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 stroke-[2.5]" /> : <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />}
            <span>{isPositive ? `+${formatEUR(gain)}` : formatEUR(gain)}</span>
            <span className="opacity-80">({isPositive ? `+${gainPct.toFixed(2)}%` : `${gainPct.toFixed(2)}%`})</span>
          </span>
          <span className="text-slate-400 text-[11px] truncate">
            sur {formatEUR(invested)}
          </span>
        </div>
      </div>

      {/* ── 2. Portefeuille d'Investissement ── */}
      <div className="bg-[#0D131F] border border-[#1E293B] hover:border-slate-600/60 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-2.5">
            <span className="text-xs font-medium text-slate-300">
              Investissements (Bourse & PEE)
            </span>
            <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="text-2xl sm:text-[26px] font-bold text-white tracking-tight tabular-nums">
            {formatEUR(invNetWorth)}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1C2638] flex items-center justify-between text-xs">
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-semibold text-[11px] tabular-nums ${
            isInvPositive 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {isInvPositive ? `+${formatEUR(invGain)}` : formatEUR(invGain)}
            <span className="opacity-80">({isInvPositive ? `+${invGainPct.toFixed(1)}%` : `${invGainPct.toFixed(1)}%`})</span>
          </span>
          <span className="text-slate-400 text-[11px]">
            {mwr !== undefined ? `TRI : ${formatPercent(mwr)}` : 'Risque'}
          </span>
        </div>
      </div>

      {/* ── 3. Trésorerie & Épargne ── */}
      <div className="bg-[#0D131F] border border-[#1E293B] hover:border-slate-600/60 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-2.5">
            <span className="text-xs font-medium text-slate-300">
              Trésorerie & Épargne
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="text-2xl sm:text-[26px] font-bold text-white tracking-tight tabular-nums">
            {formatEUR(totalCash)}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1C2638] flex items-center justify-between text-xs">
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
            {cashRatio}% du patrimoine
          </span>
          <span className="text-slate-400 text-[11px]">
            Capital garanti
          </span>
        </div>
      </div>

      {/* ── 4. Dividendes & Revenus Passifs ── */}
      <div 
        onClick={() => onOpenDividendsModal && onOpenDividendsModal()}
        className={`bg-[#0D131F] border border-[#1E293B] hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm flex flex-col justify-between ${
          onOpenDividendsModal ? 'cursor-pointer group' : ''
        }`}
        title="Cliquer pour voir le détail des dividendes et détachements"
      >
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-2.5">
            <span className="text-xs font-medium text-slate-300 group-hover:text-emerald-400 transition-colors">
              Dividendes perçus
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="text-2xl sm:text-[26px] font-bold text-emerald-400 tracking-tight tabular-nums">
            +{formatEUR(dividends)}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1C2638] flex items-center justify-between text-xs">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
            {metrics?.dividend_analytics?.operations_count || 0} détachements
          </span>
          <span className="text-blue-400 group-hover:underline text-[11px] font-medium flex items-center gap-0.5">
            Détails →
          </span>
        </div>
      </div>
    </div>
  );
}
