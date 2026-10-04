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
  '#0066FF', // BoursoBank Bleu
  '#00D4FF', // Revolut Cyan
  '#00965E', // BNP Vert
  '#F59E0B', // PEE Ambre
  '#8B5CF6', // Violet
  '#EC4899', // Rose
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
        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="text-xs text-slate-400 font-medium">{data.name}</p>
          <p className="text-sm font-bold text-white mt-0.5">{formatEURPrecise(data.value)}</p>
          <p className="text-xs text-blue-400 mt-0.5 font-semibold">{pct}% du patrimoine</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Barre d'outils / Sélecteur de graphiques */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Analyses & Graphiques
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Évolution temporelle, comparaison avec les indices et performance de vos investissements
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 flex-wrap">
          <button
            onClick={() => setChartMode('evolution')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              chartMode === 'evolution'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Courbe d'Évolution</span>
          </button>

          <button
            onClick={() => setChartMode('benchmark')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              chartMode === 'benchmark'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>vs Benchmarks</span>
          </button>

          <button
            onClick={() => setChartMode('institution')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              chartMode === 'institution'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>Par Banque</span>
          </button>

          <button
            onClick={() => setChartMode('assets')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              chartMode === 'assets'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Classes d'Actifs</span>
          </button>

          {perfAssets.length > 0 && (
            <button
              onClick={() => setChartMode('performance')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                chartMode === 'performance'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Palmarès Titres</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= 1. COURBE D'EVOLUTION TEMPORELLE ================= */}
      {chartMode === 'evolution' && (
        <div className="space-y-3">
          {history.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">Historique en construction</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                La courbe d'évolution se construit automatiquement jour après jour.
                Un snapshot est enregistré à chaque consultation du tableau de bord.
              </p>
              {history.length === 1 && (
                <p className="text-xs text-blue-400 font-medium">
                  Premier point enregistré aujourd'hui : {formatEURPrecise(history[0].total_net_worth)}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Évolution du patrimoine total ({history.length} jours de données)</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-blue-500 rounded-full"></span>
                    Valeur nette
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-slate-500 rounded-full"></span>
                    Capital investi
                  </span>
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWorth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
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
                            <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-2xl shadow-2xl backdrop-blur-md">
                              <p className="text-xs text-slate-400 font-semibold">{data.full_date || data.date}</p>
                              <p className="text-base font-extrabold text-white mt-1">
                                {formatEURPrecise(data.total_net_worth)}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Investi : <strong className="text-slate-200">{formatEUR(data.total_invested)}</strong>
                              </p>
                              <p className={`text-xs font-bold mt-1 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPos ? `+${formatEURPrecise(gain)}` : formatEURPrecise(gain)} de plus-value
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
                      stroke="#3B82F6" 
                      strokeWidth={3} 
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

      {/* ================= 2. COMPARAISON AVEC LES INDICES (BENCHMARK) ================= */}
      {chartMode === 'benchmark' && (
        <div className="space-y-4">
          {/* Contrôles du benchmark */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">Indice de référence :</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { symbol: 'CW8.PA', label: 'MSCI World (CW8)' },
                  { symbol: '^GSPC', label: 'S&P 500' },
                  { symbol: '^FCHI', label: 'CAC 40' },
                  { symbol: 'BTC-EUR', label: 'Bitcoin' },
                ].map((item) => (
                  <button
                    key={item.symbol}
                    onClick={() => setSelectedBenchmark(item.symbol)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                      selectedBenchmark === item.symbol
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Période :</span>
              {['1mo', '3mo', '6mo', '1y'].map((p) => (
                <button
                  key={p}
                  onClick={() => setBenchmarkPeriod(p)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                    benchmarkPeriod === p
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p === '1mo' ? '1 Mois' : p === '3mo' ? '3 Mois' : p === '6mo' ? '6 Mois' : '1 An'}
                </button>
              ))}
            </div>
          </div>

          {/* Cartes KPI de comparaison */}
          {benchmarkData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
                <span className="text-[11px] text-slate-400 font-medium block">Mon Portefeuille</span>
                <span className={`text-xl font-extrabold ${benchmarkData.portfolio_total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {benchmarkData.portfolio_total_return_pct >= 0 ? `+${benchmarkData.portfolio_total_return_pct}%` : `${benchmarkData.portfolio_total_return_pct}%`}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Sur la période sélectionnée</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
                <span className="text-[11px] text-slate-400 font-medium block">{benchmarkData.benchmark?.name || selectedBenchmark}</span>
                <span className={`text-xl font-extrabold ${benchmarkData.benchmark_total_return_pct >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {benchmarkData.benchmark_total_return_pct >= 0 ? `+${benchmarkData.benchmark_total_return_pct}%` : `${benchmarkData.benchmark_total_return_pct}%`}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Performance du marché</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
                <span className="text-[11px] text-slate-400 font-medium block">Alpha (Surperformance)</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xl font-extrabold ${benchmarkData.alpha_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {benchmarkData.alpha_pct >= 0 ? `+${benchmarkData.alpha_pct}%` : `${benchmarkData.alpha_pct}%`}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    benchmarkData.outperforming ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}>
                    {benchmarkData.outperforming ? 'Surperformance' : 'Sous-performance'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Écart relatif vs l'indice</span>
              </div>
            </div>
          )}

          {/* Graphique multi-courbes en % */}
          <div className="h-72 w-full pt-2">
            {isBenchmarkLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Chargement des cotations historiques de l'indice...
              </div>
            ) : benchmarkData?.series?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={benchmarkData.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
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
                          <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-2xl shadow-2xl backdrop-blur-md text-xs space-y-1">
                            <p className="text-slate-400 font-semibold">{d.full_date || d.date}</p>
                            <p className="font-bold text-blue-400">
                              Portefeuille : {d.portfolio_pct >= 0 ? `+${d.portfolio_pct}%` : `${d.portfolio_pct}%`}
                            </p>
                            <p className="font-bold text-cyan-400">
                              {benchmarkData.benchmark?.name} : {d.benchmark_pct >= 0 ? `+${d.benchmark_pct}%` : `${d.benchmark_pct}%`} ({d.benchmark_price} €)
                            </p>
                            <p className={`font-semibold pt-1 border-t border-slate-800 ${d.alpha_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              Écart (Alpha) : {d.alpha_pct >= 0 ? `+${d.alpha_pct}%` : `${d.alpha_pct}%`}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    formatter={(value) => (
                      <span className="text-xs text-slate-300 font-medium">
                        {value === 'portfolio_pct' ? 'Mon Portefeuille (%)' : `${benchmarkData.benchmark?.name || 'Indice'} (%)`}
                      </span>
                    )} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="portfolio_pct" 
                    name="portfolio_pct" 
                    stroke="#3B82F6" 
                    strokeWidth={3} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="benchmark_pct" 
                    name="benchmark_pct" 
                    stroke="#06B6D4" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Données d'indice indisponibles pour le moment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 3. REPARTITION PAR BANQUE ================= */}
      {chartMode === 'institution' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationInst}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {allocationInst.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Net</span>
              <span className="text-base font-extrabold text-white">{formatEUR(totalVal)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {allocationInst.map((item, idx) => {
              const pct = ((item.value / totalVal) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 transition-all border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: item.color || COLORS[idx % COLORS.length] }}
                    />
                    <div>
                      <span className="text-sm font-semibold text-white block">{item.name}</span>
                      <span className="text-[11px] text-slate-400">{pct}% du patrimoine</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{formatEUR(item.value)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 4. CLASSES D'ACTIFS ================= */}
      {chartMode === 'assets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationAsset}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {allocationAsset.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Catégories</span>
              <span className="text-base font-extrabold text-white">{allocationAsset.length} types</span>
            </div>
          </div>

          <div className="space-y-3">
            {allocationAsset.map((item, idx) => {
              const pct = ((item.value / totalVal) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 transition-all border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <div>
                      <span className="text-sm font-semibold text-white block">{item.name}</span>
                      <span className="text-[11px] text-slate-400">{pct}% de l'allocation</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{formatEUR(item.value)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 5. PALMARES DES PERFORMANCES ================= */}
      {chartMode === 'performance' && perfAssets.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Gains et pertes latentes par titre (en % et en montant)
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfAssets} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="symbol" type="category" stroke="#94A3B8" fontSize={11} width={80} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const isPos = d.gain_percent >= 0;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-2xl shadow-xl">
                          <p className="text-xs font-semibold text-white">{d.name}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{d.symbol}</p>
                          <p className={`text-sm font-bold mt-1.5 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPos ? `+${d.gain_percent}%` : `${d.gain_percent}%`} ({isPos ? `+${formatEURPrecise(d.gain_eur)}` : formatEURPrecise(d.gain_eur)})
                          </p>
                          <p className="text-xs text-slate-300 mt-0.5">Valeur totale : {formatEURPrecise(d.total_value_eur)}</p>
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
                      fill={entry.gain_percent >= 0 ? '#10B981' : '#EF4444'} 
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
  );
}
