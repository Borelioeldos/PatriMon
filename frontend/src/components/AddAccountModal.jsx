import React, { useState } from 'react';
import { X, Wallet } from 'lucide-react';
import { api } from '../services/api';

const PRESET_COLORS = [
  '#2563EB', // BoursoBank Bleu
  '#0284C7', // Revolut Cyan
  '#059669', // BNP Vert
  '#D97706', // Épargne Ambre
  '#7C3AED', // PEE Violet
  '#DB2777', // Rose
  '#475569', // Ardoise
];

export default function AddAccountModal({ isOpen, onClose, onAccountAdded }) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('BoursoBank');
  const [accountType, setAccountType] = useState('pea');
  const [cashBalance, setCashBalance] = useState('0');
  const [currency, setCurrency] = useState('EUR');
  const [color, setColor] = useState('#2563EB');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleInstitutionChange = (inst) => {
    setInstitution(inst);
    if (inst === 'BoursoBank') {
      setColor('#2563EB');
      setAccountType('pea');
    } else if (inst === 'Revolut') {
      setColor('#0284C7');
      setAccountType('cto');
    } else if (inst === 'BNP Paribas') {
      setColor('#059669');
      setAccountType('savings');
    } else if (inst === 'BNP Épargne Entreprise') {
      setColor('#D97706');
      setAccountType('pee');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg("Veuillez indiquer un nom pour ce compte.");
      return;
    }

    const cash = parseFloat(cashBalance);
    if (isNaN(cash) || cash < 0) {
      setErrorMsg("Le solde d'espèces doit être un nombre positif.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createAccount({
        name: name.trim(),
        institution,
        account_type: accountType,
        cash_balance: cash,
        currency,
        color,
        notes: notes.trim() || null,
      });

      onAccountAdded();
      onClose();
      // Reset
      setName('');
      setCashBalance('0');
      setNotes('');
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la création du compte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121824] border border-[#222E42] rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1C2536] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#172030] border border-[#222E42] flex items-center justify-center text-blue-400">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Nouveau compte / enveloppe</h3>
              <p className="text-xs text-slate-400">Banque, courtier ou support d'épargne</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#172030] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Établissement */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Établissement / Banque
            </label>
            <select
              value={institution}
              onChange={(e) => handleInstitutionChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500"
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
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Nom du compte
            </label>
            <input
              type="text"
              placeholder="Ex: BoursoBank PEA, Livret A BNP..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {/* Type d'enveloppe */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Solde espèces (€)
              </label>
              <input
                type="number"
                step="any"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500 font-mono tabular-nums"
                required
              />
            </div>
          </div>

          {/* Devise & Couleur */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Devise
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

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Pastille visuelle
              </label>
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      color === c ? 'scale-110 ring-2 ring-white/50' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
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
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Création..." : "Créer le compte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
