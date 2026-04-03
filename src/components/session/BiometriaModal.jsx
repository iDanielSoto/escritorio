import React from "react";
import { X, Fingerprint, Camera } from "lucide-react";

export default function BiometriaModal({
  onClose,
  onBack,
  inline = false,
  readerConnected = false,
  isOnline = false,
  isCameraConnected = false,
  onShowBiometric,
  onShowRegisterFace
}) {
  return (
    <div className={inline ? "w-full h-full flex flex-col" : "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"}>
      <div className={inline ? "flex-1 flex flex-col overflow-hidden" : "bg-bg-primary rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"}>
        {/* Header */}
        <div className={`bg-bg-primary p-6 border-b border-border-subtle flex-shrink-0 ${inline ? 'sticky top-0 z-10' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#1976D2]/10 p-2 rounded-xl">
                <Fingerprint className="w-8 h-8 text-[#1976D2]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-text-primary">Gestión Biométrica</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Registra huellas y rostros para cualquier empleado del sistema.
                </p>
              </div>
            </div>
            {!inline && (
              <button
                onClick={onClose}
                className="text-text-secondary hover:bg-bg-secondary rounded-lg p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onClick={() => readerConnected && isOnline && onShowBiometric?.()}
              disabled={!readerConnected || !isOnline}
              className={`rounded-2xl shadow-sm p-8 transition-all flex flex-col items-center justify-center border border-border-subtle min-h-[200px] ${readerConnected && isOnline
                ? "bg-bg-primary hover:bg-bg-secondary hover:border-[#1976D2]/50 hover:shadow-md cursor-pointer text-[#1976D2]"
                : "bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
            >
              <Fingerprint className="w-16 h-16 mb-4" />
              <h3 className={`text-xl font-bold mb-2 ${readerConnected && isOnline ? "text-text-primary" : "text-gray-400 dark:text-gray-600"}`}>Registrar Huella</h3>
              <p className={`text-sm text-center max-w-[200px] ${readerConnected && isOnline ? "text-text-secondary" : "text-gray-400 dark:text-gray-500"}`}>
                {!isOnline ? "Sin conexión" : readerConnected ? "Seleccionar empleado y registrar huella" : "Lector desconectado"}
              </p>
            </button>

            <button
              disabled={!isOnline || !isCameraConnected}
              onClick={() => isOnline && isCameraConnected && onShowRegisterFace?.()}
              className={`rounded-2xl shadow-sm p-8 transition-all flex flex-col items-center justify-center border border-border-subtle min-h-[200px] ${isOnline && isCameraConnected
                ? "bg-bg-primary hover:bg-bg-secondary hover:border-[#1976D2]/50 hover:shadow-md cursor-pointer text-[#1976D2]"
                : "bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
            >
              <Camera className="w-16 h-16 mb-4" />
              <h3 className={`text-xl font-bold mb-2 ${isOnline && isCameraConnected ? "text-text-primary" : "text-gray-400 dark:text-gray-600"}`}>Registrar Rostro</h3>
              <p className={`text-sm text-center max-w-[200px] ${isOnline && isCameraConnected ? "text-text-secondary" : "text-gray-400 dark:text-gray-500"}`}>
                {!isOnline ? "Sin conexión" : !isCameraConnected ? "Cámara no disponible" : "Seleccionar empleado y registrar rostro"}
              </p>
            </button>
          </div>
        </div>

        {/* Footer */}
        {!inline && (
          <div className="bg-bg-primary p-4 border-t border-border-subtle flex-shrink-0">
            <button
              onClick={onBack || onClose}
              className="w-full px-6 py-3 bg-bg-primary border border-border-subtle text-text-secondary rounded-xl font-bold hover:bg-bg-secondary transition-colors text-sm"
            >
              {onBack ? "Volver" : "Cerrar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
