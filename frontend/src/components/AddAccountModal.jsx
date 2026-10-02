import React, { useState } from 'react';
import { X, Wallet } from 'lucide-react';
import { api } from '../services/api';

const PRESET_COLORS = [
  '#0066FF', // BoursoBank Bleu
  '#00D4FF', // Revolut Cyan
  '#00965E', // BNP Vert
  '#10B981', // Émeraude PEE
  '#8B5CF6', // Violet
  '#F59E0B', // Ambre
  '#EC4899', // Rose
  '#64748B', // Ardoise
];

export default function AddAccountModal({ isOpen, onClose, onAccountAdded }) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('BoursoBank');
  const [accountType, setAccountType] = useState('pea');
  const [cashBalance, setCashBalance] = useState('0');
  const [currency, setCurrency] = useState('EUR');
  const [color, setColor] = useState('#0066FF');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleInstitutionChange = (inst) => {
    setInstitution(inst);
    if (inst === 'BoursoBank') {
      setColor('#0066FF');
      setAccountType('pea');
    } else if (inst === 'Revolut') {
      setColor('#00D4FF');
      setAccountType('cto');
    } else if (inst === 'BNP Paribas') {
      setColor('#00965E');
      setAccountType('savings');
    } else if (inst === 'BNP Épargne Entreprise') {
      setColor('#10B981');
      setAccountType('pee');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Veuillez renseigner un nom de compte');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createAccount({
        name: name.trim(),
        institution,
        account_type: accountType,
        cash_balance: parseFloat(cashBalance) || 0.0,
        currency,
        color,
        notes: notes.trim() || null
      });

      onAccountAdded();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de la création du compte');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111827] border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nouveau Compte / Enveloppe</h3>
              <p className="text-xs text-slate-400">Ajouter une banque ou support d'épargne</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Établissement */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Établissement / Banque
            </label>
            <select
              value={institution}
              onChange={(e) => handleInstitutionChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="BoursoBank">BoursoBank</option>
              <option value="Revolut">Revolut</option>
              <option value="BNP Paribas">BNP Paribas</option>
              <option value="BNP Épargne Entreprise">BNP Épargne Entreprise (PEE)</option>
              <option value="Autre">Autre établissement</option>
            </select>
          </div>

          {/* Nom du compte */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Nom du compte
            </label>
            <input
              type="text"
              placeholder="Ex: BoursoBank PEA, Livret A BNP..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {/* Type d'enveloppe */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="pea">PEA</option>
                <option value="cto">Compte-Titres (CTO)</option>
                <option value="savings">Épargne / Livret</option>
                <option value="checking">Compte Courant</option>
                <option value="crypto">Portefeuille Crypto</option>
                <option value="pee">PEE Entreprise</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Solde espèces (€)
              </label>
              <input
                type="number"
                step="any"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Couleur visuelle
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
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
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Création...' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
