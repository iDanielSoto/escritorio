import { createContext, useContext, useState, useRef, useCallback } from "react";

const CameraContext = createContext(null);

export function CameraProvider({ children }) {
  const [stream, setStream] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  // Refs para el estado síncrono
  const streamRef = useRef(null);
  const usageCountRef = useRef(0);

  // NUEVO: Ref para guardar la promesa de inicialización en curso
  const initializationPromiseRef = useRef(null);

  // Inicializar cámara
  const initCamera = useCallback(async () => {
    usageCountRef.current++;

    // 1. Si ya hay un stream activo, reutilizarlo inmediatamente
    if (streamRef.current && streamRef.current.active) {
      // Nos aseguramos que el estado refleje que está activo
      if (!isActive) setIsActive(true);
      return streamRef.current;
    }

    // 2. PROTECCIÓN DE CARRERA: Si ya se está inicializando, devolver esa misma promesa
    // Esto evita llamar a getUserMedia dos veces simultáneamente.
    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current;
    }

    try {
      setError(null);

      // 3. Guardamos la promesa en el ref mientras carga
      initializationPromiseRef.current = navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });

      const mediaStream = await initializationPromiseRef.current;

      // 4. VERIFICACIÓN POST-CARGA (Edge Case):
      // Si mientras cargaba (await), el usuario salió (releaseCamera),
      // el contador habrá bajado a 0. En ese caso, detenemos el stream inmediatamente.
      if (usageCountRef.current === 0) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return null;
      }

      // 5. Configuración exitosa
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);

      return mediaStream;

    } catch (err) {
      setError(err.message);
      // Importante: Si falla, restamos el uso porque este componente no obtuvo la cámara
      usageCountRef.current = Math.max(0, usageCountRef.current - 1);
      throw err;
    } finally {
      // 6. Limpiamos la promesa, ya sea éxito o error
      initializationPromiseRef.current = null;
    }
  }, [isActive]); // isActive agregado a deps por seguridad, aunque useRef maneja la lógica principal

  // Liberar uso de cámara
  const releaseCamera = useCallback(() => {
    usageCountRef.current = Math.max(0, usageCountRef.current - 1);

    // Solo detener si nadie más está usando la cámara
    if (usageCountRef.current === 0 && streamRef.current) {
      stopTracks();
    }
  }, []);

  // Forzar liberación (útil para un botón de "Apagar cámara" manual o logout)
  const forceRelease = useCallback(() => {
    usageCountRef.current = 0;
    stopTracks();
  }, []);

  // Función auxiliar interna para detener tracks y limpiar estado
  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    initializationPromiseRef.current = null; // Cancelar referencia a promesa si existiera
    setStream(null);
    setIsActive(false);
  };

  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

  const attachToVideo = useCallback((videoElement) => {
    if (videoElement && streamRef.current) {
      videoElement.srcObject = streamRef.current;
    }
  }, []);

  const value = {
    stream,
    isActive,
    error,
    initCamera,
    releaseCamera,
    forceRelease,
    getStream,
    attachToVideo,
  };

  return (
    <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
  );
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCamera debe usarse dentro de CameraProvider");
  }
  return context;
}