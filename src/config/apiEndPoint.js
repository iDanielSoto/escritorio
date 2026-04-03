export const API_CONFIG = {
  BASE_URL: "https://9dm7dqf9-3002.usw3.devtunnels.ms",
  ENDPOINTS: {
    MODULOS: "/api/modulos",
    USUARIOS: "/api/usuarios",
    EMPLEADOS: "/api/empleados",
    ROLES: "/api/roles",
    ASISTENCIAS: "/api/asistencias",
    INCIDENCIAS: "/api/incidencias",
    HORARIOS: "/api/horarios",
    TOLERANCIAS: "/api/tolerancias",
    EMPRESAS: "/api/empresas",
    DEPARTAMENTOS: "/api/departamentos",
    CREDENCIALES: "/api/credenciales",
    CONFIGURACION: "/api/configuracion",
    AUTH: "/api/auth",
    ESCRITORIO: "/api/escritorio",
    CONFIGURACIONES_ESCRITORIO: "/api/configuraciones-escritorio",
    MOVIL: "/api/movil",
    BIOMETRICO: "/api/biometrico",
    SOLICITUDES: "/api/solicitudes",
    EVENTOS: "/api/eventos",
    AVISOS: "/api/avisos",
  },
  TIMEOUT: 30000,
};

export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export const getApiEndpoint = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export const fetchApi = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);
  const token = localStorage.getItem("auth_token");

  const defaultOptions = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(!options.skipAuth && token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      if (response.status >= 500) {
        // En caso de que se haya caído el servidor, despachar evento inmediatamente
        window.dispatchEvent(new CustomEvent("api-offline"));
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Si la llamada tiene éxito, notificar para revivir conectividad si estaba muerta
    window.dispatchEvent(new CustomEvent("api-online"));
    return await response.json();
  } catch (error) {
    console.error(`Error en ${endpoint}:`, error);
    
    // Si el error es de tipo FETCH / Red / No route to host / CORS caido
    if (error.name === 'TypeError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      window.dispatchEvent(new CustomEvent("api-offline"));
    }
    
    throw error;
  }
};

export const postApi = async (endpoint, data, options = {}) => {
  return fetchApi(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
    ...options,
  });
};

export const putApi = async (endpoint, data, options = {}) => {
  return fetchApi(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
    ...options,
  });
};

export const deleteApi = async (endpoint, options = {}) => {
  return fetchApi(endpoint, {
    method: "DELETE",
    ...options,
  });
};

export default API_CONFIG;
