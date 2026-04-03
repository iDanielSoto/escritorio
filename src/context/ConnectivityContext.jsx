import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import API_CONFIG from "../config/apiEndPoint";

const ConnectivityContext = createContext();

const HEARTBEAT_INTERVAL = 3000;
const ELECTRON_VERIFY_TIMEOUT = 5000;

export const ConnectivityProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInternetConnected, setIsInternetConnected] = useState(navigator.onLine);
  const [isDatabaseConnected, setIsDatabaseConnected] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());

  const heartbeatRef = useRef(null);
  const isVerifyingRef = useRef(false);

  const verifyInternetConnectivity = async () => {
    try {
      if (window.electronAPI && window.electronAPI.isElectron) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ELECTRON_VERIFY_TIMEOUT);

        try {
          await fetch("https://www.google.com/favicon.ico", {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-cache",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return true;
        } catch (error) {
          clearTimeout(timeoutId);
          return false;
        }
      } else {
        const endpoints = [
          "https://www.google.com/favicon.ico",
          "https://www.cloudflare.com/favicon.ico",
        ];

        for (const endpoint of endpoints) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            await fetch(endpoint, {
              method: "HEAD",
              mode: "no-cors",
              cache: "no-cache",
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return true;
          } catch (error) {
            continue;
          }
        }
        return false;
      }
    } catch (error) {
      console.error("Error verificando conectividad:", error);
      return false;
    }
  };

  const verifyDatabaseConnectivity = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_CONFIG.BASE_URL}`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      try {
        const data = await response.json();
        return (
          data.status === "OK" ||
          data.success === true ||
          data.database === "connected"
        );
      } catch {
        return true;
      }
    } catch (error) {
      console.error("Error verificando base de datos:", error);
      return false;
    }
  };

  const offlineCooldownRef = useRef(0);

  const checkConnectivity = async () => {
    // Si estamos en cooldown de offline forzado, el latido regular debe posponerse
    if (Date.now() < offlineCooldownRef.current) {
        return;
    }

    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    try {
      const internetStatus = await verifyInternetConnectivity();
      setIsInternetConnected(internetStatus);

      let dbStatus = false;
      if (internetStatus) {
        dbStatus = await verifyDatabaseConnectivity();
        setIsDatabaseConnected(dbStatus);
      } else {
        setIsDatabaseConnected(false);
      }

      if (window.electronAPI && window.electronAPI.syncManager) {
        try {
          const isFullyOnline = internetStatus && dbStatus;
          window.electronAPI.syncManager.setOnline(isFullyOnline);
        } catch (e) {
          // Silent
        }
      }

      setLastChecked(new Date());
    } catch (error) {
      console.error("Error en verificación de conectividad:", error);
      setIsInternetConnected(false);
      setIsDatabaseConnected(false);
    } finally {
      isVerifyingRef.current = false;
    }
  };

  useEffect(() => {
    // 1. Detección Instántanea nativa del navegador
    const handleOnline = () => {
      // Si estamos en cooldown, ignorar.
      if (Date.now() < offlineCooldownRef.current) return;
      console.log("🟢 Evento ONLINE detectado");
      setIsOnline(true);
      checkConnectivity();
    };

    const handleOffline = () => {
      console.log("🔴 Evento OFFLINE detectado");
      // Forzar cooldown agresivo porque perdimos conectividad real
      offlineCooldownRef.current = Date.now() + 5000;
      setIsOnline(false);
      setIsInternetConnected(false);
      setIsDatabaseConnected(false);
    };

    // 2. Eventos Customizados lanzados desde el Interceptor de Fetch / API
    const handleApiOffline = () => {
      console.log("💥 Evento API-OFFLINE interceptado. Aplicando cortafuegos...");
      setIsDatabaseConnected(false);
      setLastChecked(new Date());
      // Si la API falla repentinamente (ej. un 500), bloqueamos intentos optimistas ("latidos") por 5 segundos
      // para evitar el "Flapping" visual que destruye y recrea la UI del Kiosko a cada rato.
      offlineCooldownRef.current = Date.now() + 5000; 
    };

    const handleApiOnline = () => {
      // Ignorar chispazos "Online" si estamos severamente penalizados por un corte reciente.
      if (Date.now() < offlineCooldownRef.current) {
         return; 
      }
      
      if (!isDatabaseConnected) {
        console.log("🟢 Evento API-ONLINE interceptado. Restaurando servicio de forma estable.");
        
        // CORRECCIÓN RAW-SYNC: Reinyectamos el token al resucitar para evitar 401s del backend
        setTimeout(() => {
          const token = localStorage.getItem("auth_token");
          if (token && window.electronAPI && window.electronAPI.syncManager) {
            try {
              window.electronAPI.syncManager.updateToken(token);
              console.log("Token re-hidratado a Electron tras recuperación de red.");
            } catch (e) {
              console.warn("Fallo re-hidratando token a Electron", e);
            }
          }
        }, 500); // Pequeño delay de gracia
      }
      setIsDatabaseConnected(true);
      setIsInternetConnected(true);
      setIsOnline(true);
      setLastChecked(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("api-offline", handleApiOffline);
    window.addEventListener("api-online", handleApiOnline);

    // Latido de fondo (Heartbeat)
    checkConnectivity();

    heartbeatRef.current = setInterval(() => {
      checkConnectivity();
    }, HEARTBEAT_INTERVAL);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      // BUG FIX: Aquí antes decía "addEventListener", creaba infinitos listeners que causaban tormenta de renders.
      window.removeEventListener("api-offline", handleApiOffline);
      window.removeEventListener("api-online", handleApiOnline);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [isDatabaseConnected]);

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline,
        isInternetConnected,
        isDatabaseConnected,
        lastChecked,
        refresh: checkConnectivity,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivityContext = () => useContext(ConnectivityContext);
