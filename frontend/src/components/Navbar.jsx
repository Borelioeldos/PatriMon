import React, { useState } from 'react';
import { 
  RefreshCw, Plus, Wallet, TrendingUp, Radio, 
  Landmark, Building2, Cloud, ChevronDown, Check,
  SlidersHorizontal, ArrowLeftRight, Layers, Eye, EyeOff,
  Sparkles, ShieldCheck, Sun, Moon
} from 'lucide-react';

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
  countdown,
  activeView = 'overview',
  onSelectView,
  privacyMode = false,
  onTogglePrivacyMode,
  theme = 'dark',
  onToggleTheme
}) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const views = [
    { id: 'overview', label: "Vue d'ensemble" },
    { id: 'accounts', label: 'Comptes & Positions' },
    { id: 'analytics', label: 'Performance & Enveloppes' },
    { id: 'transactions', label: 'Journal des Opérations' },
  ];

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-2 transition-all">
      {/* Floating Island Navigation Enclosure */}
      <div className="max-w-7xl mx-auto bg-white/85 dark:bg-[#090E1A]/85 backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_10px_35px_-5px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_45px_-10px_rgba(0,0,0,0.7)] rounded-2xl px-3.5 sm:px-5 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors duration-200">
        
        {/* Brand identity (Épuré & Haute Précision) */}
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2.5 cursor-pointer group select-none" 
            onClick={() => onSelectView && onSelectView('overview')}
            title="Retour à la vue d'ensemble"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-[0_2px_12px_rgba(37,99,235,0.35)] group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-200 transition-colors">
                PatriMon
              </span>
            </div>
          </div>

          {/* Mobile view quick toggles */}
          <div className="flex md:hidden items-center gap-1.5">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-100/80 dark:bg-white/[0.03] text-amber-500 dark:text-amber-400 btn-haptic"
                title={theme === 'dark' ? "Mode clair" : "Mode sombre"}
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              </button>
            )}
            {onTogglePrivacyMode && (
              <button
                onClick={onTogglePrivacyMode}
                className={`p-2 rounded-xl border text-xs transition-all btn-haptic ${
                  privacyMode 
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-600 dark:text-purple-300' 
                    : 'bg-slate-100/80 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400'
                }`}
                title="Mode Confidentialité"
              >
                {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white btn-haptic"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onOpenAddTransaction}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold flex items-center gap-1 shadow-md btn-haptic"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ordre</span>
            </button>
          </div>
        </div>

        {/* Perspective navigation switcher (Pills with physical feel) */}
        {onSelectView && (
          <nav className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#060A14]/70 p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.05] overflow-x-auto no-scrollbar shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors">
            {views.map((v) => {
              const isActive = activeView === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onSelectView(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs tracking-tight whitespace-nowrap transition-all duration-200 ${
                    isActive 
                      ? 'bg-white dark:bg-gradient-to-b dark:from-[#1E293B] dark:to-[#121826] text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/[0.12] shadow-sm font-semibold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Desktop command bar & quick actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Toggle Theme (Mode Sombre / Mode Clair) */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.07] text-amber-500 dark:text-amber-400 transition-all btn-haptic flex items-center gap-1.5"
              title={theme === 'dark' ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden xl:inline">
                {theme === 'dark' ? 'Clair' : 'Sombre'}
              </span>
            </button>
          )}

          {/* Toggle Privacy Mode */}
          {onTogglePrivacyMode && (
            <button
              onClick={onTogglePrivacyMode}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all btn-haptic flex items-center gap-1.5 ${
                privacyMode 
                  ? 'bg-purple-500/15 border-purple-500/35 text-purple-700 dark:text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.15)]' 
                  : 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200/80 text-slate-600 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:border-white/[0.08] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Mode Confidentialité (Flouter les montants - Raccourci 'P')"
            >
              {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> : <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
              <span className="hidden xl:inline">{privacyMode ? 'Discret' : 'Public'}</span>
            </button>
          )}

          {/* Toggle auto-refresh */}
          <button
            onClick={onToggleAutoRefresh}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all btn-haptic flex items-center gap-1.5 ${
              autoRefresh 
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                : 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200/80 text-slate-500 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-slate-500 dark:hover:text-slate-300'
            }`}
            title={`Actualisation automatique (30s)${lastUpdated ? ` • Dernière cotation : ${lastUpdated}` : ''}`}
          >
            <Radio className={`w-3 h-3 ${autoRefresh ? 'animate-pulse text-blue-600 dark:text-blue-400' : ''}`} />
            <span>{autoRefresh ? `${countdown}s` : '30s'}</span>
          </button>

          {/* Actualiser manuel */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.07] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/[0.08] text-xs font-medium transition-all btn-haptic flex items-center gap-1.5 disabled:opacity-50"
            title={`Rafraîchir les cotations maintenant${lastUpdated ? ` (Dernière MàJ : ${lastUpdated})` : ''}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            <span className="hidden lg:inline">{isRefreshing ? 'Calcul...' : 'Marché'}</span>
          </button>

          {/* Menu Outils & Intégrations */}
          <div className="relative">
            <button
              onClick={() => setIsActionsOpen(!isActionsOpen)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.07] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/[0.08] text-xs font-medium transition-all btn-haptic flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Outils</span>
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            </button>

            {isActionsOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsActionsOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#0E1524] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 z-50 space-y-1 animate-fadeIn">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2.5 py-1">
                    Connecteurs bancaires
                  </div>
                  
                  <button
                    onClick={() => { setIsActionsOpen(false); onOpenBankSync(); }}
                    className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors"
                  >
                    <Landmark className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <div>
                      <div className="font-medium">Synchro DSP2</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">BoursoBank, Revolut, BNP</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setIsActionsOpen(false); onOpenPeeImport(); }}
                    className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <div className="font-medium">Relevé BNP PEE / PERO</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Import PDF ou CSV d'avoirs</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setIsActionsOpen(false); onOpenDriveSync(); }}
                    className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors"
                  >
                    <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="font-medium">Google Drive Bourse</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Historique ordres exportés</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-200 dark:border-white/[0.06] my-1 pt-1" />

                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2.5 py-1">
                    Création manuelle
                  </div>

                  <button
                    onClick={() => { setIsActionsOpen(false); onOpenAddAccount(); }}
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
                  >
                    <Wallet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Nouveau compte / livret</span>
                  </button>

                  <button
                    onClick={() => { setIsActionsOpen(false); onOpenAddAsset(); }}
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Nouvelle position financière</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Action maîtresse : Button-in-Button CTA */}
          <button
            onClick={onOpenAddTransaction}
            className="pl-3.5 pr-2 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.35)] hover:shadow-[0_6px_25px_rgba(37,99,235,0.5)] transition-all btn-haptic flex items-center gap-2 group"
          >
            <span>Nouvel ordre</span>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
              <Plus className="w-3 h-3 text-white" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
