import React, { useState, useEffect } from 'react';
import { 
  History, Plus, Trash2, ShoppingCart, TrendingDown, 
  ArrowDownLeft, ArrowUpRight, DollarSign, Filter, RefreshCw,
  Tag, Zap, Landmark
} from 'lucide-react';
import { api } from '../services/api';
import { formatEUR } from '../utils/format';

const CATEGORY_COLORS = {
  "Alimentation & Courses": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Logement & Énergie": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Revenus & Salaires": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Investissement & Épargne": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Dividendes & Intérêts": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Abonnements & Médias": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Transports & Véhicule": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Santé & Bien-être": "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "Loisirs & Shopping": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Frais bancaires & Taxes": "bg-red-500/15 text-red-400 border-red-500/30",
  "Virement interne": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
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
        limit: 100,
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
      if (onTransactionDeleted) onTransactionDeleted(); // trigger global refresh
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
        return { label: 'Achat', icon: ShoppingCart, bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'sell':
        return { label: 'Vente', icon: TrendingDown, bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'deposit':
        return { label: 'Versement', icon: ArrowDownLeft, bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'withdrawal':
        return { label: 'Retrait', icon: ArrowUpRight, bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      case 'dividend':
        return { label: 'Dividende', icon: DollarSign, bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      default:
        return { label: type, icon: History, bg: 'bg-slate-700 text-slate-300 border-slate-600' };
    }
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Journal des Transactions & Flux
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Historique enrichi automatiquement avec commerçants, montants et catégories intelligentes
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtre par Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
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
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 max-w-[150px] truncate"
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
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 max-w-[150px] truncate"
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
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Synchroniser immédiatement comptes et transactions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline">Synchro</span>
          </button>

          {/* Bouton Nouvelle Transaction */}
          <button
            onClick={onOpenAddTransaction}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Opération</span>
          </button>
        </div>
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
          <span>Chargement du journal...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-3">
          <p className="text-sm">Aucune transaction trouvée.</p>
          <p className="text-xs max-w-md mx-auto text-slate-500">
            Enregistrez une opération ou lancez la synchronisation bancaire pour importer automatiquement vos transactions.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleQuickSync}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Synchroniser les banques
            </button>
            <button
              onClick={onOpenAddTransaction}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Enregistrer une opération
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 px-3">Type</th>
                <th className="pb-3 px-3">Catégorie</th>
                <th className="pb-3 px-3">Compte</th>
                <th className="pb-3 px-3">Libellé / Actif</th>
                <th className="pb-3 px-3 text-right">Quantité</th>
                <th className="pb-3 px-3 text-right">Cours</th>
                <th className="pb-3 px-3 text-right">Montant</th>
                <th className="pb-3 px-3 text-right">Plus-Value</th>
                <th className="pb-3 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {transactions.map((tx) => {
                const badge = getTypeBadge(tx.type);
                const BadgeIcon = badge.icon;
                const isRealizedPos = (tx.realized_gain_eur || 0) >= 0;
                const catColor = CATEGORY_COLORS[tx.category] || "bg-slate-800 text-slate-400 border-slate-700";

                return (
                  <tr key={tx.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-slate-300 whitespace-nowrap">
                      {tx.transaction_date}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${badge.bg}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {tx.category ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-medium ${catColor}`}>
                          <Tag className="w-2.5 h-2.5" />
                          {tx.category}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-300 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{tx.account_name || `Compte #${tx.account_id}`}</span>
                        {tx.external_id && (
                          <span 
                            title="Synchronisé automatiquement via Open Banking DSP2"
                            className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold"
                          >
                            DSP2
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 max-w-[220px]">
                      <div>
                        <div className="font-semibold text-white truncate" title={tx.name || tx.symbol}>
                          {tx.name || tx.symbol || 'Opération'}
                        </div>
                        {tx.symbol && tx.name && tx.symbol !== tx.name && (
                          <div className="text-[10px] font-mono text-blue-400">{tx.symbol}</div>
                        )}
                        {tx.notes && !tx.symbol && (
                          <div className="text-[10px] text-slate-500 truncate" title={tx.notes}>{tx.notes}</div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                      {tx.quantity !== null && tx.quantity !== undefined ? tx.quantity : '—'}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                      {tx.unit_price ? formatEUR(tx.unit_price_eur || tx.unit_price) : '—'}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className={tx.type === 'deposit' || tx.type === 'dividend' ? 'text-emerald-400' : 'text-white'}>
                        {tx.type === 'deposit' || tx.type === 'dividend' ? '+' : ''}{formatEUR(tx.amount_eur || tx.amount)}
                      </span>
                      {tx.fees > 0 && (
                        <span className="text-[10px] text-slate-500 block font-normal">
                          frais: {formatEUR(tx.fees_eur || tx.fees)}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      {tx.realized_gain_eur !== null && tx.realized_gain_eur !== undefined ? (
                        <span className={`font-semibold ${isRealizedPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isRealizedPos ? `+${formatEUR(tx.realized_gain_eur)}` : formatEUR(tx.realized_gain_eur)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
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
