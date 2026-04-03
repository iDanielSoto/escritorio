import React, { useState, useEffect } from 'react';
import { XCircle, Clock, AlertCircle } from 'lucide-react';
import { API_CONFIG } from '../../config/apiEndPoint';

const API_URL = API_CONFIG.BASE_URL;

/**
 * Panel de Acumulación de retardos
 * Muestra los retardos A/B del mes actual, cuántos faltan para generar una falta
 * y las notas malas acumuladas.
 */
const EquivalenciasPanel = ({ empleadoId, mesSeleccionado }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!empleadoId) return;

        const fetchEquivalencias = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const targetDate = mesSeleccionado || new Date();
                const year = targetDate.getFullYear();
                const month = targetDate.getMonth();
                const inicioMes = new Date(year, month, 1).toISOString().split('T')[0];
                const finMes = new Date(year, month + 1, 0).toISOString().split('T')[0];

                const response = await fetch(`${API_URL}/api/asistencias/empleado/${empleadoId}/equivalencias?inicio=${inicioMes}&fin=${finMes}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const result = await response.json();
                if (result.success) {
                    setData(result.data);
                }
            } catch (error) {
                console.error("Error al obtener equivalencias:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEquivalencias();
    }, [empleadoId, mesSeleccionado]);

    if (loading) return (
        <div className="animate-pulse flex flex-col gap-4 mt-auto">
            <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
            </div>
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
            </div>
        </div>
    );

    if (!data) return null;

    const eqA = data.configuracion_equivalencias?.retardos_a_por_falta || 10;
    const eqB = data.configuracion_equivalencias?.retardos_b_por_falta || 5;
    const notasMalas = data.notas_malas_acumuladas || 0;
    const notasParaSuspension = 5;

    // Barra: cuántos RetA restan para la próxima falta
    const restantesA = data.desglose_equivalencias?.retardos_a_restantes || 0;
    const restantesB = data.desglose_equivalencias?.retardos_b_restantes || 0;

    const mesActual = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return (
        <div className="flex flex-col gap-4 mt-auto">
            {/* Header / Titulo minimalista */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-widest flex items-center gap-1.5">
                    Acumulación de retardos
                </span>
            </div>

            <div className="space-y-4">
                {/* Contadores principales */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Retardo A */}
                    <div className="bg-bg-primary p-3 rounded-xl border border-border-subtle flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-text-secondary font-bold uppercase">Retardo A</p>
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <div className="flex items-end justify-between">
                            <span className="text-2xl font-bold text-text-primary">{data.retardos_a}</span>
                            <span className="text-[10px] text-text-tertiary font-medium">/{eqA} = 1 Falta</span>
                        </div>
                    </div>

                    {/* Retardo B */}
                    <div className="bg-bg-primary p-3 rounded-xl border border-border-subtle flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-text-secondary font-bold uppercase">Retardo B</p>
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <div className="flex items-end justify-between">
                            <span className="text-2xl font-bold text-text-primary">{data.retardos_b}</span>
                            <span className="text-[10px] text-text-tertiary font-medium">/{eqB} = 1 Falta</span>
                        </div>
                    </div>

                    {/* Faltas equivalentes */}
                    <div className="bg-bg-primary p-3 rounded-xl border border-border-subtle flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-text-secondary font-bold uppercase">Faltas Eq.</p>
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                        </div>
                        <div className="flex items-end justify-between">
                            <span className="text-2xl font-bold text-text-primary">{data.faltas_equivalentes_por_retardos}</span>
                            <span className="text-[10px] text-text-tertiary font-medium">Acumuladas</span>
                        </div>
                    </div>

                    {/* Notas malas */}
                    <div className={`p-3 rounded-xl border flex flex-col justify-between hover:shadow-md transition-shadow ${notasMalas >= notasParaSuspension ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-bg-primary border-border-subtle'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <p className={`text-[10px] font-bold uppercase ${notasMalas >= notasParaSuspension ? 'text-red-600 dark:text-red-400' : 'text-text-secondary'}`}>
                                Notas Malas
                            </p>
                            <AlertCircle className={`w-3.5 h-3.5 ${notasMalas >= notasParaSuspension ? 'text-red-500' : 'text-purple-500'}`} />
                        </div>
                        <div className="flex items-end justify-between">
                            <span className={`text-2xl font-bold ${notasMalas >= notasParaSuspension ? 'text-red-600 dark:text-red-400' : 'text-text-primary'}`}>
                                {notasMalas}
                            </span>
                            <span className={`text-[10px] font-medium ${notasMalas >= notasParaSuspension ? 'text-red-500 dark:text-red-400' : 'text-text-tertiary'}`}>
                                /{notasParaSuspension} = Susp.
                            </span>
                        </div>
                    </div>
                </div>

                {/* Barras de progreso minimalistas */}
                <div className="space-y-3">
                    {/* Progreso Retardo A */}
                    <div>
                        <div className="flex justify-between text-[11px] text-text-secondary mb-1.5 font-medium">
                            <span className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                Retardo A restantes para falta
                            </span>
                            <span>{restantesA} de {eqA}</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${(restantesA / eqA) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Progreso Retardo B */}
                    <div>
                        <div className="flex justify-between text-[11px] text-text-secondary mb-1.5 font-medium">
                            <span className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-orange-400" />
                                Retardo B restantes para falta
                            </span>
                            <span>{restantesB} de {eqB}</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-orange-400 rounded-full transition-all duration-500"
                                style={{ width: `${(restantesB / eqB) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Progreso Notas Malas */}
                    <div>
                        <div className="flex justify-between text-[11px] text-text-secondary mb-1.5 font-medium">
                            <span className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${notasMalas >= notasParaSuspension ? 'bg-red-500' : 'bg-purple-500'}`} />
                                Notas malas para suspensión
                            </span>
                            <span className={notasMalas >= notasParaSuspension ? 'text-red-500 font-bold' : ''}>
                                {notasMalas} de {notasParaSuspension}
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${notasMalas >= notasParaSuspension ? 'bg-red-500' : 'bg-purple-500'}`}
                                style={{ width: `${Math.min((notasMalas / notasParaSuspension) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Resumen */}
                <div className="flex justify-between items-center text-[10px] text-text-secondary bg-bg-secondary px-2 py-1.5 rounded-md border border-border-subtle">
                    <span className="flex items-center gap-1 font-medium">
                        Tot. Faltas
                    </span>
                    <span className="text-text-primary font-bold">
                        {data.total_faltas_mes}
                    </span>
                </div>

            </div>
        </div>
    );
};

export default EquivalenciasPanel;
