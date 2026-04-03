import { API_CONFIG, getApiEndpoint } from "../config/apiEndPoint";

const CONFIG_ESCRITORIO_ENDPOINT = API_CONFIG.ENDPOINTS.CONFIGURACIONES_ESCRITORIO;

const getAuthToken = () => localStorage.getItem("auth_token");

/**
 * Obtener la configuración de métodos de autenticación del escritorio específico.
 * Llama a GET /api/configuraciones-escritorio/:escritorio_id
 * @param {string} escritorioId - ID del escritorio.
 * @returns {Promise<Object>} La configuración obtenida.
 */
export const obtenerConfiguracionEscritorio = async (escritorioId) => {
    const token = getAuthToken();
    if (!escritorioId) throw new Error("ID de escritorio no proporcionado");

    const url = getApiEndpoint(`${CONFIG_ESCRITORIO_ENDPOINT}/${escritorioId}`);

    const headers = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method: "GET",
        headers,
    });

    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
            const err = await response.json();
            errorMsg = err.message || errorMsg;
        } catch (e) {
            // Failed to parse JSON, probably an HTML 404 page from Express
            errorMsg += " (Posible ruta no encontrada en el backend)";
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.message || "Error en la respuesta del servidor");
    }

    return data.data;
};

/**
 * Actualiza la configuración del escritorio, específicamente metodos_autenticacion.
 * Llama a PUT /api/configuraciones-escritorio/:escritorio_id
 * @param {string} escritorioId - ID del escritorio.
 * @param {Object} datosConfig - Objeto con las propiedades a actualizar.
 * @returns {Promise<Object>} La configuración actualizada.
 */
export const actualizarConfiguracionEscritorio = async (escritorioId, datosConfig) => {
    const token = getAuthToken();
    if (!token) throw new Error("No hay sesión activa");
    if (!escritorioId) throw new Error("ID de escritorio no proporcionado");

    const url = getApiEndpoint(`${CONFIG_ESCRITORIO_ENDPOINT}/${escritorioId}`);
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datosConfig),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Error HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.message || "Error al actualizar la configuración de escritorio");
    }

    return data.data;
};
