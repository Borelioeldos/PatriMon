import React from 'react';
import { 
  Percent, Award, DollarSign, CheckCircle2, Info, 
  ArrowUpRight, ArrowDownRight, Layers, HelpCircle
} from 'lucide-react';
import { formatEUR } from '../utils/format';

export default function PerformanceMetrics({ summary }) {
  const metrics = summary?.performance_metrics || {};
  const twr = metrics.twr || {};
  const mwr = metrics.mwr || {};
  const stats = metrics.stats || {};

  const isTwrPos = (twr.twr_percent || 0) >= 0;
  const isMwrPos = (mwr.mwr_percent || 0) >= 0;
  const isRealizedPos = (stats.total_realized_gain_eur || 0) >= 0;

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            Métriques de Rendement Réel (TWR & TRI)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Standards financiers GIPS : mesurez la performance intrinsèque de votre portefeuille et l'impact de vos flux.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span>Calculé en continu sur l'ensemble de vos opérations</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. TWR (Time-Weighted Return) */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              TWR (Temps Réel)
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400" title="Time-Weighted Return : neutralise l'impact des versements et retraits pour isoler la rentabilité de vos investissements.">
              <Percent className="w-4 h-4" />
            </div>
          </div>

          <div className={`text-2xl font-extrabold tracking-tight ${isTwrPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isTwrPos ? `+${twr.twr_percent || 0}%` : `${twr.twr_percent || 0}%`}
          </div>

          <p className="text-[11px] text-slate-400 mt-1">
            Performance pure des actifs
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span>Standard GIPS</span>
            <span className="text-indigo-300 font-medium">Hors flux de capitaux</span>
          </div>
        </div>

        {/* 2. MWR / TRI (Taux de Rendement Interne) */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              TRI / MWR (XIRR)
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400" title="Taux de Rendement Interne (XIRR) : rendement personnalisé prenant en compte les dates exactes de vos apports.">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className={`text-2xl font-extrabold tracking-tight ${isMwrPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isMwrPos ? `+${mwr.mwr_percent || 0}%` : `${mwr.mwr_percent || 0}%`}
          </div>

          <p className="text-[11px] text-slate-400 mt-1">
            Rendement effectif de l'investisseur
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span>Pondéré par l'argent</span>
            <span className="text-blue-300 font-medium">Timing des versements</span>
          </div>
        </div>

        {/* 3. Dividendes Cumulés */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Dividendes Encaissés
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl font-extrabold text-amber-300 tracking-tight">
            {formatEUR(stats.total_dividends_eur || 0)}
          </div>

          <p className="text-[11px] text-slate-400 mt-1">
            Revenus passifs cumulés
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span>Trésorerie générée</span>
            <span className="text-amber-400 font-medium">Cash reçu</span>
          </div>
        </div>

        {/* 4. Plus-Values Réalisées */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Gains Réalisés
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className={`text-2xl font-extrabold tracking-tight ${isRealizedPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isRealizedPos ? `+${formatEUR(stats.total_realized_gain_eur || 0)}` : formatEUR(stats.total_realized_gain_eur || 0)}
          </div>

          <p className="text-[11px] text-slate-400 mt-1">
            Sur cessions & ventes de titres
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span>Frais payés : {formatEUR(stats.total_fees_eur || 0)}</span>
            <span className="text-slate-300 font-medium">Arbitrages</span>
          </div>
        </div>
      </div>
    </div>
  );
}
