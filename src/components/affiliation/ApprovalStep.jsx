import {
  Clock, Lock, CheckCircle, XCircle,
  Info, ChevronRight, RefreshCw,
  ShieldAlert, ShieldCheck, HelpCircle
} from "lucide-react";
import StepIndicator from "./StepIndicator";

export default function ApprovalStep({
  requestStatus,
  companyId,
  error,
  onRetry,
  onCancel,
  onGoToLogin,
  onShowWelcome,
}) {
  // Approved State
  if (requestStatus === "approved") {
    return (
      <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden">
        {/* Header / Progress */}
        <div className="bg-bg-secondary/30 border-b border-border-subtle py-6 flex-shrink-0">
          <StepIndicator currentStep={4} />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center bg-bg-primary/50">
          <div className="max-w-xl w-full px-6 py-12 animate-slide-up">
            <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-12 text-center shadow-xl relative overflow-hidden group">
              {/* Decorative Background Icon */}
              <CheckCircle className="absolute -right-8 -bottom-8 w-48 h-48 text-success/5 rotate-12 group-hover:rotate-0 transition-transform duration-1000" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-success/5 rounded-full flex items-center justify-center mb-8 border border-success/10 relative">
                  <div className="absolute inset-0 rounded-full bg-success/10 animate-ping opacity-20" />
                  <ShieldCheck className="w-10 h-10 text-success" />
                </div>

                <h2 className="text-xs font-semibold text-success uppercase tracking-[0.2em] mb-3">
                  Paso 04 - Finalizado
                </h2>
                <h1 className="text-3xl font-light tracking-tight mb-4">
                  ¡Afiliación <span className="font-semibold">Exitosa!</span>
                </h1>
                <p className="text-text-tertiary text-sm max-w-sm mb-8">
                  Su terminal ha sido vinculada correctamente. Ya puede comenzar a gestionar la asistencia de su organización.
                </p>

                <div className="w-full bg-bg-primary/60 border border-border-subtle rounded-lg p-4 mb-2 flex items-center justify-center gap-3">
                  <Building2Icon className="w-4 h-4 text-text-tertiary" />
                  <span className="text-xs font-mono uppercase tracking-wider text-text-secondary">{companyId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Persistent Footer */}
        <div className="bg-bg-secondary/40 border-t border-border-subtle p-6 flex-shrink-0 shadow-lg">
          <div className="max-w-xl mx-auto flex justify-center">
            <button
              onClick={onGoToLogin}
              className="group px-12 py-4 bg-accent text-white rounded-lg font-semibold transition-all duration-300 flex items-center gap-3 shadow-lg shadow-accent/20 hover:bg-accent-hover hover:-translate-y-0.5 active:scale-95"
            >
              Ir al Inicio de Sesión
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Rejected State
  if (requestStatus === "rejected") {
    return (
      <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden">
        {/* Header / Progress */}
        <div className="bg-bg-secondary/30 border-b border-border-subtle py-6 flex-shrink-0">
          <StepIndicator currentStep={4} />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center bg-bg-primary/50">
          <div className="max-w-xl w-full px-6 py-12 animate-slide-up">
            <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-12 text-center shadow-xl relative overflow-hidden group">
              <ShieldAlert className="absolute -right-8 -bottom-8 w-48 h-48 text-error/5 rotate-12 group-hover:rotate-0 transition-transform duration-1000" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-error/5 rounded-full flex items-center justify-center mb-8 border border-error/10">
                  <XCircle className="w-10 h-10 text-error" />
                </div>

                <h2 className="text-xs font-semibold text-error uppercase tracking-[0.2em] mb-3">
                  Error de Afiliación
                </h2>
                <h1 className="text-3xl font-light tracking-tight mb-4">
                  Solicitud <span className="font-semibold text-error/80">Rechazada</span>
                </h1>

                {error && (
                  <div className="w-full bg-error/5 border border-error/20 rounded-lg p-4 mb-6 shadow-inner text-sm text-error/90 max-w-sm">
                    {error}
                  </div>
                )}

                <p className="text-text-tertiary text-sm max-w-md mb-8">
                  No se pudo procesar la vinculación. Por favor verifique el identificador o contacte con soporte técnico para resolverlo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Persistent Footer */}
        <div className="bg-bg-secondary/40 border-t border-border-subtle p-6 flex-shrink-0 shadow-lg">
          <div className="max-w-xl mx-auto flex justify-center w-full">
            <button
              onClick={onRetry}
              className="flex-1 max-w-xs py-4 bg-accent text-white rounded-lg font-semibold transition-all shadow-lg shadow-accent/20 hover:bg-accent-hover hover:-translate-y-0.5 flex items-center justify-center gap-3"
            >
              <RefreshCw className="w-4 h-4" />
              Intentar de Nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending State
  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden">
      {/* Header / Progress */}
      <div className="bg-bg-secondary/30 border-b border-border-subtle py-6 flex-shrink-0">
        <StepIndicator currentStep={4} />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center bg-bg-primary/50">
        <div className="max-w-2xl w-full px-6 py-12 animate-slide-up">
          <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-10 text-center shadow-xl relative overflow-hidden group">
            <Clock className="absolute -right-8 -bottom-8 w-48 h-48 text-warning/5 rotate-12 group-hover:rotate-0 transition-transform duration-1000" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-warning/5 rounded-full flex items-center justify-center mb-8 border border-warning/10 relative">
                <div className="absolute inset-0 rounded-full border-2 border-warning/20 border-t-warning animate-spin" />
                <Clock className="w-10 h-10 text-warning" />
              </div>

              <h2 className="text-xs font-semibold text-warning uppercase tracking-[0.2em] mb-3">
                Proceso en curso
              </h2>
              <h1 className="text-3xl font-light tracking-tight mb-4">
                Solicitud <span className="font-semibold text-warning/80">Pendiente</span>
              </h1>

              <div className="w-full max-w-sm grid grid-cols-2 gap-3 mb-8">
                <div className="bg-bg-primary/60 border border-border-subtle rounded-lg p-4 text-left">
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Empresa</p>
                  <p className="text-xs font-mono text-text-secondary truncate">{companyId || "Cargando..."}</p>
                </div>
                <div className="bg-bg-primary/60 border border-border-subtle rounded-lg p-4 text-left">
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Estado</p>
                  <p className="text-xs font-medium text-text-secondary flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
                    En revisión
                  </p>
                </div>
              </div>

              <div className="bg-accent/5 border border-accent/10 rounded-lg p-4 text-xs text-text-tertiary max-w-md italic flex items-start gap-3 text-left">
                <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span>La solicitud ha sido enviada al administrador central. El sistema se actualizará automáticamente cuando sea procesada.</span>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-4">
            <button
              onClick={onCancel}
              className="px-8 py-3 bg-bg-secondary border border-border-subtle rounded-lg text-sm font-semibold hover:bg-error/5 hover:text-error hover:border-error/20 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Cancelar y Recomenzar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimalist local icon helper
function Building2Icon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24"
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </svg>
  );
}

