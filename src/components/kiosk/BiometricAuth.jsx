import { useState, useEffect, useRef } from "react";
import { Fingerprint, Wifi, WifiOff, X, CheckCircle2, AlertCircle, Loader2, Database } from "lucide-react";
import { guardarSesion } from "../../services/biometricAuthService";
import useBiometricWebSocket from "../../hooks/useBiometricWebSocket";
import { getApiEndpoint } from "../../config/apiEndPoint";

export default function BiometricAuth({ isOpen = false, onClose, onAuthSuccess }) {
  if (!isOpen) return null;

  const API_URL = getApiEndpoint("/api");
  const empresaId = localStorage.getItem("empresa_id");
  const messageHandlerRef = useRef(null);
  
  const [identificando, setIdentificando] = useState(false);
  const [processingLogin, setProcessingLogin] = useState(false);
  const [result, setResult] = useState(null); // { success: boolean, message: string, data?: object }
  const [countdown, setCountdown] = useState(6);
  const countdownIntervalRef = useRef(null);
  const isProcessingRef = useRef(false);

  const {
    connected,
    readerConnected,
    currentOperation,
    setCurrentOperation,
    setStatus,
    sendCommand,
    addMessage,
    stopCapture,
  } = useBiometricWebSocket((data) => {
    if (messageHandlerRef.current) messageHandlerRef.current(data);
  });

  const iniciarIdentificacion = () => {
    sendCommand("startIdentification", { 
      apiUrl: API_URL,
      empresaId: empresaId
    });
    setCurrentOperation("Identifying");
    addMessage("🔍 Esperando huella...", "info");
  };

  const handleClose = () => {
    isProcessingRef.current = false;
    if (currentOperation !== "None") stopCapture();
    setCurrentOperation("None");
    if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
    }
    if (onClose) onClose();
  };

  // Countdown para cierre automático
  useEffect(() => {
    if (result) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      setCountdown(6);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            handleClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [result]);

  const procesarLoginBiometrico = async (empleadoId, matchScore) => {
    setProcessingLogin(true);
    addMessage("🔐 Procesando inicio de sesión...", "info");

    try {
      const authResponse = await fetch(`${API_URL}/auth/biometric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          empleado_id: empleadoId,
          empresa_id: empresaId
        }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al autenticar");
      }

      const response = await authResponse.json();

      if (!response.success) {
        throw new Error(response.message || "Error en autenticación");
      }

      const { usuario, roles, permisos, esAdmin, token } = response.data;

      if (token) {
        localStorage.setItem("auth_token", token);
      }

      const usuarioCompleto = {
        ...usuario,
        roles,
        permisos,
        esAdmin,
        token,
        matchScore,
        metodoAutenticacion: "HUELLA",
      };

      guardarSesion(usuarioCompleto);
      setResult({ success: true, message: "Sesión iniciada correctamente", data: usuarioCompleto });
      
      if (onAuthSuccess) onAuthSuccess(usuarioCompleto);
    } catch (error) {
      console.error("Error procesando login biométrico:", error);
      addMessage(`❌ Error: ${error.message}`, "error");
      setResult({ success: false, message: error.message });
    } finally {
      setProcessingLogin(false);
      setIdentificando(false);
      setCurrentOperation("None");
      setStatus("ready");
    }
  };

  // Registrar el handler de mensajes
  useEffect(() => {
    messageHandlerRef.current = (data) => {
      if (data.type === "systemStatus" && data.readerConnected) {
        if (data.currentOperation === "None") {
          setTimeout(() => iniciarIdentificacion(), 500);
        } else if (data.currentOperation !== "Identifying") {
          stopCapture();
          setTimeout(() => iniciarIdentificacion(), 800);
        }
      }

      if (data.type === "captureComplete") {
        if (data.result === "identificationSuccess") {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;

          setIdentificando(true);
          addMessage(`✅ Huella reconocida: ${data.userId}`, "success");
          
          const match = data.userId?.match(/emp_([A-Z0-9\-]+)/i);
          if (match) {
            procesarLoginBiometrico(match[1], data.matchScore || 100);
          } else {
            isProcessingRef.current = false;
            setIdentificando(false);
            addMessage("❌ No se pudo extraer el ID del empleado", "error");
            setResult({ success: false, message: "ID de empleado no válido" });
          }
        } else if (data.result === "identificationFailed") {
          addMessage("❌ Huella no reconocida", "error");
          setResult({ success: false, message: "Huella no reconocida en el sistema" });
          setTimeout(() => iniciarIdentificacion(), 2000);
        }
      }
    };
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-backdrop text-left">
      <div className="bg-bg-primary rounded-lg shadow-2xl max-w-md sm:max-w-lg w-full overflow-hidden border border-border-subtle animate-zoom-in">
        <div className="p-6 sm:p-8">
          {/* Header Minimalista */}
          <div className="text-center mb-6 relative">
            <button
              onClick={handleClose}
              className="absolute -top-2 -right-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md p-2 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Inicio de Sesión</h2>
            <p className="text-text-tertiary text-xs mt-1 opacity-80 uppercase tracking-widest font-medium">Biometría Dactilar</p>
          </div>

          <div className="space-y-4">
            {/* Status del Lector */}
            <div className={`flex items-center justify-between p-3 rounded-md border ${readerConnected ? "bg-success/5 border-success/20" : "bg-warning/5 border-warning/20"}`}>
              <div className="flex items-center gap-3">
                <Fingerprint className={`w-5 h-5 ${readerConnected ? "text-success" : "text-warning"}`} />
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Lector de Huellas</p>
                  <p className="text-xs text-text-primary font-medium">{readerConnected ? "Conectado y listo" : "Desconectado"}</p>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            {identificando || processingLogin ? (
              <div className="animate-in fade-in zoom-in duration-300">
                <div className="bg-accent/5 border border-accent/20 rounded-xl p-8 text-center">
                  <div className="relative inline-flex mb-4">
                    <Fingerprint className="w-16 h-16 text-accent animate-pulse" />
                    <div className="absolute -inset-3 flex items-center justify-center">
                      <div className="w-20 h-20 border-2 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-1">Identificando...</h3>
                  <p className="text-text-tertiary text-xs">Verificando identidad en el sistema</p>
                </div>
              </div>
            ) : !result ? (
              <div className="space-y-4">
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-xl p-6 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/5 mb-4 ring-1 ring-accent/10">
                    <Fingerprint className={`w-10 h-10 text-accent ${connected && readerConnected ? "animate-pulse" : ""}`} />
                  </div>
                  <p className="text-text-primary font-bold text-base mb-1">
                    {!connected ? "Conectando..." : !readerConnected ? "Esperando lector..." : "Coloca tu dedo"}
                  </p>
                  <p className="text-text-tertiary text-xs">
                    {!connected ? "Estableciendo conexión" : !readerConnected ? "Verifica el dispositivo" : "Identificación automática habilitada"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in zoom-in duration-300">
                <div className={`rounded-xl p-6 text-center border ${result.success ? "bg-success/5 border-success/20" : "bg-error/5 border-error/20"}`}>
                  {result.success ? (
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
                  ) : (
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                  )}
                  <h3 className={`text-lg font-bold mb-1 ${result.success ? "text-success" : "text-error"}`}>
                    {result.success ? "¡Bienvenido!" : "Error de Acceso"}
                  </h3>
                  <p className="text-text-primary text-base font-semibold mb-1">
                    {result.data?.nombre || "Usuario"}
                  </p>
                  <p className="text-text-tertiary text-xs mb-4">{result.message}</p>
                  
                  <div className="mt-4 pt-4 border-t border-border-subtle flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Cerrando en {countdown}s
                    </div>
                    {!result.success && (
                      <button 
                        onClick={() => {
                          isProcessingRef.current = false;
                          setResult(null);
                        }} 
                        className="text-accent font-bold text-sm hover:underline"
                      >
                        Intentar de nuevo
                      </button>
                    )}
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
