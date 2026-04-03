import { useState, useRef, useEffect, useCallback } from "react";

const MAX_RECONNECT_ATTEMPTS = 5;

export default function useBiometricWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [readerConnected, setReaderConnected] = useState(false);
  const [currentOperation, setCurrentOperation] = useState("None");
  const [status, setStatus] = useState("disconnected");
  const [messages, setMessages] = useState([]);
  const [savingToDatabase, setSavingToDatabase] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const addMessage = useCallback((message, type = "info") => {
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
  }, []);

  const sendCommand = useCallback((command, params = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = { command, ...params };
      console.log("📤 Enviando comando:", payload);
      wsRef.current.send(JSON.stringify(payload));
    } else {
      addMessage("❌ No conectado al servidor", "error");
    }
  }, [addMessage]);

  const connectToServer = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Obtener token de autenticación desde Electron
      let authToken = null;
      if (window.electronAPI?.getBiometricToken) {
        try {
          authToken = await window.electronAPI.getBiometricToken();
          console.log("🔑 Token obtenido:", authToken ? "✅" : "❌ null");
        } catch (err) {
          console.warn("No se pudo obtener token biométrico:", err);
        }
      } else {
        console.log("⚠️ electronAPI.getBiometricToken no disponible");
      }

      addMessage("🔌 Conectando al servidor...", "info");
      const ws = new WebSocket("ws://localhost:8787/");
      wsRef.current = ws;

      // Guardar el token en una variable que el closure pueda acceder
      const tokenToSend = authToken;

      ws.onopen = () => {
        setConnected(true);
        setStatus("connected");
        reconnectAttemptsRef.current = 0;
        addMessage("✅ Conectado al servidor biométrico", "success");

        // Enviar comando de autenticación si tenemos token
        if (tokenToSend) {
          console.log("🔐 Enviando autenticación al middleware...");
          ws.send(JSON.stringify({ command: "auth", token: tokenToSend }));
        } else {
          // Sin token (probablemente no estamos en Electron), marcar como autenticado
          console.log("⚠️ Sin token, continuando sin autenticación");
          setAuthenticated(true);
          ws.send(JSON.stringify({ command: "getStatus" }));
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
          console.log("📨 Mensaje recibido:", data);

          // Manejar resultado de autenticación
          if (data.type === "authResult") {
            if (data.success) {
              setAuthenticated(true);
              addMessage("🔐 Autenticado con middleware", "success");
              // Después de autenticarnos, solicitar estado
              wsRef.current?.send(JSON.stringify({ command: "getStatus" }));
            } else {
              setAuthenticated(false);
              addMessage(`❌ ${data.message}`, "error");
            }
          } else if (data.type === "status") {
            setStatus(data.status);
            if (data.status === "enrolling") {
              setCurrentOperation("Enrollment");
            } else if (data.status === "ready" || data.status === "connected") {
              setCurrentOperation("None");
            }
            addMessage(`ℹ️ ${data.message}`, "info");
          } else if (data.type === "systemStatus") {
            setReaderConnected(data.readerConnected);
            setCurrentOperation(data.currentOperation);
            if (data.readerConnected) {
              addMessage("✅ Lector de huellas conectado", "success");
            } else {
              addMessage("⚠️ Sin lector de huellas detectado", "warning");
            }
          } else if (data.type === "error") {
            addMessage(`❌ Error: ${data.message}`, "error");
            setCurrentOperation("None");
            setStatus("error");
          } else if (data.type === "cacheReloaded") {
            addMessage(`✅ Caché actualizado: ${data.templatesCount} huellas`, "success");
          } else if (data.type === "readerConnection") {
            // Actualización instantánea del estado del lector (conectado/desconectado)
            console.log("🔌 Cambio de conexión del lector:", data);
            setReaderConnected(data.connected);
            if (data.connected) {
              addMessage("✅ Lector de huellas conectado", "success");
            } else {
              addMessage("⚠️ Lector de huellas desconectado", "warning");
              setCurrentOperation("None");
            }
          }

          // Delegar al componente especifico
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (error) {
          console.error("Error parsing message:", error);
          addMessage("❌ Error al procesar mensaje del servidor", "error");
        }
      };
    } catch (error) {
      addMessage("❌ Error conectando al servidor", "error");
      console.error("Connection error:", error);
    }
  }, [addMessage]);

  const stopCapture = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ command: "stopCapture" }));
      } catch (e) {
        console.warn("Error enviando cancelación:", e);
      }
    }
  }, []);

  // Conectar al montar, limpiar al desmontar
  useEffect(() => {
    connectToServer();

    return () => {
      stopCapture();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        const socket = wsRef.current;
        setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
            socket.close();
          }
        }, 150);
      }
    };
  }, []);

  return {
    connected,
    authenticated,
    readerConnected,
    currentOperation,
    setCurrentOperation,
    status,
    setStatus,
    messages,
    savingToDatabase,
    setSavingToDatabase,
    sendCommand,
    addMessage,
    connectToServer,
    stopCapture,
  };
}
