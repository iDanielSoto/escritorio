import { useEffect } from "react";
import { X, CheckCircle, XCircle, Eye } from "lucide-react";
import { useFaceDetection } from "../../hooks/useFaceDetection";

export default function CameraModal({
  cameraMode,
  captureProgress,
  captureSuccess,
  captureFailed,
  isClosing,
  onClose,
  onFaceDetected,
}) {
  const {
    modelsLoaded,
    faceDetected,
    livenessDetected,
    detectionProgress,
    detectionError,
    loadModels,
    startFaceDetection,
    stopFaceDetection,
  } = useFaceDetection();

  // Cargar modelos cuando se monta el componente
  useEffect(() => {
    console.log("📦 CameraModal montado, cargando modelos...");
    loadModels();
  }, [loadModels]);

  // Iniciar detección facial cuando el video esté listo
  useEffect(() => {
    if (!modelsLoaded || captureSuccess || captureFailed) return;

    const video = document.getElementById("cameraVideo");
    if (!video) {
      console.warn("⚠️ Elemento de video no encontrado");
      return;
    }

    // Esperar a que el video esté listo
    const handleVideoReady = () => {
      console.log("📹 Video listo, iniciando detección facial...");
      console.log("📹 Video dimensions:", video.videoWidth, "x", video.videoHeight);

      startFaceDetection(
        video,
        (result) => {
          console.log("✅ Rostro detectado y validado:", result);
          onFaceDetected?.(result.descriptor);
        },
        (error) => {
          console.error("❌ Error en detección:", error);
        }
      );
    };

    // Múltiples eventos para asegurar que el video se inicie
    const handleCanPlay = () => {
      console.log("📹 Video can play");
      if (video.readyState >= 2) {
        handleVideoReady();
      }
    };

    video.addEventListener("loadeddata", handleCanPlay);
    video.addEventListener("canplay", handleCanPlay);

    // Si ya está listo, iniciar inmediatamente
    if (video.readyState >= 2) {
      handleVideoReady();
    }

    return () => {
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
      stopFaceDetection();
    };
  }, [modelsLoaded, captureSuccess, captureFailed, startFaceDetection, stopFaceDetection, onFaceDetected]);

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`bg-bg-primary rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transition-all duration-300 ${
          isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                {cameraMode === "asistencia" ? "Registro de Asistencia" : "Inicio de Sesión"}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">Reconocimiento Facial</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="p-6">
          <div className="relative bg-black rounded-xl overflow-hidden w-full" style={{ aspectRatio: "4/3", minHeight: "400px" }}>
            <video
              id="cameraVideo"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)", minHeight: "400px" }}
            />

            {/* Esquinas simples */}
            {!captureSuccess && !captureFailed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-56 h-72">
                  <div
                    className="absolute top-0 left-0 w-12 h-12 border-l-[3px] border-t-[3px] transition-all duration-300"
                    style={{
                      borderColor: captureProgress > 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                      filter: captureProgress > 0 ? 'drop-shadow(0 0 8px rgba(59,130,246,0.8))' : 'none'
                    }}
                  />
                  <div
                    className="absolute top-0 right-0 w-12 h-12 border-r-[3px] border-t-[3px] transition-all duration-300"
                    style={{
                      borderColor: captureProgress > 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                      filter: captureProgress > 0 ? 'drop-shadow(0 0 8px rgba(59,130,246,0.8))' : 'none'
                    }}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-12 h-12 border-l-[3px] border-b-[3px] transition-all duration-300"
                    style={{
                      borderColor: captureProgress > 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                      filter: captureProgress > 0 ? 'drop-shadow(0 0 8px rgba(59,130,246,0.8))' : 'none'
                    }}
                  />
                  <div
                    className="absolute bottom-0 right-0 w-12 h-12 border-r-[3px] border-b-[3px] transition-all duration-300"
                    style={{
                      borderColor: captureProgress > 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                      filter: captureProgress > 0 ? 'drop-shadow(0 0 8px rgba(59,130,246,0.8))' : 'none'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Éxito */}
            {captureSuccess && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-1">
                    {cameraMode === "asistencia" ? "¡Registro Exitoso!" : "¡Acceso Concedido!"}
                  </h4>
                  <p className="text-white/90 text-sm">Bienvenida, <strong>Amaya Abarca</strong></p>
                </div>
              </div>
            )}

            {/* Error */}
            {captureFailed && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 bg-red-500 rounded-full flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-1">No Identificado</h4>
                  <p className="text-white/90 text-sm">Intenta de nuevo</p>
                </div>
              </div>
            )}

          </div>

          {/* Indicadores de detección */}
          <div className="mt-4 space-y-2">
            {/* Instrucción */}
            <p className="text-center text-gray-700 dark:text-gray-300 text-sm font-medium">
              {!modelsLoaded && "Cargando modelos de reconocimiento..."}
              {modelsLoaded && !faceDetected && "Coloca tu rostro frente a la cámara"}
              {modelsLoaded && faceDetected && !livenessDetected && "Mantén tu rostro frente a la cámara (parpadea si quieres acelerar)"}
              {modelsLoaded && livenessDetected && "¡Rostro validado! Procesando..."}
            </p>

            {/* Indicadores visuales */}
            {modelsLoaded && (
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className={`flex items-center gap-1.5 ${faceDetected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${faceDetected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="font-medium">Rostro detectado</span>
                </div>
                <div className={`flex items-center gap-1.5 ${livenessDetected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <Eye className={`w-4 h-4 ${livenessDetected ? 'animate-pulse' : ''}`} />
                  <span className="font-medium">Liveness</span>
                </div>
              </div>
            )}

            {/* Barra de progreso de detección */}
            {modelsLoaded && detectionProgress > 0 && !captureSuccess && !captureFailed && (
              <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${detectionProgress}%` }}
                />
              </div>
            )}

            {/* Estado de carga de modelos */}
            {!modelsLoaded && (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-gray-600 dark:text-gray-400 text-xs">Cargando modelos...</span>
              </div>
            )}

            {/* Error de detección */}
            {detectionError && (
              <p className="text-center text-red-500 dark:text-red-400 text-xs font-medium">{detectionError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}