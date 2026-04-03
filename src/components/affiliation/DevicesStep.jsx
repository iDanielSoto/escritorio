import {
  Wifi,
  Info,
  Search,
  Loader2,
  Usb,
  CheckCircle2,
  AlertCircle,
  Camera,
  ChevronRight,
  ChevronLeft,
  X
} from "lucide-react";
import StepIndicator from "./StepIndicator";
import { useDeviceDetection } from "../../hooks/useDeviceDetection";

export default function DevicesStep({
  devices,
  setDevices,
  onNext,
  onPrevious,
  onShowWelcome,
}) {
  const { isDetecting, detectionStatus, setDetectionStatus, detectAllDevices } =
    useDeviceDetection(devices, setDevices);

  const updateDevice = (id, field, value) => {
    setDevices(
      devices.map((dev) => (dev.id === id ? { ...dev, [field]: value } : dev)),
    );
  };

  const removeDevice = (id) => {
    setDevices(devices.filter((dev) => dev.id !== id));
  };

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden">
      {/* Header / Progress */}
      <div className="bg-bg-secondary/30 border-b border-border-subtle py-6 flex-shrink-0">
        <StepIndicator currentStep={2} />
      </div>

      {/* Main Content Area - Split into static header and scrollable body */}
      <div className="flex-1 flex flex-col min-h-0 bg-bg-primary/50">
        {/* Static Header Section */}
        <div className="w-full bg-bg-primary/30 border-b border-border-subtle/30 shadow-sm flex-shrink-0 animate-slide-down">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-1">
                  Paso 02
                </h2>
                <h1 className="text-3xl font-light tracking-tight">
                  Detección de <span className="font-semibold">Dispositivos</span>
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onShowWelcome}
                  className="p-2 text-text-tertiary hover:text-accent transition-colors"
                  title="Ayuda"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Status Alert Area inside static header */}
            {detectionStatus && (
              <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 border shadow-sm animate-fade-in ${
                detectionStatus.type === "success" ? "bg-success/5 border-success/20 text-success" :
                detectionStatus.type === "error" ? "bg-error/5 border-error/20 text-error" :
                detectionStatus.type === "warning" ? "bg-warning/5 border-warning/20 text-warning" :
                "bg-accent/5 border-accent/20 text-accent"
              }`}>
                {detectionStatus.type === "success" && <CheckCircle2 className="w-5 h-5" />}
                {detectionStatus.type === "error" && <AlertCircle className="w-5 h-5" />}
                {detectionStatus.type === "warning" && <AlertCircle className="w-5 h-5" />}
                {detectionStatus.type === "info" && <Usb className="w-5 h-5" />}
                <span className="text-sm font-medium truncate flex-1" title={detectionStatus.message}>{detectionStatus.message}</span>
                <button onClick={() => setDetectionStatus(null)} className="ml-auto p-1.5 flex-shrink-0 hover:bg-black/5 rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Device List Section */}
        <div className={`flex-1 min-h-0 ${devices.length > 3 ? 'overflow-y-auto' : 'overflow-y-auto'}`}>
          <div className="max-w-5xl mx-auto px-6 py-8 animate-slide-up">
            <div className="space-y-6">
              {devices.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className={`group relative bg-bg-secondary/40 border rounded-lg p-5 transition-all duration-300 hover:shadow-md ${
                        device.detected ? "border-success/30 ring-1 ring-success/10" : "border-border-subtle"
                      }`}
                    >
                      {/* Device Badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${device.detected ? 'bg-success/10 text-success' : 'bg-accent/5 text-accent'}`}>
                             {device.type === 'facial' ? <Camera className="w-4 h-4" /> : <Usb className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary block leading-none mb-1 truncate" title={device.detected ? "Detectado vía " + device.connection : "Configuración Manual"}>
                              {device.detected ? "Detectado vía " + device.connection : "Configuración Manual"}
                            </span>
                            <h4 className="font-semibold text-sm truncate" title={device.name || "Nuevo Dispositivo"}>{device.name || "Nuevo Dispositivo"}</h4>
                          </div>
                        </div>
                        <button
                          onClick={() => removeDevice(device.id)}
                          className="p-1.5 text-text-tertiary hover:text-error opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-error/5"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">Nombre</label>
                          <input
                            type="text"
                            value={device.name}
                            onChange={(e) => updateDevice(device.id, "name", e.target.value)}
                            placeholder="Ej. Cámara Sur"
                            maxLength={55}
                            className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">Tipo</label>
                          <input
                            type="text"
                            readOnly
                            value={device.type === "facial" ? "Reconocimiento Facial" : "Lector de Huella"}
                            className="w-full px-3 py-2 bg-bg-primary/50 border border-border-subtle rounded-lg text-xs outline-none transition-all shadow-inner cursor-not-allowed text-text-tertiary"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">Conexión</label>
                          <select
                            value={device.connection}
                            onChange={(e) => updateDevice(device.id, "connection", e.target.value)}
                            className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner appearance-none cursor-pointer"
                          >
                            <option value="USB">Puerto USB</option>
                            <option value="IP">Red Local (IP)</option>
                          </select>
                        </div>
                        {device.connection === "IP" ? (
                           <div className="flex gap-2">
                             <div className="flex-1">
                                <label className="block text-[10px] font-bold text-text-tertiary uppercase mb-1.5 ml-1">IP / Puerto</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={device.ip}
                                    onChange={(e) => updateDevice(device.id, "ip", e.target.value)}
                                    placeholder="192.168..."
                                    className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs font-mono focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner"
                                  />
                                  <span className="text-text-tertiary">:</span>
                                  <input
                                    type="text"
                                    value={device.port}
                                    onChange={(e) => updateDevice(device.id, "port", e.target.value)}
                                    placeholder="80"
                                    className="w-16 px-2 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs font-mono focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner"
                                  />
                                </div>
                             </div>
                           </div>
                        ) : (
                          <div className="flex items-end">
                             <div className="w-full px-3 py-2 bg-bg-primary/30 border border-border-subtle/50 rounded-lg text-[10px] text-text-tertiary italic flex items-center gap-2">
                               <Usb className="w-3 h-3" /> Plug and Play habilitado
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Search Card / Trigger */}
                  <button
                    onClick={() => detectAllDevices(true)}
                    disabled={isDetecting}
                    className="group border-2 border-dashed border-border-subtle rounded-lg p-5 flex flex-col items-center justify-center gap-3 transition-all hover:border-accent/40 hover:bg-accent/5"
                  >
                    <div className={`p-3 rounded-full ${isDetecting ? 'bg-accent/10' : 'bg-bg-secondary'} group-hover:scale-110 transition-transform`}>
                      {isDetecting ? <Loader2 className="w-6 h-6 text-accent animate-spin" /> : <Search className="w-6 h-6 text-text-tertiary" />}
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold block mb-1">
                        {isDetecting ? "Buscando..." : "Redetectar Todo"}
                      </span>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-tighter">Escaneo automático de hardware</p>
                    </div>
                  </button>
                </div>
              ) : (
                /* Empty State */
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-accent/5 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 rounded-full border border-accent/10 animate-ping opacity-20" />
                    <Camera className="w-10 h-10 text-accent/40" />
                  </div>
                  <h3 className="text-xl font-light mb-2">No hay <span className="font-semibold">dispositivos</span></h3>
                  <p className="text-sm text-text-tertiary max-w-sm mb-8">
                    Se recomienda detectar al menos una cámara o lector biométrico para un funcionamiento óptimo.
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => detectAllDevices(true)}
                      disabled={isDetecting}
                      className="group px-8 py-3 bg-accent text-white rounded-lg font-semibold transition-all flex items-center gap-3 shadow-lg shadow-accent/20 hover:bg-accent-hover hover:-translate-y-0.5"
                    >
                      {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Detectar Automáticamente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Footer */}
      <div className="bg-bg-secondary/40 border-t border-border-subtle p-6 flex-shrink-0 shadow-lg">
        <div className="max-w-5xl mx-auto flex justify-between">
          <button
            onClick={onPrevious}
            className="group px-6 py-3 rounded-lg font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Anterior
          </button>
          <button
            onClick={onNext}
            className="group px-10 py-3.5 rounded-lg font-semibold transition-all duration-300 flex items-center gap-3 shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-0.5 active:scale-95 shadow-accent/20"
          >
            Siguiente Paso
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

