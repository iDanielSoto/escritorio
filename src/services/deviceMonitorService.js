
import { API_CONFIG, fetchApi } from "../config/apiEndPoint";

class DeviceMonitorService {
    constructor() {
        this.intervalId = null;
        this.isMonitoring = false;
        this.checkInterval = 30000;
        this.ws = null;
        this.biometricConnected = false;
        this.isWsConnecting = false;
        this.reconnectTimeout = null;
        this.checkDevicesTimeout = null;
        this.removeElectronListener = null;
    }

    /**
     * Versión con debounce de checkDevices para agrupar múltiples eventos rápidos
     */
    debouncedCheckDevices(delay = 1000) {
        if (this.checkDevicesTimeout) {
            clearTimeout(this.checkDevicesTimeout);
        }
        this.checkDevicesTimeout = setTimeout(() => {
            this.checkDevices();
        }, delay);
    }

    /**
     * Inicia el monitoreo de dispositivos
     */
    startMonitoring(intervalMs = 30000) {
        if (this.isMonitoring) return;

        this.checkInterval = intervalMs;
        this.isMonitoring = true;

        console.log(`[DeviceMonitor] Iniciando monitoreo...`);

        // 1. Conectar WebSocket persistente para eventos en tiempo real
        this.connectWebSocket();

        // 1.5. Escuchar eventos USB nativos de Electron
        if (window.electronAPI?.onUSBDeviceChange) {
            this.removeElectronListener = window.electronAPI.onUSBDeviceChange(() => {
                console.log("[DeviceMonitor] 🔌 Cambio de dispositivo USB detectado (Electron)");
                this.debouncedCheckDevices(500);
            });
        }

        // 2. Escuchar cambios de hardware en el navegador (para cámaras USB)
        if (navigator.mediaDevices) {
            navigator.mediaDevices.ondevicechange = () => {
                console.log("[DeviceMonitor] 📷 Cambio de hardware detectado (navegador)");
                this.debouncedCheckDevices(1000);
            };
        }

        // 3. Ejecutar verificación inicial completa
        this.checkDevices();

        // 4. Iniciar loop de respaldo (polling)
        this.intervalId = setInterval(() => {
            this.checkDevices();
        }, this.checkInterval);
    }

    /**
     * Detiene el monitoreo
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.checkDevicesTimeout) {
            clearTimeout(this.checkDevicesTimeout);
            this.checkDevicesTimeout = null;
        }

        if (typeof this.removeElectronListener === 'function') {
            this.removeElectronListener();
            this.removeElectronListener = null;
        }

        if (navigator.mediaDevices) {
            navigator.mediaDevices.ondevicechange = null;
        }

        this.closeWebSocket();
        this.isMonitoring = false;
        console.log("[DeviceMonitor] Monitoreo detenido");
    }

    /**
     * Gestiona la conexión persistente con el middleware
     */
    connectWebSocket() {
        if (this.ws?.readyState === WebSocket.OPEN || this.isWsConnecting) return;

        this.isWsConnecting = true;
        try {
            this.ws = new WebSocket("ws://localhost:8787/");

            this.ws.onopen = () => {
                console.log("[DeviceMonitor] WS Conectado a BiometricMiddleware");
                this.isWsConnecting = false;
                // Solicitar estado inicial
                this.ws.send(JSON.stringify({ command: "getStatus" }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWsMessage(data);
                } catch (e) {
                    console.error("[DeviceMonitor] Error parseando mensaje WS:", e);
                }
            };

            this.ws.onclose = () => {
                console.log("[DeviceMonitor] WS Desconectado");
                this.biometricConnected = false;
                this.isWsConnecting = false;
                this.ws = null;

                // Intentar reconectar si sigue monitoreando
                if (this.isMonitoring) {
                    this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 5000);
                }
            };

            this.ws.onerror = (err) => {
                console.warn("[DeviceMonitor] Error WS:", err);
                this.isWsConnecting = false;
                // Dejar que onclose maneje la reconexión
            };

        } catch (error) {
            console.error("[DeviceMonitor] Excepción al conectar WS:", error);
            this.isWsConnecting = false;
        }
    }

    closeWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Maneja los mensajes del WebSocket (Event-Driven)
     */
    async handleWsMessage(data) {
        // Actualizar estado interno
        if (data.type === "systemStatus") {
            const connected = data.readerConnected;
            // Si el estado interno cambia, actualizar inmediatamente
            if (this.biometricConnected !== connected) {
                this.biometricConnected = connected;
                this.updateBiometricDevices(connected ? 'conectado' : 'desconectado');
            }
        }
        else if (data.type === "readerConnection") {
            const connected = data.connected;
            console.log(`[DeviceMonitor] Evento de lector: ${connected ? 'CONECTADO' : 'DESCONECTADO'}`);
            this.biometricConnected = connected;
            // Actualización inmediata disparada por evento
            this.updateBiometricDevices(connected ? 'conectado' : 'desconectado');
        }
    }

    /**
     * Actualiza todos los dispositivos dactilares registrados
     */
    async updateBiometricDevices(estado) {
        try {
            // Obtener solo dispositivos dactilares registrados
            const response = await fetchApi(`/api/biometrico?tipo=dactilar&es_activo=true`);
            if (response.success && response.data) {
                for (const device of response.data) {
                    // Solo actualizar si el estado es diferente
                    if (device.estado !== estado) {
                        await this.updateDeviceStatus(device.id, estado);
                    }
                }
            }
        } catch (error) {
            console.error("[DeviceMonitor] Error actualizando biométricos:", error);
        }
    }

    /**
     * Ciclo de verificación (Polling)
     * Sirve como respaldo y para dispositivos no-WebSocket (cámaras)
     */
    async checkDevices() {
        try {
            const response = await fetchApi(`/api/biometrico?es_activo=true`);

            if (!response.success) return;

            const devices = response.data || [];
            if (devices.length === 0) return;

            for (const device of devices) {
                let status = 'desconectado';

                if (device.tipo === 'dactilar') {
                    // Usar el estado mantenido por el WS persistente
                    // Si el WS no está conectado, asumimos desconectado
                    status = (this.ws?.readyState === WebSocket.OPEN && this.biometricConnected)
                        ? 'conectado'
                        : 'desconectado';

                    // Intento de reconexión si el WS murió pero estamos en ciclo de check
                    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                        this.connectWebSocket();
                    }

                } else if (device.tipo === 'facial') {
                    status = await this.checkCameraStatus(device);
                }

                if (device.estado !== status) {
                    await this.updateDeviceStatus(device.id, status);
                }
            }

        } catch (error) {
            console.error("[DeviceMonitor] Error en ciclo de verificación:", error);
        }
    }

    /**
     * Verifica estatus de cámara de forma pasiva.
     * Ya no solicita stream (getUserMedia) para evitar parpadeos en el LED de la cámara.
     */
    async checkCameraStatus(device) {
        try {
            // Las cámaras IP siempre se consideran conectadas si tienen IP
            if (device.connection === 'IP' && device.ip) return 'conectado';

            if (!navigator.mediaDevices?.enumerateDevices) return 'desconectado';

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            // Si hay al menos una cámara conectada, asumimos modo conectado
            return videoDevices.length > 0 ? 'conectado' : 'desconectado';
        } catch (error) {
            console.error('[DeviceMonitor] Error verificando cámara:', error);
            return 'desconectado';
        }
    }

    /**
     * Envía la actualización de estado al servidor
     */
    async updateDeviceStatus(id, estado) {
        try {
            console.log(`[DeviceMonitor] 📡 Enviando actualización: ${id} -> ${estado}`);
            await fetchApi(`/api/biometrico/${id}/estado`, {
                method: 'PATCH',
                body: JSON.stringify({ estado })
            });
        } catch (error) {
            console.error(`[DeviceMonitor] Error updateDeviceStatus:`, error);
        }
    }

    /**
     * Desconecta todos los dispositivos activos (usado antes de apagar el sistema)
     */
    async setAllDevicesDisconnected() {
        try {
            console.log("[DeviceMonitor] 🔌 Cambiando todos los dispositivos activos a desconectado...");
            const response = await fetchApi(`/api/biometrico?es_activo=true`);
            
            if (!response.success) {
                console.error("[DeviceMonitor] Error obteniendo dispositivos para desconectar");
                return;
            }
            
            const devices = response.data || [];
            if (devices.length === 0) {
                console.log("[DeviceMonitor] No hay dispositivos activos para desconectar.");
                return;
            }
            
            const promises = devices.map(device => 
                this.updateDeviceStatus(device.id, 'desconectado')
            );
            
            await Promise.all(promises);
            console.log("[DeviceMonitor] ✅ Todos los dispositivos marcados como desconectados.");
        } catch (error) {
            console.error("[DeviceMonitor] Excepción en setAllDevicesDisconnected:", error);
        }
    }
}

export const deviceMonitorService = new DeviceMonitorService();
