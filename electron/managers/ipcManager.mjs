import { ipcMain, app, BrowserWindow } from "electron";
import os from "os";
import fs from "fs";
import path from "path";
import util from "util";
import { exec as execCallback, execSync } from "child_process";

// Services & Managers
import * as biometricService from "../services/biometricService.mjs";
import * as windowManager from "./windowManager.mjs";
import * as configHelper from "../utils/configHelper.mjs";
import sqliteManager from "../offline/sqliteManager.mjs";
import syncManager from "../offline/syncManager.mjs";
import rawQueueManager from "../offline/rawQueueManager.mjs";
import rawSyncService from "../offline/rawSyncService.mjs";
import * as networkService from "../services/networkService.mjs";
import * as updaterService from "../services/updaterService.mjs";

const exec = util.promisify(execCallback);

/**
 * Calcular distancia euclidiana entre dos descriptores faciales
 * @param {Array} descriptor1 - Primer descriptor (128 dimensiones)
 * @param {Array} descriptor2 - Segundo descriptor (128 dimensiones)
 * @returns {number} - Distancia euclidiana
 */
function calculateEuclideanDistance(descriptor1, descriptor2) {
    if (descriptor1.length !== descriptor2.length) {
        throw new Error("Los descriptores deben tener la misma longitud");
    }

    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
        const diff = descriptor1[i] - descriptor2[i];
        sum += diff * diff;
    }

    return Math.sqrt(sum);
}

/**
 * Registrar todos los manejadores de IPC
 */
/**
 * Notificar a todos los renderers que un dispositivo USB cambió
 */
function notifyUSBChange(eventType) {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
        if (!win.isDestroyed()) {
            win.webContents.send("usb-device-change", { type: eventType });
        }
    }
}

export function registerIpcHandlers() {

    // ==========================================
    // Eventos de cambio de dispositivo USB en tiempo real
    // ==========================================
    app.on("device-added", (event, device) => {
        console.log("[USB] Dispositivo conectado:", device?.deviceName || "desconocido");
        notifyUSBChange("added");
    });

    app.on("device-removed", (event, device) => {
        console.log("[USB] Dispositivo desconectado:", device?.deviceName || "desconocido");
        notifyUSBChange("removed");
    });

    // ==========================================
    // SDK DigitalPersona & Biometría
    // ==========================================

    ipcMain.handle("check-digitalpersona-sdk", async () => {
        return biometricService.checkDigitalPersonaSdk();
    });



    ipcMain.handle("get-biometric-token", () => {
        return biometricService.getBiometricToken();
    });

    ipcMain.handle("read-fingerprint-template", async (event, userId) => {
        try {
            const templatePath = path.join(
                biometricService.getBiometricPath(),
                "FingerprintTemplates",
                `${userId}.fpt`,
            );

            if (!fs.existsSync(templatePath)) {
                console.error(`[ERROR] Archivo de template no encontrado: ${templatePath}`);
                return null;
            }

            const buffer = fs.readFileSync(templatePath);
            return buffer.toString("base64");
        } catch (error) {
            console.error("[ERROR] Error leyendo template de huella:", error);
            return null;
        }
    });

    // ==========================================
    // Información del Sistema
    // ==========================================

    ipcMain.handle("get-system-info", async () => {
        try {
            const { ipAddress, macAddress } = networkService.getNetworkDetails();

            let osName = os.type();
            const release = os.release();

            if (osName === "Windows_NT") {
                const buildNumber = parseInt(release.split(".")[2] || "0");
                if (buildNumber >= 22000) {
                    osName = "Windows 11";
                } else if (buildNumber >= 10240) {
                    osName = "Windows 10";
                } else {
                    osName = "Windows";
                }
            } else if (osName === "Darwin") {
                osName = "macOS";
            }

            return {
                ipAddress,
                macAddress,
                operatingSystem: osName,
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                totalMemory: `${Math.round(os.totalmem() / 1024 ** 3)} GB`,
                freeMemory: `${Math.round(os.freemem() / 1024 ** 3)} GB`,
                cpus: os.cpus().length,
                cpuModel: os.cpus()[0]?.model || "No disponible",
                uptime: Math.floor(os.uptime() / 3600),
            };
        } catch (error) {
            console.error("Error obteniendo información del sistema:", error);
            return { error: "No se pudo obtener la información del sistema" };
        }
    });

    ipcMain.handle("get-network-info", async () => {
        try {
            const networkInterfaces = os.networkInterfaces();
            const interfaces = [];
            for (const [name, nets] of Object.entries(networkInterfaces)) {
                for (const net of nets) {
                    interfaces.push({
                        name,
                        family: net.family,
                        address: net.address,
                        mac: net.mac,
                        internal: net.internal,
                        cidr: net.cidr,
                    });
                }
            }
            return interfaces;
        } catch (error) {
            console.error("Error obteniendo información de red:", error);
            return [];
        }
    });

    // ==========================================
    // Control de Ventana
    // ==========================================

    ipcMain.on("minimize-window", () => windowManager.minimizeWindow());
    ipcMain.on("maximize-window", () => windowManager.maximizeWindow());
    ipcMain.on("close-window", () => windowManager.closeWindow());
    ipcMain.handle("is-maximized", () => windowManager.isMaximized());

    // ==========================================
    // Configuración
    // ==========================================

    ipcMain.handle("config-get", async (event, key) => {
        try {
            const configPath = configHelper.getConfigPath();
            if (!fs.existsSync(configPath)) return null;
            const data = fs.readFileSync(configPath, "utf8");
            const config = JSON.parse(data);
            return key ? config[key] : config;
        } catch (error) {
            console.error("Error leyendo configuración:", error);
            return null;
        }
    });

    ipcMain.handle("config-set", async (event, key, value) => {
        try {
            const configPath = configHelper.getConfigPath();
            let config = {};
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, "utf8");
                config = JSON.parse(data);
            }
            config[key] = value;
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
            return true;
        } catch (error) {
            console.error("Error guardando configuración:", error);
            return false;
        }
    });

    ipcMain.handle("config-remove", async (event, key) => {
        try {
            const configPath = configHelper.getConfigPath();
            if (!fs.existsSync(configPath)) return true;
            const data = fs.readFileSync(configPath, "utf8");
            const config = JSON.parse(data);
            delete config[key];
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
            return true;
        } catch (error) {
            console.error("Error eliminando configuración:", error);
            return false;
        }
    });

    // ==========================================
    // Reconocimiento Facial (Verificar Usuario)
    // ==========================================

    ipcMain.handle("verificar-usuario", async (event, descriptor) => {
        try {
            const backendUrl = configHelper.getBackendUrl();
            const response = await fetch(`${backendUrl}/api/credenciales/descriptores`, {
                method: "GET",
                headers: { Accept: "application/json" },
            });

            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

            const credenciales = await response.json();
            if (credenciales.length === 0) {
                return { success: false, message: "No hay descriptores faciales registrados" };
            }

            const THRESHOLD = 0.65;
            let bestMatch = null;
            let bestDistance = Infinity;

            for (const credencial of credenciales) {
                if (!credencial.descriptor_facial) continue;
                const storedDescriptor = credencial.descriptor_facial;
                if (storedDescriptor.length !== descriptor.length) continue;
                const distance = calculateEuclideanDistance(descriptor, storedDescriptor);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = credencial;
                }
            }

            if (bestMatch && bestDistance < THRESHOLD) {
                const empleadoResponse = await fetch(`${backendUrl}/api/empleados/${bestMatch.empleado_id}`, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                });

                if (!empleadoResponse.ok) throw new Error(`Error obteniendo empleado: ${empleadoResponse.status}`);
                const empleado = await empleadoResponse.json();

                return {
                    success: true,
                    empleado: empleado,
                    distancia: bestDistance,
                    message: "Usuario identificado correctamente",
                };
            } else {
                return {
                    success: false,
                    message: "Rostro no identificado",
                    distancia: bestDistance,
                    mejorCandidato: bestMatch ? { nombre: bestMatch.nombre, distancia: bestDistance } : null,
                };
            }
        } catch (error) {
            console.error("[ERROR] Error verificando usuario:", error);
            return { success: false, message: `Error de conexión: ${error.message}`, error: error.toString() };
        }
    });

    ipcMain.handle("registrar-asistencia-facial", async (event, empleadoId) => {
        try {
            const backendUrl = configHelper.getBackendUrl();
            const response = await fetch(`${backendUrl}/api/asistencia/registrar-facial`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ id_empleado: empleadoId, tipo: "Escritorio" }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error HTTP ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            return { success: true, message: "Asistencia registrada correctamente", data: result };
        } catch (error) {
            console.error("[ERROR] Error registrando asistencia:", error);
            return { success: false, message: `Error de conexión: ${error.message}`, error: error.toString() };
        }
    });

    ipcMain.handle("registrar-descriptor-facial", async (event, empleadoId, descriptor) => {
        try {
            const backendUrl = configHelper.getBackendUrl();
            if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
                throw new Error("Descriptor facial inválido");
            }
            const float32Array = new Float32Array(descriptor);
            const buffer = Buffer.from(float32Array.buffer);
            const descriptorBase64 = buffer.toString("base64");

            const response = await fetch(`${backendUrl}/api/credenciales/facial`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ empleado_id: empleadoId, facial: descriptorBase64 }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error HTTP ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            return {
                success: true,
                message: "Descriptor facial registrado correctamente",
                data: { id_credencial: result.id, descriptor_size: descriptorBase64.length, timestamp: new Date().toISOString() },
            };
        } catch (error) {
            console.error("[ERROR] Error registrando descriptor facial:", error);
            return { success: false, message: `Error de conexión: ${error.message}`, error: error.toString() };
        }
    });

    // ==========================================
    // USB Check / Biometric Server Check / Detect USB
    // ==========================================

    ipcMain.handle("check-biometric-server", async () => {
        try {
            const WebSocket = (await import("ws")).default;
            return new Promise((resolve) => {
                const ws = new WebSocket("ws://localhost:8787/");
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve({ connected: false, message: "Timeout al conectar" });
                }, 3000);
                ws.on("open", () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ connected: true, message: "Servidor biométrico activo" });
                });
                ws.on("error", (error) => {
                    clearTimeout(timeout);
                    resolve({ connected: false, message: error.message });
                });
            });
        } catch (error) {
            return { connected: false, message: error.message };
        }
    });

    ipcMain.handle("detect-usb-devices", async () => {
        try {
            const devices = [];
            if (process.platform === "win32") {
                try {
                    // Script mejorado: 
                    // 1. Intenta Get-PnpDevice (más rápido, Win10+)
                    // 2. Fallback a Win32_PnPEntity (más compatible, Win7+)
                    // 3. Limpia caracteres especiales y formatea JSON
                    const psScript = `
                        $ErrorActionPreference = 'SilentlyContinue'
                        $classes = 'USB','Biometric','Camera','Image','SmartCard','HIDClass','Sensor','WPD','Media','Ports','Authentication'
                        $devs = @()
                        try {
                            $devs = Get-PnpDevice -Class $classes | Where-Object Status -eq 'OK'
                        } catch {
                            $devs = Get-CimInstance Win32_PnPEntity | Where-Object { $classes -contains $_.PNPClass -and $_.Status -eq 'OK' }
                        }
                        if ($devs) {
                            $result = $devs | Select-Object @{n='Class';e={$_.PNPClass}}, FriendlyName, InstanceId, Status
                            $result | ConvertTo-Json -Compress
                        }
                    `.trim();

                    const encodedCommand = Buffer.from(psScript, "utf16le").toString("base64");

                    // Usamos exec pero con redirección correcta para CMD (2>NUL) o simplemente manejando el error
                    // windowsHide: true evita que parpadee una consola
                    const { stdout } = await exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand} 2>NUL`, {
                        encoding: "utf8",
                        timeout: 15000,
                        windowsHide: true
                    });

                    if (stdout && stdout.trim()) {
                        const parsed = JSON.parse(stdout);
                        const deviceList = Array.isArray(parsed) ? parsed : [parsed];
                        for (const dev of deviceList) {
                            if (!dev.FriendlyName) continue;

                            // Limpieza profunda de nombres (remover marcas registradas y basura de drivers)
                            const name = dev.FriendlyName
                                .replace(/[®™©´┐¢\uFFFD]/g, "")
                                .replace(/\s+/g, " ")
                                .trim();

                            const nameLower = name.toLowerCase();
                            const instanceId = (dev.InstanceId || "").toLowerCase();
                            let type = "unknown";

                            // Detección por nombre o Hardware ID (VID)
                            const isFingerprint = nameLower.includes("fingerprint") ||
                                nameLower.includes("biometric") ||
                                nameLower.includes("digital persona") ||
                                instanceId.includes("vid_05ba") || // DigitalPersona
                                instanceId.includes("vid_1162") || // SecuGen
                                instanceId.includes("vid_1b55");   // ZKTeco

                            if (isFingerprint) {
                                type = "fingerprint";
                            } else if (nameLower.includes("camera") || nameLower.includes("webcam")) {
                                type = "camera";
                            } else if (nameLower.includes("rfid") || nameLower.includes("nfc")) {
                                type = "rfid";
                            } else if (nameLower.includes("scanner")) {
                                type = "scanner";
                            }

                            if (type !== "unknown") {
                                devices.push({
                                    id: `usb_${dev.InstanceId || Math.random()}`,
                                    name: name,
                                    type,
                                    connection: "USB",
                                    detected: true,
                                    instanceId: dev.InstanceId
                                });
                            }
                        }
                    }
                } catch (psError) {
                    if (psError.signal === 'SIGTERM' || psError.killed) {
                        console.warn("[USB] Advertencia: Detección de dispositivos excedió tiempo límite.");
                    } else {
                        // Log mínimo para evitar saturar la consola con el dump de Base64
                        console.warn("[USB] Detección no disponible:", psError.code || "Error desconocido");
                    }
                }
            }

            // Deduplicate
            const seenNames = new Set();
            const uniqueDevices = devices.filter((device) => {
                const normalizedName = device.name.toLowerCase().replace(/[-_]/g, " ").trim();
                if (seenNames.has(normalizedName)) return false;
                seenNames.add(normalizedName);
                return true;
            });

            return { success: true, devices: uniqueDevices, count: uniqueDevices.length };
        } catch (error) {
            console.error("[USB] Error general detectando dispositivos:", error.message);
            return { success: false, devices: [], error: error.message };
        }
    });

    ipcMain.handle("list-all-usb-devices", async () => {
        // Simplificado para el refactor, lógica similar a detect-usb
        return { success: true, devices: [] };
    });

    // ==========================================
    // Offline Handlers (SQLite)
    // ==========================================

    ipcMain.handle("offline-save-asistencia", async (event, data) => {
        try {
            const result = sqliteManager.saveOfflineAsistencia(data);
            return { success: true, data: result };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle("offline-get-credenciales", async (event, empleadoId) => sqliteManager.getCredenciales(empleadoId) || null);
    ipcMain.handle("offline-get-all-credenciales", async () => sqliteManager.getAllCredenciales() || []);
    ipcMain.handle("offline-get-horario", async (event, empleadoId) => sqliteManager.getHorario(empleadoId) || null);
    ipcMain.handle("offline-get-empleado", async (event, empleadoId) => sqliteManager.getEmpleado(empleadoId) || null);
    ipcMain.handle("offline-get-all-empleados", async () => sqliteManager.getAllEmpleados() || []);
    ipcMain.handle("offline-get-registros-hoy", async (event, empleadoId) => sqliteManager.getRegistrosHoy(empleadoId) || []);
    ipcMain.handle("offline-get-registros-rango", async (event, eId, start, end) => sqliteManager.getRegistrosByRange(eId, start, end) || []);
    ipcMain.handle("offline-pending-count", async () => sqliteManager.getPendingCount());
    ipcMain.handle("offline-get-errors", async () => sqliteManager.getErrorRecords() || []);
    ipcMain.handle("offline-get-escritorio-info", async (event, escritorioId) => sqliteManager.getEscritorioInfo(escritorioId) || null);
    ipcMain.handle("offline-get-biometricos-registrados", async (event, escritorioId) => sqliteManager.getBiometricosRegistrados(escritorioId) || []);

    // ==========================================
    // Sync Handlers
    // ==========================================

    ipcMain.handle("sync-status", async () => syncManager.getStatus());
    ipcMain.handle("sync-pull-now", async () => syncManager.forcePull());
    ipcMain.handle("sync-push-now", async () => syncManager.forcePush());
    ipcMain.handle("sync-set-online", async (event, online) => { syncManager.setOnlineStatus(online); return { success: true }; });
    ipcMain.handle("sync-update-token", async (event, token) => {
        syncManager.updateAuthToken(token);
        rawSyncService.updateSyncToken(token);
        
        // Registrar el token persistente en app-config.json
        if (token) {
            try {
                const configPath = configHelper.getConfigPath();
                let configData = {};
                // Import fs si no está u operar con él si lo está en este archivo
                // ipcManager ya debe importar fs
                if (fs.existsSync(configPath)) {
                    configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                }
                configData.auth_token = token;
                fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
                console.log('[IPC] Token persistido a disco exitosamente para uso del Watchdog.');
            } catch (err) {
                console.warn('[IPC] No se pudo persistir el token al disco:', err.message);
            }
        }
        
        return { success: true };
    });

    // ==========================================
    // Raw Offline Handlers (New Method)
    // ==========================================
    ipcMain.handle("raw-offline-save-punch", async (event, data) => {
        try {
            const result = rawQueueManager.saveRawPunch(data);
            return { success: true, data: result };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle("raw-sync-push-now", async () => rawSyncService.pushPendingRawPunches());
    ipcMain.handle("raw-offline-pending-count", async () => rawQueueManager.getPendingRawCount());

    // ==========================================
    // Auto-Updater Handlers
    // ==========================================

    /** Fuerza una verificación manual de actualizaciones desde el renderer. */
    ipcMain.handle('updater-check', async () => {
        updaterService.checkForUpdates();
        return { success: true };
    });

    /** Inicia la descarga del paquete de actualización. */
    ipcMain.handle('updater-download', async () => {
        updaterService.downloadUpdate();
        return { success: true };
    });

    /** Cierra la app e instala la actualización descargada. */
    ipcMain.handle('updater-install', async () => {
        updaterService.quitAndInstall();
        return { success: true };
    });

    // ==========================================
    // Bitácora Handlers
    // ==========================================
    ipcMain.handle('bitacora-save-event', async (event, data) => sqliteManager.saveBitacoraEvent(data));
    ipcMain.handle('bitacora-get-events', async () => sqliteManager.getBitacoraEvents());
    ipcMain.handle('bitacora-clear-events', async () => {
        sqliteManager.clearBitacoraEvents();
        return { success: true };
    });

}
