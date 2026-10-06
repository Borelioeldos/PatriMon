import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ShoppingCart, TrendingDown, ArrowDownLeft, ArrowUpRight, 
  DollarSign, Calendar, Sparkles, Tag, RefreshCw, Zap
} from 'lucide-react';
import { api } from '../services/api';

const DEFAULT_CATEGORIES = [
  "Alimentation & Courses",
  "Logement & Énergie",
  "Revenus & Salaires",
  "Investissement & Épargne",
  "Dividendes & Intérêts",
  "Abonnements & Médias",
  "Transports & Véhicule",
  "Santé & Bien-être",
  "Loisirs & Shopping",
  "Frais bancaires & Taxes",
  "Virement interne",
  "Autre"
];

const QUICK_PRESETS = [
  { label: "💼 Salaire", name: "Salaire Schneider Electric", type: "deposit", category: "Revenus & Salaires" },
  { label: "🛒 Courses", name: "Courses Carrefour Market", type: "withdrawal", category: "Alimentation & Courses" },
  { label: "⚡ Factures / EDF", name: "TotalEnergies Électricité", type: "withdrawal", category: "Logement & Énergie" },
  { label: "🎬 Abonnement", name: "Spotify / Netflix", type: "withdrawal", category: "Abonnements & Médias" },
  { label: "🚗 Transport", name: "SNCF / RATP", type: "withdrawal", category: "Transports & Véhicule" },
  { label: "📈 Virement Épargne", name: "Virement vers Livret A", type: "withdrawal", category: "Investissement & Épargne" },
];

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
  const [category, setCategory] = useState('Investissement & Épargne');
  const [categoriesList, setCategoriesList] = useState(DEFAULT_CATEGORIES);

  const getTodayLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [transactionDate, setTransactionDate] = useState(getTodayLocalDate());
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');
  
  const [autoUpdateHolding, setAutoUpdateHolding] = useState(true);
  const [autoUpdateCash, setAutoUpdateCash] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoEnriching, setIsAutoEnriching] = useState(false);
  const [autoEnrichFeedback, setAutoEnrichFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const tickerDebounceRef = useRef(null);

  // Charger les catégories au montage
  useEffect(() => {
    api.getTransactionCategories()
      .then(cats => {
        if (Array.isArray(cats) && cats.length > 0) setCategoriesList(cats);
      })
      .catch(() => {});
  }, []);

  // Fermeture par touche Échap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initialisation du compte
  useEffect(() => {
    if (initialAccount) {
      setSelectedAccountId(initialAccount.id.toString());
    } else if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id.toString());
    }
  }, [initialAccount, accounts]);

  // Adapter la catégorie par défaut selon le type
  useEffect(() => {
    if (type === 'buy' || type === 'sell') {
      setCategory('Investissement & Épargne');
    } else if (type === 'dividend') {
      setCategory('Dividendes & Intérêts');
    } else if (type === 'deposit' && category === 'Investissement & Épargne') {
      setCategory('Revenus & Salaires');
    } else if (type === 'withdrawal' && category === 'Investissement & Épargne') {
      setCategory('Alimentation & Courses');
    }
  }, [type]);

  const currentAccount = accounts.find(a => a.id.toString() === selectedAccountId);
  const availableHoldings = currentAccount?.holdings || [];

  // Auto-enrichissement intelligent via API
  const triggerAutoEnrich = async (currentSymbol, currentType, currentQty, currentAmt, currentPrice) => {
    if (!currentSymbol || currentSymbol.length < 2) return;
    setIsAutoEnriching(true);
    try {
      const enriched = await api.enrichTransaction({
        type: currentType,
        symbol: currentSymbol,
        quantity: parseFloat(currentQty) || null,
        amount: parseFloat(currentAmt) || null,
        unit_price: parseFloat(currentPrice) || null,
        fees: parseFloat(fees) || 0,
        currency: currency,
      });

      if (enriched.name && enriched.name !== currentSymbol) {
        setName(enriched.name);
      }
      if (enriched.unit_price && (!currentPrice || currentPrice === '0')) {
        setUnitPrice(enriched.unit_price.toString());
      }
      if (enriched.currency) {
        setCurrency(enriched.currency);
      }
      if (enriched.category) {
        setCategory(enriched.category);
      }
      if (enriched.amount && (!currentAmt || currentAmt === '0')) {
        setAmount(enriched.amount.toString());
      }
      if (enriched.notes && !notes) {
        setNotes(enriched.notes);
      }
      setAutoEnrichFeedback(`Cotation et libellé complétés automatiquement (${enriched.unit_price ? enriched.unit_price + ' ' + (enriched.currency || 'EUR') : ''})`);
    } catch (err) {
      console.debug("Erreur auto-enrichissement:", err);
    } finally {
      setIsAutoEnriching(false);
    }
  };

  const handleSymbolChange = (val) => {
    const clean = val.toUpperCase().trim();
    setSymbol(clean);
    setAutoEnrichFeedback('');

    if (tickerDebounceRef.current) clearTimeout(tickerDebounceRef.current);
    if (clean.length >= 2) {
      tickerDebounceRef.current = setTimeout(() => {
        triggerAutoEnrich(clean, type, quantity, amount, unitPrice);
      }, 600);
    }
  };

  const handleSelectHolding = (hId) => {
    setSelectedHoldingId(hId);
    if (!hId) return;
    const found = availableHoldings.find(h => h.id.toString() === hId);
    if (found) {
      setSymbol(found.symbol);
      setName(found.name || found.symbol);
      const pr = found.current_price || found.unit_cost;
      if (pr) {
        setUnitPrice(pr.toString());
        if (quantity) {
          const tot = (parseFloat(quantity) * pr) + (parseFloat(fees) || 0);
          setAmount(tot.toFixed(2));
        }
      }
      setCurrency(found.currency || 'EUR');
      setCategory(type === 'dividend' ? 'Dividendes & Intérêts' : 'Investissement & Épargne');
      setNotes(type === 'dividend' ? `Dividende perçu pour ${found.name}` : `Ordre sur ${found.symbol}`);
      setAutoEnrichFeedback(`Données de position complétées (${found.symbol})`);
    }
  };

  const handleQuantityChange = (val) => {
    setQuantity(val);
    const q = parseFloat(val);
    const p = parseFloat(unitPrice);
    const f = parseFloat(fees) || 0;
    if (!isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      const tot = (q * p) + (type === 'buy' ? f : -f);
      setAmount(Math.max(0, tot).toFixed(2));
    }
  };

  const handleUnitPriceChange = (val) => {
    setUnitPrice(val);
    const p = parseFloat(val);
    const q = parseFloat(quantity);
    const f = parseFloat(fees) || 0;
    if (!isNaN(p) && p > 0 && !isNaN(q) && q > 0) {
      const tot = (q * p) + (type === 'buy' ? f : -f);
      setAmount(Math.max(0, tot).toFixed(2));
    }
  };

  const handleAmountChange = (val) => {
    setAmount(val);
    const a = parseFloat(val);
    const p = parseFloat(unitPrice);
    const f = parseFloat(fees) || 0;
    if (['buy', 'sell'].includes(type) && !isNaN(a) && a > 0 && !isNaN(p) && p > 0 && (!quantity || quantity === '0')) {
      const net = type === 'buy' ? Math.max(0, a - f) : a + f;
      setQuantity((net / p).toFixed(4));
    }
  };

  const handleApplyPreset = (preset) => {
    setType(preset.type);
    setName(preset.name);
    setCategory(preset.category);
    setNotes(preset.name);
    setAutoEnrichFeedback(`Champs pré-remplis pour "${preset.label}"`);
  };

  if (!isOpen) return null;

  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(unitPrice) || 0;
  const feesNum = parseFloat(fees) || 0;
  const customAmountNum = parseFloat(amount) || 0;

  let computedTotal = 0;
  if (type === 'buy') {
    computedTotal = customAmountNum || ((qtyNum * priceNum) + feesNum);
  } else if (type === 'sell') {
    computedTotal = customAmountNum || Math.max(0, (qtyNum * priceNum) - feesNum);
  } else if (type === 'dividend') {
    computedTotal = customAmountNum || (qtyNum * priceNum);
  } else {
    computedTotal = customAmountNum;
  }

  const activeHolding = availableHoldings.find(h => h.id.toString() === selectedHoldingId);
  let estimatedNewPru = null;
  let estimatedGain = null;

  if (type === 'buy' && activeHolding && qtyNum > 0 && priceNum > 0) {
    const oldQty = activeHolding.quantity || 0;
    const oldCostEur = activeHolding.unit_cost_eur || 0;
    const newQty = oldQty + qtyNum;
    if (newQty > 0) {
      estimatedNewPru = ((oldQty * oldCostEur) + (qtyNum * priceNum) + feesNum) / newQty;
    }
  }

  if (type === 'sell' && activeHolding && qtyNum > 0 && priceNum > 0) {
    const oldCostEur = activeHolding.unit_cost_eur || 0;
    estimatedGain = ((priceNum - oldCostEur) * qtyNum) - feesNum;
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
        category: category || "Autre",
        notes: notes || null,
        auto_update_holding: autoUpdateHolding,
        auto_update_cash: autoUpdateCash,
      };

      await api.createTransaction(payload);
      onTransactionAdded();
      onClose();

      setQuantity('');
      setUnitPrice('');
      setAmount('');
      setFees('0');
      setNotes('');
      setName('');
      setSymbol('');
      setAutoEnrichFeedback('');
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement de l'opération");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#0C111C] border border-slate-200/90 dark:border-white/[0.1] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#080D18]/80">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Enregistrer une opération</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Enrichissement automatique des cotations, catégories et PRU
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              title="Fermer (Échap)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sélecteur de type d'opération */}
          <div className="grid grid-cols-5 p-1.5 bg-slate-100 dark:bg-[#060A14] border-b border-slate-200 dark:border-white/[0.06] gap-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setType('buy')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all btn-haptic ${
                type === 'buy'
                  ? 'bg-white dark:bg-[#1E293B] text-blue-700 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-[#2D3D58]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Achat</span>
            </button>

            <button
              type="button"
              onClick={() => setType('sell')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all btn-haptic ${
                type === 'sell'
                  ? 'bg-white dark:bg-[#1E293B] text-purple-700 dark:text-purple-400 shadow-sm border border-slate-200 dark:border-[#2D3D58]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Vente</span>
            </button>

            <button
              type="button"
              onClick={() => setType('deposit')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all btn-haptic ${
                type === 'deposit'
                  ? 'bg-white dark:bg-[#1E293B] text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-[#2D3D58]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Dépôt</span>
            </button>

            <button
              type="button"
              onClick={() => setType('withdrawal')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all btn-haptic ${
                type === 'withdrawal'
                  ? 'bg-white dark:bg-[#1E293B] text-rose-700 dark:text-rose-400 shadow-sm border border-slate-200 dark:border-[#2D3D58]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Retrait</span>
            </button>

            <button
              type="button"
              onClick={() => setType('dividend')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all btn-haptic ${
                type === 'dividend'
                  ? 'bg-white dark:bg-[#1E293B] text-amber-700 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-[#2D3D58]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Dividende</span>
            </button>
          </div>

          {/* Feedback d'auto-remplissage en direct */}
          {autoEnrichFeedback && (
            <div className="px-5 py-2 bg-blue-500/10 border-b border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                {autoEnrichFeedback}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Auto-rempli</span>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Raccourcis rapides pour Dépôt / Retrait */}
            {['deposit', 'withdrawal'].includes(type) && (
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Remplissage rapide en 1 clic :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-[11px] font-medium transition-all border border-slate-200 dark:border-slate-700/60 btn-haptic"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1. Compte & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                  Compte concerné
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    setSelectedHoldingId('');
                  }}
                  className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none transition-colors"
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
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Date de l'opération
                </label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none font-mono transition-colors"
                  required
                />
              </div>
            </div>

            {/* 2. Champs spécifiques selon type d'opération */}

            {/* Cas ACHAT ou VENTE */}
            {['buy', 'sell'].includes(type) && (
              <div className="space-y-3 p-4 rounded-2xl surface-subtle">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Sélectionner un titre existant
                    </label>
                    <select
                      value={selectedHoldingId}
                      onChange={(e) => handleSelectHolding(e.target.value)}
                      className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none transition-colors"
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
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                      <span>Symbole / Ticker</span>
                      {isAutoEnriching && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-mono">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Recherche...
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: CW8.PA, AAPL, BTC-EUR..."
                      value={symbol}
                      onChange={(e) => handleSymbolChange(e.target.value)}
                      className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none font-mono uppercase transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Nom du titre (auto-rempli) */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                    <span>Nom du titre ou actif</span>
                    <span className="text-[10px] text-slate-400 font-mono">Auto-complété</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Amundi MSCI World UCITS ETF"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none transition-colors"
                  />
                </div>

                {/* Quantité, Prix unitaire & Frais */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Quantité
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ex: 5"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none font-mono tabular-nums transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                      <span>Prix ({currency})</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ex: 495.50"
                      value={unitPrice}
                      onChange={(e) => handleUnitPriceChange(e.target.value)}
                      className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none font-mono tabular-nums transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Frais (€)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ex: 1.99"
                      value={fees}
                      onChange={(e) => setFees(e.target.value)}
                      className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none font-mono tabular-nums transition-colors"
                    />
                  </div>
                </div>

                {/* Montant total (auto-calculé) */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                    <span>Montant total de l'opération (€)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Calculé automatiquement</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Calculé automatiquement"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none font-mono font-bold tabular-nums transition-colors"
                  />
                </div>

                {/* Simulations et previews automatiques */}
                {estimatedNewPru !== null && (
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 flex items-center justify-between font-mono">
                    <span>PRU actuel : <strong>{activeHolding?.unit_cost_eur?.toFixed(2)} €</strong></span>
                    <span>Nouveau PRU pondéré : <strong>{estimatedNewPru.toFixed(2)} €</strong></span>
                  </div>
                )}

                {estimatedGain !== null && (
                  <div className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between font-mono ${
                    estimatedGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
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
              <div className="p-4 rounded-2xl surface-subtle space-y-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                    Intitulé / Bénéficiaire
                  </label>
                  <input
                    type="text"
                    placeholder={type === 'deposit' ? "Ex: Salaire Schneider Electric, Virement reçu..." : "Ex: Carrefour Market, TotalEnergies, Loyer..."}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!notes) setNotes(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 input-field border rounded-xl text-sm focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                    {type === 'deposit' ? 'Montant versé (€)' : 'Montant retiré (€)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="Ex: 500.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 input-field border rounded-xl text-base font-mono font-bold tabular-nums focus:outline-none"
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
              <div className="p-4 rounded-2xl surface-subtle space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Titre versant le dividende
                    </label>
                    <select
                      value={selectedHoldingId}
                      onChange={(e) => handleSelectHolding(e.target.value)}
                      className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none transition-colors"
                    >
                      <option value="">-- Sélectionner --</option>
                      {availableHoldings.map(h => (
                        <option key={h.id} value={h.id}>{h.symbol} - {h.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Montant net perçu (€)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ex: 45.20"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 input-field border rounded-xl text-xs font-mono font-bold tabular-nums focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Catégorie & Commentaires */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none transition-colors"
                >
                  {categoriesList.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                  Commentaire / Référence
                </label>
                <input
                  type="text"
                  placeholder="Ex: Versement programmé, renforcement..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 input-field border rounded-xl text-xs focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Options de synchronisation automatique */}
            <div className="pt-2 space-y-2 border-t border-slate-200 dark:border-white/[0.06]">
              {['buy', 'sell'].includes(type) && (
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={autoUpdateHolding}
                    onChange={(e) => setAutoUpdateHolding(e.target.checked)}
                    className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>Mettre à jour automatiquement la position et le PRU pondéré</span>
                </label>
              )}

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={autoUpdateCash}
                  onChange={(e) => setAutoUpdateCash(e.target.checked)}
                  className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>
                  {type === 'buy' ? 'Débiter automatiquement le solde espèces du compte' : 'Ajuster automatiquement le solde espèces du compte'}
                </span>
              </label>
            </div>

            {/* Résumé du montant total de l'opération */}
            <div className="p-3.5 rounded-2xl surface-subtle flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">Impact financier net :</span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {computedTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all btn-haptic disabled:opacity-50"
              >
                {isSubmitting ? 'Enregistrement...' : 'Valider l\'opération'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
