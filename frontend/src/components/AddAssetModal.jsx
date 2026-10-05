import React, { useState, useEffect } from 'react';
import { X, Search, PiggyBank, TrendingUp, Building2, Check, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

const QUICK_SAVINGS_NAMES = [
  "Livret A",
  "LDDS (Développement Solidaire)",
  "LEP (Épargne Populaire)",
  "Compte sur Livret BNP",
  "Compte Courant",
  "Coffre Épargne Revolut"
];

export default function AddAssetModal({ isOpen, onClose, accounts = [], initialAccount, onAssetAdded }) {
  // Mode d'ajout : 'savings' (livret/cash), 'market' (bourse/crypto), 'pee' (épargne entreprise)
  const [activeTab, setActiveTab] = useState('savings');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Formulaire Épargne / Livrets
  const [savingsName, setSavingsName] = useState('Livret A');
  const [savingsAmount, setSavingsAmount] = useState('');

  // Formulaire Bourse & Crypto
  const [symbolQuery, setSymbolQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [symbol, setSymbol] = useState('');
  const [marketName, setMarketName] = useState('');
  const [assetClass, setAssetClass] = useState('etf');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [currency, setCurrency] = useState('EUR');

  // Formulaire PEE
  const [peeName, setPeeName] = useState('BNP Actions Monde PEE');
  const [peeParts, setPeeParts] = useState('');
  const [peeUnitCost, setPeeUnitCost] = useState('');
  const [peeCurrentPrice, setPeeCurrentPrice] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Adapter l'onglet par défaut au compte sélectionné
  useEffect(() => {
    if (initialAccount) {
      setSelectedAccountId(initialAccount.id.toString());
      if (initialAccount.account_type === 'savings' || initialAccount.institution.includes('BNP')) {
        setActiveTab('savings');
      } else if (initialAccount.account_type === 'pee') {
        setActiveTab('pee');
      } else {
        setActiveTab('market');
      }
    } else if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id.toString());
    }
  }, [initialAccount, accounts]);

  // Recherche de symboles boursiers
  useEffect(() => {
    if (activeTab !== 'market' || !symbolQuery || symbolQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.searchMarket(symbolQuery);
        setSearchResults(res);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [symbolQuery, activeTab]);

  if (!isOpen) return null;

  const handleSelectSearchResult = (res) => {
    setSymbol(res.symbol);
    setMarketName(res.name);
    setAssetClass(res.asset_class || 'stock');
    if (res.price) {
      if (!unitCost) setUnitCost(res.price.toString());
    }
    if (res.currency) setCurrency(res.currency);
    setSearchResults([]);
    setSymbolQuery('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedAccountId) {
      setErrorMsg('Veuillez sélectionner un compte');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'savings') {
        // --- Cas Livret / Épargne ---
        const amount = parseFloat(savingsAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Veuillez saisir un montant valide (> 0 €)');
        }

        await api.createHolding({
          account_id: parseInt(selectedAccountId),
          symbol: savingsName.toUpperCase().replace(/\s+/g, '-'),
          name: savingsName,
          asset_class: 'savings',
          quantity: amount,
          unit_cost: 1.0,
          current_price: 1.0,
          currency: 'EUR',
          is_manual: true
        });

      } else if (activeTab === 'market') {
        // --- Cas Bourse / Crypto ---
        if (!symbol) throw new Error('Veuillez renseigner un symbole ou ticker (ex: CW8.PA)');
        const qty = parseFloat(quantity);
        const cost = parseFloat(unitCost);
        if (isNaN(qty) || qty <= 0) throw new Error('Quantité invalide');
        if (isNaN(cost) || cost < 0) throw new Error('PRU (Prix d\'achat unitaire) invalide');

        await api.createHolding({
          account_id: parseInt(selectedAccountId),
          symbol: symbol.toUpperCase(),
          name: marketName || symbol,
          asset_class: assetClass,
          quantity: qty,
          unit_cost: cost,
          currency: currency.toUpperCase(),
          is_manual: false
        });

      } else if (activeTab === 'pee') {
        // --- Cas PEE Entreprise ---
        const parts = parseFloat(peeParts);
        const cost = parseFloat(peeUnitCost);
        const curPrice = parseFloat(peeCurrentPrice) || cost;
        if (isNaN(parts) || parts <= 0) throw new Error('Nombre de parts invalide');
        if (isNaN(cost) || cost < 0) throw new Error('Prix de revient unitaire invalide');

        await api.createHolding({
          account_id: parseInt(selectedAccountId),
          symbol: peeName.toUpperCase().replace(/\s+/g, '-'),
          name: peeName,
          asset_class: 'fund',
          quantity: parts,
          unit_cost: cost,
          current_price: curPrice,
          currency: 'EUR',
          is_manual: true,
          notes: 'Fonds PEE Entreprise'
        });
      }

      onAssetAdded();
      onClose();
      // Reset
      setSavingsAmount('');
      setQuantity('');
      setUnitCost('');
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121824] border border-[#222E42] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1C2536]">
          <div>
            <h3 className="text-sm font-semibold text-white">Ajouter à mon patrimoine</h3>
            <p className="text-xs text-slate-400 mt-0.5">Livret d'épargne, investissement boursier ou PEE</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#172030] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Choix du mode par onglets */}
        <div className="grid grid-cols-3 p-1.5 bg-[#0B0F17] border-b border-[#1C2536] gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('savings')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'savings'
                ? 'bg-[#1C263A] text-emerald-400 border border-[#2D3D58] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Livrets & Épargne</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'market'
                ? 'bg-[#1C263A] text-blue-400 border border-[#2D3D58] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Bourse & Crypto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pee')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'pee'
                ? 'bg-[#1C263A] text-amber-400 border border-[#2D3D58] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>PEE Entreprise</span>
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Sélection du compte */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Compte de destination
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-[#1C2536] rounded-md text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.institution})
                </option>
              ))}
            </select>
          </div>

          {/* ================= ONGLET 1 : LIVRETS & EPARGNE ================= */}
          {activeTab === 'savings' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                Idéal pour votre <strong>Livret A, LDDS, LEP ou compte épargne BNP</strong>. Vous saisissez simplement le montant déposé en euros !
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nom du support d'épargne
                </label>
                <input
                  type="text"
                  value={savingsName}
                  onChange={(e) => setSavingsName(e.target.value)}
                  placeholder="Ex: Livret A BNP, LDDS..."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Raccourcis rapides */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5">Suggestions rapides :</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SAVINGS_NAMES.map((qName, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSavingsName(qName)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        savingsName === qName
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {qName}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Montant total sur ce livret (€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 12500"
                    value={savingsAmount}
                    onChange={(e) => setSavingsAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-base text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    required
                    autoFocus
                  />
                  <span className="absolute right-4 top-3 text-slate-400 font-bold">€ EUR</span>
                </div>
              </div>
            </div>
          )}

          {/* ================= ONGLET 2 : BOURSE & CRYPTO ================= */}
          {activeTab === 'market' && (
            <div className="space-y-4">
              {/* Recherche assistée */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Rechercher un Ticker en direct
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tapez CW8, AAPL, BTC-EUR, TotalEnergies..."
                    value={symbolQuery}
                    onChange={(e) => setSymbolQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSearchResult(res)}
                        className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-800/60 last:border-0"
                      >
                        <div>
                          <div className="font-semibold text-white text-xs">{res.symbol}</div>
                          <div className="text-[11px] text-slate-400">{res.name}</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase font-medium">
                          {res.asset_class}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ticker & Nom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Symbole exact
                  </label>
                  <input
                    type="text"
                    placeholder="CW8.PA"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Type
                  </label>
                  <select
                    value={assetClass}
                    onChange={(e) => setAssetClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="etf">ETF / Tracker</option>
                    <option value="stock">Action</option>
                    <option value="crypto">Cryptomonnaie</option>
                  </select>
                </div>
              </div>

              {/* Quantité & PRU */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Quantité
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 10 ou 0.05"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    PRU (Prix unitaire €)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 500.00"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= ONGLET 3 : PEE ENTREPRISE ================= */}
          {activeTab === 'pee' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                Les fonds PEE (BNP Épargne Entreprise) sont valorisés manuellement selon vos relevés de compte entreprise.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nom du fonds PEE (FCPE)
                </label>
                <input
                  type="text"
                  value={peeName}
                  onChange={(e) => setPeeName(e.target.value)}
                  placeholder="Ex: BNP Paribas Actions Monde PEE"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nombre de parts
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 45.2"
                    value={peeParts}
                    onChange={(e) => setPeeParts(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Prix de revient / part (€)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 80.00"
                    value={peeUnitCost}
                    onChange={(e) => setPeeUnitCost(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Valeur liquidative actuelle (€/part)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Ex: 92.50"
                  value={peeCurrentPrice}
                  onChange={(e) => setPeeCurrentPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
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
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-semibold shadow-lg transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                activeTab === 'savings'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : activeTab === 'pee'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              {isSubmitting ? 'Enregistrement...' : 'Ajouter au portefeuille'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
