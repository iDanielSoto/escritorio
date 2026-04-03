import { useState, useEffect } from "react";
import { obtenerConfiguracionEscritorio } from "../services/configuracionEscritorioService";
import { obtenerEscritorioIdGuardado } from "../services/escritorioService";
import { useConnectivity } from "./useConnectivity";

export const useKioskConfiguration = (isLoggedIn) => {
    // Mantendremos la estructura original de 'ordenCredenciales' por compatibilidad con el resto del código
    const [ordenCredenciales, setOrdenCredenciales] = useState(null);
    const [loadingCredenciales, setLoadingCredenciales] = useState(true);

    const { isDatabaseConnected } = useConnectivity();

    // Obtener métodos activos (sin importar su orden por ahora, ya que el nuevo API no maneja orden)
    const getActiveMethods = () => {
        if (!ordenCredenciales) return [];
        return Object.entries(ordenCredenciales)
            .filter(([, config]) => config.activo)
            .map(([key]) => key);
    };

    const activeMethods = getActiveMethods();

    // Cargar credenciales desde el backend
    const cargarCredenciales = async (silent = false) => {
        try {
            if (!silent) setLoadingCredenciales(true);
            const escritorioId = obtenerEscritorioIdGuardado();
            if (!escritorioId) throw new Error("No hay ID de escritorio");

            let configuracion = null;

            // Intentar cargar desde el backend si el sistema indica que estamos conectados
            // En vez de navigator.onLine usamos isDatabaseConnected para mayor fiabilidad
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

            // Si estamos offline o falló el API, intentar desde SQLite
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

            // Mapeo de backend a frontend
            const keyMap = { huella: 'dactilar', rostro: 'facial', codigo: 'pin' };
            const orden = {};

            if (Array.isArray(prioridad) && prioridad.length > 0) {
                // Ordenar por nivel
                prioridad.sort((a, b) => a.nivel - b.nivel);

                prioridad.forEach(item => {
                    const frontKey = keyMap[item.metodo];
                    if (frontKey) {
                        orden[frontKey] = { activo: item.activo };
                    }
                });
            } else {
                // Fallback a metodos_autenticacion si prioridad no existe
                orden.facial = { activo: metodos?.rostro ?? true };
                orden.dactilar = { activo: metodos?.huella ?? true };
                orden.pin = { activo: metodos?.codigo ?? true };
            }

            setOrdenCredenciales(orden);
        } catch (err) {
            console.error("Error al cargar orden de credenciales:", err);
            // Fallback por defecto si falla el backend o no está autenticado
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
    };

    // Cargar al montar el componente y establecer polling
    useEffect(() => {
        cargarCredenciales();

        const handleConfigUpdate = () => {
            console.log("Evento 'configuracion-actualizada' detectado, recargando...");
            cargarCredenciales(true);
        };

        window.addEventListener('configuracion-actualizada', handleConfigUpdate);

        // Polling silencioso cada 15 segundos
        const timer = setInterval(() => {
            cargarCredenciales(true);
        }, 15000);

        return () => {
            clearInterval(timer);
            window.removeEventListener('configuracion-actualizada', handleConfigUpdate);
        };
    }, []);

    // Re-ejecutar carga si el estado de base de datos cambia a online (y hacerlo silencioso para no parpadear la GUI)
    useEffect(() => {
        // Solo recargar por conectividad si ya estamos hidratados una vez, de lo contrario el mount effect 
        // ya se encarga del spinner inicial.
        if (ordenCredenciales !== null) {
             console.log("[useKioskConfiguration] Cambio detectado en conectividad, refrescando silenciosamente...");
             cargarCredenciales(true); // silent = true
        }
    }, [isDatabaseConnected]);

    // Recargar credenciales cuando el usuario cierra o abre sesión
    useEffect(() => {
        if (!isLoggedIn) {
            cargarCredenciales();
        }
    }, [isLoggedIn]);

    return { ordenCredenciales, setOrdenCredenciales, loadingCredenciales, activeMethods, cargarCredenciales };
};

