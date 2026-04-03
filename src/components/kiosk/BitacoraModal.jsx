import { 
    X, Clock, User, Activity, 
    CheckCircle2, AlertCircle, Info, ListFilter
} from "lucide-react";
import { obtenerBitacora } from "../../services/bitacoraService";
import { useState, useEffect } from "react";
import DynamicLoader from "../common/DynamicLoader";

const getStatusStyles = (type) => {
  switch (type) {
    case "success":
      return {
        bg: "bg-success/10",
        text: "text-success",
        border: "border-success/20",
        icon: CheckCircle2,
        label: "Exitoso"
      };
    case "error":
      return {
        bg: "bg-error/10",
        text: "text-error",
        border: "border-error/20",
        icon: AlertCircle,
        label: "Error"
      };
    case "info":
      return {
        bg: "bg-accent/10",
        text: "text-accent",
        border: "border-accent/20",
        icon: Info,
        label: "Info"
      };
    default:
      return {
        bg: "bg-text-tertiary/10",
        text: "text-text-tertiary",
        border: "border-border-divider",
        icon: Activity,
        label: "Evento"
      };
  }
};

export default function BitacoraModal({ onClose }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Función para cargar eventos
    const cargarEventos = () => {
      const eventosDinamicos = obtenerBitacora();
      setEventos(eventosDinamicos);
      setLoading(false);
    };

    // Retardo simulado inicial para mostrar el loading
    const initialLoadTimer = setTimeout(() => {
      cargarEventos();
    }, 500);

    // Actualizar cada 1 segundo para reflejar nuevos eventos más rápidamente
    const interval = setInterval(() => {
      if (!loading) {
        cargarEventos();
      }
    }, 1000);

    return () => {
      clearTimeout(initialLoadTimer);
      clearInterval(interval);
    };
  }, [loading]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-backdrop">
      <div className="bg-bg-primary rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-border-subtle animate-zoom-in">
        {/* Header - Styled like Login */}
        <div className="px-8 pt-8 pb-6 relative text-center border-b border-border-divider bg-bg-secondary/30">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h1 className="text-2xl font-light tracking-tight text-text-primary">
            Bitácora de <span className="font-semibold text-text-primary">Eventos</span>
          </h1>
          <p className="text-text-secondary text-sm mt-2 max-w-xs mx-auto">
            Registro en tiempo real de los accesos y eventos del sistema.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
              <DynamicLoader text="Sincronizando registros..." size="medium" />
            </div>
          ) : eventos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-bg-secondary rounded-full flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-text-disabled" />
              </div>
              <p className="text-text-secondary font-medium">No hay eventos registrados hoy</p>
            </div>
          ) : (
            <div className="divide-y divide-border-divider/50">
              {eventos.map((event, idx) => {
                const styles = getStatusStyles(event.type);
                const StatusIcon = styles.icon;

                return (
                  <div 
                    key={idx}
                    className="flex items-center gap-4 py-3.5 hover:bg-bg-secondary/30 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {/* Time - Minimalist */}
                    <div className="min-w-[60px] text-center">
                      <span className="text-[11px] font-bold text-text-tertiary tracking-tight tabular-nums">
                        {event.timestamp}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-text-primary truncate">
                          {event.user}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary truncate">
                        {event.action}
                      </p>
                    </div>

                    {/* Status Badge - More compact */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${styles.bg} ${styles.text} ${styles.border}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span>{styles.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-bg-secondary/30 border-t border-border-subtle flex items-center justify-end shrink-0">
          <div className="text-[10px] font-medium text-text-disabled uppercase tracking-widest">
            {eventos.length} registros hoy
          </div>
        </div>
      </div>
    </div>
  );
}