/**
 * PullService — Descarga datos maestros del servidor al caché local SQLite
 * Usa los endpoints reales que existen en el backend.
 *
 * Endpoints usados:
 *   GET /api/empleados/                  → lista empleados activos
 *   GET /api/credenciales/descriptores   → descriptores faciales (array de números, campo descriptor_facial)
 *   GET /api/horarios/                   → horarios (si existe)
 */

import sqliteManager from './sqliteManager.mjs';
import crypto from 'crypto';

// Configuración — se inyectará desde SyncManager
let apiBaseUrl = '';
let authToken = '';
let escritorioId = '';

/**
 * Configura la URL base y token para las peticiones
 */
export function configure(baseUrl, token, escId) {
  if (baseUrl !== undefined && baseUrl !== null) {
    apiBaseUrl = baseUrl;
  }
  if (token !== undefined) {
    authToken = token || '';
  }
  if (escId !== undefined) {
    escritorioId = escId || '';
  }
  console.log('[PullService] Initialization: Configurado URL =', apiBaseUrl ? apiBaseUrl.substring(0, 40) + '...' : '(vacio!)', escritorioId ? `escritorio=${escritorioId}` : '');
}

/**
 * Helper para hacer fetch con timeout y autenticación
 */
async function apiFetch(endpoint, timeoutMs = 30000) {
  if (!apiBaseUrl) {
    throw new Error(`URL base no configurada. No se puede hacer fetch de ${endpoint}`);
  }

  const fullUrl = `${apiBaseUrl}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================
// PULL COMPLETO USANDO ENDPOINTS REALES DEL BACKEND
// ============================================================

/**
 * Ejecuta un Pull completo descargando desde el endpoint unificado.
 * @returns {Object} resumen del sync
 */
export async function fullPull() {
  console.log('[PullService] Action: Starting full data pull (unified)...');
  const startTime = Date.now();

  const results = {
    empleados: { success: false, count: 0 },
    credenciales: { success: false, count: 0 },
    horarios: { success: false, count: 0 },
    duration: 0,
  };

  if (!authToken) {
    console.warn('[PullService] Warning: Sin token de autenticacion, omitiendo Pull...');
    results.duration = Date.now() - startTime;
    return results;
  }

  try {
    // Endpoint unificado que devuelve empleados, horarios, credenciales, escritorios y biométricos
    const endpoint = escritorioId
      ? `/api/escritorio/sync/datos-referencia?escritorio_id=${encodeURIComponent(escritorioId)}`
      : '/api/escritorio/sync/datos-referencia';
    const data = await apiFetch(endpoint);

    if (!data) {
      throw new Error('Respuesta vacía del servidor');
    }

    // Guardar todo en una sola transacción para evitar "database is locked"
    sqliteManager.setReferenciaData({
      empleados: data.empleados || [],
      horarios: data.horarios || [],
      credenciales: data.credenciales || [],
      escritorios: data.escritorios || [],
      biometricos: data.biometricos || [],
    });

    results.empleados = { success: true, count: (data.empleados || []).length };
    results.credenciales = { success: true, count: (data.credenciales || []).length };
    results.horarios = { success: true, count: (data.horarios || []).length };

    console.log(`[PullService] Status: Sync unificado exitoso en ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('[PullService] Error: Pull unificado falló:', error.message);
    results.error = error.message;
  }

  results.duration = Date.now() - startTime;
  return results;
}

export default {
  configure,
  fullPull,
};
