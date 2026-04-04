import { useState, useEffect, useCallback, useRef } from "react";
import { obtenerConfiguracionEscritorio } from "../services/configuracionEscritorioService";
import { obtenerEscritorioIdGuardado } from "../services/escritorioService";
import { useConnectivity } from "./useConnectivity";

export const useKioskConfiguration = (isLoggedIn) => {
    const [ordenCredenciales, setOrdenCredenciales] = useState(null);
    const [loadingCredenciales, setLoadingCredenciales] = useState(true);

    const { isDatabaseConnected } = useConnectivity();

    const getActiveMethods = () => {
        if (!ordenCredenciales) return [];
        return Object.entries(ordenCredenciales)
            .filter(([, config]) => config.activo)
            .map(([key]) => key);
    };

    const activeMethods = getActiveMethods();

    // useCallback garantiza que la función se re-crea cuando isDatabaseConnected cambia,
    // eliminando el stale closure en el polling que causaba que siempre saltara al SQLite.
    const cargarCredenciales = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoadingCredenciales(true);
            const escritorioId = obtenerEscritorioIdGuardado();
            if (!escritorioId) throw new Error("No hay ID de escritorio");

            let configuracion = null;

            if (isDatabaseConnected) {
                try {
                    configuracion = await obtenerConfiguracionEscritorio(escritorioId);
                    console.log("[useKioskConfiguration] Configuración cargada desde el backend");
                } catch (apiErr) {
                    console.warn("[useKioskConfiguration] Error al cargar desde API, intentando caché local:", apiErr);
                }
            } else {
                console.log("[useKioskConfiguration] Conectividad BD en FALSO. Saltando fetch a backend.");
            }

            if (!configuracion) {
                console.log("[useKioskConfiguration] Cargando configuración desde base de datos local (Offline Mode)...");
                const offlineInfo = await window.electronAPI?.offlineDB?.getEscritorioInfo(escritorioId);

                if (offlineInfo) {
                    configuracion = {
                        prioridad_biometrico: offlineInfo.prioridad_biometrico,
                        metodos_autenticacion: offlineInfo.metodos_autenticacion || { huella: true, rostro: true, codigo: true }
                    };
                    console.log("[useKioskConfiguration] Configuración cargada desde SQLite");
                }
            }

            if (!configuracion) {
                throw new Error("No se pudo obtener la configuración de ninguna fuente");
            }

            let metodos = configuracion.metodos_autenticacion;
            if (typeof metodos === 'string') {
                metodos = JSON.parse(metodos);
            }

            let prioridad = configuracion.prioridad_biometrico;
            if (typeof prioridad === 'string') {
                prioridad = JSON.parse(prioridad);
            }

            const keyMap = { huella: 'dactilar', rostro: 'facial', codigo: 'pin' };
            const orden = {};

            if (Array.isArray(prioridad) && prioridad.length > 0) {
                prioridad.sort((a, b) => a.nivel - b.nivel);
                prioridad.forEach(item => {
                    const frontKey = keyMap[item.metodo];
                    if (frontKey) {
                        orden[frontKey] = { activo: item.activo };
                    }
                });
            } else {
                orden.facial = { activo: metodos?.rostro ?? true };
                orden.dactilar = { activo: metodos?.huella ?? true };
                orden.pin = { activo: metodos?.codigo ?? true };
            }

            setOrdenCredenciales(orden);
        } catch (err) {
            console.error("Error al cargar orden de credenciales:", err);
            if (!silent) {
                setOrdenCredenciales({
                    facial: { activo: true },
                    dactilar: { activo: true },
                    pin: { activo: true },
                });
            }
        } finally {
            if (!silent) setLoadingCredenciales(false);
        }
    }, [isDatabaseConnected]); // ← re-crea la función cuando cambia la conectividad

    // Carga inicial y re-carga cada vez que cargarCredenciales cambia (es decir, al cambiar isDatabaseConnected)
    useEffect(() => {
        cargarCredenciales();
    }, [cargarCredenciales]);

    // Polling: useRef + dep en cargarCredenciales garantiza que siempre use la versión fresca
    const pollingRef = useRef(null);
    useEffect(() => {
        const handleConfigUpdate = () => {
            console.log("Evento 'configuracion-actualizada' detectado, recargando...");
            cargarCredenciales(true);
        };
        window.addEventListener('configuracion-actualizada', handleConfigUpdate);

        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(() => {
            cargarCredenciales(true);
        }, 10000); // 10s para reacción más rápida

        return () => {
            clearInterval(pollingRef.current);
            window.removeEventListener('configuracion-actualizada', handleConfigUpdate);
        };
    }, [cargarCredenciales]); // ← el interval se re-crea con la función fresca

    // Recargar cuando el usuario cierra sesión
    useEffect(() => {
        if (!isLoggedIn) {
            cargarCredenciales();
        }
    }, [isLoggedIn, cargarCredenciales]);

    return { ordenCredenciales, setOrdenCredenciales, loadingCredenciales, activeMethods, cargarCredenciales };
};

