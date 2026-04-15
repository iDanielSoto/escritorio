import { app } from "electron";
import path from "path";
import fs from "fs";

/**
 * Gestión de configuración persistente en archivo
 * La configuración se guarda en C:\ProgramData\SistemaAsistencia\ para que
 * tanto Electron como el Watchdog (SYSTEM) puedan acceder al mismo archivo.
 */

const getSharedConfigDir = () => {
    // Si process.env.PROGRAMDATA está disponible, úsalo. Si no (ej macOS/Linux en dev), usa userData pero avisa.
    return process.env.PROGRAMDATA
        ? path.join(process.env.PROGRAMDATA, "SistemaAsistencia")
        : path.join(app.getPath("userData"), "SistemaAsistencia_Shared");
};

/**
 * Migrar configuración existente desde AppData (path antiguo) a ProgramData (path nuevo)
 * Se ejecuta automáticamente la primera vez.
 */
function migrateConfigIfNeeded() {
    try {
        const sharedDir = getSharedConfigDir();
        const newConfigPath = path.join(sharedDir, "app-config.json");
        const oldConfigPath = path.join(app.getPath("userData"), "app-config.json");

        // Si el archivo ya existe en el nuevo path, terminar (ya migrado o nueva instalación limpia)
        if (fs.existsSync(newConfigPath)) return;

        // Si no existe en el viejo path, tampoco hay nada que migrar
        if (!fs.existsSync(oldConfigPath)) return;

        // Crear directorio nuevo si no existe
        if (!fs.existsSync(sharedDir)) {
            fs.mkdirSync(sharedDir, { recursive: true });
        }

        // Copiar la configuración al nuevo path
        fs.copyFileSync(oldConfigPath, newConfigPath);
        console.log('[ConfigHelper] Configuración migrada de AppData a ProgramData');
    } catch (error) {
        console.warn('[ConfigHelper] No se pudo migrar config:', error.message);
    }
}

// Ejecutar migración cuando inicie
app.whenReady().then(migrateConfigIfNeeded);

export const getConfigPath = () => {
    const sharedDir = getSharedConfigDir();
    // Asegurar que el directorio existe
    if (!fs.existsSync(sharedDir)) {
        try {
            fs.mkdirSync(sharedDir, { recursive: true });
        } catch (e) {
            console.warn('[ConfigHelper] Falló creación del directorio compartido, fallback a userData', e.message);
            return path.join(app.getPath("userData"), "app-config.json");
        }
    }
    return path.join(sharedDir, "app-config.json");
};

/**
 * Función auxiliar para obtener la URL del backend
 */
export function getBackendUrl() {
    const configPath = getConfigPath();
    // URL por defecto - Dev Tunnel (debe coincidir con apiEndPoint.js)
    let backendUrl = "https://9dm7dqf9-3002.usw3.devtunnels.ms";

    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, "utf8");
            const config = JSON.parse(data);
            backendUrl = config.backendUrl || backendUrl;
        }
    } catch (error) {
        // Usar URL por defecto si hay error leyendo configuración
    }

    // Eliminar barra final si existe
    return backendUrl.replace(/\/$/, "");
}

/**
 * Función auxiliar para obtener un valor de configuración específico
 */
export function getConfigValue(key) {
    const configPath = getConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, "utf8");
            const config = JSON.parse(data);
            return config[key];
        }
    } catch (error) {
        console.error(`Error leyendo configuración [${key}]:`, error);
    }
    return null;
}
