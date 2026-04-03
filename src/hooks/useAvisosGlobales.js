// src/hooks/useAvisosGlobales.js
// Hook para detección de cambios en avisos globales en tiempo real (polling)

import { useState, useEffect, useRef, useCallback } from "react";
import { getAvisosGlobales } from "../services/avisosService";

const POLLING_INTERVAL = 30 * 1000; // 30 segundos

/**
 * Hook que mantiene los avisos globales actualizados en tiempo real.
 * Hace polling al backend y detecta cambios automáticamente.
 * 
 * @param {Object} options
 * @param {number} options.intervalo - Intervalo de polling en ms (default: 30s)
 * @param {boolean} options.pausado - Si true, detiene el polling (ej: cuando hay sesión abierta)
 * @returns {{ notices, loading, error, ultimaActualizacion, refrescar }}
 */
export function useAvisosGlobales({ intervalo = POLLING_INTERVAL, pausado = false } = {}) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  // Ref para comparar cambios sin triggear re-renders
  const prevHashRef = useRef(null);
  const intervalRef = useRef(null);

  /**
   * Genera un hash simple para detectar cambios en los avisos
   */
  const generarHash = useCallback((avisos) => {
    if (!avisos || avisos.length === 0) return "empty";
    return avisos.map(a => `${a.id || a.subject}_${a.time}`).join("|");
  }, []);

  /**
   * Carga los avisos y detecta si hubo cambios
   */
  const cargarAvisos = useCallback(async (esInicial = false) => {
    try {
      if (esInicial) setLoading(true);
      setError(null);

      const data = await getAvisosGlobales(true); // forceRefresh para comparar con backend
      const nuevoHash = generarHash(data);

      // Solo actualizar estado si los datos cambiaron
      if (nuevoHash !== prevHashRef.current) {
        prevHashRef.current = nuevoHash;
        setNotices(data);
        setUltimaActualizacion(new Date());

        if (!esInicial && data.length > 0) {
          console.log("🔔 Avisos globales actualizados:", data.length, "avisos");
        }
      }
    } catch (err) {
      console.error("❌ Error en polling de avisos globales:", err.message);
      setError(err.message);
    } finally {
      if (esInicial) setLoading(false);
    }
  }, [generarHash]);

  /**
   * Función pública para forzar un refresco
   */
  const refrescar = useCallback(() => {
    return cargarAvisos(false);
  }, [cargarAvisos]);

  // Carga inicial
  useEffect(() => {
    cargarAvisos(true);
  }, [cargarAvisos]);

  // Polling periódico
  useEffect(() => {
    if (pausado) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      cargarAvisos(false);
    }, intervalo);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cargarAvisos, intervalo, pausado]);

  return {
    notices,
    loading,
    error,
    ultimaActualizacion,
    refrescar,
  };
}
