import React, { useState, useEffect } from 'react';
import { 
  X, ShoppingCart, TrendingDown, ArrowDownLeft, ArrowUpRight, 
  DollarSign, Check, Calendar, HelpCircle, Layers, Sparkles 
} from 'lucide-react';
import { api } from '../services/api';

export default function AddTransactionModal({ 
  isOpen, 
  onClose, 
  accounts = [], 
  initialAccount = null, 
  onTransactionAdded 
}) {
  const [type, setType] = useState('buy'); // buy, sell, deposit, withdrawal, dividend
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedHoldingId, setSelectedHoldingId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('0');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');
  
  const [autoUpdateHolding, setAutoUpdateHolding] = useState(true);
  const [autoUpdateCash, setAutoUpdateCash] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initialisation du compte
  useEffect(() => {
    if (initialAccount) {
      setSelectedAccountId(initialAccount.id.toString());
    } else if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id.toString());
    }
  }, [initialAccount, accounts]);

  const currentAccount = accounts.find(a => a.id.toString() === selectedAccountId);
  const availableHoldings = currentAccount?.holdings || [];

  // Quand on choisit un holding existant
  const handleSelectHolding = (hId) => {
    setSelectedHoldingId(hId);
    if (!hId) return;
    const found = availableHoldings.find(h => h.id.toString() === hId);
    if (found) {
      setSymbol(found.symbol);
      setName(found.name || found.symbol);
      if (found.current_price) {
        setUnitPrice(found.current_price.toString());
      } else if (found.unit_cost) {
        setUnitPrice(found.unit_cost.toString());
      }
      setCurrency(found.currency || 'EUR');
    }
  };

  if (!isOpen) return null;

  // Calcul du montant total estimé
  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(unitPrice) || 0;
  const feesNum = parseFloat(fees) || 0;
  const customAmountNum = parseFloat(amount) || 0;

  let computedTotal = 0;
  if (type === 'buy') {
    computedTotal = (qtyNum * priceNum) + feesNum;
  } else if (type === 'sell') {
    computedTotal = Math.max(0, (qtyNum * priceNum) - feesNum);
  } else if (type === 'dividend') {
    computedTotal = customAmountNum || (qtyNum * priceNum);
  } else {
    computedTotal = customAmountNum;
  }

  // Calcul du nouveau PRU estimé pour un achat
  const activeHolding = availableHoldings.find(h => h.id.toString() === selectedHoldingId);
  let estimatedNewPru = null;
  if (type === 'buy' && activeHolding && qtyNum > 0 && priceNum > 0) {
    const oldQty = activeHolding.quantity || 0;
    const oldCost = activeHolding.unit_cost_eur || 0;
    const newQty = oldQty + qtyNum;
    if (newQty > 0) {
      estimatedNewPru = ((oldQty * oldCost) + (qtyNum * priceNum) + feesNum) / newQty;
    }
  }

  // Plus-value estimée sur vente
  let estimatedGain = null;
  if (type === 'sell' && activeHolding && qtyNum > 0 && priceNum > 0) {
    const pru = activeHolding.unit_cost_eur || 0;
    estimatedGain = ((priceNum - pru) * qtyNum) - feesNum;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedAccountId) {
      setErrorMsg("Veuillez sélectionner un compte.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        account_id: parseInt(selectedAccountId),
        holding_id: selectedHoldingId ? parseInt(selectedHoldingId) : null,
        type: type,
        transaction_date: transactionDate,
        symbol: symbol.toUpperCase() || null,
        name: name || null,
        quantity: ['buy', 'sell'].includes(type) ? qtyNum : (quantity ? qtyNum : null),
        unit_price: ['buy', 'sell'].includes(type) ? priceNum : (unitPrice ? priceNum : null),
        amount: computedTotal,
        fees: feesNum,
        currency: currency.toUpperCase(),
        notes: notes || null,
        auto_update_holding: autoUpdateHolding,
        auto_update_cash: autoUpdateCash,
      };

      await api.createTransaction(payload);
      onTransactionAdded();
      onClose();

      // Reset
      setQuantity('');
      setUnitPrice('');
      setAmount('');
      setFees('0');
      setNotes('');
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement de l'opération");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111827] border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Enregistrer une Opération
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Achats, ventes, versements, retraits ou dividendes avec recalcul automatique du PRU
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sélecteur de type d'opération */}
        <div className="grid grid-cols-5 p-2 bg-slate-900/90 border-b border-slate-800 gap-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setType('buy')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all ${
              type === 'buy'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Achat</span>
          </button>

          <button
            type="button"
            onClick={() => setType('sell')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all ${
              type === 'sell'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Vente</span>
          </button>

          <button
            type="button"
            onClick={() => setType('deposit')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all ${
              type === 'deposit'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Dépôt</span>
          </button>

          <button
            type="button"
            onClick={() => setType('withdrawal')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all ${
              type === 'withdrawal'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Retrait</span>
          </button>

          <button
            type="button"
            onClick={() => setType('dividend')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all ${
              type === 'dividend'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Dividende</span>
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* 1. Compte & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                Compte concerné
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setSelectedHoldingId('');
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                required
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.institution}) — Solde: {acc.cash_balance} €
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Date de l'opération
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
          </div>

          {/* 2. Champs spécifiques selon type d'opération */}

          {/* Cas ACHAT ou VENTE */}
          {['buy', 'sell'].includes(type) && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Sélectionner un titre existant
                  </label>
                  <select
                    value={selectedHoldingId}
                    onChange={(e) => handleSelectHolding(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Autre ou Nouveau Ticker --</option>
                    {availableHoldings.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.symbol} - {h.name} (Qté : {h.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Symbole / Ticker (ex: CW8.PA)
                  </label>
                  <input
                    type="text"
                    placeholder="CW8.PA, AAPL..."
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono uppercase"
                    required
                  />
                </div>
              </div>

              {/* Quantité & Prix unitaire */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 5"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Prix unitaire (€)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 495.50"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Frais d'ordre (€)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 1.99"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Simulations et previews automatiques */}
              {estimatedNewPru !== null && (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center justify-between">
                  <span>PRU actuel : <strong>{activeHolding?.unit_cost_eur?.toFixed(2)} €</strong></span>
                  <span>Nouveau PRU pondéré estimé : <strong className="text-white">{estimatedNewPru.toFixed(2)} €</strong></span>
                </div>
              )}

              {estimatedGain !== null && (
                <div className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${
                  estimatedGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                  <span>Plus-value réalisée estimée :</span>
                  <strong className="text-sm font-bold">
                    {estimatedGain >= 0 ? `+${estimatedGain.toFixed(2)} €` : `${estimatedGain.toFixed(2)} €`}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Cas VERSEMENT ou RETRAIT */}
          {['deposit', 'withdrawal'].includes(type) && (
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {type === 'deposit' ? 'Montant versé (€)' : 'Montant retiré (€)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 500.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-base text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    required
                    autoFocus
                  />
                  <span className="absolute right-3.5 top-2.5 text-slate-400 font-bold">EUR €</span>
                </div>
              </div>
            </div>
          )}

          {/* Cas DIVIDENDE */}
          {type === 'dividend' && (
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Titre versant le dividende
                  </label>
                  <select
                    value={selectedHoldingId}
                    onChange={(e) => handleSelectHolding(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Sélectionner --</option>
                    {availableHoldings.map(h => (
                      <option key={h.id} value={h.id}>{h.symbol} - {h.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Montant net perçu (€)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 45.20"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes optionnelles */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Commentaire / Référence (optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex: Versement mensuel programmé, renforcement PEA..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Options de synchronisation automatique */}
          <div className="pt-2 space-y-2 border-t border-slate-800">
            {['buy', 'sell'].includes(type) && (
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoUpdateHolding}
                  onChange={(e) => setAutoUpdateHolding(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Mettre à jour automatiquement la position et le PRU pondéré</span>
              </label>
            )}

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoUpdateCash}
                onChange={(e) => setAutoUpdateCash(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>
                {type === 'buy' ? 'Débiter automatiquement le solde espèces du compte' : 'Ajuster automatiquement le solde espèces du compte'}
              </span>
            </label>
          </div>

          {/* Résumé du montant total de l'opération */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-medium">Impact financier net :</span>
            <span className="text-base font-extrabold text-white">
              {computedTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement...' : 'Valider l\'opération'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
