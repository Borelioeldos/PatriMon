import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check, X, 
  TrendingUp, TrendingDown, PiggyBank, Landmark, ShieldCheck, Wallet, ArrowUpRight,
  Building2, Zap, Eye, EyeOff, History, Info, Sparkles
} from 'lucide-react';
import { formatEUR, formatCurrency } from '../utils/format';
import EditHoldingModal from './EditHoldingModal';
import AssetDetailModal from './AssetDetailModal';

export default function AccountsList({ 
  accounts = [], 
  onDeleteAccount, 
  onUpdateAccount, 
  onDeleteHolding, 
  onOpenAddAssetForAccount,
  onOpenPeeImport,
  onOpenBankSync,
  onHoldingUpdated,
  onOpenAddTransaction
}) {
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [editingCashId, setEditingCashId] = useState(null);
  const [cashInputValue, setCashInputValue] = useState('');
  const [editingHolding, setEditingHolding] = useState(null);
  const [selectedHoldingId, setSelectedHoldingId] = useState(null);
  const [showClosedAccounts, setShowClosedAccounts] = useState({});

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

  const getType = (acc) => (acc.account_type || '').toLowerCase();

  const getAccountTypeBadge = (type) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'savings': 
        return { label: 'Épargne & Livrets', icon: PiggyBank, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' };
      case 'pea': 
        return { label: 'PEA Indiciel', icon: TrendingUp, color: 'bg-blue-500/10 text-blue-400 border-blue-500/25' };
      case 'cto': 
        return { label: 'CTO Actions & ETF', icon: Landmark, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' };
      case 'crypto': 
        return { label: 'Crypto Actifs', icon: ArrowUpRight, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' };
      case 'pee': 
        return { label: 'PEE Entreprise', icon: ShieldCheck, color: 'bg-amber-500/10 text-amber-400 border-amber-500/25' };
      case 'pero': 
        return { label: 'PERO Retraite', icon: ShieldCheck, color: 'bg-purple-500/10 text-purple-400 border-purple-500/25' };
      default: 
        return { label: 'Compte Courant', icon: Wallet, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête de section avec connecteurs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Établissements & Enveloppes Fiscales
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Comptes d'investissement et livrets d'épargne • Cliquez sur une enveloppe pour déplier ses actifs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenBankSync && (
            <button
              onClick={onOpenBankSync}
              className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium transition-all btn-haptic flex items-center gap-1.5 shadow-sm"
              title="Synchroniser vos comptes bancaires via DSP2"
            >
              <Landmark className="w-3.5 h-3.5 text-cyan-400" />
              <span>Synchro banques</span>
            </button>
          )}

          {onOpenPeeImport && (
            <button
              onClick={onOpenPeeImport}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all btn-haptic flex items-center gap-1.5 shadow-sm"
              title="Importer un relevé PDF/CSV BNP Épargne Entreprise (PEE / PERO)"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Importer PEE</span>
            </button>
          )}
        </div>
      </div>

      {/* Grille des comptes avec Double-Bezel Hardware Architecture */}
      <div className="grid grid-cols-1 gap-3.5">
        {accounts.map((acc) => {
          const isExpanded = !!expandedAccounts[acc.id];
          const holdings = acc.holdings || [];
          const activeHoldings = holdings.filter(h => (h.quantity || 0) > 0);
          const closedHoldings = holdings.filter(h => (h.quantity || 0) <= 0);
          const isClosedVisible = !!showClosedAccounts[acc.id];
          const displayedHoldings = isClosedVisible ? holdings : activeHoldings;

          const isGainPositive = (acc.gain_eur || 0) >= 0;
          const accType = getType(acc);
          const badge = getAccountTypeBadge(accType);
          const BadgeIcon = badge.icon;
          const isSavingsAccount = accType === 'savings' || (acc.name || '').toLowerCase().includes('livret');

          return (
            <div 
              key={acc.id}
              className="double-bezel rounded-[1.75rem] p-1.5 group transition-all"
            >
              <div className="double-bezel-inner rounded-[calc(1.75rem-0.375rem)] overflow-hidden">
                {/* En-tête du compte */}
                <div 
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 cursor-pointer select-none hover:bg-white/[0.015] transition-colors"
                  onClick={() => toggleExpand(acc.id)}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Monogramme Institution */}
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-xs flex-shrink-0 border border-white/20"
                      style={{ backgroundColor: acc.color || '#2563EB' }}
                    >
                      {(acc.institution || '??').substring(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-sm tracking-tight">{acc.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${badge.color}`}>
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          • {acc.institution}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                        {/* Solde espèces / livret avec bouton d'édition direct */}
                        <div 
                          className="flex items-center gap-1.5 bg-[#070B14]/80 px-2.5 py-1 rounded-lg border border-white/[0.06]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-slate-400 font-mono text-[11px]">
                            {isSavingsAccount ? "Solde livret :" : "Liquidités :"}
                          </span>
                          {editingCashId === acc.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                value={cashInputValue}
                                onChange={(e) => setCashInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCash(acc);
                                  if (e.key === 'Escape') setEditingCashId(null);
                                }}
                                className="w-20 px-1.5 py-0.5 bg-[#121826] border border-blue-500 rounded text-xs text-white focus:outline-none font-mono"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveCash(acc)}
                                className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                title="Valider (Entrée)"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingCashId(null)}
                                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                                title="Annuler (Échap)"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white tabular-nums font-mono">
                                {formatCurrency(acc.cash_balance, acc.currency || 'EUR')}
                              </span>
                              <button
                                onClick={() => handleStartEditCash(acc)}
                                className="p-0.5 text-slate-500 hover:text-blue-400 transition-colors"
                                title="Modifier le solde"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {holdings.length > 0 && (
                          <span className="font-mono text-[11px] text-slate-400">
                            • {activeHoldings.length} active{activeHoldings.length > 1 ? 's' : ''}
                            {closedHoldings.length > 0 && ` (${closedHoldings.length} soldée${closedHoldings.length > 1 ? 's' : ''})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Valeur totale du compte & actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3.5">
                    <div className="text-left sm:text-right">
                      <div className="text-lg sm:text-xl font-bold text-white tracking-tight font-mono tabular-nums">
                        {formatEUR(acc.total_value_eur)}
                      </div>
                      {acc.total_invested_eur > 0 && accType !== 'savings' && (
                        <div className={`text-xs font-mono font-semibold flex items-center sm:justify-end gap-1 tabular-nums ${
                          isGainPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {isGainPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{isGainPositive ? `+${formatEUR(acc.gain_eur)}` : formatEUR(acc.gain_eur)}</span>
                          <span>({isGainPositive ? `+${acc.gain_percent}%` : `${acc.gain_percent}%`})</span>
                        </div>
                      )}
                      {isSavingsAccount && (
                        <span className="text-[11px] text-emerald-400 font-mono font-medium">
                          Capital garanti
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Bouton spécifique Import PEE / PERO */}
                      {(accType === 'pee' || accType === 'pero' || (acc.name || '').toLowerCase().includes('pee')) && onOpenPeeImport && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPeeImport();
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 text-xs font-medium transition-all btn-haptic flex items-center gap-1"
                          title="Importer relevé PEE BNP"
                        >
                          <Building2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Relevé</span>
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddAssetForAccount(acc);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all btn-haptic flex items-center gap-1 shadow-sm"
                        title={isSavingsAccount ? "Ajouter un livret" : "Ajouter une position"}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isSavingsAccount ? "+ Livret" : "+ Actif"}</span>
                      </button>

                      <div className="p-1.5 text-slate-400 hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lignes d'actifs / Livrets déroulantes */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] bg-[#070B14]/70 p-4 sm:p-5">
                    {displayedHoldings.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs space-y-2.5">
                        <p>
                          {isSavingsAccount 
                            ? "Votre solde principal est enregistré ci-dessus. Vous pouvez ajouter un sous-livret pour ce compte."
                            : "Aucune position active dans ce compte."}
                        </p>
                        {closedHoldings.length > 0 && !isClosedVisible ? (
                          <button
                            onClick={() => setShowClosedAccounts(prev => ({ ...prev, [acc.id]: true }))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] text-slate-300 border border-white/[0.08] text-xs font-medium hover:bg-white/[0.07] transition-all btn-haptic"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            <span>Afficher les {closedHoldings.length} position{closedHoldings.length > 1 ? 's' : ''} soldée{closedHoldings.length > 1 ? 's' : ''}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenAddAssetForAccount(acc)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-600/25 transition-all btn-haptic"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isSavingsAccount ? "Ajouter un livret" : "Ajouter un actif"}</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/[0.06] text-slate-400 font-medium">
                              <th className="pb-3 pr-3 font-semibold uppercase tracking-wider text-[10px]">Support</th>
                              <th className="pb-3 px-3 text-right font-semibold uppercase tracking-wider text-[10px]">Quantité</th>
                              <th className="pb-3 px-3 text-right font-semibold uppercase tracking-wider text-[10px]">PRU</th>
                              <th className="pb-3 px-3 text-right font-semibold uppercase tracking-wider text-[10px]">Cours direct</th>
                              <th className="pb-3 px-3 text-right font-semibold uppercase tracking-wider text-[10px]">Var. jour</th>
                              <th className="pb-3 px-3 text-right font-semibold uppercase tracking-wider text-[10px]">Valeur totale</th>
                              <th className="pb-3 px-3 text-right font-semibold uppercase tracking-wider text-[10px]">Plus-value</th>
                              <th className="pb-3 pl-3 text-right font-semibold uppercase tracking-wider text-[10px]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {displayedHoldings.map((h) => {
                              const isPositive = (h.gain_eur || 0) >= 0;
                              const isDayPositive = (h.change_day_percent || 0) >= 0;
                              const isLivret = (h.asset_class || '').toLowerCase() === 'savings' || (h.asset_class || '').toLowerCase() === 'cash';
                              const isClosed = (h.quantity || 0) <= 0;

                              return (
                                <tr 
                                  key={h.id} 
                                  onClick={() => !isLivret && setSelectedHoldingId(h.id)}
                                  className={`transition-colors group ${
                                    !isLivret ? 'cursor-pointer' : ''
                                  } ${
                                    isClosed 
                                      ? 'opacity-60 bg-[#070A12]/40 hover:bg-white/[0.03] hover:opacity-100' 
                                      : 'hover:bg-white/[0.025]'
                                  }`}
                                  title={!isLivret ? "Cliquer pour ouvrir la fiche valeur complète" : undefined}
                                >
                                  <td className="py-3 pr-3">
                                    <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                                      {isLivret && <PiggyBank className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                                      <span className={!isLivret ? "group-hover:text-blue-400 transition-colors" : ""}>
                                        {h.name || h.symbol}
                                      </span>
                                      {isLivret && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                          Épargne
                                        </span>
                                      )}
                                      {isClosed && (
                                        <span className="text-[9px] px-1.5 py-0.2 bg-white/[0.05] text-slate-400 border border-white/[0.08] rounded font-mono font-medium">
                                          SOLDÉ
                                        </span>
                                      )}
                                      {h.is_manual && !isLivret && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-medium">
                                          {accType === 'pee' ? 'PEE' : accType === 'pero' ? 'PERO' : 'Manuel'}
                                        </span>
                                      )}
                                    </div>
                                    {!isLivret && (
                                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                        {h.symbol}
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                                    {isLivret ? '—' : h.quantity}
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                                    {isLivret ? '1,00 €' : formatEUR(h.unit_cost_eur)}
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono text-white">
                                    {isLivret ? (
                                      <span className="text-emerald-400">1,00 €</span>
                                    ) : isClosed ? (
                                      <span className="text-slate-500 text-[11px]">Soldé</span>
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

                                  <td className="py-3 px-3 text-right font-mono">
                                    {isLivret ? (
                                      <span className="text-slate-400 text-[11px]">Garanti</span>
                                    ) : isClosed ? (
                                      <span className="text-slate-500 text-[11px]">—</span>
                                    ) : (
                                      <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-semibold ${
                                        isDayPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                      }`}>
                                        {isDayPositive ? `+${h.change_day_percent}%` : `${h.change_day_percent}%`}
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono font-bold text-white tabular-nums">
                                    {formatEUR(h.total_value_eur)}
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono">
                                    {isLivret ? (
                                      <span className="text-slate-400">Sans risque</span>
                                    ) : isClosed ? (
                                      <span className="text-slate-500 text-[11px]">—</span>
                                    ) : (
                                      <>
                                        <div className={`font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {isPositive ? `+${formatEUR(h.gain_eur)}` : formatEUR(h.gain_eur)}
                                        </div>
                                        <div className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                          {isPositive ? `+${h.gain_percent}%` : `${h.gain_percent}%`}
                                        </div>
                                      </>
                                    )}
                                  </td>

                                  <td className="py-3 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => setEditingHolding(h)}
                                        className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-white/[0.05] transition-colors"
                                        title="Modifier la position ou recalculer le PRU"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => onDeleteHolding(h.id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/[0.05] transition-colors"
                                        title="Supprimer la position"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Barre bascule pour les positions soldées */}
                    {closedHoldings.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <button
                          onClick={() => setShowClosedAccounts(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 border border-white/[0.08] transition-all btn-haptic self-start"
                        >
                          {isClosedVisible ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                              <span>Masquer les {closedHoldings.length} position{closedHoldings.length > 1 ? 's' : ''} soldée{closedHoldings.length > 1 ? 's' : ''}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-blue-400" />
                              <span>Afficher les {closedHoldings.length} position{closedHoldings.length > 1 ? 's' : ''} soldée{closedHoldings.length > 1 ? 's' : ''}</span>
                            </>
                          )}
                        </button>
                        <span className="text-[11px] text-slate-500 font-mono">
                          💡 Cliquez sur une ligne pour ouvrir sa fiche valeur & ordres
                        </span>
                      </div>
                    )}

                    <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-mono text-[11px]">Compte #{acc.id}</span>
                      <button
                        onClick={() => onDeleteAccount(acc.id)}
                        className="text-rose-400/80 hover:text-rose-400 transition-colors flex items-center gap-1 text-[11px]"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer le compte</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <EditHoldingModal
        isOpen={!!editingHolding}
        holding={editingHolding}
        onClose={() => setEditingHolding(null)}
        onHoldingUpdated={() => {
          if (onHoldingUpdated) onHoldingUpdated();
        }}
      />

      <AssetDetailModal
        isOpen={!!selectedHoldingId}
        holdingId={selectedHoldingId}
        onClose={() => setSelectedHoldingId(null)}
        onOpenAddTransaction={onOpenAddTransaction}
      />
    </div>
  );
}
