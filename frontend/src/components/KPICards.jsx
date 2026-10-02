import React from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Landmark, ShieldCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function KPICards({ summary }) {
  const netWorth = summary?.total_net_worth || 0;
  const invested = summary?.total_invested || 0;
  const gain = summary?.total_gain || 0;
  const gainPct = summary?.total_gain_percent || 0;
  const totalCash = summary?.total_cash || 0;

  const isPositive = gain >= 0;
  const cashRatio = netWorth > 0 ? ((totalCash / netWorth) * 100).toFixed(1) : 0;

  const formatEUR = (val) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatEURPrecise = (val) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Patrimoine Total Net */}
      <div className="relative overflow-hidden bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-all pointer-events-none" />
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs uppercase font-semibold tracking-wider">Patrimoine Net Total</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Landmark className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {formatEURPrecise(netWorth)}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold ${
            isPositive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {isPositive ? `+${gainPct}%` : `${gainPct}%`}
          </span>
          <span className="text-slate-400">gain global</span>
        </div>
      </div>

      {/* 2. Plus-Value Latente */}
      <div className="relative overflow-hidden bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all group">
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-10 -mt-10 transition-all pointer-events-none ${
          isPositive ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' : 'bg-rose-500/10 group-hover:bg-rose-500/20'
        }`} />
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs uppercase font-semibold tracking-wider">Plus / Moins-Value</span>
          <div className={`p-2 rounded-xl border ${
            isPositive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        </div>
        <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? `+${formatEURPrecise(gain)}` : formatEURPrecise(gain)}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span>Sur investissement de <strong className="text-slate-200">{formatEUR(invested)}</strong></span>
        </div>
      </div>

      {/* 3. Liquidités & Livrets */}
      <div className="relative overflow-hidden bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs uppercase font-semibold tracking-wider">Liquidités & Épargne</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {formatEURPrecise(totalCash)}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
            {cashRatio}% du patrimoine
          </span>
          <span>(sécurité disponible)</span>
        </div>
      </div>

      {/* 4. Enveloppes Actives */}
      <div className="relative overflow-hidden bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs uppercase font-semibold tracking-wider">Comptes Suivis</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {summary?.accounts?.length || 0} comptes
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>BoursoBank, Revolut, BNP & PEE</span>
        </div>
      </div>
    </div>
  );
}
