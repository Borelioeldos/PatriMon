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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[#0C111C] border border-slate-200/90 dark:border-white/[0.1] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between bg-slate-50/70 dark:bg-[#080D18]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Edit3 className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Modifier la position</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {holding.name || holding.symbol} {holding.symbol ? `(${holding.symbol})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`mx-5 mt-3.5 p-2.5 rounded-xl flex items-center gap-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
          }`}>
            {feedback.type === 'success' ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Quantité */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Quantité détenue
              </label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#06090F] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono tabular-nums transition-colors"
              />
            </div>

            {/* Devise */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Devise de cotation
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#06090F] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                PRU unitaire ({currency})
              </label>
              <input
                type="number"
                step="any"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#06090F] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono tabular-nums transition-colors"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                Frais d'achat inclus
              </span>
            </div>

            {/* Cours Actuel */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Cours actuel ({currency})
              </label>
              <input
                type="number"
                step="any"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="Laisser vide si coté auto"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#06090F] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono tabular-nums transition-colors"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                {holding.is_manual ? "Valeur liquidative manuelle" : "Automatique via marché"}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes / Commentaire
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Parts PEE abondées, DCA mensuel..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#06090F] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Bloc Recalcul automatique */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#06090F] border border-slate-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Recalculer depuis les transactions</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Rejoue l'historique pour actualiser le PRU pondéré et la quantité exacte.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRecalculatePru}
              disabled={isRecalculating}
              className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/25 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 flex-shrink-0 disabled:opacity-50 btn-haptic"
            >
              <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? "Calcul..." : "Recalculer"}</span>
            </button>
          </div>

          {/* Boutons d'action */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/80 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 btn-haptic"
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
