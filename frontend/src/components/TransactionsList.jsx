import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Plus, Trash2, ShoppingCart, TrendingDown, 
  ArrowDownLeft, ArrowUpRight, DollarSign, RefreshCw,
  Tag, Search, Filter, X, ArrowDownRight, Layers,
  CheckCircle2, Building2
} from 'lucide-react';
import { api } from '../services/api';
import { formatEUR } from '../utils/format';

const CATEGORY_STYLES = {
  "Alimentation & Courses": "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  "Logement & Énergie": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  "Revenus & Salaires": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  "Investissement & Épargne": "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  "Dividendes & Intérêts": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  "Abonnements & Médias": "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  "Transports & Véhicule": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  "Santé & Bien-être": "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  "Loisirs & Shopping": "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
  "Frais bancaires & Taxes": "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  "Virement interne": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
};

export default function TransactionsList({ 
  onOpenAddTransaction, 
  accounts = [], 
  refreshTrigger = 0,
  onTransactionDeleted 
}) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Charger les catégories disponibles
  useEffect(() => {
    api.getTransactionCategories()
      .then(cats => {
        if (Array.isArray(cats)) setCategories(cats);
      })
      .catch(() => {});
  }, []);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await api.getTransactions({
        accountId: filterAccount || undefined,
        type: filterType || undefined,
        category: filterCategory || undefined,
        limit: 150,
      });
      setTransactions(data);
    } catch (err) {
      console.error("Erreur chargement transactions :", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterType, filterAccount, filterCategory, refreshTrigger]);

  const handleQuickSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncBankBalances();
      fetchTransactions();
      if (onTransactionDeleted) onTransactionDeleted();
      alert(res.message || "Comptes et transactions synchronisés !");
    } catch (err) {
      alert("Erreur de synchronisation : " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (txId) => {
    if (window.confirm("Supprimer cette transaction ? Le solde de trésorerie du compte sera réajusté et la position recalculée automatiquement.")) {
      try {
        await api.deleteTransaction(txId);
        fetchTransactions();
        if (onTransactionDeleted) onTransactionDeleted();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const getTypeBadge = (type) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'buy':
        return { label: 'Achat', icon: ShoppingCart, bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' };
      case 'sell':
        return { label: 'Vente', icon: TrendingDown, bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' };
      case 'deposit':
        return { label: 'Versement', icon: ArrowDownLeft, bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' };
      case 'withdrawal':
        return { label: 'Dépense / Retrait', icon: ArrowUpRight, bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20' };
      case 'dividend':
        return { label: 'Dividende', icon: DollarSign, bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' };
      default:
        return { label: type, icon: History, bg: 'bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]' };
    }
  };

  // Filtrage local supplémentaire par recherche textuelle (ticker, nom, notes, compte)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (tx.name && tx.name.toLowerCase().includes(q)) ||
        (tx.symbol && tx.symbol.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.account_name && tx.account_name.toLowerCase().includes(q))
      );
    });
  }, [transactions, searchQuery]);

  // Statistiques rapides sur les transactions affichées
  const stats = useMemo(() => {
    let inflows = 0;
    let outflows = 0;
    let realizedPnl = 0;
    let sellCount = 0;
    filteredTransactions.forEach(tx => {
      const amt = tx.amount_eur || tx.amount || 0;
      const t = (tx.type || '').toLowerCase();
      if (t === 'deposit' || t === 'dividend' || t === 'sell') {
        inflows += amt;
        if (t === 'sell' && tx.realized_gain_eur !== null && tx.realized_gain_eur !== undefined) {
          realizedPnl += tx.realized_gain_eur;
          sellCount++;
        }
      } else if (t === 'withdrawal' || t === 'buy') {
        outflows += amt;
      }
    });
    return {
      count: filteredTransactions.length,
      inflows,
      outflows,
      net: inflows - outflows,
      realizedPnl,
      sellCount,
    };
  }, [filteredTransactions]);

  const hasActiveFilters = Boolean(filterType || filterAccount || filterCategory || searchQuery);

  const clearFilters = () => {
    setFilterType('');
    setFilterAccount('');
    setFilterCategory('');
    setSearchQuery('');
  };

  return (
    <div className="fintech-card overflow-hidden transition-all duration-300">
      {/* En-tête Principal */}
      <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#070B14]/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <History className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Journal des Opérations & Trésorerie
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Historique unifié : ordres de bourse, dividendes perçus et flux bancaires DSP2
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bouton Synchro Directe */}
            <button
              onClick={handleQuickSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold border border-slate-200 dark:border-white/[0.08] transition-all btn-haptic flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              title="Synchroniser immédiatement comptes et transactions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              <span>Synchro DSP2</span>
            </button>

            {/* Bouton Nouvelle Transaction */}
            <button
              onClick={onOpenAddTransaction}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-[0_2px_12px_rgba(37,99,235,0.3)] transition-all btn-haptic flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouvelle Opération</span>
            </button>
          </div>
        </div>

        {/* Barre de Filtres Rapides & Recherche */}
        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Champ de recherche */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher ticker, libellé..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#06090F] border border-slate-200/90 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filtre par Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-[#06090F] border border-slate-200/90 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
            >
              <option value="">Tous les types</option>
              <option value="buy">Achats de titres</option>
              <option value="sell">Ventes de titres</option>
              <option value="deposit">Versements & Revenus</option>
              <option value="withdrawal">Dépenses & Retraits</option>
              <option value="dividend">Dividendes</option>
            </select>

            {/* Filtre par Catégorie */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-[#06090F] border border-slate-200/90 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 max-w-[150px] truncate transition-colors shadow-sm"
            >
              <option value="">Toutes catégories</option>
              {categories.map((c, idx) => (
                <option key={idx} value={c}>{c}</option>
              ))}
            </select>

            {/* Filtre par Compte */}
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-[#06090F] border border-slate-200/90 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 max-w-[150px] truncate transition-colors shadow-sm"
            >
              <option value="">Tous les comptes</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>

            {/* Reset Filtres */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition-colors hover:bg-slate-200/50 dark:hover:bg-white/[0.05]"
                title="Réinitialiser les filtres"
              >
                <X className="w-3 h-3" />
                <span>Effacer filtres</span>
              </button>
            )}
          </div>

          {/* Mini-Stats Bar */}
          <div className="flex items-center gap-3 text-xs self-end md:self-auto flex-wrap">
            <span className="text-slate-500 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-white font-mono">{stats.count}</strong> opération{stats.count > 1 ? 's' : ''}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold" title="Total des encaissements (dépôts, dividendes, cessions)">
              +{formatEUR(stats.inflows)}
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-mono font-semibold" title="Total des décaissements (dépenses, achats)">
              -{formatEUR(stats.outflows)}
            </span>
            {stats.sellCount > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span 
                  className={`font-mono font-semibold ${stats.realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                  title="Plus-values nettes définitivement réalisées sur les ventes affichées"
                >
                  PV nette : {stats.realizedPnl >= 0 ? `+${formatEUR(stats.realizedPnl)}` : formatEUR(stats.realizedPnl)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contenu : Table / Loader / Empty */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
          <span>Chargement du journal des transactions...</span>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="py-16 px-4 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center text-slate-400 mx-auto">
            <History className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {hasActiveFilters ? "Aucune opération ne correspond à vos filtres" : "Aucune transaction enregistrée"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hasActiveFilters 
              ? "Modifiez vos critères de recherche ou réinitialisez les filtres pour afficher l'ensemble de l'historique."
              : "Enregistrez un premier ordre ou lancez une synchronisation DSP2 pour alimenter votre historique patrimonial."
            }
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="mt-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          ) : (
            <button
              onClick={onOpenAddTransaction}
              className="mt-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
            >
              + Ajouter une opération
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#070B14]/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Catégorie</th>
                <th className="py-3 px-3">Compte</th>
                <th className="py-3 px-3">Actif / Libellé</th>
                <th className="py-3 px-3 text-right">Quantité</th>
                <th className="py-3 px-3 text-right">Cours Unit.</th>
                <th className="py-3 px-3 text-right">Montant Net</th>
                <th className="py-3 px-3 text-right">Plus-Value</th>
                <th className="py-3 pr-4 pl-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
              {filteredTransactions.map((tx) => {
                const badge = getTypeBadge(tx.type);
                const BadgeIcon = badge.icon;
                const isRealizedPos = (tx.realized_gain_eur || 0) >= 0;
                const catStyle = CATEGORY_STYLES[tx.category] || "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.06]";
                const isCredit = tx.type === 'deposit' || tx.type === 'dividend';

                return (
                  <tr 
                    key={tx.id} 
                    className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap text-[11px]">
                      {tx.transaction_date}
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${badge.bg}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </td>

                    {/* Catégorie */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {tx.category ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-medium ${catStyle}`}>
                          <Tag className="w-2.5 h-2.5 opacity-70" />
                          {tx.category}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Compte */}
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs text-slate-800 dark:text-slate-200">
                          {tx.account_name || `Compte #${tx.account_id}`}
                        </span>
                        {tx.external_id && (
                          <span 
                            title="Synchronisé automatiquement via Open Banking DSP2"
                            className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 text-[9px] font-mono font-bold"
                          >
                            DSP2
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Libellé / Actif */}
                    <td className="py-3 px-3 max-w-[240px]">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs" title={tx.name || tx.symbol}>
                          {tx.name || tx.symbol || 'Opération'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {tx.symbol && tx.name && tx.symbol !== tx.name && (
                            <span className="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              {tx.symbol}
                            </span>
                          )}
                          {tx.notes && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[140px]" title={tx.notes}>
                              {tx.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Quantité */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums text-xs">
                      {tx.quantity !== null && tx.quantity !== undefined ? tx.quantity : '—'}
                    </td>

                    {/* Cours unitaire */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums text-xs">
                      {tx.unit_price ? formatEUR(tx.unit_price_eur || tx.unit_price) : '—'}
                    </td>

                    {/* Montant Net */}
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                      <span className={`font-bold text-xs ${
                        isCredit 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-slate-900 dark:text-slate-100'
                      }`}>
                        {isCredit ? '+' : ''}{formatEUR(tx.amount_eur || tx.amount)}
                      </span>
                      {tx.fees > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">
                          frais: {formatEUR(tx.fees_eur || tx.fees)}
                        </span>
                      )}
                    </td>

                    {/* Plus-value réalisée */}
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                      {tx.realized_gain_eur !== null && tx.realized_gain_eur !== undefined ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          isRealizedPos 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          {isRealizedPos ? `+${formatEUR(tx.realized_gain_eur)}` : formatEUR(tx.realized_gain_eur)}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Action Supprimer */}
                    <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 transition-all"
                        title="Supprimer la transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
