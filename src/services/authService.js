// src/services/authService.js
// Servicio de autenticación con API remota

import { getApiEndpoint, API_CONFIG } from "../config/apiEndPoint";
import { agregarEvento } from "./bitacoraService";

// Usar la configuración centralizada
const API_URL = API_CONFIG.BASE_URL;
console.log("🔗 API URL:", API_URL); // Para debug

/**
 * Autenticar usuario por usuario/correo y PIN usando el endpoint de autenticación
 * @param {string} usuarioOCorreo - Nombre de usuario o correo
 * @param {string} pin - PIN del usuario (contraseña)
 * @param {string} [empresaId] - (Opcional) ID de la empresa del kiosco para multi-tenant
 * @returns {Promise<Object>} - Usuario autenticado o error
 */
export const loginUsuario = async (usuarioOCorreo, pin, empresaId = null) => {
  try {
    console.log("🔐 Iniciando login para:", usuarioOCorreo);

    const bodyData = {
      usuario: usuarioOCorreo,
      contraseña: pin,
    };
    
    if (empresaId) {
      bodyData.empresa_id = empresaId;
    }

    // 1. Autenticar con el endpoint /api/auth/login
    const loginResponse = await fetch(`${API_URL}${API_CONFIG.ENDPOINTS.AUTH}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json().catch(() => ({}));
      throw new Error(errorData.message || "Credenciales inválidas");
    }

    const loginData = await loginResponse.json();
    console.log("✅ Respuesta de login:", JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      throw new Error(loginData.message || "Error en la autenticación");
    }

    // Extraer datos - el backend puede enviar la data en diferentes formatos
    const responseData = loginData.data || loginData;

    // Guardar el token para futuras peticiones
    const token = responseData.token;
    if (token) {
      localStorage.setItem('auth_token', token);
      console.log("🔑 Token guardado");
      // Enviar token al SyncManager para que pueda hacer Pull autenticado
      if (window.electronAPI && window.electronAPI.syncManager) {
        try {
          window.electronAPI.syncManager.updateToken(token);
        } catch (e) {
          // Silenciar errores de IPC
        }
      }
    }

    // El usuario puede venir directamente en data o en data.usuario
    const usuarioData = responseData.usuario || responseData;

    // 2. Obtener datos adicionales del empleado si es necesario
    let empleadoData = null;
    if (usuarioData.es_empleado && token) {
      try {
        const empleadosResponse = await fetch(`${API_URL}${API_CONFIG.ENDPOINTS.EMPLEADOS}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (empleadosResponse.ok) {
          const empleados = await empleadosResponse.json();
          empleadoData = empleados.find(emp => emp.usuario_id === usuarioData.id);

          if (empleadoData) {
            console.log("✅ Datos de empleado encontrados:", {
              id: empleadoData.id,
              rfc: empleadoData.rfc,
              nss: empleadoData.nss,
              horario_id: empleadoData.horario_id
            });
          }
        }
      } catch (error) {
        console.warn("⚠️ No se pudieron obtener datos del empleado:", error);
      }
    }

    // 3. Combinar datos de usuario y empleado
    // Los datos del empleado pueden venir directamente en usuarioData (desde el login)
    // o en empleadoData (si se hizo la petición adicional)
    const datosCompletos = {
      // Datos del usuario desde la respuesta de login
      id: usuarioData.id,
      usuario: usuarioData.usuario,
      username: usuarioData.usuario,
      correo: usuarioData.correo,
      email: usuarioData.correo,
      nombre: usuarioData.nombre,
      foto: usuarioData.foto,
      telefono: usuarioData.telefono,
      estado_cuenta: usuarioData.estado_cuenta,
      activo: usuarioData.estado_cuenta,
      es_empleado: usuarioData.es_empleado,
      esAdmin: usuarioData.esAdmin || responseData.esAdmin,
      fecha_registro: usuarioData.fecha_registro,
      estado: "CONECTADO",
      token: token,
      // Datos del empleado - primero intentar desde usuarioData (respuesta de login)
      // luego desde empleadoData (petición adicional)
      empleado_id: usuarioData.empleado_id || empleadoData?.id,
      rfc: usuarioData.rfc || empleadoData?.rfc,
      nss: usuarioData.nss || empleadoData?.nss,
      horario_id: usuarioData.horario_id || empleadoData?.horario_id,
      roles: usuarioData.roles || responseData.roles,
      permisos: usuarioData.permisos || responseData.permisos,
    };

    // 4. Registrar login exitoso
    agregarEvento({
      user: datosCompletos.nombre || usuarioOCorreo,
      action: `Inicio de sesión exitoso`,
      type: "success",
    });

    console.log("✅ Login exitoso:", datosCompletos);

    return {
      success: true,
      usuario: datosCompletos,
    };
  } catch (error) {
    console.error("❌ Error en login:", error);
    agregarEvento({
      user: usuarioOCorreo,
      action: `Intento de login fallido - ${error.message}`,
      type: "error",
    });
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Autenticar un kiosco solo con el identificador de la empresa
 * @param {string} identificador - El identificador de la empresa
 * @returns {Promise<Object>} - El token de acceso y datos de la empresa
 */
export const loginKiosco = async (identificador) => {
  try {
    console.log("🔐 Generando token de kiosco para empresa:", identificador);

    const response = await fetch(`${API_URL}${API_CONFIG.ENDPOINTS.AUTH}/token-kiosco`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identificador }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Identificador inválido o empresa inactiva");
    }

    const loginData = await response.json();
    console.log("✅ Respuesta token kiosco:", JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      throw new Error(loginData.message || "Error al obtener el token del kiosco");
    }

    return loginData;
  } catch (error) {
    console.error("❌ Error en login kiosco:", error);
    throw error;
  }
};

/**
 * Obtener usuario por ID
 * @param {number} id - ID del usuario
 * @returns {Promise<Object>} - Usuario encontrado
 */
export const getUsuarioById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/usuarios/${id}`);

    if (!response.ok) {
      throw new Error("Usuario no encontrado");
    }

    return await response.json();
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    throw error;
  }
};

/**
 * Guardar sesión en localStorage
 * @param {Object} usuario - Datos del usuario
 */
export const guardarSesion = (usuario) => {
  localStorage.setItem("usuarioActual", JSON.stringify(usuario));
  localStorage.setItem("ultimoLogin", new Date().toISOString());
};

/**
 * Obtener sesión actual
 * @returns {Object|null} - Usuario actual o null
 */
export const obtenerSesion = () => {
  const usuario = localStorage.getItem("usuarioActual");
  return usuario ? JSON.parse(usuario) : null;
};

/**
 * Actualizar estado del usuario
 * @param {number} id - ID del usuario
 * @param {string} nuevoEstado - Nuevo estado (CONECTADO/DESCONECTADO)
 * @returns {Promise<Object>}
 */
export const actualizarEstadoUsuario = async (id, nuevoEstado) => {
  try {
    console.log(`🔄 Actualizando estado del usuario ${id} a ${nuevoEstado}...`);

    // 1. Obtener el usuario completo primero
    const usuarioActual = await getUsuarioById(id);
    console.log("📋 Usuario actual obtenido:", usuarioActual);

    // 2. Crear una copia con el estado actualizado
    const usuarioActualizado = {
      ...usuarioActual,
      estado: nuevoEstado,
    };

    // 3. Usar PUT con el objeto completo
    const response = await fetch(`${API_URL}/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(usuarioActualizado),
    });

    console.log("📡 Respuesta del servidor:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error en respuesta:", errorText);
      throw new Error(`Error al actualizar estado: ${response.status}`);
    }

    const resultado = await response.json();
    console.log("✅ Estado actualizado exitosamente:", resultado);
    return resultado;
  } catch (error) {
    console.error("❌ Error al actualizar estado:", error);
    throw error;
  }
};

/**
 * Cerrar sesión y actualizar estado
 * @param {number} userId - ID del usuario
 */
export const cerrarSesion = async (userId) => {
  try {
    // Actualizar estado a DESCONECTADO antes de cerrar sesión
    if (userId) {
      await actualizarEstadoUsuario(userId, "DESCONECTADO");
    }
  } catch (error) {
    console.error("Error al actualizar estado al cerrar sesión:", error);
  } finally {
    localStorage.removeItem("usuarioActual");
    localStorage.removeItem("ultimoLogin");
  }
};

/**
 * Verificar si hay sesión activa
 * @returns {boolean}
 */
export const haySesionActiva = () => {
  return obtenerSesion() !== null;
};
