import { useState } from "react";
import { Building2, Info, X, HelpCircle, ChevronRight, ChevronLeft, ShieldCheck, Mail } from "lucide-react";
import StepIndicator from "./StepIndicator";

export default function AffiliationStep({
  companyId,
  setCompanyId,
  onSubmit,
  onPrevious,
  onShowWelcome,
}) {
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden">
      {/* Header / Progress */}
      <div className="bg-bg-secondary/30 border-b border-border-subtle py-6 flex-shrink-0">
        <StepIndicator currentStep={3} />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-bg-primary/50">
        <div className="max-w-4xl mx-auto px-6 py-8 animate-slide-up">
          {/* Section Header */}
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-1">
                Paso 03
              </h2>
              <h1 className="text-3xl font-light tracking-tight">
                Vincular <span className="font-semibold">Empresa</span>
              </h1>
              <p className="text-text-tertiary text-sm mt-3 max-w-md">
                Conecte este nodo local con la instancia en la nube de su organización para sincronizar datos.
              </p>
            </div>
            <button
              onClick={onShowWelcome}
              className="p-2 text-text-tertiary hover:text-accent transition-colors"
              title="Ayuda"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-6 shadow-sm relative overflow-hidden group">
              {/* Decorative Subtle Background Icon */}
              <Building2 className="absolute -right-8 -bottom-8 w-40 h-40 text-accent/5 -rotate-12 transition-transform group-hover:rotate-0 duration-700" />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center border border-accent/10 mb-6">
                  <ShieldCheck className="w-8 h-8 text-accent" />
                </div>

                <h3 className="text-lg font-semibold mb-2">ID de Afiliación</h3>
                <p className="text-sm text-text-tertiary mb-8 max-w-xs">
                  Ingrese el código alfanumérico proporcionado por su administrador.
                </p>

                <div className="w-full space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      placeholder="nombre-empresa-XXX"
                      className="w-full px-4 py-3 bg-bg-primary border border-border-subtle rounded-lg focus:ring-1 focus:ring-accent focus:border-accent transition-all outline-none text-center font-mono text-sm tracking-[0.15em] shadow-inner placeholder:text-text-disabled"
                    />
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-text-tertiary">
                      ¿No tiene su ID?{" "}
                      <button
                        onClick={() => setShowHelpModal(true)}
                        className="text-accent hover:underline font-bold transition-colors ml-1"
                      >
                        Solicitar Soporte
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Footer */}
      <div className="bg-bg-secondary/40 border-t border-border-subtle p-6 flex-shrink-0 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between">
          <button
            onClick={onPrevious}
            className="group px-6 py-3 rounded-lg font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Anterior
          </button>
          <button
            onClick={onSubmit}
            disabled={!companyId.trim()}
            className={`
              group px-10 py-3.5 rounded-lg font-semibold transition-all duration-300 flex items-center gap-3 shadow-sm
              ${companyId.trim()
                ? "bg-accent text-white hover:bg-accent-hover hover:-translate-y-0.5 active:scale-95 shadow-accent/20"
                : "bg-border-divider text-text-disabled cursor-not-allowed opacity-50"
              }
            `}
          >
            Solicitar Afiliación
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Modernized Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in">
          <div className="bg-bg-primary border border-border-subtle rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/5 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Asistencia</h3>
                  <p className="text-text-tertiary text-xs">Cómo recuperar su Identificador</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {[
                { title: "Contrato de Licencia", desc: "Consulte el documento PDF enviado por FASITLAC." },
                { title: "Manual de Usuario", desc: "Vea la sección 'Activación de Terminales'." },
                { title: "Administración Central", desc: "Contacte al responsable de TI de su empresa." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-bg-secondary/30 border border-border-subtle rounded-lg hover:bg-bg-secondary/50 transition-colors group">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-[10px] font-bold border border-accent/20">
                    0{i + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold mb-0.5">{item.title}</h4>
                    <p className="text-xs text-text-tertiary">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-bg-secondary/20 flex justify-center">
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-xs font-bold uppercase tracking-widest text-text-tertiary hover:text-accent transition-colors"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

