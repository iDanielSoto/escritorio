// src/services/empleadoService.js
// Servicio para obtener datos de empleados

import { API_CONFIG, fetchApi } from "../config/apiEndPoint";

const API_URL = API_CONFIG.BASE_URL;

/**
 * Obtener todos los empleados
 * @returns {Promise<Array>} - Lista de empleados
 */
export const getAllEmpleados = async () => {
  try {
    console.log(`📋 Obteniendo todos los empleados...`);
    const token = localStorage.getItem("auth_token");

    const response = await fetch(`${API_URL}${API_CONFIG.ENDPOINTS.EMPLEADOS}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error("Error al obtener empleados");
    }

    const json = await response.json();
    return json.data || json;
  } catch (error) {
    console.error("❌ Error al obtener empleados:", error);
    throw error;
  }
};

/**
 * Obtener datos completos de un empleado por su ID de usuario
 * @param {string} usuarioId - ID del usuario
 * @returns {Promise<Object>} - Datos del empleado
 */
export const getEmpleadoByUsuarioId = async (usuarioId) => {
  try {
    console.log(`📋 Buscando empleado para usuario ${usuarioId}...`);
    const token = localStorage.getItem("auth_token");

    const response = await fetch(`${API_URL}${API_CONFIG.ENDPOINTS.EMPLEADOS}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error("Error al obtener empleados");
    }

    const json = await response.json();
    const empleados = json.data || json;
    
    // Validar que sea un arreglo antes de tratar de buscar
    if (!Array.isArray(empleados)) {
      console.warn("⚠️ La respuesta de la API no es un arreglo de empleados:", empleados);
      return null;
    }

    const empleado = empleados.find((emp) => emp.usuario_id === usuarioId);

    if (empleado) {
      console.log("✅ Empleado encontrado:", empleado);
    }
    return empleado || null;
  } catch (error) {
    console.error("❌ Error al obtener empleado:", error);
    throw error;
  }
};

/**
 * Obtener datos de un empleado por su ID de empleado
 * @param {string} empleadoId - ID del empleado
 * @returns {Promise<Object>} - Datos del empleado
 */
export const getEmpleadoById = async (empleadoId) => {
  try {
    console.log(`📋 Obteniendo datos del empleado ${empleadoId}...`);
    const token = localStorage.getItem("auth_token");

    const response = await fetch(`${API_URL}${API_CONFIG.ENDPOINTS.EMPLEADOS}/${empleadoId}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error("Empleado no encontrado");
    }

    const json = await response.json();
    const empleado = json.data || json;
    console.log("✅ Datos del empleado obtenidos:", empleado);
    return empleado;
  } catch (error) {
    console.error("❌ Error al obtener empleado:", error);
    throw error;
  }
};

/**
 * Obtener el horario asignado a un empleado
 * @param {string} horarioId - ID del horario
 * @returns {Promise<Object>} - Datos del horario
 */
export const getHorarioById = async (horarioId) => {
  try {
    console.log(`⏰ Obteniendo horario ${horarioId}...`);
    const token = localStorage.getItem("auth_token");

    const response = await fetch(`${API_URL}${API_CONFIG.ENDPOINTS.HORARIOS}/${horarioId}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error("Horario no encontrado");
    }

    const json = await response.json();
    const horario = json.data || json;
    console.log("✅ Horario obtenido:", horario);
    return horario;
  } catch (error) {
    console.error("❌ Error al obtener horario:", error);
    throw error;
  }
};

/**
 * Obtener datos completos del empleado incluyendo su horario
 * Puede recibir el ID de usuario o los datos del usuario con empleado_id y horario_id
 * @param {string|Object} usuarioIdOrData - ID del usuario o objeto con datos
 * @returns {Promise<Object>} - Datos completos del empleado con horario
 */
export const getEmpleadoConHorario = async (usuarioIdOrData) => {
  try {
    let empleado = null;
    let horarioId = null;

    // Si es un objeto con empleado_id, usar esos datos directamente
    if (typeof usuarioIdOrData === 'object' && usuarioIdOrData.empleado_id) {
      // Preservar TODOS los datos del usuario, no solo algunos campos
      empleado = {
        ...usuarioIdOrData,
        id: usuarioIdOrData.empleado_id,
        usuario_id: usuarioIdOrData.id,
      };
      horarioId = usuarioIdOrData.horario_id;
    }
    // Si es un ID, buscar el empleado
    else if (typeof usuarioIdOrData === 'string' || typeof usuarioIdOrData === 'number') {
      empleado = await getEmpleadoByUsuarioId(usuarioIdOrData);
      horarioId = empleado?.horario_id;
    }

    if (!empleado) {
      console.warn("⚠️ No se encontró empleado");
      return null;
    }

    // Obtener horario si existe
    let horario = null;
    if (horarioId) {
      try {
        horario = await getHorarioById(horarioId);
      } catch (error) {
        console.warn("⚠️ No se pudo obtener el horario:", error);
      }
    }

    return {
      ...empleado,
      horario,
    };
  } catch (error) {
    console.error("❌ Error al obtener empleado con horario:", error);
    throw error;
  }
};

/**
 * Obtener las asistencias de un empleado
 * @param {string} empleadoId - ID del empleado
 * @param {Object} options - Opciones de filtrado
 * @returns {Promise<Array>} - Lista de asistencias
 */
export const getAsistenciasEmpleado = async (empleadoId, options = {}) => {
  try {
    console.log(`📊 Obteniendo asistencias del empleado ${empleadoId}...`);

    let url = `${API_CONFIG.ENDPOINTS.ASISTENCIAS}?empleado_id=${empleadoId}`;

    if (options.fechaInicio) {
      url += `&fecha_inicio=${options.fechaInicio}`;
    }
    if (options.fechaFin) {
      url += `&fecha_fin=${options.fechaFin}`;
    }

    const asistencias = await fetchApi(url);
    console.log("✅ Asistencias obtenidas:", asistencias.length);
    return asistencias;
  } catch (error) {
    console.error("❌ Error al obtener asistencias:", error);
    throw error;
  }
};

/**
 * Obtener las incidencias de un empleado
 * @param {string} empleadoId - ID del empleado
 * @returns {Promise<Array>} - Lista de incidencias
 */
export const getIncidenciasEmpleado = async (empleadoId) => {
  try {
    console.log(`📋 Obteniendo incidencias del empleado ${empleadoId}...`);
    const incidencias = await fetchApi(`${API_CONFIG.ENDPOINTS.INCIDENCIAS}?empleado_id=${empleadoId}`);
    console.log("✅ Incidencias obtenidas:", incidencias.length);
    return incidencias;
  } catch (error) {
    console.error("❌ Error al obtener incidencias:", error);
    throw error;
  }
};

/**
 * Obtener los departamentos asignados a un empleado por su empleado_id
 * Flujo: GET /api/empleados/{empleado_id}/departamentos → departamentos completos
 * @param {string} empleadoId - ID del empleado
 * @returns {Promise<Array>} - Lista de departamentos con datos completos
 */
export const getDepartamentosPorEmpleadoId = async (empleadoId) => {
  try {
    if (!empleadoId) {
      console.warn("⚠️ No se proporcionó empleado_id");
      return [];
    }

    const token = localStorage.getItem("auth_token");
    console.log(`🏢 Obteniendo departamentos del empleado ${empleadoId}...`);

    // Intentar obtener departamentos del empleado desde el endpoint específico
    const response = await fetch(
      `${API_URL}${API_CONFIG.ENDPOINTS.EMPLEADOS}/${empleadoId}/departamentos`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const departamentos = data.data || data;
      console.log("✅ Departamentos obtenidos:", departamentos);
      return Array.isArray(departamentos) ? departamentos : [];
    }

    // Si el endpoint específico no existe, intentar con query params
    console.log("⚠️ Endpoint específico no disponible, intentando alternativa...");
    const altResponse = await fetch(
      `${API_URL}${API_CONFIG.ENDPOINTS.DEPARTAMENTOS}?empleado_id=${empleadoId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      }
    );

    if (altResponse.ok) {
      const altData = await altResponse.json();
      const departamentos = altData.data || altData;
      console.log("✅ Departamentos obtenidos (alternativo):", departamentos);
      return Array.isArray(departamentos) ? departamentos : [];
    }

    console.warn("⚠️ No se pudieron obtener departamentos");
    return [];
  } catch (err) {
    console.error("❌ Error al obtener departamentos del empleado:", err);
    return [];
  }
};

/**
 * Obtener los departamentos asignados a un empleado desde un array
 * Flujo: empleados_departamentos (FK empleado_id) → departamentos (datos completos)
 * @param {Array} departamentosAsignados - Array de departamentos del empleado (de empleados_departamentos)
 * @returns {Promise<Array>} - Lista de departamentos con datos completos
 */
export const getDepartamentosEmpleado = async (departamentosAsignados) => {
  try {
    if (!departamentosAsignados || departamentosAsignados.length === 0) {
      return [];
    }

    const token = localStorage.getItem("auth_token");

    // Por cada departamento_id, obtener el registro completo de la tabla departamentos
    const promesas = departamentosAsignados.map(async (depto) => {
      try {
        const deptoId = depto.departamento_id || depto.id;
        const response = await fetch(
          `${API_URL}${API_CONFIG.ENDPOINTS.DEPARTAMENTOS}/${deptoId}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return data.data || data;
        }
        return null;
      } catch (err) {
        console.warn(`⚠️ Error obteniendo departamento:`, err);
        return null;
      }
    });

    const resultados = await Promise.all(promesas);
    return resultados.filter((depto) => depto !== null);
  } catch (err) {
    console.error("❌ Error al obtener departamentos del empleado:", err);
    return [];
  }
};

/**
 * Obtener un departamento por su ID
 * @param {string} departamentoId - ID del departamento
 * @returns {Promise<Object>} - Datos del departamento
 */
export const getDepartamentoById = async (departamentoId) => {
  try {
    const token = localStorage.getItem("auth_token");

    const response = await fetch(
      `${API_URL}${API_CONFIG.ENDPOINTS.DEPARTAMENTOS}/${departamentoId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      }
    );

    if (!response.ok) {
      throw new Error("Departamento no encontrado");
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error("❌ Error al obtener departamento:", error);
    throw error;
  }
};

export default {
  getAllEmpleados,
  getEmpleadoById,
  getHorarioById,
  getEmpleadoConHorario,
  getAsistenciasEmpleado,
  getIncidenciasEmpleado,
  getDepartamentosEmpleado,
  getDepartamentosPorEmpleadoId,
  getDepartamentoById,
};
