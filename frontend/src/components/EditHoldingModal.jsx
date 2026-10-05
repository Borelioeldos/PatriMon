import React, { useState, useEffect } from 'react';
import { X, Edit3, Calculator, Save, RefreshCw, AlertCircle, Check, Info } from 'lucide-react';
import { api } from '../services/api';
import { formatEUR, formatCurrency } from '../utils/format';

export default function EditHoldingModal({
  isOpen,
  onClose,
  holding,
  onHoldingUpdated
}) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (holding) {
      setQuantity(holding.quantity !== undefined && holding.quantity !== null ? holding.quantity.toString() : '0');
      setUnitCost(holding.unit_cost !== undefined && holding.unit_cost !== null ? holding.unit_cost.toString() : '0');
      setCurrentPrice(holding.current_price !== undefined && holding.current_price !== null ? holding.current_price.toString() : '');
      setCurrency(holding.currency || 'EUR');
      setNotes(holding.notes || '');
      setFeedback(null);
    }
  }, [holding, isOpen]);

  if (!isOpen || !holding) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload = {
        quantity: parseFloat(quantity) || 0,
        unit_cost: parseFloat(unitCost) || 0,
        currency: currency,
        notes: notes || null,
      };

      if (currentPrice !== '') {
        payload.current_price = parseFloat(currentPrice) || 0;
      }

      await api.updateHolding(holding.id, payload);
      setFeedback({ type: 'success', message: 'Position mise à jour avec succès !' });
      if (onHoldingUpdated) onHoldingUpdated();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || "Erreur lors de la mise à jour." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculatePru = async () => {
    setIsRecalculating(true);
    setFeedback(null);
    try {
      const res = await api.recalculateHolding(holding.id);
      setQuantity((res.quantity || 0).toString());
      setUnitCost((res.unit_cost || 0).toString());
      setFeedback({
        type: 'success',
        message: `Position recalculée : ${res.quantity} parts au PRU de ${formatCurrency(res.unit_cost, res.currency || 'EUR')}.`
      });
      if (onHoldingUpdated) onHoldingUpdated();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || "Erreur lors du recalcul de la position."
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121824] border border-[#222E42] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1C2536] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#172030] border border-[#222E42] flex items-center justify-center text-blue-400">
              <Edit3 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Modifier la position</h2>
              <p className="text-xs text-slate-400 font-mono">
                {holding.name || holding.symbol} {holding.symbol ? `(${holding.symbol})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#172030] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`mx-5 mt-3.5 p-2.5 rounded-lg flex items-center gap-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {feedback.type === 'success' ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            {/* Quantité */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Quantité détenue
              </label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500 font-mono tabular-nums"
              />
            </div>

            {/* Devise */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Devise de cotation
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF (₣)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* PRU (Prix de Revient Unitaire) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                PRU unitaire ({currency})
              </label>
              <input
                type="number"
                step="any"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500 font-mono tabular-nums"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Frais d'achat inclus
              </span>
            </div>

            {/* Cours Actuel */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Cours actuel ({currency})
              </label>
              <input
                type="number"
                step="any"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="Laisser vide si coté auto"
                className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500 font-mono tabular-nums"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {holding.is_manual ? "Valeur liquidative manuelle" : "Automatique via marché"}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Notes / Commentaire
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Parts PEE abondées, DCA mensuel..."
              className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Bloc Recalcul automatique */}
          <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#1C2536] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                <Calculator className="w-3.5 h-3.5 text-blue-400" />
                <span>Recalculer depuis les transactions</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Rejoue l'historique complet pour actualiser le PRU pondéré et la quantité.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRecalculatePru}
              disabled={isRecalculating}
              className="px-2.5 py-1 rounded-md bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-medium transition-all flex items-center justify-center gap-1 flex-shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? "Calcul..." : "Recalculer"}</span>
            </button>
          </div>

          {/* Boutons d'action */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#1C2536]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Enregistrement..." : "Enregistrer"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
