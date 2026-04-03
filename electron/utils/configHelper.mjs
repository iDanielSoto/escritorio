import { app } from "electron";
import path from "path";
import fs from "fs";

/**
 * Gestión de configuración persistente en archivo
 * La configuración se guarda en la carpeta de datos de usuario de la aplicación
 */
export const getConfigPath = () => {
    return path.join(app.getPath("userData"), "app-config.json");
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
