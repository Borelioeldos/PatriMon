import React, { useState, useEffect } from 'react';
import { 
  History, Plus, Trash2, ShoppingCart, TrendingDown, 
  ArrowDownLeft, ArrowUpRight, DollarSign, RefreshCw,
  Tag, Search
} from 'lucide-react';
import { api } from '../services/api';
import { formatEUR } from '../utils/format';

const CATEGORY_STYLES = {
  "Alimentation & Courses": "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25",
  "Logement & Énergie": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  "Revenus & Salaires": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  "Investissement & Épargne": "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25",
  "Dividendes & Intérêts": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/25",
  "Abonnements & Médias": "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25",
  "Transports & Véhicule": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/25",
  "Santé & Bien-être": "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
  "Loisirs & Shopping": "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/25",
  "Frais bancaires & Taxes": "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25",
  "Virement interne": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25",
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
    if (window.confirm("Supprimer cette transaction ? Le solde de trésorerie du compte sera réajusté et la position (quantité/PRU) recalculée automatiquement.")) {
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
    switch (type) {
      case 'buy':
        return { label: 'Achat', icon: ShoppingCart, bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25' };
      case 'sell':
        return { label: 'Vente', icon: TrendingDown, bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25' };
      case 'deposit':
        return { label: 'Versement', icon: ArrowDownLeft, bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25' };
      case 'withdrawal':
        return { label: 'Retrait', icon: ArrowUpRight, bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25' };
      case 'dividend':
        return { label: 'Dividende', icon: DollarSign, bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25' };
      default:
        return { label: type, icon: History, bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  // Filtrage local supplémentaire par recherche textuelle (ticker, nom, notes)
  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (tx.name && tx.name.toLowerCase().includes(q)) ||
      (tx.symbol && tx.symbol.toLowerCase().includes(q)) ||
      (tx.notes && tx.notes.toLowerCase().includes(q)) ||
      (tx.account_name && tx.account_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="double-bezel rounded-[1.75rem] p-1.5 transition-all">
      <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] p-5 sm:p-6 space-y-4">
        {/* En-tête */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.06] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <History className="w-4 h-4 stroke-[2]" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Journal des Transactions & Flux de Capitaux
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Historique complet : ordres de bourse, dividendes, versements et ventilation catégorielle
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Recherche texte */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrer par titre, note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-52 transition-colors"
              />
            </div>

            {/* Filtre par Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Tous types</option>
              <option value="buy">Achats</option>
              <option value="sell">Ventes</option>
              <option value="deposit">Versements</option>
              <option value="withdrawal">Retraits / Dépenses</option>
              <option value="dividend">Dividendes</option>
            </select>

            {/* Filtre par Catégorie */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 max-w-[140px] truncate transition-colors"
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
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 max-w-[140px] truncate transition-colors"
            >
              <option value="">Tous les comptes</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>

            {/* Bouton Synchro Directe */}
            <button
              onClick={handleQuickSync}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#070B14] dark:hover:bg-white/[0.06] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold border border-slate-200 dark:border-white/[0.08] transition-all btn-haptic flex items-center gap-1.5 disabled:opacity-50"
              title="Synchroniser immédiatement comptes et transactions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              <span className="hidden sm:inline">Synchro</span>
            </button>

            {/* Bouton Nouvelle Transaction */}
            <button
              onClick={onOpenAddTransaction}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all btn-haptic flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Opération</span>
            </button>
          </div>
        </div>

        {/* Contenu */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span>Chargement du journal...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-14 text-center text-slate-500 dark:text-slate-400 space-y-2.5">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aucune transaction trouvée.</p>
            <p className="text-xs max-w-md mx-auto text-slate-400 dark:text-slate-500">
              Enregistrez une opération ou déclenchez la synchronisation bancaire pour alimenter l'historique.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1C2536] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pr-3">Date</th>
                  <th className="pb-3 px-2.5">Type</th>
                  <th className="pb-3 px-2.5">Catégorie</th>
                  <th className="pb-3 px-2.5">Compte</th>
                  <th className="pb-3 px-2.5">Libellé</th>
                  <th className="pb-3 px-2.5 text-right">Quantité</th>
                  <th className="pb-3 px-2.5 text-right">Cours</th>
                  <th className="pb-3 px-2.5 text-right">Montant</th>
                  <th className="pb-3 px-2.5 text-right">Plus-value</th>
                  <th className="pb-3 pl-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-[#1C2536]/60">
                {filteredTransactions.map((tx) => {
                  const badge = getTypeBadge(tx.type);
                  const BadgeIcon = badge.icon;
                  const isRealizedPos = (tx.realized_gain_eur || 0) >= 0;
                  const catStyle = CATEGORY_STYLES[tx.category] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-[#0B0F17]/70 transition-colors">
                      <td className="py-3 pr-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap text-[11px]">
                        {tx.transaction_date}
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-2.5 whitespace-nowrap">
                        {tx.category ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${catStyle}`}>
                            <Tag className="w-2.5 h-2.5" />
                            {tx.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{tx.account_name || `Compte #${tx.account_id}`}</span>
                          {tx.external_id && (
                            <span 
                              title="Synchronisé automatiquement via Open Banking DSP2"
                              className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 text-[9px] font-mono font-bold"
                            >
                              DSP2
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-2.5 max-w-[200px]">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white truncate text-xs" title={tx.name || tx.symbol}>
                            {tx.name || tx.symbol || 'Opération'}
                          </div>
                          {tx.symbol && tx.name && tx.symbol !== tx.name && (
                            <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-medium">{tx.symbol}</div>
                          )}
                          {tx.notes && !tx.symbol && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={tx.notes}>{tx.notes}</div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                        {tx.quantity !== null && tx.quantity !== undefined ? tx.quantity : '—'}
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                        {tx.unit_price ? formatEUR(tx.unit_price_eur || tx.unit_price) : '—'}
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                        <span className={tx.type === 'deposit' || tx.type === 'dividend' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}>
                          {tx.type === 'deposit' || tx.type === 'dividend' ? '+' : ''}{formatEUR(tx.amount_eur || tx.amount)}
                        </span>
                        {tx.fees > 0 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-normal">
                            frais: {formatEUR(tx.fees_eur || tx.fees)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {tx.realized_gain_eur !== null && tx.realized_gain_eur !== undefined ? (
                          <span className={`font-semibold ${isRealizedPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isRealizedPos ? `+${formatEUR(tx.realized_gain_eur)}` : formatEUR(tx.realized_gain_eur)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3 pl-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
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
    </div>
  );
}
