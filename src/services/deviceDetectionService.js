// services/deviceDetectionService.js - ESTABLE

const VIRTUAL_CAMERA_PATTERNS = [
  "obs",
  "virtual",
  "manycam",
  "xsplit",
  "snap camera",
  "snapcamera",
  "droidcam",
  "iriun",
  "epoccam",
  "ndi",
  "newtek",
  "camtwist",
  "sparkocam",
  "splitcam",
  "youcam",
  "cyberlink",
  "avatarify",
  "chromacam",
  "vcam",
  "fake",
  "screen capture",
  "game capture",
];

const normalizationCache = new Map();
const virtualCameraCache = new Map();

export const deviceDetectionService = {
  /**
   * Verificar si es una cámara virtual (con cache)
   */
  isVirtualCamera(name) {
    if (virtualCameraCache.has(name)) {
      return virtualCameraCache.get(name);
    }
    const nameLower = name.toLowerCase();
    const isVirtual = VIRTUAL_CAMERA_PATTERNS.some((pattern) =>
      nameLower.includes(pattern),
    );
    virtualCameraCache.set(name, isVirtual);
    return isVirtual;
  },

  /**
   * Determinar el tipo de dispositivo
   */
  getDeviceType(name) {
    const nameLower = name.toLowerCase();
    if (
      nameLower.includes("fingerprint") ||
      nameLower.includes("huella") ||
      nameLower.includes("dactilar") ||
      nameLower.includes("u.are.u")
    ) {
      return "dactilar";
    }
    return "facial";
  },

  normalizeNameForComparison(name) {
    if (!name) return "";
    if (normalizationCache.has(name)) {
      return normalizationCache.get(name);
    }

    let normalized = name
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const backup = normalized;

    normalized = normalized.replace(
      /\b(hd|camera|webcam|usb|web|integrated|built-in|truevision|general)\b/gi,
      "",
    ).replace(/\s+/g, " ").trim();

    // Si después de quitar las palabras comunes nos quedamos sin nada, usamos el backup
    if (normalized === "") {
      normalized = backup;
    }

    normalizationCache.set(name, normalized);
    return normalized;
  },

  /**
   * FIX 5: Detectar cámaras web con fallback: si Electron no devuelve nada,
   * también intentamos la detección por browser para mayor robustez.
   */
  async detectWebcams() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return [];
      }

      // Si Electron API existe, la priorizamos pero no la usamos como única fuente:
      // el fallback al browser ocurre en detectUSBDevices cuando retorna vacío.
      // Aquí siempre enumeramos por browser para el caso de que Electron falle.
      if (window.electronAPI?.detectUSBDevices) {
        // Electron se encarga de USB; browser solo como respaldo de cámaras
        // que Electron no liste (ej. cámaras integradas no USB puras).
        // Seguimos enumerando pero luego mergeDetectedDevices deduplicará.
      }

      await this.checkCameraPermission();
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();

      const cameras = mediaDevices.reduce((acc, device, index) => {
        if (device.kind !== "videoinput") return acc;

        const label = device.label || `Cámara ${index + 1}`;
        if (this.isVirtualCamera(label)) return acc;

        acc.push({
          // FIX 6: ID estable basado en deviceId del browser (no Date.now())
          id: device.deviceId ? `browser-${device.deviceId}` : `browser-cam-${index}`,
          name: label,
          type: this.getDeviceType(label),
          connection: "USB",
          ip: "",
          port: "",
          deviceId: device.deviceId,
          detected: true,
        });
        return acc;
      }, []);

      return cameras;
    } catch (error) {
      console.error("Error detectando cámaras web:", error);
      return [];
    }
  },

  /**
   * Verificar permisos de cámara
   */
  async checkCameraPermission() {
    try {
      if (!navigator.permissions) return "prompt";
      const result = await navigator.permissions.query({ name: "camera" });
      return result.state;
    } catch {
      return "prompt";
    }
  },

  /**
   * Detectar dispositivos USB vía Electron API
   */
  async detectUSBDevices() {
    try {
      if (!window.electronAPI?.detectUSBDevices) {
        return [];
      }

      const result = await window.electronAPI.detectUSBDevices();

      if (!result?.success || !result?.devices?.length) {
        return [];
      }

      return result.devices.map((d) => ({
        ...d,
        // FIX 6: ID estable basado en instanceId si existe
        id: d.instanceId ? `usb-${d.instanceId}` : `usb-${d.name}`,
        type: this.getDeviceType(d.name || ""),
        detected: true,
      }));
    } catch (error) {
      console.error("Error detectando dispositivos USB:", error);
      return [];
    }
  },

  /**
   * FIX 7: Nuevo helper para saber si dos dispositivos son el mismo.
   * Usado por el hook para actualizar el estado detected (true/false).
   */
  isSameDevice(deviceA, deviceB) {
    const idA = deviceA.device_id || deviceA.deviceId || deviceA.instanceId;
    const idB = deviceB.device_id || deviceB.deviceId || deviceB.instanceId;

    if (idA && idB) {
      return idA === idB;
    }

    // Fallback por nombre solo si alguno de los dos carece por completo de un ID físico
    return (
      this.normalizeNameForComparison(deviceA.name) ===
      this.normalizeNameForComparison(deviceB.name)
    );
  },

  /**
   * Verificar si un dispositivo ya existe en la lista
   */
  deviceExists(device, existingDevices) {
    return existingDevices.some((d) => this.isSameDevice(device, d));
  },

  /**
   * Filtrar dispositivos nuevos (que no existen en la lista actual)
   */
  filterNewDevices(detectedDevices, currentDevices) {
    const existingIds = new Set(
      currentDevices
        .map((d) => d.device_id || d.deviceId || d.instanceId)
        .filter(Boolean)
    );

    // Mantenemos los nombres solo para aquellos dispositivos que no tienen ID físico
    const existingNames = new Set(
      currentDevices
        .filter((d) => !(d.device_id || d.deviceId || d.instanceId))
        .map((d) => this.normalizeNameForComparison(d.name))
        .filter(Boolean)
    );

    return detectedDevices.filter((d) => {
      if (!d.name) return false;

      const detectedId = d.device_id || d.deviceId || d.instanceId;
      if (detectedId) {
        if (existingIds.has(detectedId)) return false;
        // Si tiene ID y no está en `existingIds`, es estrictamente nuevo. Omitimos el nombre.
        return true;
      }

      // Solo si el dispositivo detectado carece de ID físico, utilizamos el nombre como fallback
      return !existingNames.has(this.normalizeNameForComparison(d.name));
    });
  },

  mergeDetectedDevices(usbDevices, webcams) {
    const combined = [];

    // 1. Deduplicar los propios usbDevices (porque un mismo USB reporta endpoints de video, audio, etc)
    for (const usb of usbDevices) {
      const normName = this.normalizeNameForComparison(usb.name);
      const existsInCombined = combined.some(
        (d) => this.normalizeNameForComparison(d.name) === normName
      );

      if (!existsInCombined && usb.name) {
        // Preferir nombres sin paréntesis si es que hay varias opciones para la misma cámara
        // O simplemente nos quedamos con la primera que llegue
        combined.push(usb);
      }
    }

    // 2. Unir webcams omitiendo las que ya estén en USB
    for (const webcam of webcams) {
      const normName = this.normalizeNameForComparison(webcam.name);
      const existsInCombined = combined.some(
        (d) => this.normalizeNameForComparison(d.name) === normName
      );

      if (!existsInCombined && webcam.name) {
        combined.push(webcam);
      }
    }

    return combined;
  },

  /**
   * Asignar IDs numéricos únicos a dispositivos que no tienen uno estable
   */
  assignUniqueIds(devices, startingId) {
    return devices.map((d, index) => ({
      ...d,
      id: d.id || startingId + index,
    }));
  },

  /**
   * Determinar el mensaje de estado apropiado
   */
  getDetectionStatusMessage(
    detectedDevices,
    newDevices,
    hasElectronAPI,
    webcamsCount,
  ) {
    if (newDevices.length > 0) {
      return {
        type: "success",
        message: `Se detectaron ${newDevices.length} dispositivo(s) nuevo(s)`,
      };
    }
    if (detectedDevices.length > 0) {
      return {
        type: "info",
        message: "Los dispositivos detectados ya están en la lista",
      };
    }
    if (!hasElectronAPI) {
      return {
        type: "info",
        message:
          webcamsCount === 0
            ? "No se detectaron cámaras. Conecte un dispositivo o agregue uno manualmente."
            : "Detección limitada en modo web. Para detectar todos los dispositivos, use la aplicación de escritorio.",
      };
    }
    return {
      type: "info",
      message: "No se detectaron dispositivos conectados",
    };
  },

  /**
   * Limpiar cache periódicamente para evitar memory leaks
   */
  clearCache() {
    normalizationCache.clear();
    virtualCameraCache.clear();
  },

  /**
   * Detectar lectores biométricos vía WebSocket
   */
  async detectBiometricDevices() {
    // Obtener token de autenticación antes de conectar
    let biometricToken = null;
    try {
      biometricToken = await window.electronAPI?.getBiometricToken?.();
    } catch (e) {
      console.warn("[BiometricDetect] No se pudo obtener token:", e);
    }

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket("ws://localhost:8787/");
        const timeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.CLOSED) ws.close();
          resolve([]);
        }, 3000);

        ws.onopen = () => {
          // Autenticar primero si hay token, sino intentar directo
          if (biometricToken) {
            ws.send(JSON.stringify({ command: "auth", token: biometricToken }));
          } else {
            ws.send(JSON.stringify({ command: "getStatus" }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Después de autenticación exitosa, pedir status
            if (data.type === "authResult" && data.success) {
              ws.send(JSON.stringify({ command: "getStatus" }));
              return;
            }

            if (
              data.type === "systemStatus" ||
              data.type === "readerConnection"
            ) {
              if (data.readerConnected || data.connected) {
                clearTimeout(timeout);
                ws.close();
                // Usar SerialNumber real del middleware (si lo envía)
                const serialNumber = data.readerSerialNumber || null;
                const readerModel = data.readerModel || "DigitalPersona";
                resolve([
                  {
                    id: serialNumber ? `biometric-${serialNumber}` : "biometric-reader-dp",
                    name: `Lector de Huella (${readerModel})`,
                    type: "dactilar",
                    connection: "USB",
                    ip: "",
                    port: "",
                    detected: true,
                    instanceId: serialNumber,
                    deviceId: serialNumber,
                  },
                ]);
              } else {
                // Lector reportado como desconectado
                clearTimeout(timeout);
                ws.close();
                resolve([]);
              }
            }
          } catch (e) {
            console.error("Error parsing WS message:", e);
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve([]);
        };
      } catch (error) {
        console.error("Error en detección biométrica:", error);
        resolve([]);
      }
    });
  },
};
