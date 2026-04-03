import React, { useState, useEffect } from "react";
import { 
  HardDrive, Camera, Building2, Lock, ChevronRight, 
  Activity, Wifi, Database, Cpu, Info, CheckCircle2
} from "lucide-react";
import { getSystemInfo } from "../../utils/systemInfo";

const steps = [
  { number: 1, icon: HardDrive, title: "Configurar Nodo", desc: "Registro básico del sistema" },
  { number: 2, icon: Camera, title: "Dispositivos", desc: "Cámaras y lectores biométricos" },
  { number: 3, icon: Building2, title: "Afiliación", desc: "Vincular con su empresa" },
  { number: 4, icon: Lock, title: "Aprobación", desc: "Validación administrativa" },
];

export default function WelcomeScreen({ onClose }) {
  const [greeting, setGreeting] = useState("");
  const [sdkMissing, setSdkMissing] = useState(false);
  const [systemInfo, setSystemInfo] = useState({
    hostname: "Detectando...",
    ip: "0.0.0.0",
    version: "v1.0.0"
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Buenos días");
    else if (hour < 18) setGreeting("Buenas tardes");
    else setGreeting("Buenas noches");

    const initSetup = async () => {
      // 1. Info del sistema
      if (window.electronAPI && window.electronAPI.getSystemInfo) {
        try {
          const info = await window.electronAPI.getSystemInfo();
          setSystemInfo(prev => ({ 
            ...prev, 
            hostname: info.hostname || "Desconocido",
            ip: info.ipAddress || "No detectada"
          }));
        } catch (err) {
          console.error(err);
        }
      } else {
        getSystemInfo().then(info => {
          setSystemInfo(prev => ({
            ...prev,
            hostname: "Terminal Web", 
            ip: info.ipAddress || "No detectada"
          }));
        }).catch(err => console.error(err));
      }

      // 2. Verificar SDK
      if (window.electronAPI && window.electronAPI.checkDigitalPersonaSdk) {
        try {
          const status = await window.electronAPI.checkDigitalPersonaSdk();
          if (!status.installed) {
            setSdkMissing(true);
          }
        } catch (err) {
          console.error("Error verificando SDK:", err);
        }
      }
    };

    initSetup();
  }, []);

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans selection:bg-accent/30 overflow-hidden">
      {/* Top Bar - Status & Health */}
      <div className="px-6 py-3 border-b border-border-subtle flex items-center justify-between text-[11px] font-medium text-text-secondary bg-bg-secondary/30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 grayscale opacity-70">
            <Cpu className="w-3.5 h-3.5" />
            <span>{systemInfo.hostname}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Dirección IP Local">
            <Wifi className="w-3.5 h-3.5 text-success" />
            <span>{systemInfo.ip}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
            <span>Base de Datos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${sdkMissing ? 'bg-error' : 'bg-success'}`}></span>
            <span>Servicio Biométrico</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-5xl mx-auto w-full">
        {/* Header Section */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="inline-flex items-center justify-center p-3 mb-6 bg-accent/5 rounded-xl border border-accent/10">
            <img src="images/logo.ico" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
          </div>
          <h2 className="text-sm font-semibold text-accent uppercase tracking-[0.2em] mb-2">
            Panel de Inicio
          </h2>
          <h1 className="text-4xl font-light tracking-tight mb-3">
            {greeting}, <span className="font-semibold">Bienvenido al Sistema</span>
          </h1>
          <p className="text-text-secondary text-base max-w-lg mx-auto">
            Comience la configuración técnica para habilitar el control de asistencia en esta terminal.
          </p>
        </div>

        {/* Steps Linear Flow */}
        <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-[22px] left-10 right-10 h-[1px] bg-border-divider -z-10" />
          
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center text-center group cursor-default">
              <div className="w-11 h-11 rounded-lg bg-bg-secondary border border-border-subtle flex items-center justify-center mb-4 group-hover:border-accent/40 group-hover:bg-bg-primary transition-all duration-300 shadow-sm">
                <step.icon className="w-5 h-5 text-text-secondary group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-sm font-semibold mb-1">{step.title}</h3>
              <p className="text-xs text-text-tertiary leading-relaxed px-4">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Minimal Info Box */}
        {sdkMissing ? (
          <div className="bg-error/10 border border-error/20 p-5 rounded-lg flex gap-4 max-w-2xl w-full animate-fade-in shadow-sm shadow-error/10">
            <div className="w-10 h-10 rounded-lg bg-error/20 flex items-center justify-center shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="text-sm">
              <h4 className="font-semibold text-error mb-1">Dependencia Biométrica Ausente</h4>
              <p className="text-text-secondary leading-normal">
                No se detectó el SDK de DigitalPersona instalado en este equipo. El instalador no finalizó o el controlador fue eliminado. Por favor, <strong>cierre e inicie de nuevo la instalación (Setup.exe)</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-bg-secondary/50 border border-border-subtle p-5 rounded-lg flex gap-4 max-w-2xl w-full animate-fade-in">
            <div className="w-10 h-10 rounded-lg bg-accent/5 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-accent" />
            </div>
            <div className="text-sm">
              <h4 className="font-semibold mb-1">Requisitos de inicio</h4>
              <p className="text-text-secondary leading-normal">
                Asegúrese de contar con el <span className="text-text-primary font-medium">Código de Empresa</span> proporcionado por administración y que los dispositivos biométricos estén conectados por USB.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-8 flex flex-col items-center border-t border-border-subtle bg-bg-secondary/20">
        <button
          onClick={onClose}
          className={`group px-8 py-3.5 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-3 shadow-lg active:scale-95 mb-4 ${
            sdkMissing 
              ? "bg-warning hover:bg-warning-hover shadow-warning/20" 
              : "bg-accent hover:bg-accent-hover shadow-accent/20"
          }`}
        >
          {sdkMissing ? "Continuar en Modo Compatibilidad" : "Iniciar Configuración"}
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="flex items-center gap-2 text-[10px] text-text-disabled font-medium uppercase tracking-widest">
          <span>FASITLAC TECNM</span>
          <span className="w-1 h-1 rounded-full bg-border-divider"></span>
          <span>{systemInfo.version}</span>
        </div>
      </div>
    </div>
  );
}

