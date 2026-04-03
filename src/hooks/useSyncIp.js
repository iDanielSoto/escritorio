import { useEffect, useRef } from "react";
import { getSystemInfo } from "../utils/systemInfo";
import { actualizarEscritorio, obtenerEscritorioIdGuardado } from "../services/escritorioService";

/**
 * Hook para sincronizar la IP del escritorio con la API cuando esta cambia.
 * Ignora desconexiones (IP no detectada) y evita actualizaciones redundantes.
 */
export const useSyncIp = () => {
    const lastSyncedIpRef = useRef(null);
    const isUpdatingRef = useRef(false);

    const syncIpWithApi = async (newIp) => {
        // 1. Validaciones básicas
        if (!newIp || newIp === "No detectada") {
            console.log("ℹ️ [useSyncIp] IP no válida o desconexión detectada. Saltando sincronización.");
            return;
        }

        if (newIp === lastSyncedIpRef.current) {
            console.log("ℹ️ [useSyncIp] La IP no ha cambiado desde la última sincronización.");
            return;
        }

        if (isUpdatingRef.current) {
            console.log("ℹ️ [useSyncIp] Actualización en curso, ignorando evento.");
            return;
        }

        const escritorioId = obtenerEscritorioIdGuardado();
        if (!escritorioId) {
            console.log("⚠️ [useSyncIp] No hay escritorio_id guardado. El dispositivo podría no estar afiliado.");
            return;
        }

        // 2. Ejecutar actualización
        isUpdatingRef.current = true;
        try {
            console.log(`📡 [useSyncIp] Detectado cambio de IP: ${lastSyncedIpRef.current || 'N/A'} -> ${newIp}. Sincronizando con API...`);

            await actualizarEscritorio(escritorioId, { ip: newIp });

            lastSyncedIpRef.current = newIp;
            console.log("✅ [useSyncIp] IP sincronizada correctamente.");
        } catch (error) {
            console.error("❌ [useSyncIp] Error al sincronizar IP con la API:", error);
        } finally {
            isUpdatingRef.current = false;
        }
    };

    useEffect(() => {
        // Obtener IP inicial al montar
        const initSync = async () => {
            try {
                const info = await getSystemInfo();
                if (info.ipAddress && info.ipAddress !== "No detectada") {
                    lastSyncedIpRef.current = info.ipAddress;
                    console.log("ℹ️ [useSyncIp] IP inicial detectada:", info.ipAddress);
                }
            } catch (error) {
                console.error("❌ [useSyncIp] Error al obtener IP inicial:", error);
            }
        };

        initSync();

        // Suscribirse a cambios de red mediante Electron
        if (window.electronAPI && window.electronAPI.onNetworkStatusChange) {
            const unsubscribe = window.electronAPI.onNetworkStatusChange((details) => {
                console.log("🌐 [useSyncIp] Evento de red detectado:", details);
                syncIpWithApi(details.ipAddress);
            });

            return () => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                } else if (window.electronAPI.removeNetworkStatusListener) {
                    // Fallback por si la API de Electron usa un método directo de remoción
                    window.electronAPI.removeNetworkStatusListener();
                }
            };
        } else {
            console.warn("⚠️ [useSyncIp] window.electronAPI.onNetworkStatusChange no disponible.");
        }
    }, []);

    return null; // Este hook no expone estado, solo ejecuta efectos secundarios
};

export default useSyncIp;
