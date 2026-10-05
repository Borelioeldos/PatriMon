import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  BarChart, Bar, LineChart, Line, Legend
} from 'recharts';
import { 
  TrendingUp, Layers, PieChart as PieIcon, BarChart3, 
  Activity, Clock, Compass
} from 'lucide-react';
import { api } from '../services/api';
import { formatEUR, formatEURPrecise } from '../utils/format';

const COLORS = [
  '#2563EB', // Cobalt Bourso
  '#0284C7', // Cyan Revolut
  '#059669', // Sage Emerald BNP
  '#D97706', // Warm Amber PEE
  '#7C3AED', // Royal Indigo
  '#DB2777', // Magenta / Rose
];

export default function AllocationsCharts({ summary, theme = 'dark' }) {
  const [chartMode, setChartMode] = useState('evolution');

  // État du comparateur Benchmark
  const [selectedBenchmark, setSelectedBenchmark] = useState('CW8.PA');
  const [benchmarkPeriod, setBenchmarkPeriod] = useState('1mo');
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [isBenchmarkLoading, setIsBenchmarkLoading] = useState(false);

  const allocationInst = summary?.allocation_institution || [];
  const allocationAsset = summary?.allocation_asset_class || [];
  const history = summary?.history || [];
  const perfAssets = summary?.performance_by_asset || [];
  const totalVal = summary?.total_net_worth || 1;

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1C2536' : '#E2E8F0';
  const axisColor = isDark ? '#64748B' : '#94A3B8';

  // Chargement des données benchmark
  useEffect(() => {
    if (chartMode !== 'benchmark') return;

    let isMounted = true;
    const fetchBenchmark = async () => {
      try {
        setIsBenchmarkLoading(true);
        const data = await api.getBenchmarkComparison(selectedBenchmark, benchmarkPeriod);
        if (isMounted) setBenchmarkData(data);
      } catch (err) {
        console.error("Erreur chargement benchmark :", err);
      } finally {
        if (isMounted) setIsBenchmarkLoading(false);
      }
    };

    fetchBenchmark();
    return () => { isMounted = false; };
  }, [chartMode, selectedBenchmark, benchmarkPeriod]);

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const pct = ((data.value / totalVal) * 100).toFixed(1);
      return (
        <div className="bg-white/95 dark:bg-[#121824]/95 border border-slate-200 dark:border-[#222E42] p-3 rounded-xl shadow-xl backdrop-blur-md">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{data.name}</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums font-mono">{formatEURPrecise(data.value)}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-semibold font-mono">{pct}% du portefeuille</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="double-bezel rounded-[1.75rem] p-1.5 transition-all">
      <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] p-5 sm:p-6 space-y-5">
        {/* Barre d'outils / Sélecteur de graphiques */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.06] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Activity className="w-4 h-4 stroke-[2]" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Analyses Financières & Allocations
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Historique patrimonial, benchmarks indiciels et dispersion des avoirs
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#060A14]/70 p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.05] overflow-x-auto no-scrollbar shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => setChartMode('evolution')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'evolution'
                  ? 'bg-white dark:bg-gradient-to-b dark:from-[#1E293B] dark:to-[#121826] text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/[0.12] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.03]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Historique</span>
            </button>

            <button
              onClick={() => setChartMode('benchmark')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'benchmark'
                  ? 'bg-white dark:bg-gradient-to-b dark:from-[#1E293B] dark:to-[#121826] text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/[0.12] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.03]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>vs Benchmarks</span>
            </button>

            <button
              onClick={() => setChartMode('institution')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'institution'
                  ? 'bg-white dark:bg-gradient-to-b dark:from-[#1E293B] dark:to-[#121826] text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/[0.12] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.03]'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Établissements</span>
            </button>

            <button
              onClick={() => setChartMode('assets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'assets'
                  ? 'bg-white dark:bg-gradient-to-b dark:from-[#1E293B] dark:to-[#121826] text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/[0.12] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.03]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Classes d'actifs</span>
            </button>

            {perfAssets.length > 0 && (
              <button
                onClick={() => setChartMode('performance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                  chartMode === 'performance'
                    ? 'bg-white dark:bg-gradient-to-b dark:from-[#1E293B] dark:to-[#121826] text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/[0.12] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.03]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Palmarès</span>
              </button>
            )}
          </div>
        </div>

        {/* ================= 1. COURBE D'EVOLUTION TEMPORELLE ================= */}
        {chartMode === 'evolution' && (
          <div className="space-y-3">
            {history.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <Clock className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Historique en constitution</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  La trajectoire patrimoniale est enregistrée à chaque point de snapshot quotidien.
                </p>
                {history.length === 1 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-semibold">
                    Valeur au {history[0].date} : {formatEURPrecise(history[0].total_net_worth)}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono text-[11px] font-medium">{history.length} instantanés enregistrés</span>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 bg-blue-600 dark:bg-blue-500 rounded-sm"></span>
                      <span className="text-slate-700 dark:text-slate-300">Valeur nette</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-500 rounded-sm"></span>
                      <span className="text-slate-700 dark:text-slate-300">Capital investi</span>
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorWorth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="date" stroke={axisColor} fontSize={11} tickLine={false} />
                      <YAxis 
                        stroke={axisColor} 
                        fontSize={11} 
                        tickLine={false} 
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} 
                        domain={['dataMin - 1000', 'dataMax + 1000']}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const gain = data.total_gain || 0;
                            const isPos = gain >= 0;
                            return (
                              <div className="bg-white/95 dark:bg-[#121824]/95 border border-slate-200 dark:border-[#222E42] p-3 rounded-xl shadow-xl backdrop-blur-md">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{data.full_date || data.date}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums font-mono">
                                  {formatEURPrecise(data.total_net_worth)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  Investi : <span className="text-slate-700 dark:text-slate-200 tabular-nums font-mono">{formatEUR(data.total_invested)}</span>
                                </p>
                                <p className={`text-xs font-bold mt-1 tabular-nums font-mono ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {isPos ? `+${formatEURPrecise(gain)}` : formatEURPrecise(gain)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="total_net_worth" 
                        stroke="#2563EB" 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#colorWorth)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="total_invested" 
                        stroke="#94A3B8" 
                        strokeWidth={1.5} 
                        strokeDasharray="4 4"
                        fillOpacity={0} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= 2. COMPARATEUR BENCHMARK ================= */}
        {chartMode === 'benchmark' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-subtle p-3 rounded-xl">
              {/* Choix de l'indice */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Indice :</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { symbol: 'CW8.PA', label: 'MSCI World (CW8)' },
                    { symbol: '^GSPC', label: 'S&P 500' },
                    { symbol: '^FCHI', label: 'CAC 40' },
                  ].map((b) => (
                    <button
                      key={b.symbol}
                      onClick={() => setSelectedBenchmark(b.symbol)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all btn-haptic ${
                        selectedBenchmark === b.symbol
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#121824] border border-slate-200 dark:border-[#1C2536]'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Choix de la période */}
              <div className="flex items-center gap-1">
                {[
                  { id: '1mo', label: '1M' },
                  { id: '3mo', label: '3M' },
                  { id: '6mo', label: '6M' },
                  { id: '1y', label: '1A' },
                  { id: 'max', label: 'Tout' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setBenchmarkPeriod(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors font-mono font-medium ${
                      benchmarkPeriod === p.id
                        ? 'bg-slate-900 dark:bg-[#1C263A] text-white dark:border dark:border-[#2D3D58] font-bold shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {isBenchmarkLoading ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                Chargement des cours de l'indice...
              </div>
            ) : benchmarkData?.data?.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={benchmarkData.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="date" stroke={axisColor} fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke={axisColor} 
                      fontSize={11} 
                      tickLine={false} 
                      tickFormatter={(v) => `${v}%`} 
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white/95 dark:bg-[#121824]/95 border border-slate-200 dark:border-[#222E42] p-3 rounded-xl shadow-xl backdrop-blur-md text-xs space-y-1">
                              <p className="text-slate-500 dark:text-slate-400 font-mono">{d.date}</p>
                              <p className="font-bold text-blue-600 dark:text-blue-400 tabular-nums font-mono">
                                Portefeuille : {d.portfolio_return >= 0 ? `+${d.portfolio_return}%` : `${d.portfolio_return}%`}
                              </p>
                              <p className="font-bold text-amber-600 dark:text-amber-400 tabular-nums font-mono">
                                {benchmarkData.benchmark_name} : {d.benchmark_return >= 0 ? `+${d.benchmark_return}%` : `${d.benchmark_return}%`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="portfolio_return" 
                      name="Mon Portefeuille" 
                      stroke="#2563EB" 
                      strokeWidth={2.5} 
                      dot={false} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="benchmark_return" 
                      name={benchmarkData.benchmark_name || 'Benchmark'} 
                      stroke="#F59E0B" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-14 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                Historique insuffisant pour comparer la performance sur cette période.
              </div>
            )}
          </div>
        )}

        {/* ================= 3. ALLOCATION PAR ETABLISSEMENT ================= */}
        {chartMode === 'institution' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-60 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationInst}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {allocationInst.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {allocationInst.map((item, idx) => {
                const pct = ((item.value / totalVal) * 100).toFixed(1);
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl surface-subtle">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-md flex-shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">{item.name}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{pct}% de l'actif</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 dark:text-white tabular-nums font-mono">{formatEUR(item.value)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 4. ALLOCATION PAR CLASSE D'ACTIFS ================= */}
        {chartMode === 'assets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-60 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationAsset}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {allocationAsset.map((entry, index) => (
                      <Cell key={`cell-asset-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {allocationAsset.map((item, idx) => {
                const pct = ((item.value / totalVal) * 100).toFixed(1);
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl surface-subtle">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-md flex-shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">{item.name}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{pct}% de l'actif</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 dark:text-white tabular-nums font-mono">{formatEUR(item.value)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 5. PALMARES DES PERFORMANCES ================= */}
        {chartMode === 'performance' && perfAssets.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Rendement et plus-values latentes par titre individuel
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfAssets} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" stroke={axisColor} fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="symbol" type="category" stroke={axisColor} fontSize={11} width={80} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        const isPos = d.gain_percent >= 0;
                        return (
                          <div className="bg-white/95 dark:bg-[#121824]/95 border border-slate-200 dark:border-[#222E42] p-3 rounded-xl shadow-xl backdrop-blur-md text-xs space-y-1">
                            <p className="font-bold text-slate-900 dark:text-white">{d.name}</p>
                            <p className="text-slate-500 dark:text-slate-400 font-mono">{d.symbol}</p>
                            <p className={`font-bold tabular-nums font-mono ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isPos ? `+${d.gain_percent}%` : `${d.gain_percent}%`} ({isPos ? `+${formatEURPrecise(d.gain_eur)}` : formatEURPrecise(d.gain_eur)})
                            </p>
                            <p className="text-slate-600 dark:text-slate-300 font-mono">Valorisation : {formatEURPrecise(d.total_value_eur)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="gain_percent">
                    {perfAssets.map((entry, index) => (
                      <Cell 
                        key={`bar-${index}`} 
                        fill={entry.gain_percent >= 0 ? '#10B981' : '#F43F5E'} 
                        radius={[0, 4, 4, 0]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
