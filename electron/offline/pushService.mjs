/**
 * PushService — Envía registros de asistencia pendientes al servidor en lotes
 * Usa el endpoint dedicado /api/escritorio/sync/asistencias-pendientes
 */

import sqliteManager from './sqliteManager.mjs';

// Configuración
let apiBaseUrl = '';
let authToken = '';

// Track de último push para evitar concurrencia
let isPushing = false;

/**
 * Configura la URL base y token
 */
export function configure(baseUrl, token) {
  apiBaseUrl = baseUrl;
  authToken = token || '';
}

/**
 * Actualiza solo el token (sin cambiar la URL)
 */
export function updateToken(token) {
  authToken = token || '';
}

/**
 * Envía un lote de registros pendientes al servidor
 * @param {Array} records - registros de offline_asistencias
 * @returns {Object} { sincronizados, rechazados }
 */
async function pushBatch(records) {
  // Transformar registros al formato que espera el endpoint
  const registros = records.map(record => ({
    id: record.idempotency_key || record.local_id.toString(),
    empleado_id: record.empleado_id,
    tipo: record.tipo,
    estado: record.estado,
    clasificacion: record.estado,
    departamento_id: record.departamento_id || null,
    metodo_registro: record.metodo_registro,
    dispositivo_origen: record.dispositivo_origen || 'escritorio',
    ubicacion: null,
    fecha_registro: new Date(record.fecha_registro).getTime(),
  }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${apiBaseUrl}/api/escritorio/sync/asistencias-pendientes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ registros }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText };
    }

    if (!response.ok) {
      const errorMsg = data.message || data.error || `HTTP ${response.status}`;
      console.log(`[PushService] Info: Respuesta del servidor (${response.status}):`, JSON.stringify(data).substring(0, 300));

      // Auth errors — no point retrying without new token
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: `Auth error: ${errorMsg}`, authError: true };
      }

      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      sincronizados: data.sincronizados || [],
      rechazados: data.rechazados || [],
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMsg = error.name === 'AbortError'
      ? 'Timeout de conexión'
      : `Network error: ${error.message}`;
    return { success: false, error: errorMsg };
  }
}

/**
 * Ejecuta el Push de todos los registros pendientes
 * @returns {Object} { total, synced, errors, skipped }
 */
export async function pushPendingRecords() {
  if (isPushing) {
    console.log('[PushService] Info: Ya hay un push en curso, omitiendo...');
    return { total: 0, synced: 0, errors: 0, skipped: 0, busy: true };
  }

  isPushing = true;
  console.log('[PushService] Action: Iniciando push de registros pendientes...');

  try {
    const pending = sqliteManager.getPendingAsistencias(50); // Máximo 50

    if (pending.length === 0) {
      console.log('[PushService] Info: No hay registros pendientes');
      return { total: 0, synced: 0, errors: 0, skipped: 0 };
    }

    console.log(`[PushService] Info: ${pending.length} registros pendientes encontrados`);

    const result = await pushBatch(pending);

    if (!result.success) {
      // Error general (network, auth, etc.)
      console.error(`[PushService] Error: Error en batch: ${result.error}`);

      // Marcar cada registro con error
      for (const record of pending) {
        sqliteManager.markSyncError(record.local_id, result.error, result.authError || false);
      }

      return { total: pending.length, synced: 0, errors: pending.length, skipped: 0 };
    }

    // Procesar resultados individuales
    const { sincronizados, rechazados } = result;

    // Marcar sincronizados
    for (const sync of sincronizados) {
      const record = pending.find(r =>
        (r.idempotency_key === sync.id_local) || (r.local_id.toString() === sync.id_local)
      );
      if (record) {
        sqliteManager.markAsSynced(record.local_id, sync.id_servidor);
        console.log(`[PushService] Success: local_id=${record.local_id} -> server_id=${sync.id_servidor}`);
      }
    }

    // Marcar rechazados
    for (const rej of rechazados) {
      const record = pending.find(r =>
        (r.idempotency_key === rej.id_local) || (r.local_id.toString() === rej.id_local)
      );
      if (record) {
        const definitivo = ['CAMPOS_FALTANTES', 'EMPLEADO_NO_EXISTE', 'DUPLICADO'].includes(rej.codigo);
        sqliteManager.markSyncError(record.local_id, rej.error, definitivo);
        console.log(`[PushService] Error: local_id=${record.local_id} : ${rej.error} (${rej.codigo})${definitivo ? ' DEFINITIVO' : ''}`);
      }
    }

    const synced = sincronizados.length;
    const errors = rechazados.length;
    console.log(`[PushService] Status: Resultado = ${synced} sincronizados, ${errors} rechazados`);
    return { total: pending.length, synced, errors, skipped: 0 };
  } catch (error) {
    console.error('[PushService] Error: Error general en push:', error.message);
    return { total: 0, synced: 0, errors: 0, skipped: 0, error: error.message };
  } finally {
    isPushing = false;
  }
}

/**
 * Fuerza el push de un registro específico
 * @param {number} localId
 * @returns {Object}
 */
export async function forcePushRecord(localId) {
  const db = sqliteManager.getDatabase();
  if (!db) return { success: false, error: 'Database not initialized' };

  const stmt = db.prepare('SELECT * FROM offline_asistencias WHERE local_id = ?');
  const record = stmt.get(localId);

  if (!record) {
    return { success: false, error: 'Registro no encontrado' };
  }

  const result = await pushBatch([record]);

  if (result.success) {
    const synced = result.sincronizados?.[0];
    if (synced) {
      sqliteManager.markAsSynced(record.local_id, synced.id_servidor);
      return { success: true, serverId: synced.id_servidor };
    }
    const rejected = result.rechazados?.[0];
    if (rejected) {
      sqliteManager.markSyncError(record.local_id, rejected.error, true);
      return { success: false, error: rejected.error };
    }
  }

  return { success: false, error: result.error || 'Unknown error' };
}

export default {
  configure,
  updateToken,
  pushPendingRecords,
  forcePushRecord,
};
