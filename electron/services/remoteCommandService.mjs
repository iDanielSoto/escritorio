import { app } from "electron";
import { getBackendUrl, getConfigValue } from "../utils/configHelper.mjs";

let pollInterval = null;
let isChecking = false;

/**
 * Consulta el backend para verificar si hay un comando pendiente para Kiosko
 * Endpoint: GET /api/escritorio/:id/comando-kiosko
 */
async function checkRemoteCommand() {
    if (isChecking) return;
    isChecking = true;

    try {
        const escritorioId = getConfigValue('escritorio_id');
        if (!escritorioId) return;

        const backendUrl = getBackendUrl();
        if (!backendUrl) return;

        const token = getConfigValue('auth_token');
        if (!token) return;

        const url = `${backendUrl}/api/escritorio/${escritorioId}/comando-kiosko`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                if (res.status !== 404 && res.status !== 401) {
                    console.warn(`[RemoteCommand] Error servidor: ${res.status}`);
                }
                return;
            }

            const text = await res.text();
            console.log(`[RemoteCommand] Respuesta recibida: ${text}`);

            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error('[RemoteCommand] Error parseando JSON:', jsonErr.message);
                return;
            }

            if (data.success && data.accion) {
                console.log(`[RemoteCommand] Acción procesando: ${data.accion}`);
                
                switch (data.accion) {
                    case "shutdown":
                        console.log("[RemoteCommand] !!! EJECUTANDO CIERRE FORZADO !!!");
                        app.exit(0);
                        // Fallback total en caso de que app.exit sea bloqueado
                        setTimeout(() => {
                            console.log("[RemoteCommand] Fallback: process.exit()");
                            process.exit(0);
                        }, 500);
                        break;
                    case "restart":
                        console.log("[RemoteCommand] !!! EJECUTANDO REINICIO FORZADO !!!");
                        app.relaunch();
                        app.exit(0);
                        setTimeout(() => process.exit(0), 500);
                        break;
                    case "none":
                        // Silencio normal
                        break;
                    default:
                        console.log(`[RemoteCommand] Acción desconocida: ${data.accion}`);
                        break;
                }
            }

        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name !== 'AbortError') {
                console.warn('[RemoteCommand] Error de red polling');
            }
        }
    } catch (err) {
        console.error('[RemoteCommand] Error general:', err.message);
    } finally {
        isChecking = false;
    }
}

/**
 * Inicia el polling periódico de comandos remotos
 * @param {number} intervalMs — Intervalo en milisegundos (default: 30s)
 */
export function startRemoteCommandPoll(intervalMs = 30000) {
    if (pollInterval) clearInterval(pollInterval);
    
    // Ejecutar un chequeo inmediato al arrancar
    checkRemoteCommand();
    
    pollInterval = setInterval(checkRemoteCommand, intervalMs);
    console.log(`[RemoteCommand] Polling iniciado cada ${intervalMs / 1000}s (Primer chequeo inmediato)`);
}

/**
 * Detiene el polling
 */
export function stopRemoteCommandPoll() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    console.log('[RemoteCommand] Polling detenido');
}

export default {
    startRemoteCommandPoll,
    stopRemoteCommandPoll,
};
