// hooks/useDeviceDetection.js - ESTABLE
import { useState, useEffect, useRef, useCallback } from "react";
import { deviceDetectionService } from "../services/deviceDetectionService";

export const useDeviceDetection = (devices, setDevices) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState(null);
  const hasDetectedOnMount = useRef(false);
  const detectionTimeoutRef = useRef(null);
  // Ref para acceder al valor actual de devices sin agregarlo como dependencia
  const devicesRef = useRef(devices);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  /**
   * FIX 1: useCallback SIN 'devices' en dependencias.
   * Usamos devicesRef.current y setDevices con callback funcional para
   * evitar el bucle de re-detección que causaba inestabilidad.
   */
  const detectAllDevices = useCallback(
    async (showStatus = true) => {
      setIsDetecting(true);
      if (showStatus) {
        setDetectionStatus(null);
      }

      try {
        const currentDevices = devicesRef.current;

        // Detectar todos los tipos de dispositivos en paralelo
        const [usbDevices, webcams, biometricDevices] = await Promise.all([
          deviceDetectionService.detectUSBDevices(),
          deviceDetectionService.detectWebcams(),
          deviceDetectionService.detectBiometricDevices(),
        ]);

        // Combinar dispositivos evitando duplicados
        const detectedDevices = deviceDetectionService.mergeDetectedDevices(
          [...biometricDevices, ...usbDevices],
          webcams,
        );

        // FIX 2: Separar dispositivos en nuevos vs. ya existentes
        const newDevices = deviceDetectionService.filterNewDevices(
          detectedDevices,
          currentDevices,
        );

        // FIX 3: Actualizar estado de dispositivos existentes (conectado/desconectado)
        // y agregar los nuevos en una sola operación atómica
        setDevices((prevDevices) => {
          // Marcar como desconectados los que ya no se detectan
          const updatedExisting = prevDevices.map((existingDevice) => {
            const stillDetected = detectedDevices.some((d) =>
              deviceDetectionService.isSameDevice(d, existingDevice),
            );
            // Solo actualizamos si el estado cambió para evitar renders innecesarios
            if (existingDevice.detected !== stillDetected) {
              return { ...existingDevice, detected: stillDetected };
            }
            return existingDevice;
          });

          // Agregar dispositivos verdaderamente nuevos
          if (newDevices.length > 0) {
            const mappedNewDevices = newDevices.map((d) => ({
              ...d,
              device_id: d.deviceId || d.instanceId || null,
              detected: true,
            }));
            const devicesWithIds = deviceDetectionService.assignUniqueIds(
              mappedNewDevices,
              updatedExisting.length + 1,
            );
            return [...updatedExisting, ...devicesWithIds];
          }

          return updatedExisting;
        });

        if (showStatus) {
          const hasElectronAPI = !!(
            window.electronAPI && window.electronAPI.detectUSBDevices
          );
          const statusMessage =
            deviceDetectionService.getDetectionStatusMessage(
              detectedDevices,
              newDevices,
              hasElectronAPI,
              webcams.length,
            );
          setDetectionStatus(statusMessage);
        }

        return detectedDevices;
      } catch (error) {
        console.error("Error detectando dispositivos:", error);
        if (showStatus) {
          setDetectionStatus({
            type: "error",
            message: "Error al detectar dispositivos: " + error.message,
          });
        }
        return [];
      } finally {
        setIsDetecting(false);
      }
    },
    [setDevices], // FIX 1: Solo setDevices como dependencia (es estable)
  );

  /**
   * Detección inicial al montar
   */
  useEffect(() => {
    if (!hasDetectedOnMount.current) {
      hasDetectedOnMount.current = true;
      detectionTimeoutRef.current = setTimeout(() => {
        detectAllDevices(false).then((detected) => {
          if (detected.length > 0) {
            setDetectionStatus({
              type: "success",
              message: `Se detectaron automáticamente ${detected.length} dispositivo(s)`,
            });
          }
        });
      }, 500);
    }

    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
      deviceDetectionService.clearCache();
    };
  }, [detectAllDevices]);

  /**
   * FIX 4: Escuchar cambios de dispositivos en tiempo real.
   * Cuando el usuario conecta o desconecta una cámara, el navegador y
   * Electron lo notifican y re-detectamos automáticamente.
   */
  useEffect(() => {
    // Listener del navegador (Web API)
    const handleDeviceChange = () => {
      console.log("[DeviceDetection] Cambio de dispositivo detectado (browser)");
      detectAllDevices(true);
    };

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }

    // Listener de Electron (si está disponible)
    let removeElectronListener = null;
    if (window.electronAPI?.onUSBDeviceChange) {
      removeElectronListener = window.electronAPI.onUSBDeviceChange(() => {
        console.log("[DeviceDetection] Cambio de dispositivo USB detectado (Electron)");
        detectAllDevices(true);
      });
    }

    return () => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
      if (typeof removeElectronListener === "function") {
        removeElectronListener();
      }
    };
  }, [detectAllDevices]);

  return {
    isDetecting,
    detectionStatus,
    setDetectionStatus,
    detectAllDevices,
  };
};
