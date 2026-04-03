/**
 * SyncManager — Orquestador de sincronización bidireccional
 * Gestiona el ciclo Pull → Push, timers, y responde a eventos de conectividad.
 */

import sqliteManager from './sqliteManager.mjs';
import pullService from './pullService.mjs';
import pushService from './pushService.mjs';
import * as configHelper from '../utils/configHelper.mjs';
import fs from 'fs';

// Configuración
const SYNC_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutos
const RECONNECT_COOLDOWN_MS = 3000;       // 3 segundos post-reconexión
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min → forzar full sync

// Estado interno
let syncTimer = null;
let isOnline = false;
let lastOnlineTimestamp = Date.now();
let lastOfflineTimestamp = null;
let isSyncing = false;
let mainWindow = null;
let storedApiBaseUrl = ''; // URL base almacenada localmente
let storedEscritorioId = ''; // ID del escritorio actual

// Callback para notificar al renderer
let onStatusChange = null;

/**
 * Estado actual de sincronización
 */
let syncStatus = {
  state: 'idle',        // 'idle' | 'pulling' | 'pushing' | 'error' | 'offline'
  lastSync: null,
  lastError: null,
  pending: 0,
  errors: 0,
};

/**
 * Inicializa el SyncManager
 * @param {Object} config
 * @param {string} config.apiBaseUrl - URL base del API
 * @param {string} config.authToken - Token JWT
 * @param {BrowserWindow} config.window - Referencia a mainWindow para enviar eventos
 */
export function init(config) {
  const { apiBaseUrl, authToken, window } = config;

  mainWindow = window;

  // Leer escritorio_id del config persistente
  try {
    const configPath = configHelper.getConfigPath();
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      storedEscritorioId = cfg.escritorio_id || '';
    }
  } catch (e) {
    console.warn('[SyncManager] Warning: No se pudo leer escritorio_id del config:', e.message);
  }
  storedApiBaseUrl = apiBaseUrl || '';

  console.log('[SyncManager] Initialization: API Base URL =', storedApiBaseUrl || '(vacio!)');

  if (!storedApiBaseUrl) {
    console.error('[SyncManager] Error: apiBaseUrl esta vacio. El Pull no funcionara.');
  }

  // Inicializar SQLite
  try {
    sqliteManager.initDatabase();
    console.log('[SyncManager] Status: SQLite inicializado');
  } catch (dbError) {
    console.error('[SyncManager] Error: Error inicializando SQLite:', dbError.message);
    console.error('[SyncManager] Info: Intenta: npx electron-rebuild -f -w better-sqlite3');
  }

  // Configurar servicios con la URL
  pullService.configure(storedApiBaseUrl, authToken, storedEscritorioId);
  pushService.configure(storedApiBaseUrl, authToken);

  console.log('[SyncManager] Status: escritorio_id =', storedEscritorioId || '(no configurado)');

  // Actualizar el conteo de pendientes
  updatePendingCount();

  console.log('[SyncManager] Status: Inicializado exitosamente');
}

/**
 * Actualiza el token de autenticación
 * @param {string} token
 */
export function updateAuthToken(token) {
  // Releer escritorio_id del config por si cambió
  try {
    const configPath = configHelper.getConfigPath();
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      storedEscritorioId = cfg.escritorio_id || '';
    }
  } catch (e) { }

  // IMPORTANTE: preservar la URL y escritorioId al actualizar el token
  pullService.configure(storedApiBaseUrl, token, storedEscritorioId);
  pushService.updateToken(token);
  console.log('[SyncManager] Status: Token actualizado');

  // Si tenemos un nuevo token válido, iniciar Pull para cachear datos
  if (token && isOnline) {
    console.log('[SyncManager] Action: Token recibido — iniciando Pull con autenticacion...');
    performSync('token-update');
  }
}

/**
 * Inicia la sincronización periódica
 */
export function startPeriodicSync() {
  // Sync inicial
  performSync('initial');

  // Timer periódico
  syncTimer = setInterval(() => {
    if (isOnline) {
      performSync('periodic');
    }
  }, SYNC_INTERVAL_MS);

  console.log(`[SyncManager] Status: Sync periodico configurado cada ${SYNC_INTERVAL_MS / 1000}s`);
}

/**
 * Detiene la sincronización periódica
 */
export function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  console.log('[SyncManager] Action: Sync periodico detenido');
}

/**
 * Notifica un cambio en la conectividad
 * @param {boolean} online
 */
export function setOnlineStatus(online) {
  const wasOffline = !isOnline;
  const wasOnline = isOnline;

  // Actualizar estado primero
  isOnline = online;

  if (online) {
    lastOnlineTimestamp = Date.now();

    if (wasOffline) {
      // Reconexión detectada
      const offlineDuration = lastOfflineTimestamp
        ? Date.now() - lastOfflineTimestamp
        : 0;

      console.log(`[SyncManager] Event: Reconexion detectada. Offline por ${Math.round(offlineDuration / 1000)}s`);

      // Cooldown antes de sincronizar
      setTimeout(() => {
        if (isOnline) {
          const fullSync = offlineDuration > OFFLINE_THRESHOLD_MS;
          performSync(fullSync ? 'reconnect-full' : 'reconnect');
        }
      }, RECONNECT_COOLDOWN_MS);
    }
  } else {
    if (wasOnline) {
      // Solo loggear la primera vez que se detecta offline
      lastOfflineTimestamp = Date.now();
      updateStatus('offline', null);
      console.log('[SyncManager] Event: Conexion perdida');
    }
    // Si ya estábamos offline, no repetir log
  }
}

/**
 * Ejecuta un ciclo completo de sincronización (Pull + Push)
 * @param {string} reason - motivo del sync
 */
export async function performSync(reason = 'manual') {
  if (isSyncing) {
    console.log('[SyncManager] Info: Sync ya en curso, omitiendo...');
    return;
  }

  if (!isOnline && reason !== 'initial') {
    console.log('[SyncManager] Info: Sin conexion, omitiendo sync');
    return;
  }

  isSyncing = true;
  console.log(`[SyncManager] Action: Iniciando sync (${reason})...`);

  try {
    // PULL — Descargar datos maestros
    if (reason !== 'push-only') {
      updateStatus('pulling', null);
      const pullResult = await pullService.fullPull();

      if (!pullResult.empleados.success && !pullResult.credenciales.success) {
        console.warn('[SyncManager] Warning: Pull fallo (posible falta de auth o conexion)');
      }
    }

    // PUSH — Enviar registros pendientes
    updateStatus('pushing', null);
    const pushResult = await pushService.pushPendingRecords();

    // Actualizar estado
    updatePendingCount();
    updateStatus('idle', null);

    syncStatus.lastSync = new Date().toISOString();
    notifyRenderer();

    console.log(`[SyncManager] Status: Sync completo (${reason}) - Pull OK, Push: ${pushResult.synced}/${pushResult.total}`);
  } catch (error) {
    console.error(`[SyncManager] Error: Error en sync (${reason}):`, error.message);
    updateStatus('error', error.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Fuerza un Push inmediato (desde el renderer)
 */
export async function forcePush() {
  if (!isOnline) {
    return { success: false, error: 'Sin conexión' };
  }
  const result = await pushService.pushPendingRecords();
  updatePendingCount();
  notifyRenderer();
  return result;
}

/**
 * Fuerza un Pull inmediato (desde el renderer)
 */
export async function forcePull() {
  if (!isOnline) {
    return { success: false, error: 'Sin conexión' };
  }
  const result = await pullService.fullPull();
  notifyRenderer();
  return result;
}

/**
 * Obtiene el estado actual de sincronización
 * @returns {Object}
 */
export function getStatus() {
  updatePendingCount();
  return { ...syncStatus, isOnline };
}

// ============================================================
// INTERNOS
// ============================================================

function updateStatus(state, error) {
  syncStatus.state = state;
  if (error) syncStatus.lastError = error;
  notifyRenderer();
}

function updatePendingCount() {
  try {
    const counts = sqliteManager.getPendingCount();
    syncStatus.pending = counts.pending;
    syncStatus.errors = counts.errors;
  } catch (e) {
    // SQLite aún no inicializado
  }
}

function notifyRenderer() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-status-update', {
        ...syncStatus,
        isOnline,
      });
    }
  } catch (e) {
    // Window cerrada
  }
}

/**
 * Limpieza al cerrar la app
 */
export function destroy() {
  stopPeriodicSync();
  sqliteManager.closeDatabase();
  console.log('[SyncManager] Status: Destruido');
}

export default {
  init,
  updateAuthToken,
  startPeriodicSync,
  stopPeriodicSync,
  setOnlineStatus,
  performSync,
  forcePush,
  forcePull,
  getStatus,
  destroy,
};
