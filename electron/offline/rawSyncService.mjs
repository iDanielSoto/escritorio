import rawQueueManager from './rawQueueManager.mjs';
import { getConfigValue, getBackendUrl } from '../utils/configHelper.mjs';

let apiBaseUrl = '';
let authToken = '';
let isPushing = false;
let syncInterval = null;

export function configureSync(baseUrl, token) {
    apiBaseUrl = baseUrl;
    authToken = token || '';
}

export function updateSyncToken(token) {
    authToken = token || '';
}

export function startAutoSync(intervalMs = 30000) {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => {
        pushPendingRawPunches();
    }, intervalMs);
    console.log(`[RawSync] Started auto-sync every ${intervalMs}ms`);
}

export function stopAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

async function pushRawBatch(records) {
    const registros = records.map(record => ({
        id: record.id,
        empleado_id: record.empleado_id,
        metodo: record.metodo,
        fecha_captura: record.fecha_captura
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const headers = { 'Content-Type': 'application/json' };

        // Intentar recuperar el token de la configuración si no ha sido provisto
        if (!authToken) {
            authToken = getConfigValue("auth_token") || '';
        }
        if (!apiBaseUrl) {
            apiBaseUrl = getBackendUrl() || '';
        }

        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const response = await fetch(`${apiBaseUrl}/api/escritorio/sync/raw-punch`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ registros }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { message: responseText };
        }

        if (!response.ok) {
            const errorMsg = data.message || data.error || `HTTP ${response.status}`;
            if (response.status === 401 || response.status === 403) {
                return { success: false, error: `Auth error: ${errorMsg}`, authError: true };
            }
            return { success: false, error: errorMsg };
        }

        return {
            success: true,
            sincronizados: data.sincronizados || [],
            rechazados: data.rechazados || []
        };
    } catch (error) {
        clearTimeout(timeoutId);
        const errorMsg = error.name === 'AbortError' ? 'Timeout de conexión' : `Network error: ${error.message}`;
        return { success: false, error: errorMsg };
    }
}

export async function pushPendingRawPunches() {
    if (isPushing) return { busy: true };
    isPushing = true;

    try {
        const pending = rawQueueManager.getPendingRawPunches(50);
        if (pending.length === 0) return { total: 0, synced: 0, errors: 0 };

        console.log(`[RawSync] Iniciando push de ${pending.length} registros raw pendientes...`);
        const result = await pushRawBatch(pending);

        if (!result.success) {
            console.error(`[RawSync] Error en batch: ${result.error}`);
            // No marcamos como definitivo, reintentaremos luego
            for (const record of pending) {
                rawQueueManager.markRawPunchError(record.id, result.error, result.authError);
            }
            return { total: pending.length, synced: 0, errors: pending.length };
        }

        const { sincronizados, rechazados } = result;

        for (const sync of sincronizados) {
            rawQueueManager.markRawPunchSynced(sync.id_local);
            console.log(`[RawSync] Success: id_local=${sync.id_local}`);
        }

        for (const rej of rechazados) {
            // Si el backend lo rechazó específicamente en la iteración, asumimos que es un error de validación (definitivo)
            const definitivo = rej.codigo
                ? ['CAMPOS_FALTANTES', 'EMPLEADO_NO_EXISTE', 'VALIDACION_FALLIDA'].includes(rej.codigo)
                : true;
            rawQueueManager.markRawPunchError(rej.id_local, rej.error, definitivo);
            console.log(`[RawSync] Error: id_local=${rej.id_local} : ${rej.error} (Definitivo: ${definitivo})`);
        }

        return {
            total: pending.length,
            synced: sincronizados.length,
            errors: rechazados.length,
            sincronizados,
            rechazados,
        };


    } catch (error) {
        console.error('[RawSync] Error general en push:', error.message);
        return { total: 0, synced: 0, errors: 0, error: error.message };
    } finally {
        isPushing = false;
    }
}

export default {
    configureSync,
    updateSyncToken,
    startAutoSync,
    stopAutoSync,
    pushPendingRawPunches
};
