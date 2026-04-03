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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-bg-primary/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="max-w-xl w-full px-6 py-12 animate-slide-up">
        <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-12 text-center shadow-xl relative overflow-hidden group">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex flex-col items-center">
            <h2 className="text-xs font-semibold text-error uppercase tracking-[0.2em] mb-3">
              Confirmación Requerida
            </h2>
            <h1 className="text-3xl font-light tracking-tight mb-4">
              {title}
            </h1>

            <p className="text-text-tertiary text-sm max-w-sm mb-8 leading-relaxed">
              {message}
            </p>

            <div className="flex gap-4 w-full justify-center">
              <button
                onClick={onClose}
                className="flex-1 px-8 py-3.5 bg-bg-primary border border-border-subtle hover:border-text-secondary text-text-primary rounded-lg font-semibold transition-all duration-300 shadow-sm flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-8 py-3.5 bg-error text-white hover:bg-red-600 rounded-lg font-semibold transition-all duration-300 shadow-sm shadow-error/20 flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
