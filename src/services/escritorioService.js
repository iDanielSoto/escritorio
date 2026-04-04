// src/services/escritorioService.js
// Servicio para gestionar datos del escritorio/nodo

import { API_CONFIG, getApiEndpoint } from "../config/apiEndPoint";

const ESCRITORIO_ENDPOINT = API_CONFIG.ENDPOINTS.ESCRITORIO;
const SOLICITUDES_ENDPOINT = API_CONFIG.ENDPOINTS.SOLICITUDES;

/**
 * Obtener el token de autenticación
 * @returns {string|null} - Token o null
 */
const getAuthToken = () => {
  return localStorage.getItem("auth_token");
};

/**
 * Obtener los datos del escritorio actual
 * Intenta múltiples endpoints en orden de preferencia
 * @param {string} escritorioId - ID del escritorio (CHAR 8)
 * @returns {Promise<Object>} - Datos del escritorio
 */
export const obtenerEscritorio = async (escritorioId) => {
  try {
    if (!escritorioId) {
      throw new Error("No se proporcionó el ID del escritorio");
    }

    const token = getAuthToken();
    console.log("📡 Obteniendo datos del escritorio:", escritorioId);

    // Estrategia 1: Intentar con endpoint /actual (basado en token)
    if (token) {
      try {
        let url = getApiEndpoint(`${ESCRITORIO_ENDPOINT}/actual`);
        let response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const resultado = await response.json();
          console.log("✅ Datos obtenidos via /actual:", resultado);
          return resultado.data || resultado;
        }
      } catch (e) {
        console.log("⚠️ Endpoint /actual no disponible, intentando alternativas...");
      }
    }

    // Estrategia 2: Intentar con endpoint directo por ID (con token si existe)
    if (token) {
      try {
        const url = getApiEndpoint(`${ESCRITORIO_ENDPOINT}/${escritorioId}`);
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const resultado = await response.json();
          console.log("✅ Datos obtenidos via /{id}:", resultado);
          return resultado.data || resultado;
        }
      } catch (e) {
        console.log("⚠️ Endpoint /{id} no disponible, intentando alternativas...");
      }
    }

    // Estrategia 3: Intentar con el token de solicitud guardado (endpoint público)
    const solicitudToken = localStorage.getItem("solicitud_token");
    if (solicitudToken) {
      try {
        const url = getApiEndpoint(`${SOLICITUDES_ENDPOINT}/verificar/${solicitudToken}`);
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const resultado = await response.json();
          const solicitud = resultado.data || resultado;
          console.log("✅ Datos obtenidos via solicitud:", solicitud);

          // Mapear los datos de la solicitud al formato de escritorio
          if (solicitud.estado?.toLowerCase() === "aceptado") {
            return {
              id: solicitud.escritorio_id || escritorioId,
              nombre: solicitud.nombre || "",
              descripcion: solicitud.descripcion || "",
              ip: solicitud.ip || "",
              mac: solicitud.mac || "",
              sistema_operativo: solicitud.sistema_operativo || "",
              dispositivos_biometricos: solicitud.dispositivos_temp || [],
              es_activo: true,
            };
          }
        }
      } catch (e) {
        console.log("⚠️ Endpoint de solicitud no disponible");
      }
    }

    // Si ninguna estrategia funcionó, lanzar error
    throw new Error("No se pudo obtener la información del escritorio. Verifique su conexión o contacte al administrador.");
  } catch (error) {
    console.error("❌ Error al obtener escritorio:", error);
    throw error;
  }
};

/**
 * Actualizar los datos del escritorio
 * @param {string} escritorioId - ID del escritorio (CHAR 8)
 * @param {Object} datos - Datos a actualizar
 * @param {string} datos.nombre - Nombre del nodo (CHAR 55)
 * @param {string} datos.descripcion - Descripción (TEXT)
 * @param {string} datos.ip - Dirección IP (CHAR 12)
 * @param {string} datos.mac - Dirección MAC (CHAR 12)
 * @param {string} datos.sistema_operativo - Sistema operativo (TEXT)
 * @returns {Promise<Object>} - Escritorio actualizado
 */
export const actualizarEscritorio = async (escritorioId, datos) => {
  try {
    if (!escritorioId) {
      throw new Error("No se proporcionó el ID del escritorio");
    }

    const token = getAuthToken();
    if (!token) {
      throw new Error("Sesión no válida. Por favor, cierre sesión e inicie nuevamente.");
    }

    console.log("📝 Actualizando escritorio:", escritorioId, datos);
    const url = getApiEndpoint(`${ESCRITORIO_ENDPOINT}/${escritorioId}`);

    const datosFormateados = {
      nombre: datos.nombre !== undefined ? datos.nombre.substring(0, 55) : undefined,
      descripcion: datos.descripcion,
      ip: datos.ip !== undefined ? datos.ip.substring(0, 45) : undefined,
      mac: datos.mac !== undefined ? datos.mac.substring(0, 17) : undefined,
      sistema_operativo: datos.sistema_operativo,
      es_activo: datos.es_activo,
      dispositivos_biometricos: datos.dispositivos_biometricos
    };

    // Eliminar campos undefined para dejar que el backend use COALESCE
    Object.keys(datosFormateados).forEach(key =>
      datosFormateados[key] === undefined && delete datosFormateados[key]
    );

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(datosFormateados),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error HTTP ${response.status}`);
    }

    const resultado = await response.json();
    console.log("✅ Escritorio actualizado:", resultado);

    return resultado.data || resultado;
  } catch (error) {
    console.error("❌ Error al actualizar escritorio:", error);
    throw error;
  }
};

/**
 * Obtener el ID del escritorio guardado en localStorage
 * @returns {string|null} - ID del escritorio o null
 */
export const obtenerEscritorioIdGuardado = () => {
  return localStorage.getItem("escritorio_id");
};

/**
 * Verificar si el escritorio está activo
 * @param {string} escritorioId - ID del escritorio
 * @returns {Promise<boolean>} - true si está activo
 */
export const verificarEscritorioActivo = async (escritorioId) => {
  try {
    const escritorio = await obtenerEscritorio(escritorioId);
    return escritorio?.es_activo === true || escritorio?.es_activo === 1;
  } catch (error) {
    console.error("❌ Error al verificar estado del escritorio:", error);
    return false;
  }
};

/**
 * Verificar el estado público del escritorio de forma ligera para detecciones en tiempo real.
 * Usa un endpoint que no requiere token.
 * @param {string} escritorioId - ID del escritorio
 * @returns {Promise<Object>} - Resultado del estado del servidor
 */
export const verificarEstadoPublico = async (escritorioId) => {
  try {
    if (!escritorioId) {
      throw new Error("No se proporcionó el ID del escritorio");
    }

    const url = getApiEndpoint(`${ESCRITORIO_ENDPOINT}/public/status/${escritorioId}`);
    const token = getAuthToken();

    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (response.ok) {
      const resultado = await response.json();
      return resultado;
    }
    return null;
  } catch (error) {
    console.warn("❌ Error al verificar estado público del escritorio:", error);
    return null;
  }
};

/**
 * Desactiva el escritorio en el servidor
 * @param {string} escritorioId - ID del escritorio a desactivar
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const desactivarEscritorio = async (escritorioId) => {
  try {
    if (!escritorioId) {
      throw new Error("No se proporcionó el ID del escritorio");
    }

    const token = getAuthToken();
    if (!token) {
      console.warn("⚠️ No hay token de autenticación para desactivar escritorio. Intentando sin token o puede fallar.");
    }

    console.log("🛑 Desactivando escritorio:", escritorioId);
    const url = getApiEndpoint(`${ESCRITORIO_ENDPOINT}/${escritorioId}`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error HTTP ${response.status}`);
    }

    const resultado = await response.json();
    console.log("✅ Escritorio desactivado en el servidor:", resultado);

    return resultado;
  } catch (error) {
    console.error("❌ Error al desactivar escritorio:", error);
    throw error;
  }
};
