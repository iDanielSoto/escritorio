import { useState, useEffect } from "react";
import { obtenerConfiguracionEscritorio } from "../services/configuracionEscritorioService";
import { obtenerEscritorioIdGuardado } from "../services/escritorioService";

export const useMaintenanceStatus = () => {
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(false);

    useEffect(() => {
        const checkMaintenance = async () => {
            try {
                const escritorioId = obtenerEscritorioIdGuardado();
                if (!escritorioId) {
                    // Si no hay escritorio, no verificamos el mantenimiento
                    return;
                }

                setIsCheckingMaintenance(true);

                const configuracion = await obtenerConfiguracionEscritorio(escritorioId);

                if (configuracion && configuracion.es_mantenimiento !== undefined) {
                    setIsMaintenance(Boolean(configuracion.es_mantenimiento));
                }
            } catch (error) {
                console.warn("No se pudo verificar el estado de mantenimiento específico del nodo:", error);
            } finally {
                setIsCheckingMaintenance(false);
            }
        };

        checkMaintenance();
        const interval = setInterval(checkMaintenance, 15000);

        return () => clearInterval(interval);
    }, []);

    return { isMaintenance, isCheckingMaintenance };
};
