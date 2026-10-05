import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  BarChart, Bar, LineChart, Line, Legend
} from 'recharts';
import { 
  TrendingUp, Layers, PieChart as PieIcon, BarChart3, 
  Activity, Clock, Compass, ArrowUpRight, ArrowDownRight, Award
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

export default function AllocationsCharts({ summary }) {
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
        <div className="bg-[#121824] border border-[#222E42] p-2.5 rounded-lg shadow-xl">
          <p className="text-xs text-slate-400 font-medium">{data.name}</p>
          <p className="text-sm font-semibold text-white mt-0.5 tabular-nums">{formatEURPrecise(data.value)}</p>
          <p className="text-xs text-blue-400 mt-0.5 font-medium">{pct}% du portefeuille</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="double-bezel rounded-[1.75rem] p-1.5">
      <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] p-5 sm:p-6 space-y-5">
        {/* Barre d'outils / Sélecteur de graphiques */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Analyses Financières & Allocations
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Historique patrimonial, benchmarks indiciels et dispersion des avoirs
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#060A14]/70 p-1 rounded-xl border border-white/[0.05] overflow-x-auto no-scrollbar shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => setChartMode('evolution')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'evolution'
                  ? 'bg-gradient-to-b from-[#1E293B] to-[#121826] text-white border border-white/[0.12] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Historique</span>
            </button>

            <button
              onClick={() => setChartMode('benchmark')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'benchmark'
                  ? 'bg-gradient-to-b from-[#1E293B] to-[#121826] text-white border border-white/[0.12] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>vs Benchmarks</span>
            </button>

            <button
              onClick={() => setChartMode('institution')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'institution'
                  ? 'bg-gradient-to-b from-[#1E293B] to-[#121826] text-white border border-white/[0.12] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Établissements</span>
            </button>

            <button
              onClick={() => setChartMode('assets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                chartMode === 'assets'
                  ? 'bg-gradient-to-b from-[#1E293B] to-[#121826] text-white border border-white/[0.12] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Classes d'actifs</span>
            </button>

            {perfAssets.length > 0 && (
              <button
                onClick={() => setChartMode('performance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap btn-haptic ${
                  chartMode === 'performance'
                    ? 'bg-gradient-to-b from-[#1E293B] to-[#121826] text-white border border-white/[0.12] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
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
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2.5">
              <div className="p-2.5 rounded-lg bg-[#0B0F17] border border-[#1C2536] text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Historique en constitution</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                La trajectoire patrimoniale est enregistrée à chaque point de snapshot quotidien.
              </p>
              {history.length === 1 && (
                <p className="text-xs text-blue-400 font-mono">
                  Valeur au {history[0].date} : {formatEURPrecise(history[0].total_net_worth)}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px]">{history.length} instantanés enregistrés</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span>
                    <span>Valeur nette</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></span>
                    <span>Capital investi</span>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1C2536" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="#64748B" 
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
                            <div className="bg-[#121824] border border-[#222E42] p-2.5 rounded-lg shadow-xl">
                              <p className="text-xs text-slate-400 font-mono">{data.full_date || data.date}</p>
                              <p className="text-sm font-semibold text-white mt-0.5 tabular-nums">
                                {formatEURPrecise(data.total_net_worth)}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Investi : <span className="text-slate-200 tabular-nums">{formatEUR(data.total_invested)}</span>
                              </p>
                              <p className={`text-xs font-medium mt-1 tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorWorth)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total_invested" 
                      stroke="#64748B" 
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B0F17] p-2.5 rounded-lg border border-[#1C2536]">
            {/* Choix de l'indice */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Indice :</span>
              <div className="flex items-center gap-1">
                {[
                  { symbol: 'CW8.PA', label: 'MSCI World (CW8)' },
                  { symbol: '^GSPC', label: 'S&P 500' },
                  { symbol: '^FCHI', label: 'CAC 40' },
                ].map((b) => (
                  <button
                    key={b.symbol}
                    onClick={() => setSelectedBenchmark(b.symbol)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      selectedBenchmark === b.symbol
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-white bg-[#121824] border border-[#1C2536]'
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
                  className={`px-2 py-0.5 rounded text-xs transition-colors font-mono ${
                    benchmarkPeriod === p.id
                      ? 'bg-[#1C263A] text-white border border-[#2D3D58] font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {isBenchmarkLoading ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              Chargement des cours de l'indice...
            </div>
          ) : benchmarkData?.data?.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={benchmarkData.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1C2536" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis 
                    stroke="#64748B" 
                    fontSize={11} 
                    tickLine={false} 
                    tickFormatter={(v) => `${v}%`} 
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#121824] border border-[#222E42] p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                            <p className="text-slate-400 font-mono">{d.date}</p>
                            <p className="font-semibold text-blue-400 tabular-nums">
                              Portefeuille : {d.portfolio_return >= 0 ? `+${d.portfolio_return}%` : `${d.portfolio_return}%`}
                            </p>
                            <p className="font-semibold text-amber-400 tabular-nums">
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
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="benchmark_return" 
                    name={benchmarkData.benchmark_name || 'Benchmark'} 
                    stroke="#F59E0B" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4"
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
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

          <div className="space-y-1.5">
            {allocationInst.map((item, idx) => {
              const pct = ((item.value / totalVal) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-[#1C2536]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">{item.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{pct}% de l'actif</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-white tabular-nums">{formatEUR(item.value)}</div>
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

          <div className="space-y-1.5">
            {allocationAsset.map((item, idx) => {
              const pct = ((item.value / totalVal) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-[#1C2536]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">{item.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{pct}% de l'actif</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-white tabular-nums">{formatEUR(item.value)}</div>
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
          <p className="text-xs text-slate-400">
            Rendement et plus-values latentes par titre individuel
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfAssets} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1C2536" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="symbol" type="category" stroke="#94A3B8" fontSize={11} width={80} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const isPos = d.gain_percent >= 0;
                      return (
                        <div className="bg-[#121824] border border-[#222E42] p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                          <p className="font-semibold text-white">{d.name}</p>
                          <p className="text-slate-400 font-mono">{d.symbol}</p>
                          <p className={`font-semibold tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPos ? `+${d.gain_percent}%` : `${d.gain_percent}%`} ({isPos ? `+${formatEURPrecise(d.gain_eur)}` : formatEURPrecise(d.gain_eur)})
                          </p>
                          <p className="text-slate-300">Valorisation : {formatEURPrecise(d.total_value_eur)}</p>
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
                      radius={[0, 3, 3, 0]}
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
