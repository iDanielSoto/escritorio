/**
 * updaterService.mjs
 * Servicio de auto-actualización usando electron-updater + GitHub Releases.
 *
 * Usa createRequire para importar electron-updater (CommonJS) desde un módulo ESM.
 * El updater solo se activa en producción (app.isPackaged), controlado desde main.mjs.
 */

import { createRequire } from 'module';
import { BrowserWindow, app } from 'electron';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

// ─────────────────────────────────────────────
//  Logging a archivo (electron-log captura errores de updater automáticamente)
// ─────────────────────────────────────────────
try {
    const log = require('electron-log');
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
} catch {
    // electron-log es opcional; si no está instalado, se usa console
    autoUpdater.logger = console;
}

// ─────────────────────────────────────────────
//  Configuración base del updater
// ─────────────────────────────────────────────
// Repo PÚBLICO → sin tokens necesarios en el código.
// La descarga NO es automática: el renderer confirma antes de descargar.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// ─────────────────────────────────────────────
//  Helper: enviar evento a todos los renderers
// ─────────────────────────────────────────────
function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    });
}

// ─────────────────────────────────────────────
//  Inicializar y registrar eventos del updater
// ─────────────────────────────────────────────
export function initAutoUpdater() {
    console.log('[Updater] Inicializando auto-updater. Versión actual:', app.getVersion());

    autoUpdater.on('checking-for-update', () => {
        console.log('[Updater] Buscando actualizaciones...');
        sendToRenderer('updater-status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[Updater] Actualización disponible:', info.version);
        sendToRenderer('updater-status', {
            status: 'available',
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes || null,
        });
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('[Updater] App al día:', info.version);
        sendToRenderer('updater-status', {
            status: 'latest',
            currentVersion: info.version,
        });
    });

    autoUpdater.on('download-progress', (progress) => {
        sendToRenderer('updater-progress', {
            percent: Math.round(progress.percent),
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond,
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Actualización descargada:', info.version);
        sendToRenderer('updater-status', {
            status: 'downloaded',
            version: info.version,
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err.message);
        sendToRenderer('updater-status', {
            status: 'error',
            message: err.message,
        });
    });
}

// ─────────────────────────────────────────────
//  Acciones públicas (llamadas desde ipcManager)
// ─────────────────────────────────────────────

/** Verifica si hay una versión más reciente en GitHub Releases. */
export function checkForUpdates() {
    autoUpdater.checkForUpdates().catch((err) => {
        console.error('[Updater] Error al verificar:', err.message);
    });
}

/** Inicia la descarga del paquete de actualización. */
export function downloadUpdate() {
    autoUpdater.downloadUpdate().catch((err) => {
        console.error('[Updater] Error al descargar:', err.message);
    });
}

/**
 * Cierra la app e instala la actualización descargada.
 * silent=false → muestra el instalador NSIS.
 * forceRunAfter=true → relanza la app después de instalar.
 */
export function quitAndInstall() {
    autoUpdater.quitAndInstall(false, true);
}
