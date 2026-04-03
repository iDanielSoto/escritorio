import { createContext, useContext, useState, useEffect } from "react";
import { API_CONFIG } from "../config/apiEndPoint";
import { loginUsuario } from "../services/authService";
import { getEmpleadoConHorario } from "../services/empleadoService";

const API_URL = API_CONFIG.BASE_URL;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const userData = localStorage.getItem("user_data");

      if (token) {
        if (window.electronAPI && window.electronAPI.syncManager) {
          try {
            window.electronAPI.syncManager.updateToken(token);
            console.log("Token entregado a SyncManager localmente");
          } catch (e) {
            console.warn("No se pudo sincronizar el token con el proceso principal en el inicio", e);
          }
        }
        
        if (userData) {
          setUser(JSON.parse(userData));
        }
      }
    } catch (error) {
      console.error("Error al verificar autenticacion:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (usuario, contrasena) => {
    try {
      setLoading(true);
      setError(null);

      const empresaId = localStorage.getItem("empresa_id");
      
      const bodyData = { usuario, contraseña: contrasena };
      if (empresaId) {
        bodyData.empresa_id = empresaId;
      }

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al iniciar sesion");
      }

      if (!data.success) {
        throw new Error(data.message || "Credenciales invalidas");
      }

      localStorage.setItem("auth_token", data.data.token);
      localStorage.setItem("user_data", JSON.stringify(data.data));

      setUser(data.data);
      return { success: true };
    } catch (error) {
      console.error("Error en login:", error);
      setError(error.message);
      return {
        success: false,
        message: error.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Error al cerrar sesion:", error);
    } finally {
      // localStorage.removeItem("auth_token"); // OMITTED to persist for kiosk DevTunnels
      localStorage.removeItem("user_data");
      setUser(null);
      setError(null);
    }
  };

  const hasPermission = (permiso) => {
    if (!user) return false;
    if (user.esAdmin) return true;
    return true;
  };

  const isAdmin = () => {
    if (!user) return false;
    // Evaluar diferentes formas en las que llega del backend (snake_case, camelCase o en un array de roles)
    return !!(
      user.esAdmin ||
      user.es_admin ||
      (Array.isArray(user.roles) && user.roles.some((r) => r.es_admin || r.esAdmin || r.nombre === 'Administrador' || r.nombre === 'admin')) ||
      user.rol === 'admin' || user.rol === 'Administrador'
    );
  };

  // Login por PIN (para empleados)
  const loginByPin = async (username, pin) => {
    try {
      setLoading(true);
      setError(null);

      const empresaId = localStorage.getItem("empresa_id");
      const result = await loginUsuario(username, pin, empresaId);

      if (!result.success) {
        throw new Error(result.error || "Error al iniciar sesión");
      }

      const usuario = result.usuario;

      // Obtener datos completos del empleado con horario (si es empleado)
      let empleadoCompleto = usuario;
      try {
        if (usuario.es_empleado && usuario.empleado_id) {
          // Pasar el objeto completo para que use empleado_id y horario_id
          const datosCompletos = await getEmpleadoConHorario(usuario);
          if (datosCompletos) {
            empleadoCompleto = { ...usuario, ...datosCompletos };
          }
        }
      } catch (err) {
        console.warn(
          "⚠️ No se pudieron obtener datos completos del empleado:",
          err,
        );
      }

      localStorage.setItem("user_data", JSON.stringify(empleadoCompleto));

      setUser(empleadoCompleto);
      return { success: true, usuario: empleadoCompleto };
    } catch (error) {
      console.error("Error en loginByPin:", error);
      setError(error.message);
      return {
        success: false,
        message: error.message,
      };
    } finally {
      setLoading(false);
    }
  };

  // Actualizar datos del empleado en el contexto
  const updateEmpleadoData = async (empleadoId) => {
    try {
      const datosCompletos = await getEmpleadoConHorario(empleadoId);
      const updatedUser = { ...user, ...datosCompletos };
      setUser(updatedUser);
      localStorage.setItem("user_data", JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      console.error("Error actualizando datos del empleado:", error);
      throw error;
    }
  };

  // Login por huella dactilar (para empleados)
  const loginByFingerprint = async (empleadoData) => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔐 loginByFingerprint - Datos recibidos:", empleadoData);

      // empleadoData viene del BiometricReader con los datos del empleado
      const usuario = {
        ...empleadoData,
        metodoAutenticacion: "HUELLA",
      };

      // Obtener datos completos del empleado con horario
      let empleadoCompleto = usuario;
      try {
        // Si tiene empleado_id, usar eso directamente
        if (usuario.empleado_id) {
          console.log("📋 Buscando empleado por empleado_id:", usuario.empleado_id);
          const datosCompletos = await getEmpleadoConHorario(usuario);
          if (datosCompletos) {
            empleadoCompleto = {
              ...usuario,
              ...datosCompletos,
              es_empleado: true, // Siempre marcar como empleado en auth biométrica
            };
          }
        }
        // Si no tiene empleado_id pero tiene id (usuario_id), buscar empleado por usuario_id
        else if (usuario.id) {
          console.log("📋 Buscando empleado por usuario_id:", usuario.id);
          const { getEmpleadoByUsuarioId } = await import("../services/empleadoService");
          const empleadoPorUsuario = await getEmpleadoByUsuarioId(usuario.id);
          if (empleadoPorUsuario) {
            console.log("✅ Empleado encontrado:", empleadoPorUsuario);
            // Combinar datos: primero empleado, luego usuario (para no sobrescribir nombre, correo, etc.)
            empleadoCompleto = {
              ...empleadoPorUsuario,  // Datos del empleado (rfc, nss, horario_id)
              ...usuario,              // Datos del usuario (nombre, correo, telefono) - tienen prioridad
              empleado_id: empleadoPorUsuario.id,
              es_empleado: true,
              // Preservar explícitamente los datos del usuario
              nombre: usuario.nombre,
              correo: usuario.correo,
              telefono: usuario.telefono,
              // Agregar datos del empleado que no existen en usuario
              rfc: empleadoPorUsuario.rfc,
              nss: empleadoPorUsuario.nss,
              horario_id: empleadoPorUsuario.horario_id,
            };
            // Obtener horario si existe
            if (empleadoPorUsuario.horario_id) {
              try {
                const { getHorarioById } = await import("../services/empleadoService");
                const horario = await getHorarioById(empleadoPorUsuario.horario_id);
                if (horario) {
                  empleadoCompleto.horario = horario;
                }
              } catch (horarioErr) {
                console.warn("⚠️ No se pudo cargar el horario:", horarioErr);
              }
            }
          }
        }
      } catch (err) {
        console.warn(
          "⚠️ No se pudieron obtener datos completos del empleado:",
          err,
        );
      }

      // Asegurar que siempre esté marcado como empleado en auth biométrica
      // (solo empleados pueden tener huella/rostro registrado)
      if (!empleadoCompleto.es_empleado) {
        empleadoCompleto.es_empleado = true;
      }

      console.log("✅ Datos completos del empleado:", empleadoCompleto);

      // Guardar en localStorage
      localStorage.setItem("user_data", JSON.stringify(empleadoCompleto));

      setUser(empleadoCompleto);
      return { success: true, usuario: empleadoCompleto };
    } catch (error) {
      console.error("Error en loginByFingerprint:", error);
      setError(error.message);
      return {
        success: false,
        message: error.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    loginByPin,
    loginByFingerprint,
    logout,
    isAuthenticated: !!user,
    hasPermission,
    isAdmin,
    checkAuth,
    updateEmpleadoData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
