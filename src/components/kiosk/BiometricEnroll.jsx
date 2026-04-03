import { useState, useRef, useEffect } from "react";
import { Fingerprint, Wifi, WifiOff, X, Database, CheckCircle } from "lucide-react";
import { registrarHuella } from "../../services/biometricAuthService";
import { API_CONFIG } from "../../config/apiEndPoint";
import useBiometricWebSocket from "../../hooks/useBiometricWebSocket";

export default function BiometricEnroll({
  isOpen = false,
  onClose,
  onEnrollmentSuccess,
  idEmpleado = null,
}) {
  if (!isOpen) return null;

  const API_URL = `${API_CONFIG.BASE_URL}/api`;
  const messageHandlerRef = useRef(null);
  const isClosingRef = useRef(false);

  const [enrollProgress, setEnrollProgress] = useState({
    collected: 0,
    required: 4,
    percentage: 0,
  });
  const [lastEnrollmentData, setLastEnrollmentData] = useState(null);

  const {
    connected,
    readerConnected,
    currentOperation,
    setCurrentOperation,
    setStatus,
    savingToDatabase,
    setSavingToDatabase,
    sendCommand,
    addMessage,
    connectToServer,
    stopCapture,
  } = useBiometricWebSocket((data) => {
    if (messageHandlerRef.current) messageHandlerRef.current(data);
  });

  const iniciarEnrollment = () => {
    if (!idEmpleado) {
      addMessage("❌ No hay ID de empleado configurado", "error");
      return;
    }

    // Forzar limpieza de cualquier operación previa (ej: AsistenciaHuella que quedó colgada)
    stopCapture();

    isClosingRef.current = false;
    setLastEnrollmentData(null);
    setEnrollProgress({ collected: 0, required: 4, percentage: 0 });
    setCurrentOperation("Enrollment");

    // Pequeño delay de 250ms para asegurar que el middleware detuvo la captura anterior
    setTimeout(() => {
      const userId = `emp_${idEmpleado}`;
      sendCommand("startEnrollment", { userId });
      addMessage("🔍 Esperando huella para registro...", "info");
    }, 250);
  };

  const guardarHuellaEnBaseDatos = async (userId, templateBase64) => {
    if (!idEmpleado) {
      addMessage("❌ No hay ID de empleado configurado", "error");
      return;
    }

    if (!templateBase64) {
      addMessage("❌ No se recibió el template de la huella", "error");
      return;
    }

    setSavingToDatabase(true);
    addMessage("💾 Guardando huella en base de datos...", "info");

    try {
      const result = await registrarHuella(idEmpleado, templateBase64, userId);

      if (result.success) {
        addMessage("✅ Huella guardada exitosamente", "success");
        addMessage(`📊 Tamaño: ${result.data.template_size} bytes`, "info");

        const empresaId = localStorage.getItem("empresa_id");
        sendCommand("reloadTemplates", { 
          apiUrl: API_URL,
          empresaId: empresaId 
        });
        addMessage("🔄 Actualizando caché de huellas...", "info");

        if (onEnrollmentSuccess) {
          onEnrollmentSuccess({
            userId,
            idEmpleado,
            idCredencial: result.data.id_credencial,
            timestamp: result.data.timestamp,
          });
        }

        // Cierre automático después de éxito
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          setTimeout(() => {
            handleClose();
          }, 2000);
        }
      } else {
        addMessage(`❌ Error DB: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Error guardando en DB:", error);
      addMessage(`❌ Error conectando con backend: ${error.message}`, "error");
    } finally {
      setSavingToDatabase(false);
    }
  };

  // Registrar el handler de mensajes
  useEffect(() => {
    messageHandlerRef.current = (data) => {

      if (data.type === "enrollProgress") {
        // Validar que el progreso sea de la persona que actualmente estamos enrolando
        if (data.userId && data.userId !== `emp_${idEmpleado}`) {
          return;
        }

        setEnrollProgress({
          collected: data.samplesCollected,
          required: data.samplesRequired,
          percentage: data.percentage,
        });
        addMessage(
          `📊 Progreso: ${data.samplesCollected}/${data.samplesRequired} (${data.percentage}%)`,
          "info"
        );
      }

      if (data.type === "captureComplete" && data.result === "enrollmentSuccess") {
        if (data.userId !== `emp_${idEmpleado}`) {
          addMessage("⚠️ Huella descartada (pertenece a un escaneo anterior)", "warning");
          // Reseteamos el lector por si se quedó colgado
          stopCapture();
          setCurrentOperation("None");
          return;
        }

        addMessage(`✅ Captura completada: ${data.userId}`, "success");

        setLastEnrollmentData({
          userId: data.userId,
          templateBase64: data.templateBase64,
          timestamp: data.timestamp,
        });

        if (!data.templateBase64 && window.electronAPI) {
          addMessage("📄 Leyendo template desde archivo...", "info");
          window.electronAPI
            .readFingerprintTemplate(data.userId)
            .then((templateBase64) => {
              if (templateBase64) {
                addMessage("✅ Template cargado desde archivo", "success");
                guardarHuellaEnBaseDatos(data.userId, templateBase64);
              } else {
                addMessage("❌ No se pudo leer el template desde archivo", "error");
              }
            })
            .catch((error) => {
              console.error("Error leyendo template:", error);
              addMessage(`❌ Error leyendo template: ${error.message}`, "error");
            });
        } else if (data.templateBase64) {
          guardarHuellaEnBaseDatos(data.userId, data.templateBase64);
        } else {
          addMessage("⚠️ Template no disponible", "warning");
        }

        // Resetear servidor a modo "None" para dejar el lector limpio
        stopCapture();
        setEnrollProgress({ collected: 0, required: 4, percentage: 0 });
        setCurrentOperation("None");
        setStatus("ready");
      }
    };
  }, []);

  const cancelEnrollment = () => {
    stopCapture();
    setEnrollProgress({ collected: 0, required: 4, percentage: 0 });
    setCurrentOperation("None");
    addMessage("⏹️ Operación cancelada", "warning");
  };

  const handleClose = () => {
    isClosingRef.current = true;
    if (currentOperation !== "None") stopCapture();
    setCurrentOperation("None");
    setLastEnrollmentData(null);
    setEnrollProgress({ collected: 0, required: 4, percentage: 0 });
    if (onClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#1976D2] p-2 rounded-lg">
                <Fingerprint className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Registrar Huella Digital
              </h1>
            </div>

            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Reader Status */}
            <div
              className={`flex items-center justify-between p-4 rounded-xl ${readerConnected
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                }`}
            >
              <div className="flex items-center gap-3">
                <Fingerprint
                  className={`w-6 h-6 ${readerConnected
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                    }`}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Lector de Huellas</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {readerConnected ? "Conectado y listo" : "Desconectado"}
                  </p>
                </div>
              </div>
            </div>

            {/* Enroll Section */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Registrar Nueva Huella
              </h2>

              <div className="space-y-4">
                <div className="bg-[#E3F2FD] dark:bg-[#1565C0]/20 border border-[#BBDEFB] dark:border-[#1565C0]/40 rounded-lg p-6 text-center">
                  <Fingerprint className="w-16 h-16 mx-auto mb-3 text-[#1976D2] dark:text-[#42A5F5]" />
                  <p className="text-gray-900 dark:text-white font-medium mb-1">
                    Coloca tu dedo en el lector
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Se requieren 4 muestras para el registro
                  </p>
                </div>

                {currentOperation === "Enrollment" && (
                  <div className="bg-[#E3F2FD] dark:bg-[#1565C0]/20 border border-[#BBDEFB] dark:border-[#1565C0]/40 rounded-lg p-4">
                    <div className="mb-3">
                      <div className="flex justify-between text-gray-900 dark:text-white text-sm mb-2">
                        <span>
                          Muestras: {enrollProgress.collected}/{enrollProgress.required}
                        </span>
                        <span>{enrollProgress.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#1976D2] h-full transition-all duration-300 rounded-full"
                          style={{ width: `${enrollProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-center text-sm">
                      Coloque el mismo dedo en el lector
                    </p>
                  </div>
                )}

                {savingToDatabase && (
                  <div className="bg-[#E3F2FD] dark:bg-[#1565C0]/20 border border-[#BBDEFB] dark:border-[#1565C0]/40 rounded-lg p-3">
                    <p className="text-gray-900 dark:text-white text-center text-sm flex items-center justify-center gap-2">
                      <Database className="w-4 h-4" />
                      Guardando en base de datos...
                    </p>
                  </div>
                )}

                {currentOperation === "Enrollment" ? (
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={cancelEnrollment}
                      className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={iniciarEnrollment}
                      disabled={!readerConnected}
                      className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${!readerConnected
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-[#1976D2] hover:bg-[#1565C0]"
                        }`}
                    >
                      <Fingerprint className="w-5 h-5" />
                      {lastEnrollmentData ? "Registrar Otra Huella" : "Iniciar Registro"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Last Enrollment Result */}
            {lastEnrollmentData && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-green-800 dark:text-green-300 font-bold">
                      Huella Registrada Exitosamente
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                      Empleado ID: <strong>{idEmpleado}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
