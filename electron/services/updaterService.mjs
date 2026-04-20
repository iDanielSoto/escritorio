import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import * as windowManager from '../managers/windowManager.mjs';

/**
 * Servicio encargado de la actualización remota segura vía electron-updater
 */

// Leer token desde la raíz empaquetada o en modo desarrollo
function getUpdaterToken() {
    try {
        // En producción suele guardarse junto a los recursos, app.getAppPath() 
        // nos lleva a la carpeta base del programa donde reside el .env empaquetado.
        const appPath = app.isPackaged ? path.join(process.resourcesPath, 'app.asar') : app.getAppPath();
        const envPath = app.isPackaged ? path.join(process.resourcesPath, 'app.asar', '.env') : path.join(appPath, '.env');
        
        // Pero app.asar no permite lecturas asíncronas crudas a veces, dotenv 
        // afortunadamente maneja esto bien con readFileSync. Sin embargo, en un asar,
        // electron-builder no copia el `.env` al asar a menos que lo especifiquemos, 
        // y a veces es más seguro desempaquetarlo. Si fallase la lectura del asar, intentamos normal:
        if (fs.existsSync(envPath)) {
            const config = dotenv.parse(fs.readFileSync(envPath));
            return config.KIO_UPDATER_TOKEN || '';
        }
    } catch (e) {
        console.error('[Updater] Error leyendo token del .env', e.message);
    }
    return '';
}

export function setupAutoUpdater(apiBaseUrl) {
    const updaterToken = getUpdaterToken();
    if (!updaterToken) {
        console.warn('[Updater] Advertencia: KIO_UPDATER_TOKEN no encontrado en .env. El auto-updater puede fallar si la ruta está protegida.');
    }

    // 1. Deshabilitar descargas automáticas para mantener control visual en Premium UI
    autoUpdater.autoDownload = false;

    // 2. Definir Feeds Estrictos dinámicamente
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: `${apiBaseUrl}/api/updates`
    });

    // 3. Inyectar cabecera de seguridad
    autoUpdater.requestHeaders = {
        'x-updater-token': updaterToken
    };

    // 4. Configurar listeners de eventos
    autoUpdater.on('update-available', (info) => {
        console.log('[Updater] Actualización disponible:', info.version);
        const win = windowManager.getMainWindow();
        if (win) {
            win.webContents.send('update-available', info);
        }
        
        // Empezar a descargar automáticamente para el flujo de kiosko, pero la UI controla la visibilidad
        autoUpdater.downloadUpdate();
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const win = windowManager.getMainWindow();
        if (win) {
            win.webContents.send('download-progress', {
                percent: progressObj.percent,
                transferred: progressObj.transferred,
                total: progressObj.total,
                bytesPerSecond: progressObj.bytesPerSecond
            });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Actualización lista para instalar:', info.version);
        const win = windowManager.getMainWindow();
        if (win) {
            win.webContents.send('update-downloaded', info);
        }
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error en actualización:', err);
    });

    // 5. Iniciar la comprobación inicial
    console.log('[Updater] Revisando actualizaciones bajo URL:', `${apiBaseUrl}/api/updates`);
    autoUpdater.checkForUpdates();
}

export function installUpdate() {
    console.log('[Updater] Instalando actualización y reiniciando app...');
    autoUpdater.quitAndInstall(false, true); // (isSilent, isForceRunAfter)
}
