import React from "react";
import { X, AlertTriangle } from "lucide-react";

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirmación", 
  message = "¿Estás seguro de continuar?" 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-in fade-in duration-200">
      <div className="bg-bg-primary rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-border-subtle animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6 relative">
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md p-2 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 mx-auto mb-4 bg-error/10 rounded-full flex items-center justify-center ring-4 ring-error/5">
              <AlertTriangle className="w-8 h-8 text-error" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">{title}</h2>
          </div>

          <div className="space-y-6">
            <p className="text-text-secondary text-sm text-center leading-relaxed font-medium">
              {message}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={onConfirm}
                className="w-full bg-[#1976D2] hover:bg-[#1565C0] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Aceptar
              </button>
              <button
                onClick={onClose}
                className="w-full text-text-tertiary font-bold text-sm hover:text-text-primary transition-colors h-10"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
