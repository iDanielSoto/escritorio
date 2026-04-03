import { useEffect, useState } from "react";
import {
  HardDrive, Info, RefreshCw, ChevronRight,
  Cpu, Wifi, Monitor, Activity
} from "lucide-react";
import StepIndicator from "./StepIndicator";
import { getSystemInfo } from "../../utils/systemInfo";

export default function NodeConfigStep({
  nodeConfig,
  setNodeConfig,
  onNext,
  onShowWelcome,
}) {
  const [isDetecting, setIsDetecting] = useState(false);

  // Detectar información del sistema al cargar el componente
  useEffect(() => {
    detectSystemInfo();

    // Suscribirse a cambios de red
    if (window.electronAPI && window.electronAPI.onNetworkStatusChange) {
      const handleNetworkChange = (details) => {
        setNodeConfig((prev) => ({
          ...prev,
          ipAddress: details.ipAddress,
          macAddress: details.macAddress,
        }));
      };

      window.electronAPI.onNetworkStatusChange(handleNetworkChange);

      return () => {
        if (window.electronAPI.removeNetworkStatusListener) {
          window.electronAPI.removeNetworkStatusListener();
        }
      };
    }
  }, []);

  const detectSystemInfo = async () => {
    setIsDetecting(true);
    try {
      const systemInfo = await getSystemInfo();
      setNodeConfig({
        ...nodeConfig,
        ipAddress: systemInfo.ipAddress,
        macAddress: systemInfo.macAddress,
        operatingSystem: systemInfo.operatingSystem,
      });
    } catch (error) {
      console.error("Error al detectar información del sistema:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  const isFormValid = () => {
    return (
      nodeConfig.nodeName.trim() !== "" &&
      nodeConfig.description.trim() !== "" &&
      nodeConfig.ipAddress && nodeConfig.ipAddress !== "No detectada" &&
      nodeConfig.macAddress && nodeConfig.macAddress !== "No detectada" &&
      nodeConfig.operatingSystem && nodeConfig.operatingSystem !== "Sistema no detectado"
    );
  };

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden">
      {/* Header / Progress */}
      <div className="bg-bg-secondary/30 border-b border-border-subtle py-6 flex-shrink-0">
        <StepIndicator currentStep={1} />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-bg-primary/50">
        <div className="max-w-4xl mx-auto px-6 py-8 animate-slide-up">
          {/* Section Header */}
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-1">
                Paso 01
              </h2>
              <h1 className="text-3xl font-light tracking-tight">
                Configuración del <span className="font-semibold">Nodo</span>
              </h1>
            </div>
            <button
              onClick={onShowWelcome}
              className="p-2 text-text-tertiary hover:text-accent transition-colors"
              title="Ayuda"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column: Form */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/5 flex items-center justify-center border border-accent/10">
                    <Monitor className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider">Identidad del Sistema</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-end mb-1.5 px-1">
                      <label className="block text-[11px] font-bold text-text-tertiary uppercase">
                        Nombre del Nodo *
                      </label>
                      <span className="text-[10px] text-text-tertiary font-mono">
                        {nodeConfig.nodeName?.length || 0}/55
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={55}
                      value={nodeConfig.nodeName}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, nodeName: e.target.value })}
                      placeholder="Ej. Recepción Principal, Edificio A"
                      className="w-full px-4 py-3 bg-bg-primary border border-border-subtle rounded-lg focus:ring-1 focus:ring-accent focus:border-accent transition-all outline-none text-sm shadow-inner"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-1.5 px-1">
                      <label className="block text-[11px] font-bold text-text-tertiary uppercase">
                        Descripción *
                      </label>
                      <span className="text-[10px] text-text-tertiary font-mono">
                        {nodeConfig.description?.length || 0}/255
                      </span>
                    </div>
                    <textarea
                      maxLength={255}
                      value={nodeConfig.description}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, description: e.target.value })}
                      placeholder="Detalles sobre la ubicación o uso de esta terminal"
                      rows="2"
                      className="w-full px-4 py-3 bg-bg-primary border border-border-subtle rounded-lg focus:ring-1 focus:ring-accent focus:border-accent transition-all outline-none text-sm resize-none shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Requirements / Notice */}
              <div className="flex items-start gap-4 p-4 border border-border-subtle bg-bg-secondary/20 rounded-lg">
                <Activity className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Esta información se vinculará permanentemente a este hardware. Asegúrese de que el nombre sea descriptivo para facilitar la administración desde la nube.
                </p>
              </div>
            </div>

            {/* Right Column: System Info (Health View Style) */}
            <div className="space-y-6">
              <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-sm uppercase tracking-wider">Estado de Red</h3>
                  <button
                    onClick={detectSystemInfo}
                    disabled={isDetecting}
                    className="p-1.5 hover:bg-accent/5 rounded-md text-text-tertiary hover:text-accent transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-text-tertiary uppercase">Dirección IP</span>
                    <div className="flex items-center gap-2">
                      <Wifi className={`w-3.5 h-3.5 ${nodeConfig.ipAddress ? 'text-success' : 'text-error'}`} />
                      <span className="font-mono text-sm">{nodeConfig.ipAddress || '---'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-text-tertiary uppercase">ID de Hardware (MAC)</span>
                    <div className="flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-text-tertiary" />
                      <span className="font-mono text-[10px] tracking-tighter">{nodeConfig.macAddress || '---'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-text-tertiary uppercase">Sistema Operativo</span>
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-accent" />
                      <span className="text-xs">{nodeConfig.operatingSystem || 'No detectado'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-border-subtle">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${isFormValid() ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                    <span className="text-[10px] items-center font-medium uppercase text-text-secondary">
                      {isFormValid() ? 'Listo para continuar' : 'Campos incompletos'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Footer */}
      <div className="bg-bg-secondary/40 border-t border-border-subtle p-6 flex-shrink-0 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-end">
          <button
            onClick={onNext}
            disabled={!isFormValid()}
            className={`
              group px-10 py-3.5 rounded-lg font-semibold transition-all duration-300 flex items-center gap-3 shadow-sm
              ${isFormValid()
                ? "bg-accent text-white hover:bg-accent-hover hover:-translate-y-0.5 active:scale-95 shadow-accent/20"
                : "bg-border-divider text-text-disabled cursor-not-allowed opacity-50"
              }
            `}
          >
            Siguiente Paso
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

