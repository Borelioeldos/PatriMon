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
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

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

      // Si l'actif est manuel ou sans cotation automatique, on peut aussi forcer le cours actuel
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
      <div className="bg-[#111827] border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Modifier la position</h2>
              <p className="text-xs text-slate-400">
                {holding.name || holding.symbol} {holding.symbol ? `(${holding.symbol})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}>
            {feedback.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Quantité */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Quantité détenue
              </label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Devise */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Devise de cotation
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF (₣)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* PRU (Prix de Revient Unitaire) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                PRU Unitaire ({currency})
              </label>
              <input
                type="number"
                step="any"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Frais d'achat inclus
              </span>
            </div>

            {/* Cours Actuel (pour actifs manuels / PEE) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cours Actuel ({currency})
              </label>
              <input
                type="number"
                step="any"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="Laisser vide si coté auto"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {holding.is_manual ? "Valeur liquidative manuelle" : "Automatique via Yahoo Finance"}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Notes / Commentaire
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Parts PEE abondées, DCA mensuel..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Bloc Recalcul automatique */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Calculator className="w-3.5 h-3.5 text-blue-400" />
                <span>Recalcul depuis les transactions</span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Recalcule la quantité et le PRU pondéré à partir de l'historique complet de vos achats/ventes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRecalculatePru}
              disabled={isRecalculating}
              className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 flex-shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? "Calcul..." : "Recalculer"}</span>
            </button>
          </div>

          {/* Boutons d'action */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
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
