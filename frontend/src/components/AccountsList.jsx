import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check, X, 
  TrendingUp, TrendingDown, PiggyBank, Landmark, ShieldCheck, Wallet, ArrowUpRight
} from 'lucide-react';

export default function AccountsList({ 
  accounts = [], 
  onDeleteAccount, 
  onUpdateAccount, 
  onDeleteHolding, 
  onOpenAddAssetForAccount 
}) {
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [editingCashId, setEditingCashId] = useState(null);
  const [cashInputValue, setCashInputValue] = useState('');

  const toggleExpand = (accountId) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const handleStartEditCash = (account) => {
    setEditingCashId(account.id);
    setCashInputValue(account.cash_balance.toString());
  };

  const handleSaveCash = async (account) => {
    const newCash = parseFloat(cashInputValue);
    if (!isNaN(newCash) && newCash >= 0) {
      await onUpdateAccount(account.id, { cash_balance: newCash });
    }
    setEditingCashId(null);
  };

  const formatEUR = (val) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  /** Normalise le type de compte pour comparaison (toujours lowercase). */
  const getType = (acc) => (acc.account_type || '').toLowerCase();

  const getAccountTypeBadge = (type) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'savings': 
        return { label: 'Épargne & Livrets', icon: PiggyBank, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'pea': 
        return { label: 'PEA Indiciel', icon: TrendingUp, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'cto': 
        return { label: 'CTO Actions US/EU', icon: Landmark, color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
      case 'crypto': 
        return { label: 'Crypto Actifs', icon: ArrowUpRight, color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
      case 'pee': 
        return { label: 'PEE Entreprise', icon: ShieldCheck, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      default: 
        return { label: 'Compte Courant', icon: Wallet, color: 'bg-slate-700 text-slate-300 border-slate-600' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            Mes Établissements & Enveloppes
          </h2>
          <p className="text-xs text-slate-400">
            BoursoBank, Revolut, BNP Paribas et PEE • Cliquez sur un compte pour afficher ses lignes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {accounts.map((acc) => {
          const isExpanded = !!expandedAccounts[acc.id];
          const holdings = acc.holdings || [];
          const isGainPositive = (acc.gain_eur || 0) >= 0;
          const accType = getType(acc);
          const badge = getAccountTypeBadge(accType);
          const BadgeIcon = badge.icon;
          const isSavingsAccount = accType === 'savings' || (acc.name || '').toLowerCase().includes('livret');

          return (
            <div 
              key={acc.id}
              className="bg-[#111827]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-slate-700/80"
            >
              {/* En-tête du compte */}
              <div 
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                onClick={() => toggleExpand(acc.id)}
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div 
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-md text-xs flex-shrink-0"
                    style={{ backgroundColor: acc.color || '#3B82F6' }}
                  >
                    {(acc.institution || '??').substring(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-base">{acc.name}</h3>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {acc.institution}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                      {/* Solde espèces / livret avec bouton d'édition direct */}
                      <div 
                        className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-slate-400">
                          {isSavingsAccount ? "Solde Livret / Épargne :" : "Espèces / Cash :"}
                        </span>
                        {editingCashId === acc.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="any"
                              value={cashInputValue}
                              onChange={(e) => setCashInputValue(e.target.value)}
                              className="w-24 px-2 py-0.5 bg-slate-800 border border-emerald-500 rounded text-xs text-white focus:outline-none font-bold"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveCash(acc)}
                              className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                              title="Valider le montant"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCashId(null)}
                              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                              title="Annuler"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{formatEUR(acc.cash_balance)}</span>
                            <button
                              onClick={() => handleStartEditCash(acc)}
                              className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-medium transition-colors flex items-center gap-1"
                              title="Changer le montant"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Modifier</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {holdings.length > 0 && (
                        <span>• {holdings.length} {holdings.length > 1 ? 'positions / sous-livrets' : 'position'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Valeur totale du compte & actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-left sm:text-right">
                    <div className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                      {formatEUR(acc.total_value_eur)}
                    </div>
                    {acc.total_invested_eur > 0 && accType !== 'savings' && (
                      <div className={`text-xs font-semibold flex items-center sm:justify-end gap-1 ${
                        isGainPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isGainPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span>{isGainPositive ? `+${formatEUR(acc.gain_eur)}` : formatEUR(acc.gain_eur)}</span>
                        <span>({isGainPositive ? `+${acc.gain_percent}%` : `${acc.gain_percent}%`})</span>
                      </div>
                    )}
                    {isSavingsAccount && (
                      <span className="text-[11px] text-emerald-400 font-medium">
                        Capital garanti & disponible
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAddAssetForAccount(acc);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all flex items-center gap-1"
                      title={isSavingsAccount ? "Ajouter un livret dans ce compte" : "Ajouter un actif"}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {isSavingsAccount ? "+ Livret" : "+ Actif"}
                      </span>
                    </button>

                    <div className="p-2 text-slate-400 hover:text-white transition-colors">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lignes d'actifs / Livrets déroulantes */}
              {isExpanded && (
                <div className="border-t border-slate-800/80 bg-slate-950/50 p-4 sm:p-5">
                  {holdings.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs sm:text-sm space-y-2">
                      <p>
                        {isSavingsAccount 
                          ? "Votre solde principal est enregistré ci-dessus. Vous pouvez aussi ajouter d'autres livrets (ex: LDDS, LEP...) pour ce compte."
                          : "Aucun titre ou actif financier enregistré dans ce compte."}
                      </p>
                      <button
                        onClick={() => onOpenAddAssetForAccount(acc)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-600/30 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isSavingsAccount ? "Ajouter un autre livret (LDDS, LEP...)" : "Ajouter une position boursière / crypto"}
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                            <th className="pb-3 pr-4">Nom / Support</th>
                            <th className="pb-3 px-3 text-right">Quantité</th>
                            <th className="pb-3 px-3 text-right">PRU (€)</th>
                            <th className="pb-3 px-3 text-right">Cours Live</th>
                            <th className="pb-3 px-3 text-right">Var. Jour</th>
                            <th className="pb-3 px-3 text-right">Valeur (€)</th>
                            <th className="pb-3 px-3 text-right">Plus-Value</th>
                            <th className="pb-3 pl-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {holdings.map((h) => {
                            const isPositive = (h.gain_eur || 0) >= 0;
                            const isDayPositive = (h.change_day_percent || 0) >= 0;
                            const isLivret = (h.asset_class || '').toLowerCase() === 'savings' || (h.asset_class || '').toLowerCase() === 'cash';

                            return (
                              <tr key={h.id} className="hover:bg-slate-900/60 transition-colors">
                                <td className="py-3 pr-4">
                                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                                    {isLivret && <PiggyBank className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                                    <span>{h.name || h.symbol}</span>
                                    {isLivret && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium">
                                        Épargne
                                      </span>
                                    )}
                                    {h.is_manual && !isLivret && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-medium">
                                        PEE
                                      </span>
                                    )}
                                  </div>
                                  {!isLivret && (
                                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                      {h.symbol}
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right font-medium text-slate-200">
                                  {isLivret ? '—' : h.quantity}
                                </td>

                                <td className="py-3 px-3 text-right font-medium text-slate-300">
                                  {isLivret ? '1,00 €' : formatEUR(h.unit_cost_eur)}
                                </td>

                                <td className="py-3 px-3 text-right font-semibold text-white">
                                  {isLivret ? (
                                    <span className="text-emerald-400 font-medium">1,00 €</span>
                                  ) : (
                                    <>
                                      {h.current_price_eur ? formatEUR(h.current_price_eur) : '—'}
                                      {h.currency !== 'EUR' && (
                                        <span className="text-[10px] text-slate-400 block font-normal">
                                          ({h.current_price} {h.currency})
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right font-medium">
                                  {isLivret ? (
                                    <span className="text-slate-400 text-[11px]">Garanti</span>
                                  ) : (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      isDayPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                                    }`}>
                                      {isDayPositive ? `+${h.change_day_percent}%` : `${h.change_day_percent}%`}
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right font-bold text-white text-sm">
                                  {formatEUR(h.total_value_eur)}
                                </td>

                                <td className="py-3 px-3 text-right">
                                  {isLivret ? (
                                    <span className="text-xs text-slate-400 font-medium">Sans risque</span>
                                  ) : (
                                    <>
                                      <div className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isPositive ? `+${formatEUR(h.gain_eur)}` : formatEUR(h.gain_eur)}
                                      </div>
                                      <div className={`text-[10px] ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {isPositive ? `+${h.gain_percent}%` : `${h.gain_percent}%`}
                                      </div>
                                    </>
                                  )}
                                </td>

                                <td className="py-3 pl-3 text-right">
                                  <button
                                    onClick={() => onDeleteHolding(h.id)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
                                    title="Supprimer la position"
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

                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-xs">
                    <span className="text-slate-500">ID Compte : #{acc.id}</span>
                    <button
                      onClick={() => onDeleteAccount(acc.id)}
                      className="text-rose-400/70 hover:text-rose-400 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer ce compte
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
