import React, { useState } from 'react';
import { ShieldOff, UserPlus, AlertTriangle, X, CheckCircle2 } from 'lucide-react';

/**
 * Pantalla que se muestra cuando el nodo de escritorio está deshabilitado por un administrador.
 * @param {string} nodeName - Nombre del nodo deshabilitado
 * @param {boolean} isChecking - Si se está verificando el estado actualmente
 * @param {Function} onRetry - Callback para reintentar la verificación
 * @param {Function} onNewAffiliation - Callback para iniciar una nueva solicitud de afiliación (limpia el storage)
 */
const NodeDisabledScreen = ({ nodeName, isChecking, onRetry, onNewAffiliation }) => {
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleNewAffiliationClick = () => {
        setShowConfirmation(true);
    };

    const handleConfirm = () => {
        setShowConfirmation(false);
        onNewAffiliation();
    };

    const handleCancel = () => {
        setShowConfirmation(false);
    };

    return (
        <div className="min-h-screen bg-bg-secondary flex flex-col items-center justify-center p-6 text-center antialiased">
            {/* Modal de Confirmación */}
            {showConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-bg-primary rounded-2xl shadow-2xl border border-border-subtle max-w-sm w-full p-7 relative">
                        <button
                            onClick={handleCancel}
                            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center gap-4">
                            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-7 h-7 text-red-500" />
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-text-primary mb-2">
                                    ¿Crear nueva afiliación?
                                </h3>
                                <p className="text-text-secondary text-sm leading-relaxed">
                                    Esto eliminará el registro actual de este nodo y deberá ser aprobado nuevamente por un administrador.
                                    <br /><br />
                                    <strong>Esta acción no se puede deshacer.</strong>
                                </p>
                            </div>

                            <div className="flex gap-3 w-full mt-1">
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 py-2.5 px-4 border border-border-subtle rounded-xl text-text-secondary hover:bg-bg-secondary font-medium transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors text-sm flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tarjeta principal */}
            <div className="bg-bg-primary p-10 rounded-2xl shadow-2xl max-w-lg w-full border-t-4 border-red-500 border-x border-b border-border-subtle relative overflow-hidden">
                {/* Decoración de fondo */}
                <div className="absolute top-0 left-0 w-full h-16 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(239,68,68,0.06)_10px,rgba(239,68,68,0.06)_20px)] opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center">
                    {/* Icono */}
                    <div className="mb-6 relative">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shadow-inner">
                            <ShieldOff className="w-10 h-10 text-red-500" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-extrabold text-text-primary mb-3 tracking-tight">
                        Nodo Deshabilitado
                    </h1>

                    <p className="text-text-secondary text-base mb-2 max-w-sm leading-relaxed mx-auto">
                        El nodo{' '}
                        {nodeName ? (
                            <span className="font-semibold text-text-primary">"{nodeName}"</span>
                        ) : (
                            'actual'
                        )}{' '}
                        ha sido <strong>deshabilitado por un administrador</strong>.
                    </p>

                    <p className="text-text-tertiary text-sm mb-8 max-w-xs mx-auto">
                        Contacta a un administrador para habilitarlo de nuevo, o crea una nueva solicitud de afiliación.
                    </p>

                    {/* Acciones */}
                    <div className="flex flex-col gap-3 w-full">


                        {/* Nueva afiliación */}
                        <button
                            onClick={handleNewAffiliationClick}
                            className="w-full py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-sm shadow-red-500/20"
                        >
                            <UserPlus className="w-4 h-4" />
                            Crear nueva solicitud de afiliación
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

export default NodeDisabledScreen;
