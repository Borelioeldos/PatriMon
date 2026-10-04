import React from 'react';
import { RefreshCw, PlusCircle, Wallet, TrendingUp, Radio, ArrowLeftRight, Landmark, Building2, Cloud } from 'lucide-react';

export default function Navbar({ 
  onRefresh, 
  isRefreshing, 
  onOpenAddAsset, 
  onOpenAddAccount, 
  onOpenAddTransaction,
  onOpenBankSync,
  onOpenPeeImport,
  onOpenDriveSync,
  lastUpdated,
  autoRefresh,
  onToggleAutoRefresh,
  countdown
}) {
  return (
    <header className="sticky top-0 z-40 bg-[#0A0F1D]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Titre */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                PatriMon
              </span>
              
              {/* Badge Marché Temps Réel */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>LIVE DIRECT</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              {lastUpdated && (
                <span>Cotations : {lastUpdated}</span>
              )}
              {autoRefresh && (
                <span className="hidden sm:inline text-blue-400 font-medium">
                  • Rafraîchissement auto dans {countdown}s
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Toggle Auto-refresh */}
          <button
            onClick={onToggleAutoRefresh}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              autoRefresh 
                ? 'bg-blue-600/15 border-blue-500/40 text-blue-400' 
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="Activer/désactiver l'actualisation automatique toutes les 30s"
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-blue-400' : ''}`} />
            <span>Auto (30s)</span>
          </button>

          {/* Bouton Actualiser */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Rafraîchir immédiatement les cours boursiers et devises"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden md:inline">{isRefreshing ? 'Actualisation...' : 'Actualiser'}</span>
          </button>

          {/* Bouton Synchronisation Bancaire DSP2 */}
          <button
            onClick={onOpenBankSync}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 text-xs sm:text-sm font-semibold transition-all active:scale-95"
            title="Synchronisation bancaire automatique DSP2 (BoursoBank, BNP Paribas, Revolut...)"
          >
            <Landmark className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Banques DSP2</span>
          </button>

          {/* Bouton Import Relevé BNP PEE / PERO */}
          <button
            onClick={onOpenPeeImport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 text-xs sm:text-sm font-semibold transition-all active:scale-95"
            title="Importer un relevé de situation officiel BNP Épargne Entreprise (PDF / CSV)"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Relevé PEE</span>
          </button>

          {/* Bouton Google Drive Bourse */}
          <button
            onClick={onOpenDriveSync}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs sm:text-sm font-semibold transition-all active:scale-95"
            title="Synchroniser vos comptes boursiers (PEA, CTO, Crypto, PEE) depuis votre Google Drive"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Google Drive</span>
          </button>

          {/* Bouton Nouveau Compte */}
          <button
            onClick={onOpenAddAccount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 text-xs sm:text-sm font-semibold transition-all active:scale-95"
            title="Créer un nouveau compte ou livret"
          >
            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">+ Compte</span>
          </button>

          {/* Bouton Nouvelle Transaction / Opération */}
          <button
            onClick={onOpenAddTransaction}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 text-xs sm:text-sm font-semibold transition-all active:scale-95"
            title="Enregistrer un achat, une vente, un versement ou un dividende"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">+ Opération</span>
          </button>

          {/* Bouton Ajouter Actif / Livret */}
          <button
            onClick={onOpenAddAsset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-blue-600/30 active:scale-95 ring-1 ring-white/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Actif</span>
          </button>
        </div>
      </div>
    </header>
  );
}
