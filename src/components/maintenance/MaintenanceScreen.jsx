import React from 'react';
import { HardHat, RefreshCw, Construction } from 'lucide-react';

const MaintenanceScreen = ({ isChecking, onRetry }) => {
    return (
        <div className="min-h-screen bg-bg-secondary flex flex-col items-center justify-center p-6 text-center antialiased">
            <div className="bg-bg-primary p-10 rounded-2xl shadow-2xl max-w-lg w-full border-t-4 border-amber-500 border-x border-b border-border-subtle relative overflow-hidden">
                {/* Subtle warning strips background in header area */}
                <div className="absolute top-0 left-0 w-full h-16 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(245,158,11,0.1)_10px,rgba(245,158,11,0.1)_20px)] opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center">
                    {/* Icon Header */}
                    <div className="mb-6 relative">
                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shadow-inner">
                            <Construction className="w-10 h-10 text-amber-500" />
                        </div>
                        {/* Pequeño icono secundario animado (opcional) */}
                        <div className="absolute -bottom-1 -right-1 bg-bg-primary rounded-full p-1.5 shadow-sm border border-border-subtle">
                            <HardHat className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-extrabold text-text-primary mb-3 tracking-tight">
                        Sistema en Mantenimiento
                    </h1>

                    <p className="text-text-secondary text-base mb-8 max-w-sm leading-relaxed mx-auto">
                        Estamos realizando tareas programadas de actualización para asegurar el óptimo funcionamiento de la plataforma.
                        <br /><br />
                        El servicio se restablecerá automáticamente en breve.
                    </p>

                    <div className="w-full mt-2 flex flex-col gap-3">
                        {/* Server Status Indicator */}
                        {isChecking && (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 py-4 px-6 rounded-xl border border-amber-200 dark:border-amber-900/50 w-full font-medium">
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                <span>Verificando conexión con el servidor...</span>
                            </div>
                        )}

                        {/* Botón manual de reintento */}
                        <button
                            onClick={onRetry}
                            disabled={isChecking}
                            className="mt-1 w-full py-2.5 px-4 bg-transparent hover:bg-amber-50 dark:hover:bg-amber-900/20 text-text-secondary hover:text-amber-600 dark:hover:text-amber-400 border border-border-subtle hover:border-amber-200 dark:hover:border-amber-800 rounded-xl transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reintentar ahora
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-sm font-medium text-text-tertiary">
                FASITLAC © {new Date().getFullYear()} - Sistema Checador
            </div>
        </div>
    );
};

export default MaintenanceScreen;
