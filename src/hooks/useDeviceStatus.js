// hooks/useDeviceStatus.js
// Hook optimizado que monitorea el estado de conexión de dispositivos biométricos
// Usa refs para evitar re-renders innecesarios y loops de dependencias
import { useState, useEffect, useRef, useCallback } from "react";
import { deviceDetectionService } from "../services/deviceDetectionService";
import { getApiEndpoint } from "../config/apiEndPoint";

const API_URL = getApiEndpoint("/api");

export const useDeviceStatus = (devices, setDevices, options = {}) => {
  const { interval = 15000, enabled = true } = options;
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  // Refs para evitar dependencias circulares en callbacks
  const devicesRef = useRef(devices);
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);
  const intervalRef = useRef(null);
  const initialCheckDoneRef = useRef(false);
  const debounceTimeoutRef = useRef(null);

  // Mantener ref sincronizado con devices
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const getAuthToken = useCallback(() => {
    return localStorage.getItem("auth_token");
  }, []);

  /**
   * PATCH /api/biometrico/:id/estado — fire and forget
   */
  // Se ha añadido la propiedad isActivo como parámetro para validar si se debe actualizar el estado
  const updateEstadoEnBD = useCallback(
    (deviceId, nuevoEstado, isActivo = true) => {
      // Si el dispositivo no tiene un ID válido, es nuevo o está inactivo, abortamos
      if (!deviceId || String(deviceId).startsWith("NEW_") || !isActivo) return;
      const token = getAuthToken();
      // No await — fire and forget para no bloquear
      fetch(`${API_URL}/biometrico/${deviceId}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      }).catch(() => { }); // silencioso
    },
    [getAuthToken]
  );

  /**
   * Normaliza nombre para comparación
   */
  const normalizeName = useCallback((name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/[®™©]/g, "")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .replace(
        /\b(hd|camera|webcam|usb|web|integrated|built-in|truevision|general)\b/gi,
        ""
      )
      .trim();
  }, []);

  /**
   * Verificación de estado — usa refs, sin dependencia en 'devices'
   */
  const checkDeviceStatuses = useCallback(async () => {
    const currentDevices = devicesRef.current;
    if (!currentDevices || currentDevices.length === 0 || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      const [usbDevices, webcams] = await Promise.all([
        deviceDetectionService.detectUSBDevices(),
        deviceDetectionService.detectWebcams(),
      ]);

      const allDetected = deviceDetectionService.mergeDetectedDevices(
        usbDevices,
        webcams
      );

      if (!isMountedRef.current) return;

      let hasChanges = false;
      const changedDevices = [];

      const updatedDevices = currentDevices.map((device) => {
        const regName = normalizeName(device.nombre);
        if (!regName) return device;

        const connected = allDetected.some((detected) => {
          const detectedId = detected.deviceId || detected.instanceId;

          // 1. Intentar coincidencia exacta y estable por ID físico
          if (device.device_id && detectedId) {
            return device.device_id === detectedId;
          }

          // 2. Fallback por nombre:
          // Si el dispositivo está registrado pero NO tiene device_id (aún no se ha anclado el hardware),
          // o el detectado no tiene ID físico.
          const detName = normalizeName(detected.name);
          if (!detName) return false;

          return (
            regName === detName ||
            regName.includes(detName) ||
            detName.includes(regName)
          );
        });

        const newEstado = connected ? "conectado" : "desconectado";

        if (device.estado !== newEstado) {
          hasChanges = true;
          changedDevices.push({ id: device.id, estado: newEstado, es_activo: device.es_activo ?? true });
          return { ...device, estado: newEstado };
        }
        return device;
      });

      if (hasChanges && isMountedRef.current) {
        // Double check against current state to be absolutely sure
        if (JSON.stringify(updatedDevices) !== JSON.stringify(devicesRef.current)) {
          setDevices(updatedDevices);
          changedDevices.forEach((c) => updateEstadoEnBD(c.id, c.estado));
        }
      }

      if (isMountedRef.current) {
        setLastChecked(new Date());
      }
    } catch (error) {
      console.error("[useDeviceStatus] Error verificando estado:", error);
      if (isMountedRef.current) {
        const currentDevices2 = devicesRef.current;
        let hasChanges = false;
        const changedDevices = [];

        const errorDevices = currentDevices2.map((device) => {
          if (device.estado !== "error") {
            hasChanges = true;
            changedDevices.push({ id: device.id, estado: "error" });
            return { ...device, estado: "error" };
          }
          return device;
        });

        if (hasChanges) {
          setDevices(errorDevices);
          changedDevices.forEach((c) => updateEstadoEnBD(c.id, c.estado));
        }
      }
    } finally {
      isCheckingRef.current = false;
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [normalizeName, setDevices, updateEstadoEnBD]);
  // ↑ NO depende de 'devices' — usa devicesRef.current

  // Envoltorio con debounce para eventos rápidos de hardware
  const debouncedCheck = useCallback((delay = 1000) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      checkDeviceStatuses();
    }, delay);
  }, [checkDeviceStatuses]);

  // Verificación inicial (una sola vez)
  useEffect(() => {
    if (enabled && devices.length > 0 && !initialCheckDoneRef.current) {
      initialCheckDoneRef.current = true;
      const timeout = setTimeout(checkDeviceStatuses, 500); // Reducido de 2000 a 500 para mayor velocidad inicial
      return () => clearTimeout(timeout);
    }
  }, [enabled, devices.length, checkDeviceStatuses]);

  // Polling periódico — intervalo ESTABLE, no se reinicia en cada render
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Solo crear intervalo si no existe
    if (!intervalRef.current) {
      intervalRef.current = setInterval(checkDeviceStatuses, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, checkDeviceStatuses]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Evento nativo del navegador para hot-plug de dispositivos multimedia (cámaras/micrófonos)
  useEffect(() => {
    if (!enabled) return;

    const handleDeviceChange = () => {
      console.log("[useDeviceStatus] Detectado cambio en dispositivos multimedia (Hot-Plug)");
      debouncedCheck(300); // Reducido para mayor reactividad
    };

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    // Integrar también los eventos nativos de Electron para el modal
    let removeElectronListener = null;
    if (window.electronAPI?.onUSBDeviceChange) {
      removeElectronListener = window.electronAPI.onUSBDeviceChange(() => {
        console.log("[useDeviceStatus] 🔌 Cambio de dispositivo USB detectado (Electron)");
        debouncedCheck(300); // Reducido para mayor reactividad
      });
    }

    return () => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
      if (typeof removeElectronListener === 'function') {
        removeElectronListener();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [enabled, debouncedCheck]);

  return {
    isChecking,
    lastChecked,
    checkNow: checkDeviceStatuses,
  };
};
