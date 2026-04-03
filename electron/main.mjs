/**
 * Proceso principal de Electron
 * Este archivo maneja la ventana de la aplicación y la comunicación con el sistema
 */

import { app, globalShortcut, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import log from "electron-log/main.js";

// Configuración de electron-log: Se limpia el archivo en cada arranque para no acumular peso
log.initialize();
log.transports.file.getFile().clear();

// Sobreescribir consola principal para que sea capturada por el logger de archivo
Object.assign(console, log.functions);

// Offline-First modules
import syncManager from "./offline/syncManager.mjs";
import rawSyncService from "./offline/rawSyncService.mjs";

// Services & Managers
import * as biometricService from "./services/biometricService.mjs";
import * as networkService from "./services/networkService.mjs";
import * as windowManager from "./managers/windowManager.mjs";
import * as ipcManager from "./managers/ipcManager.mjs";
import * as configHelper from "./utils/configHelper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Suprimir logs de errores internos de Chromium
app.commandLine.appendSwitch("log-level", "3");

// Este método se llamará cuando Electron haya terminado la inicialización
app.whenReady().then(() => {

  const ALLOW_DEV_TOOLS = windowManager.ALLOW_DEV_TOOLS;
  const isProd = process.env.NODE_ENV !== "development";

  // Registrar atajos bloqueados para Kiosko estricto
  if (isProd || !ALLOW_DEV_TOOLS) {
    const blockedShortcuts = [
      'Alt+F4',
      'CommandOrControl+I',
      'CommandOrControl+Shift+I',
      'F12',
      'F11',
      'Alt+Tab',
      'Alt+Space'
    ];

    blockedShortcuts.forEach(shortcut => {
      try {
        globalShortcut.register(shortcut, () => {
          console.log(`[Seguridad Kiosko] Combinación bloqueada: ${shortcut}`);
        });
      } catch (err) {
        // Ignorar si no se puede registrar
      }
    });
  }

  // Comando secreto para cerrar la APP: Ctrl + Shift + Q
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });

  // Comando secreto para minimizar (útil para mantenimiento): Ctrl + Shift + M
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    windowManager.minimizeWindow();
  });

  // Iniciar el BiometricMiddleware
  biometricService.startBiometricMiddleware();

  // Registrar manejadores IPC
  ipcManager.registerIpcHandlers();

  // Crear la ventana principal
  const mainWindow = windowManager.createWindow();

  // Bloqueo preventivo en el nivel enfocado (BrowserWindow Input)
  if (isProd) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const keyLowerCase = input.key ? input.key.toLowerCase() : '';
      const isBlocked = (
        (input.alt && input.key === 'F4') ||
        (input.alt && input.key === 'Tab') ||
        (input.control && keyLowerCase === 'i') ||
        (input.key === 'Meta') ||    // Tecla Windows
        (input.key === 'F11') ||
        (input.key === 'F12')
      );

      // No bloqueamos command/control + r ni F5, ni Ctrl+Shift+A (React)
      if (isBlocked) {
        event.preventDefault();
        console.log(`[Seguridad Kiosko] Tecla prevenida en ventana: ${input.key}`);
      }
    });
  }

  // Iniciar monitoreo de red
  networkService.startMonitoring(mainWindow);

  // Inicializar sistema Offline-First
  try {
    const apiBaseUrl = configHelper.getBackendUrl();
    syncManager.init({
      apiBaseUrl,
      authToken: '', // Se actualizará cuando el usuario inicie sesión
      window: mainWindow,
    });
    // Asumir online inicialmente, el renderer confirmará
    syncManager.setOnlineStatus(true);
    syncManager.startPeriodicSync();

    // Inicializar servidor de Raw Sync
    rawSyncService.configureSync(apiBaseUrl, '');
    rawSyncService.startAutoSync(30000); // 30 segundos

    console.log('[Main] Status: Sistema Offline-First inicializado');
  } catch (error) {
    console.error('[Main] Error: Error inicializando sistema offline:', error);
  }

  app.on("activate", function () {
    // En macOS es común recrear una ventana cuando se hace clic en el icono del dock
    if (BrowserWindow.getAllWindows().length === 0) windowManager.createWindow();
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    // Detener el BiometricMiddleware antes de salir
    biometricService.stopBiometricMiddleware();
    app.quit();
  }
});

// Detener el BiometricMiddleware y limpiar recursos offline cuando la app se cierre
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  biometricService.stopBiometricMiddleware();
  networkService.stopMonitoring();
  syncManager.destroy();
  rawSyncService.stopAutoSync();
});
