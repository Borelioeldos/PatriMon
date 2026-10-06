import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Target, TrendingUp, Compass, Calculator, Flame, Sparkles, 
  ArrowRight, Check, AlertTriangle, ShieldCheck, RefreshCw,
  Coins, PiggyBank, BarChart3, ChevronRight, Sliders, Info,
  CheckCircle2, ArrowUpRight, Scale
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  Legend, CartesianGrid, AreaChart, Area, ReferenceLine, Cell
} from 'recharts';
import { api } from '../services/api';

const ASSET_COLORS = {
  'Actions & ETF': '#3B82F6',               // Bleu vif
  'Livrets & Épargne': '#10B981',            // Émeraude
  'Épargne Entreprise (PEE)': '#8B5CF6',     // Violet
  'Retraite (PERO)': '#EC4899',             // Rose
  'Crypto': '#F59E0B',                      // Ambre
  'Fonds & OPCVM': '#06B6D4',               // Cyan
  'Immobilier & Autre': '#64748B',          // Ardoise
};

export default function StrategyView({ summary, theme = 'dark' }) {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('rebalance'); // 'rebalance' | 'fire'

  // ────────────────── Données d'allocation & rééquilibrage ──────────────────
  const [allocationData, setAllocationData] = useState(null);
  const [isLoadingAlloc, setIsLoadingAlloc] = useState(true);
  const [allocError, setAllocError] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [customAllocations, setCustomAllocations] = useState({});
  const [isSavingTargets, setIsSavingTargets] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // ────────────────── Simulateur de versement (DCA) ──────────────────
  const [contributionAmount, setContributionAmount] = useState(500);
  const [dcaSimulation, setDcaSimulation] = useState(null);
  const [isSimulatingDca, setIsSimulatingDca] = useState(false);

  // ────────────────── Simulateur d'intérêts composés & FIRE ──────────────────
  const [initialCapital, setInitialCapital] = useState(summary?.total_net_worth || 10000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [annualReturn, setAnnualReturn] = useState(7.5);
  const [durationYears, setDurationYears] = useState(20);
  const [inflationRate, setInflationRate] = useState(2.0);
  const [swrPct, setSwrPct] = useState(4.0);
  const [desiredExpense, setDesiredExpense] = useState(2500);
  
  const [projectionsData, setProjectionsData] = useState(null);
  const [isLoadingProj, setIsLoadingProj] = useState(false);

  // Mettre à jour le capital initial quand le résumé change
  useEffect(() => {
    if (summary?.total_net_worth && initialCapital === 10000) {
      setInitialCapital(summary.total_net_worth);
    }
  }, [summary?.total_net_worth]);

  // Charger l'allocation actuelle et les presets
  const fetchAllocation = useCallback(async () => {
    try {
      setIsLoadingAlloc(true);
      setAllocError(null);
      const data = await api.getStrategyAllocation();
      setAllocationData(data);
      setSelectedPreset(data.active_preset || 'balanced');
      setCustomAllocations(data.target_allocations || {});
    } catch (err) {
      console.error(err);
      setAllocError("Impossible de charger l'analyse d'allocation.");
    } finally {
      setIsLoadingAlloc(false);
    }
  }, []);

  useEffect(() => {
    fetchAllocation();
  }, [fetchAllocation]);

  // Simuler le versement DCA dès que le montant ou les cibles changent
  const runDcaSimulation = useCallback(async (amount, targets = null) => {
    try {
      setIsSimulatingDca(true);
      const res = await api.simulateRebalance(amount, targets);
      setDcaSimulation(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulatingDca(false);
    }
  }, []);

  useEffect(() => {
    if (allocationData) {
      runDcaSimulation(contributionAmount, customAllocations);
    }
  }, [contributionAmount, allocationData, runDcaSimulation]);

  // Calculer les projections FIRE en direct
  const runProjections = useCallback(async () => {
    try {
      setIsLoadingProj(true);
      const res = await api.calculateProjections({
        initial_capital: Number(initialCapital),
        monthly_contribution: Number(monthlyContribution),
        annual_return_pct: Number(annualReturn),
        years: Number(durationYears),
        inflation_rate_pct: Number(inflationRate),
        swr_pct: Number(swrPct),
        desired_monthly_expense: Number(desiredExpense),
      });
      setProjectionsData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProj(false);
    }
  }, [initialCapital, monthlyContribution, annualReturn, durationYears, inflationRate, swrPct, desiredExpense]);

  useEffect(() => {
    runProjections();
  }, [runProjections]);

  // Appliquer un preset
  const handleSelectPreset = (presetKey) => {
    setSelectedPreset(presetKey);
    if (allocationData?.presets?.[presetKey]) {
      const presetAlloc = allocationData.presets[presetKey].allocations;
      setCustomAllocations({ ...presetAlloc });
    }
  };

  // Modifier un pourcentage d'allocation manuellement
  const handleTargetChange = (assetClass, val) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    setCustomAllocations(prev => ({
      ...prev,
      [assetClass]: num,
    }));
    setSelectedPreset('custom');
  };

  // Somme totale des allocations cibles saisies
  const totalTargetPercent = useMemo(() => {
    return Object.values(customAllocations).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, [customAllocations]);

  const isValid100 = Math.abs(totalTargetPercent - 100) < 0.1;

  // Sauvegarder l'allocation cible
  const handleSaveAllocations = async () => {
    if (!isValid100) {
      alert(`La somme des cibles doit être égale à 100% (actuellement ${totalTargetPercent.toFixed(1)}%).`);
      return;
    }
    try {
      setIsSavingTargets(true);
      await api.updateStrategyAllocation(customAllocations, selectedPreset);
      setSaveSuccessMsg("Allocations cibles enregistrées !");
      setTimeout(() => setSaveSuccessMsg(''), 3000);
      fetchAllocation();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSavingTargets(false);
    }
  };

  // Données pour le graphique de comparaison Réel vs Cible
  const comparisonChartData = useMemo(() => {
    if (!allocationData?.analysis) return [];
    return allocationData.analysis.map(item => ({
      name: item.asset_class,
      "Réel (%)": item.current_percent,
      "Cible (%)": customAllocations[item.asset_class] ?? item.target_percent,
      delta: item.delta_percent,
      color: ASSET_COLORS[item.asset_class] || '#94A3B8',
    }));
  }, [allocationData, customAllocations]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── Sub-header avec sélecteur de sous-perspective ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 fintech-card p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Pilotage Stratégique & Décisions</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Phase 4
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Copilote d'allocation d'actifs, arbitrage DCA sans vente et trajectoire FIRE long terme
            </p>
          </div>
        </div>

        {/* Onglets de bascule */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#060A14] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.06] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('rebalance')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'rebalance'
                ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/[0.1]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-blue-500" />
            <span>Allocation Cible & Rééquilibrage</span>
          </button>
          <button
            onClick={() => setActiveTab('fire')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'fire'
                ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/[0.1]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Intérêts Composés & FIRE</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. ONGLET : ALLOCATION CIBLE & RÉÉQUILIBRAGE DCA                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rebalance' && (
        <div className="space-y-6">
          {/* Card 1 : Sélecteur de Presets & Cibles */}
          <div className="fintech-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span>Matrice d'Allocation Cible</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choisissez un profil type éprouvé ou définissez vos propres pondérations
                </p>
              </div>

              {/* Presets buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {allocationData?.presets && Object.entries(allocationData.presets).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => handleSelectPreset(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 btn-haptic ${
                      selectedPreset === key
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-slate-100 dark:bg-[#161F30] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1D2A42] border border-slate-200 dark:border-white/[0.06]'
                    }`}
                  >
                    {p.name.split(' (')[0]}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedPreset('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 btn-haptic ${
                    selectedPreset === 'custom'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-[#161F30] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1D2A42] border border-slate-200 dark:border-white/[0.06]'
                  }`}
                >
                  Sur-mesure
                </button>
              </div>
            </div>

            {/* Description du profil actif */}
            {allocationData?.presets?.[selectedPreset] && (
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <span className="font-semibold">{allocationData.presets[selectedPreset].name} : </span>
                  {allocationData.presets[selectedPreset].description}
                </div>
              </div>
            )}

            {/* Inputs de réglage des cibles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {Object.entries(customAllocations).map(([acName, targetVal]) => (
                <div key={acName} className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#070B14]/60 border border-slate-200/70 dark:border-white/[0.06] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate" title={acName}>
                      {acName}
                    </span>
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ASSET_COLORS[acName] || '#94A3B8' }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={targetVal}
                      onChange={(e) => handleTargetChange(acName, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#121927] border border-slate-200 dark:border-white/[0.1] text-right font-mono font-semibold text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-400 font-mono">%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer validation et sauvegarde */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Total des cibles :</span>
                <span className={`font-mono font-bold text-sm ${isValid100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {totalTargetPercent.toFixed(1)}%
                </span>
                {!isValid100 && (
                  <span className="text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Doit être égal à 100%
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {saveSuccessMsg && (
                  <span className="text-xs text-emerald-500 flex items-center gap-1 font-medium animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {saveSuccessMsg}
                  </span>
                )}
                <button
                  onClick={handleSaveAllocations}
                  disabled={!isValid100 || isSavingTargets}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all btn-haptic ${
                    isValid100 && !isSavingTargets
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-200 dark:bg-white/[0.05] text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSavingTargets ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Enregistrer ces cibles</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2 : Visualisation Comparaison & Matrice des Écarts (Deltas) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Graphique de comparaison Réel vs Cible */}
            <div className="lg:col-span-6 fintech-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <span>Réel vs Cible (% du Patrimoine)</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Total : {summary?.total_net_worth ? `${summary.total_net_worth.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €` : '—'}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10 }}
                      interval={0}
                      tickFormatter={(val) => val.split(' ')[0]}
                    />
                    <YAxis 
                      tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip 
                      formatter={(val, name) => [`${val}%`, name]}
                      contentStyle={{
                        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Réel (%)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Cible (%)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tableau des écarts (Deltas & Statuts) */}
            <div className="lg:col-span-6 fintech-card p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-500" />
                  <span>Matrice des Déviations</span>
                </h3>
                <span className="text-[11px] text-slate-400">Classé par priorité d'achat</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/[0.06] text-slate-400 font-medium">
                      <th className="pb-2">Classe d'actif</th>
                      <th className="pb-2 text-right">Réel (€)</th>
                      <th className="pb-2 text-right">Réel / Cible</th>
                      <th className="pb-2 text-right">Écart (Delta)</th>
                      <th className="pb-2 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] font-mono">
                    {allocationData?.analysis?.map((item) => {
                      const isUnder = item.status === 'UNDERWEIGHT';
                      const isOver = item.status === 'OVERWEIGHT';
                      return (
                        <tr key={item.asset_class} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 font-sans font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: ASSET_COLORS[item.asset_class] || '#94A3B8' }}
                            />
                            <span className="truncate max-w-[120px]" title={item.asset_class}>
                              {item.asset_class}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                            {item.current_value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                          </td>
                          <td className="py-2.5 text-right text-slate-500">
                            <span className="text-slate-900 dark:text-white font-semibold">{item.current_percent}%</span>
                            <span className="text-slate-400"> / {item.target_percent}%</span>
                          </td>
                          <td className={`py-2.5 text-right font-semibold ${
                            isUnder ? 'text-blue-500' : isOver ? 'text-amber-500' : 'text-emerald-500'
                          }`}>
                            {item.delta_percent > 0 ? `+${item.delta_percent}%` : `${item.delta_percent}%`}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {item.delta_value > 0 ? `+${item.delta_value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €` : `${item.delta_value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
                            </div>
                          </td>
                          <td className="py-2.5 text-center font-sans">
                            {isUnder && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                À renforcer
                              </span>
                            )}
                            {isOver && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Surpondéré
                              </span>
                            )}
                            {!isUnder && !isOver && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Conforme
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Card 3 : Calculateur de Versement DCA Intelligent ("Où investir mes 500 € ce mois-ci ?") */}
          <div className="fintech-card p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-500" />
                  <span>Calculateur d'Apport Mensuel (DCA Intelligent)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Algorithme d'optimisation sans vente : ventile votre apport sur les sous-pondérations pour réaligner le portefeuille
                </p>
              </div>

              {/* Raccourcis de montants */}
              <div className="flex items-center gap-1.5">
                {[200, 300, 500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setContributionAmount(amt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all btn-haptic ${
                      contributionAmount === amt
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-[#161F30] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.06] hover:bg-slate-100'
                    }`}
                  >
                    +{amt} €
                  </button>
                ))}
              </div>
            </div>

            {/* Saisie personnalisée */}
            <div className="flex items-center gap-3 max-w-sm">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Montant à injecter :
              </label>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121927] border border-slate-300 dark:border-white/[0.12] text-slate-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">€</span>
              </div>
            </div>

            {/* Recommandations concrètes d'arbitrage */}
            {dcaSimulation && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Recommandation d'allocation pour vos {contributionAmount.toLocaleString('fr-FR')} € :
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {dcaSimulation.plan.map((item) => {
                    const hasAllocation = item.allocated_amount > 0;
                    return (
                      <div
                        key={item.asset_class}
                        className={`p-4 rounded-xl border transition-all ${
                          hasAllocation
                            ? 'bg-white dark:bg-[#131D30] border-blue-500/40 shadow-sm shadow-blue-500/5'
                            : 'bg-slate-50/60 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/[0.04] opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.asset_class}>
                            {item.asset_class}
                          </span>
                          <span 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: ASSET_COLORS[item.asset_class] || '#94A3B8' }}
                          />
                        </div>

                        <div className="font-mono text-base font-bold text-slate-900 dark:text-white mb-1">
                          {hasAllocation ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              +{item.allocated_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">0,00 € (déjà pondéré)</span>
                          )}
                        </div>

                        {hasAllocation && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight mb-2">
                            {item.suggested_action}
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-500">
                          <span>Écart : {item.delta_before > 0 ? `+${item.delta_before}%` : `${item.delta_before}%`}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-emerald-500 font-semibold">
                            {item.delta_after > 0 ? `+${item.delta_after}%` : `${item.delta_after}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. ONGLET : INTÉRÊTS COMPOSÉS & PROJECTIONS FIRE                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fire' && (
        <div className="space-y-6">
          {/* Card 1 : 4 KPI Luxury FIRE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 : Capital Projeté */}
            <div className="fintech-card p-4 sm:p-5 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Patrimoine Projeté ({durationYears} ans)
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {projectionsData?.summary?.final_nominal_portfolio
                  ? `${projectionsData.summary.final_nominal_portfolio.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Pouvoir d'achat réel : {projectionsData?.summary?.final_real_portfolio?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </div>
            </div>

            {/* KPI 2 : Part des Intérêts */}
            <div className="fintech-card p-4 sm:p-5 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Intérêts Composés Générés
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {projectionsData?.summary?.total_interest_earned
                  ? `+${projectionsData.summary.total_interest_earned.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {projectionsData?.summary?.interest_ratio_percent}% du patrimoine créé par le rendement !
              </div>
            </div>

            {/* KPI 3 : Rente Mensuelle Passive */}
            <div className="fintech-card p-4 sm:p-5 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Rente Mensuelle Estimée (4% SWR)
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {projectionsData?.summary?.final_monthly_passive_income
                  ? `${projectionsData.summary.final_monthly_passive_income.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € / mois`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Réel net d'inflation : {projectionsData?.summary?.final_real_monthly_passive_income?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €/m
              </div>
            </div>

            {/* KPI 4 : Cible FIRE */}
            <div className="fintech-card p-4 sm:p-5 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Objectif FIRE ({desiredExpense} €/m)</span>
                <Flame className="w-3.5 h-3.5 text-amber-500" />
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-500">
                {projectionsData?.fire?.target_fire_capital
                  ? `${projectionsData.fire.target_fire_capital.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Progression : <span className="font-semibold text-slate-700 dark:text-slate-300">{projectionsData?.fire?.fire_progress_percent}%</span>
                {projectionsData?.fire?.years_to_fire && ` • Atteint en an ${projectionsData.fire.years_to_fire}`}
              </div>
            </div>
          </div>

          {/* Card 2 : Contrôles & Sliders Interactifs */}
          <div className="fintech-card p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.06] pb-3">
              <Sliders className="w-4 h-4 text-blue-500" />
              <span>Paramètres de Simulation Personnalisés</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Capital Initial */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Capital Initial</label>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{Number(initialCapital).toLocaleString('fr-FR')} €</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Épargne Mensuelle */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Épargne Mensuelle</label>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{Number(monthlyContribution).toLocaleString('fr-FR')} € / mois</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="50"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Rendement Annuel */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Rendement Annuel Estimé</label>
                  <span className="font-mono font-bold text-indigo-500">{annualReturn}% / an</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={annualReturn}
                  onChange={(e) => setAnnualReturn(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span onClick={() => setAnnualReturn(3.0)} className="cursor-pointer hover:text-blue-500">Livrets 3%</span>
                  <span onClick={() => setAnnualReturn(7.5)} className="cursor-pointer hover:text-blue-500 font-semibold text-blue-500">World 7.5%</span>
                  <span onClick={() => setAnnualReturn(10.0)} className="cursor-pointer hover:text-blue-500">S&P 10%</span>
                </div>
              </div>

              {/* Horizon de placement */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Horizon d'Investissement</label>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{durationYears} ans</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="5"
                  value={durationYears}
                  onChange={(e) => setDurationYears(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>5 ans</span>
                  <span>15 ans</span>
                  <span>25 ans</span>
                  <span>35 ans</span>
                </div>
              </div>

              {/* Inflation Annuelle */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Inflation Annuelle</label>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{inflationRate}% / an</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={inflationRate}
                  onChange={(e) => setInflationRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Dépense Mensuelle FIRE */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Dépense Cible Retraite</label>
                  <span className="font-mono font-bold text-amber-500">{Number(desiredExpense).toLocaleString('fr-FR')} € / mois</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="6000"
                  step="250"
                  value={desiredExpense}
                  onChange={(e) => setDesiredExpense(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Card 3 : Graphique Empilé de Projections (AreaChart Effet Boule de Neige) */}
          <div className="fintech-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span>Trajectoire de Croissance & Effet Boule de Neige</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Décomposition : Capital Initial (Bleu) + Versements Cumulés (Indigo) + Intérêts Composés (Émeraude)
                </p>
              </div>

              {projectionsData?.summary?.crossover_year && (
                <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Crossover en Année {projectionsData.summary.crossover_year}</span>
                </div>
              )}
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={projectionsData?.projections || []}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="colorInitial" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10 }}
                    tickFormatter={(y) => `An ${y}`}
                  />
                  <YAxis 
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
                  />
                  <Tooltip 
                    formatter={(val, name) => [`${Number(val).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, name]}
                    contentStyle={{
                      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="initial_capital"
                    stackId="1"
                    stroke="#3B82F6"
                    fill="url(#colorInitial)"
                    name="Capital Initial"
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative_deposits_only"
                    stackId="1"
                    stroke="#6366F1"
                    fill="url(#colorDeposits)"
                    name="Épargne Versée"
                  />
                  <Area
                    type="monotone"
                    dataKey="total_interest"
                    stackId="1"
                    stroke="#10B981"
                    fill="url(#colorInterest)"
                    name="Intérêts Composés"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 4 : Paliers d'Indépendance FIRE (Lean, Standard, Fat FIRE) */}
          <div className="fintech-card p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Niveaux d'Indépendance Financière (FIRE Metrics)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Lean FIRE */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0A0F1D]/80 border border-slate-200 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Lean FIRE (75%)</span>
                  <span className="text-[10px] text-slate-400 font-mono">{(desiredExpense * 0.75).toFixed(0)} €/m</span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {projectionsData?.fire?.lean_fire_capital?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                </div>
                <p className="text-[11px] text-slate-500">
                  Mode frugal : couvre l'essentiel vital sans compromis de sécurité.
                </p>
              </div>

              {/* Standard FIRE */}
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-500/25 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-900 dark:text-amber-300">Standard FIRE (100%)</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">{desiredExpense} €/m</span>
                </div>
                <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                  {projectionsData?.fire?.target_fire_capital?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Maintien complet du train de vie actuel financé par le capital.
                </p>
              </div>

              {/* Fat FIRE */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0A0F1D]/80 border border-slate-200 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Fat FIRE (130%)</span>
                  <span className="text-[10px] text-slate-400 font-mono">{(desiredExpense * 1.3).toFixed(0)} €/m</span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {projectionsData?.fire?.fat_fire_capital?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                </div>
                <p className="text-[11px] text-slate-500">
                  Confort supérieur et voyages sans contrainte financière.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
