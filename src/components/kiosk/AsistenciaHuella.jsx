import { useState, useEffect, useRef } from "react";
import {
  Fingerprint,
  Wifi,
  WifiOff,
  X,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  LogIn,
  Timer,
  Loader2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { guardarSesion } from "../../services/biometricAuthService";
import { obtenerEscritorio } from "../../services/escritorioService";
import { API_CONFIG, fetchApi } from "../../config/apiEndPoint";
import { agregarEvento } from "../../services/bitacoraService";

import { useConnectivity } from "../../hooks/useConnectivity";

export default function AsistenciaHuella({
  isOpen = false,
  onClose,
  onSuccess,
  onLoginRequest,
  onReaderStatusChange, // Callback para notificar cambios en el estado del lector
  backgroundMode = false // Modo silencioso: conexión activa pero sin modal visible hasta detectar huella
}) {
  // En modo normal, si no está abierto, no renderizar
  // En modo background, siempre mantener la conexión activa
  const shouldMaintainConnection = isOpen || backgroundMode;

  const [connected, setConnected] = useState(false);
  const [showModal, setShowModal] = useState(!backgroundMode); // En background, modal oculto inicialmente
  const [readerConnected, setReaderConnected] = useState(false);
  const [currentOperation, setCurrentOperation] = useState("None");
  const [status, setStatus] = useState("disconnected");
  const [statusMessage, setStatusMessage] = useState("");
  const [processingAttendance, setProcessingAttendance] = useState(false);
  const [processingLogin, setProcessingLogin] = useState(false);
  const [result, setResult] = useState(null); // { success: boolean, message: string, empleado?: object }
  const [countdown, setCountdown] = useState(6); // Contador de 6 segundos
  const [loginHabilitado, setLoginHabilitado] = useState(false); // Prevenir login automático
  const [identificando, setIdentificando] = useState(false); // Estado para mostrar pantalla de "Identificando..."
  const [messages, setMessages] = useState([]);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const hasStartedIdentification = useRef(false);
  const countdownIntervalRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const backgroundModeRef = useRef(backgroundMode);
  const isProcessingAttendanceRef = useRef(false); // Ref para prevenir llamadas duplicadas
  const MAX_RECONNECT_ATTEMPTS = 5;

  const { isDatabaseConnected } = useConnectivity();
  const isDatabaseConnectedRef = useRef(isDatabaseConnected);

  // Mantener las refs actualizadas
  useEffect(() => {
    onCloseRef.current = onClose;
    backgroundModeRef.current = backgroundMode;
    isDatabaseConnectedRef.current = isDatabaseConnected;
  }, [onClose, backgroundMode, isDatabaseConnected]);

  // Notificar al padre cuando cambia el estado del lector
  useEffect(() => {
    if (onReaderStatusChange) {
      onReaderStatusChange(readerConnected);
    }
  }, [readerConnected, onReaderStatusChange]);



  // Reset de loginHabilitado al montar el componente (prevenir login automático)
  useEffect(() => {
    // Solo resetear loginHabilitado al montar para prevenir login automático
    // NO resetear result aquí porque puede interferir con el flujo de registro
    setLoginHabilitado(false);
    setProcessingLogin(false);

    // En modo background, asegurar que el modal esté oculto inicialmente
    if (backgroundMode) {
      setShowModal(false);
    }

    return () => {
      // Limpiar al desmontar
      setLoginHabilitado(false);
    };
  }, []); // Solo al montar/desmontar

  // Conectar al servidor cuando shouldMaintainConnection sea true
  useEffect(() => {
    if (shouldMaintainConnection) {
      connectToServer();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        const socket = wsRef.current;
        // Enviar stopCapture antes de cerrar la conexión para asegurar que el lector se libere
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ command: "stopCapture" }));
          } catch (e) {
            console.error("Error enviando stopCapture en AsistenciaHuella:", e);
          }
          // Retrasar el cierre para permitir el envío del socket antes de desconectar
          setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.close();
            }
          }, 150);
        } else {
          socket.close();
        }
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [shouldMaintainConnection, backgroundMode]);

  // Ref para la función de cierre del modal (necesaria para el setInterval)
  const closeModalRef = useRef(null);

  // Actualizar la ref de cierre
  useEffect(() => {
    closeModalRef.current = () => {
      // SIEMPRE deshabilitar login al cerrar para prevenir llamadas automáticas
      setLoginHabilitado(false);
      setIdentificando(false);
      // Resetear ref de procesamiento para permitir nuevos registros
      isProcessingAttendanceRef.current = false;

      if (backgroundModeRef.current) {
        // En modo background, solo ocultar el modal y reiniciar
        setShowModal(false);
        setResult(null);
        setMessages([]);
        hasStartedIdentification.current = false;
        // Reiniciar identificación después de cerrar
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const empresaId = localStorage.getItem("empresa_id");
            console.log("🔄 Reiniciando identificación con empresaId:", empresaId);
            sendCommand("startIdentification", { 
              apiUrl: `${API_CONFIG.BASE_URL}/api`,
              empresaId
            });
          }
        }, 500);
      } else {
        // En modo normal, cerrar completamente
        if (onCloseRef.current) onCloseRef.current();
      }
    };
  }, []);

  // Countdown para cerrar automáticamente después de resultado (éxito o no disponible)
  useEffect(() => {
    // Activar countdown cuando hay éxito O cuando no puede registrar (fuera de horario)
    // O error con empleado identificado O cualquier error en modo background
    // O huella no reconocida
    const debeIniciarCountdown = result?.success ||
      result?.noPuedeRegistrar ||
      result?.noReconocida || // Huella no reconocida
      (result && !result.success && result.empleadoId) ||
      (backgroundMode && result && !result.success); // En background, cerrar automáticamente cualquier error

    if (debeIniciarCountdown) {
      // Limpiar cualquier intervalo anterior
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      setCountdown(6);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            // Cerrar después de mostrar 0
            setTimeout(() => {
              if (closeModalRef.current) closeModalRef.current();
            }, 500);
            return 0;
          }
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [result?.success, result?.noPuedeRegistrar, result?.empleadoId]);

  // Habilitar login solo después de que el resultado se muestre Y el modal esté visible (prevenir login automático)
  useEffect(() => {
    // Solo habilitar login si:
    // 1. Hay un resultado con empleadoId
    // 2. El modal está visible (showModal es true)
    // 3. Después de un delay para asegurar que el usuario vea la ventana
    if (result && result.empleadoId && showModal) {
      // Resetear el estado de login habilitado
      setLoginHabilitado(false);
      // Habilitar el botón después de un delay más largo para asegurar que el usuario vea la ventana
      const timer = setTimeout(() => {
        // Verificar nuevamente que el modal sigue visible antes de habilitar
        setLoginHabilitado(true);
      }, 1000); // Aumentado a 1 segundo para dar tiempo a ver la ventana
      return () => clearTimeout(timer);
    } else {
      setLoginHabilitado(false);
    }
  }, [result, showModal]);

  const connectToServer = async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Obtener token de autenticación desde Electron
      let authToken = null;
      if (window.electronAPI?.getBiometricToken) {
        try {
          authToken = await window.electronAPI.getBiometricToken();
          console.log("🔑 [AsistenciaHuella] Token obtenido:", authToken ? "✅" : "❌ null");
        } catch (err) {
          console.warn("No se pudo obtener token biométrico:", err);
        }
      }

      addMessage("🔌 Conectando al servidor...", "info");
      const ws = new WebSocket("ws://localhost:8787/");
      wsRef.current = ws;

      // Guardar token para el closure
      const tokenToSend = authToken;

      ws.onopen = () => {
        setConnected(true);
        setStatus("connected");
        reconnectAttemptsRef.current = 0;
        addMessage("✅ Conectado al servidor biométrico", "success");

        // Enviar autenticación si hay token
        if (tokenToSend) {
          console.log("🔐 [AsistenciaHuella] Enviando autenticación...");
          ws.send(JSON.stringify({ command: "auth", token: tokenToSend }));
        } else {
          // Sin token, solicitar estado directamente
          sendCommand("getStatus");
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setReaderConnected(false);
        setStatus("disconnected");
        setCurrentOperation("None");
        addMessage("❌ Desconectado del servidor", "warning");

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            10000
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            addMessage(
              `🔄 Reintentando conexión (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`,
              "info"
            );
            connectToServer();
          }, delay);
        } else {
          addMessage("❌ Máximo de reintentos alcanzado", "error");
        }
      };

      ws.onerror = (error) => {
        addMessage("❌ Error de conexión WebSocket", "error");
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        } catch (error) {
          console.error("Error parsing message:", error);
          addMessage("❌ Error al procesar mensaje del servidor", "error");
        }
      };
    } catch (error) {
      addMessage("❌ Error conectando al servidor", "error");
      console.error("Connection error:", error);
    }
  };

  const registrarAsistencia = async (empleadoId, matchScore) => {
    setProcessingAttendance(true);
    addMessage("📝 Cargando datos del empleado...", "info");

    let empleadoData = null;

    try {
      // ── PASO 1: OBTENER DATOS DEL EMPLEADO ───────────────────────────────
      // La identificación ya fue hecha por el BiometricMiddleware (proceso local).
      // Solo necesitamos los datos del empleado para mostrar en el modal.
      if (isDatabaseConnectedRef.current) {
        // ── Datos ONLINE ──
        try {
          const empleadoResponse = await fetchApi(`${API_CONFIG.ENDPOINTS.EMPLEADOS}/${empleadoId}`);
          empleadoData = empleadoResponse.data || empleadoResponse;
        } catch (apiError) {
          console.warn("⚠️ [OfflineFirst/Huella] No se pudo obtener empleado de API, usando SQLite:", apiError.message);
        }
      }

      // Fallback: SQLite (también se usa cuando no hay conexión)
      if (!empleadoData && window.electronAPI?.offlineDB) {
        console.log("📴 [OfflineFirst/Huella] Obteniendo empleado desde SQLite...");
        empleadoData = await window.electronAPI.offlineDB.getEmpleado(empleadoId);
      }

      if (!empleadoData) {
        throw new Error("No se encontró información del empleado");
      }

      // Usar el ID numérico real del empleado
      const empleadoIdNumerico = empleadoData.id || empleadoId;

      // ── PASO 2 + 3: GUARDAR LOCAL Y SINCRONIZAR INMEDIATAMENTE ──────────
      addMessage("💾 Guardando asistencia...", "info");
      console.log("💾 [EagerSync/Huella] Guardando y sincronizando asistencia...");
      const { guardarYSincronizarAsistencia } = await import("../../services/offlineAuthService");
      const syncResult = await guardarYSincronizarAsistencia({
        empleadoId: empleadoIdNumerico,
        metodoRegistro: "HUELLA",
        isDatabaseConnected: isDatabaseConnectedRef.current,
      });

      const horaActual = new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      });

      let nuevoResultado;

      if (syncResult.rechazado) {
        // ── Rechazado definitivamente por el servidor ──
        addMessage(`❌ Registro rechazado: ${syncResult.errorServidor}`, "error");

        agregarEvento({
          user: empleadoData?.nombre || "Usuario",
          action: `Registro rechazado: ${syncResult.errorServidor} - Huella`,
          type: "error",
        });

        nuevoResultado = {
          success: false,
          message: syncResult.errorServidor,
          empleado: empleadoData,
          empleadoId: empleadoIdNumerico,
          rechazado: true,
          hora: horaActual,
        };
      } else if (!syncResult.pendiente) {
        // ── Resultado REAL del servidor ──
        const tipoMovimiento = syncResult.tipo === "salida" ? "SALIDA" : "ENTRADA";
        // importar obtenerInfoClasificacion del servicio compartido
        const { obtenerInfoClasificacion } = await import("../../services/asistenciaLogicService");
        const { estadoTexto, tipoEvento } = obtenerInfoClasificacion(syncResult.estado, syncResult.tipo);

        addMessage(`✅ ${tipoMovimiento} registrada (${estadoTexto})`, "success");

        agregarEvento({
          user: empleadoData?.nombre || "Usuario",
          action: `${tipoMovimiento} registrada (${estadoTexto}) - Huella`,
          type: tipoEvento || "success",
        });

        nuevoResultado = {
          success: true,
          message: "Asistencia registrada",
          empleado: empleadoData,
          empleadoId: empleadoIdNumerico,
          tipoMovimiento,
          hora: syncResult.hora || horaActual,
          estado: syncResult.estado,
          estadoTexto,
          clasificacion: syncResult.estado,
        };
      } else {
        // ── Pendiente: sin conexión o push falló temporalmente ──
        addMessage("⏳ Asistencia pendiente de sincronizar", "warning");

        agregarEvento({
          user: empleadoData?.nombre || "Usuario",
          action: "Asistencia guardada localmente (pendiente de sincronizar) - Huella",
          type: "warning",
        });

        nuevoResultado = {
          success: true,
          message: "Registro pendiente",
          empleado: empleadoData,
          empleadoId: empleadoIdNumerico,
          tipoMovimiento: "PENDIENTE",
          hora: horaActual,
          estado: "pendiente",
          estadoTexto: "⏳ Asistencia pendiente",
          clasificacion: "pendiente",
          pendiente: true,
        };
      }


      setIdentificando(false);
      setResult(nuevoResultado);

      if (backgroundMode) {
        setTimeout(() => {
          setShowModal(true);
        }, 50);
      }

      if (onSuccess && nuevoResultado.success) {
        onSuccess({
          empleadoId: empleadoIdNumerico,
          matchScore,
          empleado: empleadoData,
          tipo_movimiento: nuevoResultado.tipoMovimiento,
          hora: nuevoResultado.hora,
          estado: nuevoResultado.estado,
          pendiente: nuevoResultado.pendiente || false,
        });
      }

    } catch (error) {
      console.error("❌ Error registrando asistencia:", error);

      let finalErrorMessage = error.message || "Error al registrar asistencia";
      if (finalErrorMessage.includes("falta directa")) {
        finalErrorMessage = "Registro denegado: Se te ha registrado una falta directa en este turno. No puedes registrar asistencia.";
      }

      addMessage(`❌ Error: ${finalErrorMessage}`, "error");

      agregarEvento({
        user: empleadoData?.nombre || empleadoId || "Usuario",
        action: `Error en registro con Huella - ${finalErrorMessage}`,
        type: "error",
      });

      const responseData = error.responseData;
      const isBlockCompletedError = error.message && (
        (error.message.includes("bloque") && error.message.includes("completado")) ||
        (error.message.includes("jornada") && error.message.includes("completada"))
      );

      const resultadoError = {
        success: false,
        message: finalErrorMessage,
        empleadoId: empleadoId,
        empleado: empleadoData,
        noPuedeRegistrar: responseData?.noPuedeRegistrar || isBlockCompletedError,
        estadoHorario: responseData?.estadoHorario || (isBlockCompletedError ? "completado" : undefined),
        minutosRestantes: responseData?.minutosRestantes,
      };

      setIdentificando(false);
      setResult(resultadoError);

      if (backgroundMode) {
        setTimeout(() => {
          setShowModal(true);
        }, 50);
      }
    } finally {
      setProcessingAttendance(false);
      setCurrentOperation("None");
      setStatus("ready");
    }
  };

  // Procesar login biométrico para obtener datos completos del empleado
  const procesarLoginBiometrico = async (empleadoId) => {
    // Verificar que el login esté habilitado Y el modal esté visible (prevenir llamadas automáticas)
    if (!loginHabilitado || !showModal) {
      console.warn("⚠️ Login no habilitado o modal no visible - ignorando llamada");
      return;
    }

    setProcessingLogin(true);

    // Detener el countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    try {
      const API_BASE = "https://9dm7dqf9-3002.usw3.devtunnels.ms/api";

      // Llamar al endpoint de autenticación biométrica para obtener datos completos
      const authResponse = await fetch(`${API_BASE}/auth/biometric`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ empleado_id: empleadoId }),
      });

      if (!authResponse.ok) {
        if (authResponse.status >= 500) {
          const error = new Error(`Server Error: ${authResponse.status}`);
          error.isApiOffline = true;
          throw error;
        }
        const errorData = await authResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al autenticar");
      }

      const authResult = await authResponse.json();

      if (!authResult.success) {
        throw new Error(authResult.message || "Error en autenticación");
      }

      // Extraer datos completos de la respuesta
      const { usuario, roles, permisos, esAdmin, token } = authResult.data;
      console.log("👤 Usuario autenticado:", usuario);
      console.log("📋 Roles:", roles);

      // Guardar token en localStorage
      if (token) {
        localStorage.setItem('auth_token', token);
        console.log("🔑 Token guardado");
      }

      // Preparar datos completos del usuario para la sesión
      const usuarioCompleto = {
        ...usuario,
        roles,
        permisos,
        esAdmin,
        token,
        metodoAutenticacion: "HUELLA",
      };

      // Guardar sesión
      guardarSesion(usuarioCompleto);

      // Cerrar modal
      if (onClose) onClose();

      // Callback de login exitoso con datos completos
      if (onLoginRequest) {
        onLoginRequest(usuarioCompleto);
      }

    } catch (error) {
      console.error("Error procesando login biométrico:", error);

      // === FALLBACK OFFLINE LOGIN ===
      const isNetworkError = error.name === 'TypeError'
        || error.message.includes('Failed to fetch')
        || error.message.includes('NetworkError')
        || error.message.includes('ERR_INTERNET_DISCONNECTED')
        || error.isApiOffline // API server returned 500+ error
        || error.message.includes('Server Error');

      if (isNetworkError && window.electronAPI && window.electronAPI.offlineDB) {
        console.log('📴 [AsistenciaHuella] Sin conexión — intentando Login offline...');
        try {
          // Recuperar datos completos del empleado para la sesión
          const empleadoFull = await window.electronAPI.offlineDB.getEmpleado(empleadoId);
          if (empleadoFull) {
            const usuarioOffline = {
              id: empleadoFull.usuario_id,
              nombre: empleadoFull.nombre,
              usuario: empleadoFull.usuario || '',
              correo: empleadoFull.correo || '',
              foto: empleadoFull.foto || null,
              username: empleadoFull.usuario || empleadoFull.nombre,
              es_empleado: true,
              empleado_id: empleadoId,
              roles: [],
              permisos: [],
              esAdmin: false,
              offline: true,
              metodoAutenticacion: "HUELLA_OFFLINE",
              ...empleadoFull
            };

            // Guardar sesión
            guardarSesion(usuarioOffline);

            // Cerrar modal
            if (onClose) onClose();

            // Callback de login exitoso con datos completos
            if (onLoginRequest) {
              onLoginRequest(usuarioOffline);
            }
            return;
          }
        } catch (offlineErr) {
          console.error('❌ [AsistenciaHuella] Error Login Offline:', offlineErr);
        }
      }

      addMessage(`❌ Error: ${error.message}`, "error");
      // Reiniciar countdown si hay error
      setCountdown(6);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setTimeout(() => {
              if (onCloseRef.current) onCloseRef.current();
            }, 500);
            return 0;
          }
          return newValue;
        });
      }, 1000);
    } finally {
      setProcessingLogin(false);
    }
  };

  const handleServerMessage = (data) => {
    console.log("📨 Mensaje recibido:", data);

    switch (data.type) {
      case "authResult":
        // Respuesta de autenticación del middleware
        if (data.success) {
          console.log("🔐 [AsistenciaHuella] Autenticado correctamente");
          addMessage("🔐 Autenticado con middleware", "success");
          // Después de autenticarnos, solicitar estado del sistema
          sendCommand("getStatus");
        } else {
          console.error("❌ [AsistenciaHuella] Error de autenticación:", data.message);
          addMessage(`❌ Error de autenticación: ${data.message}`, "error");
        }
        break;

      case "status":
        setStatus(data.status);
        setStatusMessage(data.message);

        if (data.status === "ready" || data.status === "connected") {
          setCurrentOperation("None");
        }

        addMessage(`ℹ️ ${data.message}`, "info");
        break;

      case "systemStatus":
        setReaderConnected(data.readerConnected);
        setCurrentOperation(data.currentOperation);

        if (data.readerConnected) {
          addMessage("✅ Lector de huellas conectado", "success");
          if (!hasStartedIdentification.current) {
            if (data.currentOperation === "None") {
              // Lector listo, iniciar identificación
              hasStartedIdentification.current = true;
              setTimeout(() => {
                startIdentification();
              }, 500);
            } else {
              // Servidor en otro modo (enrollment previo o Identifying huérfano), forzar reset
              sendCommand("stopCapture");
              hasStartedIdentification.current = true;
              setTimeout(() => {
                startIdentification();
              }, 800);
            }
          }
        } else {
          addMessage("⚠️ Sin lector de huellas detectado", "warning");
        }
        break;

      case "captureComplete":
        console.log("📨 captureComplete recibido:", data);

        if (data.result === "identificationSuccess") {
          // PROTECCIÓN: Verificar si ya hay un registro en proceso ANTES de hacer cualquier cosa
          if (isProcessingAttendanceRef.current) {
            console.log('⚠️ [Huella] Ignorando captureComplete duplicado - ya hay registro en proceso');
            break; // Salir del case sin hacer nada
          }

          // Marcar inmediatamente que estamos procesando (ANTES de cualquier async)
          isProcessingAttendanceRef.current = true;

          // Mostrar inmediatamente pantalla de "Identificando..." en modo background
          if (backgroundMode) {
            setIdentificando(true);
            setShowModal(true);
          }

          // Huella identificada - registrar asistencia
          addMessage(`✅ Huella reconocida: ${data.userId}`, "success");
          addMessage(`🎯 Precisión: ${data.matchScore || 100}%`, "info");

          // Extraer el ID del empleado del userId (formato: emp_EMP00003 o emp_ITL-EMP-001)
          const idEmpleadoMatch = data.userId?.match(/emp_([A-Z0-9\-]+)/i);
          if (idEmpleadoMatch) {
            const empleadoId = idEmpleadoMatch[1];
            registrarAsistencia(empleadoId, data.matchScore || 100);
          } else {
            addMessage("❌ No se pudo extraer el ID del empleado", "error");
            setIdentificando(false);
            isProcessingAttendanceRef.current = false; // Resetear solo en error

            // En modo background, mostrar modal con el error
            if (backgroundMode) {
              setShowModal(true);
            }

            setResult({
              success: false,
              message: "Error identificando empleado",
            });
            setCurrentOperation("None");
            setStatus("ready");
          }

        } else if (data.result === "identificationFailed") {
          // Huella no reconocida - mostrar mensaje y cerrar automáticamente
          console.log("⚠️ Huella no reconocida");
          addMessage("❌ Huella no reconocida en el sistema", "error");

          // Mostrar modal con mensaje de error
          if (backgroundMode) {
            setShowModal(true);
          }

          setResult({
            success: false,
            message: "Huella no reconocida en el sistema",
            noReconocida: true, // Marcador especial para huella no identificada
          });

          setCurrentOperation("None");
          setStatus("ready");
          hasStartedIdentification.current = false;
        }
        break;

      case "cacheReloaded":
        addMessage(`✅ Caché actualizado: ${data.templatesCount} huellas`, "success");
        console.log("[CACHE] Caché de templates recargado:", data);
        break;

      case "readerConnection":
        // Actualización instantánea del estado del lector (conectado/desconectado)
        console.log("🔌 Cambio de conexión del lector:", data);
        setReaderConnected(data.connected);
        if (data.connected) {
          addMessage("✅ Lector de huellas conectado", "success");
          // Reiniciar identificación si el lector se reconecta
          if (!hasStartedIdentification.current) {
            hasStartedIdentification.current = true;
            setTimeout(() => {
              startIdentification();
            }, 500);
          }
        } else {
          addMessage("⚠️ Lector de huellas desconectado", "warning");
          setCurrentOperation("None");
          hasStartedIdentification.current = false;
        }
        break;

      case "error":
        addMessage(`❌ Error: ${data.message}`, "error");
        setCurrentOperation("None");
        setStatus("error");
        break;

      default:
        console.log("Tipo de mensaje desconocido:", data.type);
    }
  };

  const sendCommand = (command, params = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        command,
        ...params,
      };
      console.log("📤 Enviando comando:", payload);
      wsRef.current.send(JSON.stringify(payload));
    } else {
      addMessage("❌ No conectado al servidor", "error");
    }
  };

  const addMessage = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString("es-MX");
    setMessages((prev) =>
      [
        {
          id: Date.now() + Math.random(),
          type,
          message,
          timestamp,
        },
        ...prev,
      ].slice(0, 50)
    );
  };

  const startIdentification = () => {
    if (currentOperation !== "None") {
      addMessage("⚠️ Ya hay una operación en curso", "warning");
      return;
    }

    setResult(null);
    setCurrentOperation("Identifying");
    addMessage("🔍 Iniciando identificación...", "info");

    // Obtener la URL del API y empresa_id
    const API_URL = `${API_CONFIG.BASE_URL}/api`;
    let empresaId = localStorage.getItem("empresa_id");

    const startWithId = (id) => {
      console.log("🚀 Enviando comando startIdentification:", {
        apiUrl: API_URL,
        empresaId: id
      });

      if (!id) {
        console.warn("⚠️ Advertencia: empresa_id es NULL. Esto causará un error 400 en el backend.");
      }

      // Enviar comando de identificación
      sendCommand("startIdentification", { 
        apiUrl: API_URL,
        empresaId: id
      });
    };

    // Si no hay empresaId, intentar recuperarlo del nodo antes de fallar
    if (!empresaId) {
      const escritorioId = localStorage.getItem("escritorio_id");
      if (escritorioId) {
        console.log("🔍 EmpresaId no encontrado, intentando recuperarlo del nodo...");
        obtenerEscritorio(escritorioId)
          .then(nodo => {
            if (nodo && nodo.empresa_id) {
              console.log("✅ EmpresaId recuperado:", nodo.empresa_id);
              localStorage.setItem("empresa_id", nodo.empresa_id);
              startWithId(nodo.empresa_id);
            } else {
              startWithId(null);
            }
          })
          .catch(err => {
            console.error("❌ Error recuperando empresa_id:", err);
            startWithId(null);
          });
        return;
      }
    }

    startWithId(empresaId);
  };

  const cancelOperation = () => {
    sendCommand("cancelEnrollment");
    setCurrentOperation("None");
    hasStartedIdentification.current = false;
    addMessage("⏹️ Operación cancelada", "warning");
    // Reiniciar identificación después de cancelar
    if (connected && readerConnected) {
      setTimeout(() => startIdentification(), 500);
    }
  };

  const isProcessing = currentOperation !== "None" || processingAttendance;

  // Función para cerrar el modal (diferente comportamiento en background mode)
  const handleCloseModal = () => {
    // SIEMPRE deshabilitar login al cerrar para prevenir llamadas automáticas
    setLoginHabilitado(false);
    // Resetear ref de procesamiento para permitir nuevos registros
    isProcessingAttendanceRef.current = false;

    if (backgroundMode) {
      // En modo background, solo ocultar el modal y reiniciar para siguiente lectura
      setShowModal(false);
      setResult(null);
      setMessages([]);
      hasStartedIdentification.current = false;
      // Reiniciar identificación para estar listo para la siguiente huella
      if (connected && readerConnected) {
        setTimeout(() => startIdentification(), 500);
      }
    } else {
      // En modo normal, cerrar completamente
      if (onClose) onClose();
    }
  };

  // No renderizar nada si no debe mantener conexión
  if (!shouldMaintainConnection) {
    return null;
  }

  // En modo background, no mostrar UI hasta que se detecte huella
  if (backgroundMode && !showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-backdrop">
      <div className="bg-bg-primary rounded-lg shadow-2xl max-w-md sm:max-w-lg w-full overflow-hidden border border-border-subtle animate-zoom-in">
        <div className="p-6 sm:p-8">
          {/* Header Minimalista */}
          <div className="text-center mb-6 relative">
            <button
              onClick={handleCloseModal}
              className="absolute -top-2 -right-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md p-2 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Registro de Asistencia</h2>
            <p className="text-text-tertiary text-xs mt-1 opacity-80 uppercase tracking-widest font-medium">Huella Digital</p>
          </div>

          {/* Content */}
          <div className="space-y-3">
            {/* Reader Status */}
            <div
              className={`flex items-center justify-between p-3 rounded-md border ${readerConnected
                ? "bg-success/5 border-success/20"
                : "bg-warning/5 border-warning/20"
                }`}
            >
              <div className="flex items-center gap-3">
                <Fingerprint
                  className={`w-5 h-5 ${readerConnected
                    ? "text-success"
                    : "text-warning"
                    }`}
                />
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                    Lector de Huellas
                  </p>
                  <p className="text-xs text-text-primary font-medium">
                    {readerConnected ? "Conectado y listo" : "Desconectado"}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Action Area */}
            {identificando ? (
              /* Pantalla de Identificando... */
              <div className="animate-in fade-in zoom-in duration-300">
                <div className="bg-accent/5 border border-accent/20 rounded-xl p-8 text-center">
                  <div className="relative inline-flex mb-4">
                    <Fingerprint className="w-16 h-16 text-accent animate-pulse" />
                    <div className="absolute -inset-3 flex items-center justify-center">
                      <div className="w-20 h-20 border-2 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-1">
                    Identificando...
                  </h3>
                  <p className="text-text-tertiary text-xs">
                    Por favor espera... verificando identidad
                  </p>
                </div>
              </div>
            ) : !result ? (
              /* Pantalla de Espera/Lectura */
              <div className="space-y-4">
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-xl p-6 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/5 mb-4 ring-1 ring-accent/10">
                    <Fingerprint
                      className={`w-10 h-10 text-accent ${connected && readerConnected ? "animate-pulse" : ""
                        }`}
                    />
                  </div>
                  <p className="text-text-primary font-bold text-base mb-1">
                    {!connected
                      ? "Conectando al servidor..."
                      : !readerConnected
                        ? "Esperando lector..."
                        : "Coloca tu dedo en el lector"}
                  </p>
                  <p className="text-text-tertiary text-xs">
                    {!connected
                      ? "Por favor espera..."
                      : !readerConnected
                        ? "Verifica la conexión del lector"
                        : "Identificación automática"}
                  </p>
                </div>

                {(processingAttendance || (typeof cargandoDatosHorario !== 'undefined' && cargandoDatosHorario)) && (
                  <div className="bg-accent/5 border border-accent/10 rounded-md p-4 flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    <p className="text-text-primary font-medium text-sm">
                      {(typeof cargandoDatosHorario !== 'undefined' && cargandoDatosHorario) ? "Verificando horario..." : "Registrando asistencia..."}
                    </p>
                  </div>
                )}

                {/* Solo mostrar botón cancelar cuando hay operación en curso */}
                {currentOperation !== "None" && (
                  <div className="pt-4">
                    <button
                      onClick={cancelOperation}
                      className="w-full py-4 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <X className="w-5 h-5" />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Result Display */
              <div className="animate-in fade-in zoom-in duration-300">
                <div
                  className={`rounded-xl p-6 text-center border ${result.success
                    ? "bg-success/5 border-success/20"
                    : result.noPuedeRegistrar
                      ? "bg-warning/5 border-warning/20"
                      : "bg-error/5 border-error/20"
                    }`}
                >
                  {result.success ? (
                    <>
                      {/* Icono según clasificación */}
                      {result.clasificacion === 'retardo_a' || result.clasificacion === 'retardo_b' || result.clasificacion === 'salida_temprana' ? (
                        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-warning" />
                      ) : result.clasificacion === 'falta' ? (
                        <XCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                      ) : (
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
                      )}

                      <h3 className={`text-lg font-bold mb-1 ${result.clasificacion === 'falta'
                        ? "text-error"
                        : result.clasificacion === 'retardo_a' || result.clasificacion === 'retardo_b' || result.clasificacion === 'salida_temprana'
                          ? "text-warning"
                          : "text-success"
                        }`}>
                        {result.pendiente ? "Registro pendiente" : "Asistencia Registrada"}
                      </h3>

                      {result.empleado?.nombre && (
                        <p className="text-text-primary text-base font-semibold mb-1">
                          {result.empleado.nombre}
                        </p>
                      )}

                      {result.tipoMovimiento && !result.pendiente && (
                        <div className="mt-1 text-center">
                          <p className="text-text-tertiary text-xs">
                            {result.tipoMovimiento === "ENTRADA" ? "Entrada" : "Salida"} registrada {result.hora && <>a las <span className="text-text-primary font-bold">{result.hora}</span></>}
                          </p>
                          {/* Badge de clasificación */}
                          <div className="flex justify-center mt-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${result.clasificacion === "entrada" || result.clasificacion === "salida_puntual"
                                ? "bg-success/10 text-success ring-1 ring-success/20"
                                : result.clasificacion === "retardo_a" || result.clasificacion === "retardo_b" || result.clasificacion === "salida_temprana"
                                  ? "bg-warning/10 text-warning ring-1 ring-warning/20"
                                  : result.clasificacion === "falta"
                                    ? "bg-error/10 text-error ring-1 ring-error/20"
                                    : "bg-bg-tertiary text-text-tertiary ring-1 ring-border-subtle"
                                }`}
                            >
                              {result.estadoTexto || result.estado || "Registrado"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-border-subtle flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Cerrando en {countdown}s
                        </div>

                        <button
                          onClick={() => procesarLoginBiometrico(result.empleadoId)}
                          disabled={processingLogin || !loginHabilitado}
                          className="w-full py-2.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-xs transition-all flex items-center justify-center ring-1 ring-border-subtle shadow-sm disabled:opacity-50"
                        >
                          {processingLogin ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Iniciar sesión
                        </button>
                      </div>
                    </>
                  ) : result.noPuedeRegistrar ? (
                    <>
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-warning" />
                      <h3 className="text-lg font-bold mb-1 text-warning">
                        No Disponible
                      </h3>
                      {result.empleado?.nombre && (
                        <p className="text-text-primary text-base font-semibold mb-1">
                          {result.empleado.nombre}
                        </p>
                      )}
                      <p className="text-text-tertiary text-xs mb-3">
                        {result.message}
                      </p>
                      <div className="flex justify-center mb-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${result.estadoHorario === "completado"
                            ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                            : "bg-warning/10 text-warning ring-1 ring-warning/20"
                            }`}
                        >
                          {result.estadoHorario === "completado"
                            ? "Jornada completada"
                            : result.estadoHorario === "tiempo_insuficiente"
                              ? `Aún no disponible`
                              : "Fuera de horario"}
                        </span>
                      </div>

                      <div className="pt-4 border-t border-border-subtle flex flex-col items-center gap-3">


                        <button
                          onClick={() => procesarLoginBiometrico(result.empleadoId)}
                          disabled={processingLogin || !loginHabilitado}
                          className="w-full py-2.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-xs transition-all flex items-center justify-center ring-1 ring-border-subtle shadow-sm disabled:opacity-50"
                        >
                          {processingLogin ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Iniciar sesión
                        </button>

                        <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Cerrando en {countdown}s
                        </div>
                      </div>
                    </>
                  ) : result.noReconocida ? (
                    <>
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                      <h3 className="text-lg font-bold mb-1 text-error">
                        Huella No Reconocida
                      </h3>
                      <p className="text-text-tertiary text-xs mb-6">
                        Huella no registrada. Intenta de nuevo o contacta a soporte.
                      </p>

                      <div className="flex flex-col items-center gap-3">
                        <button
                          onClick={handleCloseModal}
                          className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-md font-bold text-base shadow-lg shadow-accent/10 transition-all"
                        >
                          Intentar de nuevo
                        </button>

                        <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Cerrando en {countdown}s
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                      <h3 className="text-lg font-bold mb-1 text-error">
                        {result?.message?.includes("Registro denegado") ? "Registro Denegado" : "Error en Registro"}
                      </h3>
                      {result.empleado?.nombre && (
                        <p className="text-text-primary text-base font-semibold mb-1">
                          {result.empleado.nombre}
                        </p>
                      )}
                      <p className="text-text-tertiary text-xs mb-4">
                        {result?.message?.replace("Registro denegado: ", "")}
                      </p>

                      {result.empleadoId && (
                        <div className="pt-4 border-t border-border-subtle flex flex-col items-center gap-3 mb-4">


                          <button
                            onClick={() => procesarLoginBiometrico(result.empleadoId)}
                            disabled={processingLogin || !loginHabilitado}
                            className="w-full py-2.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-xs transition-all flex items-center justify-center ring-1 ring-border-subtle shadow-sm disabled:opacity-50"
                          >
                            {processingLogin ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Iniciar sesión
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col items-center gap-3">
                        <button
                          onClick={handleCloseModal}
                          className="w-full py-3 bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-primary rounded-md font-bold text-base transition-all"
                        >
                          Intentar de nuevo
                        </button>

                        <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Cerrando en {countdown}s
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
