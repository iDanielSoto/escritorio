// src/services/avisosService.js
// Servicio para gestionar avisos con cache en memoria

import { API_CONFIG, fetchApi } from "../config/apiEndPoint";

const AVISOS_ENDPOINT = API_CONFIG.ENDPOINTS.AVISOS;
const EMPLEADOS_ENDPOINT = API_CONFIG.ENDPOINTS.EMPLEADOS;

// ─── Cache en memoria ────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cacheGlobales = {
  data: null,
  timestamp: 0,
};

const cacheEmpleados = new Map(); // Map<empleadoId, { data, timestamp }>

// ─── Helpers ─────────────────────────────────────────

/**
 * Formatea una fecha ISO a formato legible para el frontend
 * @param {string} fechaISO 
 * @returns {{ time: string, date: string }}
 */
function formatearFecha(fechaISO) {
  if (!fechaISO) return { time: "", date: "" };

  const fecha = new Date(fechaISO);

  // Formato de hora: "10:45 a.m."
  const time = fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Formato de fecha: "29/10/2025"
  const date = fecha.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return { time, date };
}

/**
 * Mapea un aviso del backend al formato del frontend
 * @param {Object} aviso - Aviso del backend { id, titulo, contenido, fecha_registro }
 * @returns {Object} Aviso mapeado al formato del frontend
 */
function mapearAviso(aviso) {
  const { time, date } = formatearFecha(aviso.fecha_registro || aviso.fecha_asignacion);

  return {
    id: aviso.id,
    subject: aviso.titulo || "Sin título",
    detail: aviso.contenido || "",
    message: aviso.contenido ? aviso.contenido.substring(0, 80) : "",
    time,
    date,
    author: aviso.remitente_nombre || "Sistema",
    type: "info",
  };
}

// ─── API Functions ───────────────────────────────────

/**
 * Obtiene los avisos globales con cache
 * @param {boolean} forceRefresh - Si true, ignora el cache
 * @returns {Promise<Array>} Lista de avisos globales formateados
 */
export async function getAvisosGlobales(forceRefresh = false) {
  const ahora = Date.now();

  // Devolver cache si es válida
  if (!forceRefresh && cacheGlobales.data && (ahora - cacheGlobales.timestamp) < CACHE_TTL) {
    return cacheGlobales.data;
  }

  try {
    const empresaId = localStorage.getItem("empresa_id");
    let url = `${AVISOS_ENDPOINT}/publicos`;

    if (empresaId) {
      url += `?empresa_id=${encodeURIComponent(empresaId)}`;
    }

    const response = await fetchApi(url);

    const avisos = response.success && Array.isArray(response.data)
      ? response.data.map(mapearAviso)
      : [];

    // Guardar en cache
    cacheGlobales = {
      data: avisos,
      timestamp: Date.now(),
    };

    return avisos;
  } catch (error) {
    console.error("❌ Error obteniendo avisos globales:", error.message);

    // Si hay cache expirada, devolverla como fallback
    if (cacheGlobales.data) {
      console.warn("⚠️ Usando cache expirada de avisos globales como fallback");
      return cacheGlobales.data;
    }

    return [];
  }
}

/**
 * Obtiene los avisos de un empleado específico con cache
 * @param {string|number} empleadoId - ID del empleado
 * @param {boolean} forceRefresh - Si true, ignora el cache
 * @returns {Promise<Array>} Lista de avisos del empleado formateados
 */
export async function getAvisosDeEmpleado(empleadoId, forceRefresh = false) {
  if (!empleadoId) {
    console.warn("⚠️ No se proporcionó empleadoId para avisos");
    return [];
  }

  const ahora = Date.now();
  const cached = cacheEmpleados.get(empleadoId);

  // Devolver cache si es válida
  if (!forceRefresh && cached && (ahora - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetchApi(`${EMPLEADOS_ENDPOINT}/${empleadoId}/avisos`);

    const avisos = response.success && Array.isArray(response.data)
      ? response.data.map(mapearAviso)
      : [];

    // Guardar en cache
    cacheEmpleados.set(empleadoId, {
      data: avisos,
      timestamp: Date.now(),
    });

    return avisos;
  } catch (error) {
    console.error(`❌ Error obteniendo avisos del empleado ${empleadoId}:`, error.message);

    // Si hay cache expirada, devolverla como fallback
    if (cached?.data) {
      console.warn("⚠️ Usando cache expirada de avisos de empleado como fallback");
      return cached.data;
    }

    return [];
  }
}

/**
 * Limpia toda la cache de avisos (útil al cerrar sesión)
 */
export function limpiarCacheAvisos() {
  cacheGlobales = { data: null, timestamp: 0 };
  cacheEmpleados.clear();
}
