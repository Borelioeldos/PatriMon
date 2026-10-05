import React, { useState, useRef } from 'react';
import { 
  X, UploadCloud, FileText, CheckCircle2, AlertCircle, 
  Building2, ShieldCheck, ArrowRight, RefreshCw, Sparkles, Check
} from 'lucide-react';
import { api } from '../services/api';

export default function PeeImportModal({ 
  isOpen, 
  onClose, 
  onImportSuccess 
}) {
  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [createPeroAccount, setCreatePeroAccount] = useState(true);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMsg('');
    setIsAnalyzing(true);
    setPreviewData(null);

    try {
      const data = await api.previewPeeStatement(selectedFile);
      if (!data.success || data.all_items.length === 0) {
        throw new Error("Aucun fonds ou dispositif n'a pu être extrait. Vérifiez qu'il s'agit bien d'un relevé BNP Épargne Entreprise.");
      }
      setPreviewData(data);
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'analyse du document");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.all_items) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.confirmPeeImport({
        items: previewData.all_items,
        create_pero_account_if_needed: createPeroAccount,
      });

      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement des positions");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatEUR = (val) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121824] border border-[#222E42] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Importer Relevé BNP Épargne Entreprise</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase font-semibold">
                  1-Clic
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Compatible relevé de situation PDF (Schneider Electric...) et exports CSV
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Zone de Drag & Drop */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
              file
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-slate-700/80 bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files[0])}
              accept=".pdf,.csv"
              className="hidden"
            />

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
            }`}>
              {isAnalyzing ? (
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              ) : file ? (
                <FileText className="w-6 h-6 text-emerald-400" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                {isAnalyzing
                  ? "Analyse du relevé en cours..."
                  : file
                  ? file.name
                  : "Glissez votre relevé PDF BNP ici ou cliquez pour parcourir"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Fichiers acceptés : Relevé de situation PDF ou export CSV BNP EE
              </p>
            </div>
          </div>

          {/* Résultat d'analyse & Prévisualisation */}
          {previewData && (
            <div className="space-y-4 animate-fadeIn">
              {/* Synthèse du relevé */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Établissement & Date</span>
                  <span className="text-sm font-bold text-white block mt-0.5">{previewData.company_name}</span>
                  <span className="text-[10px] text-slate-500">Relevé au {previewData.statement_date}</span>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Montant Brut Total</span>
                  <span className="text-sm font-bold text-emerald-400 block mt-0.5">{formatEUR(previewData.total_gross_amount)}</span>
                  <span className="text-[10px] text-slate-500">{previewData.all_items.length} supports détectés</span>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Plus-Value Globale</span>
                  <span className={`text-sm font-bold block mt-0.5 ${previewData.global_gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {previewData.global_gain >= 0 ? `+${formatEUR(previewData.global_gain)}` : formatEUR(previewData.global_gain)}
                  </span>
                  <span className="text-[10px] text-slate-500">Calculée par BNP EE</span>
                </div>
              </div>

              {/* Bloc 1 : Dispositif PEE */}
              {previewData.pee_items.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Dispositif PEE (Épargne 5 ans)
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      {formatEUR(previewData.pee_items.reduce((s, it) => s + it.total_value, 0))}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/60">
                    {previewData.pee_items.map((it, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-white">{it.fund_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {it.quantity} parts • VL: {formatEUR(it.current_price)}/part
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">{formatEUR(it.total_value)}</div>
                          {it.gain_eur !== 0 && (
                            <div className="text-[10px] text-emerald-400 font-medium">
                              +{formatEUR(it.gain_eur)} (+{it.gain_percent}%)
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bloc 2 : Dispositif PERO (Cardif Retraite) */}
              {previewData.pero_items.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      Dispositif PERO (Cardif Retraite)
                    </span>
                    <span className="text-[11px] text-amber-400 font-semibold">
                      {formatEUR(previewData.pero_items.reduce((s, it) => s + it.total_value, 0))}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/60">
                    {previewData.pero_items.map((it, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-white">{it.fund_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {it.quantity} parts • VL: {formatEUR(it.current_price)}/part
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">{formatEUR(it.total_value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 pt-2 border-t border-slate-800 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createPeroAccount}
                      onChange={(e) => setCreatePeroAccount(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Créer / utiliser un compte dédié « BNP Cardif - PERO Retraite »</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={!previewData || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Actualisation en cours...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Valider et actualiser mes avoirs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
