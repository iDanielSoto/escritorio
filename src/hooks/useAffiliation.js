// src/hooks/useAffiliation.js
import { useState, useEffect } from "react";
import {
  crearSolicitudAfiliacion,
  obtenerEstadoSolicitud,
  obtenerSolicitudGuardada,
  limpiarSolicitudGuardada,
  cancelarSolicitud,
  obtenerInfoSistema,
} from "../services/affiliationService.js";

export const useAffiliation = () => {
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [solicitudActual, setSolicitudActual] = useState(null);
  const [estadoSolicitud, setEstadoSolicitud] = useState(null);

  // Cargar solicitud guardada al iniciar
  useEffect(() => {
    const solicitudGuardada = obtenerSolicitudGuardada();
    if (solicitudGuardada) {
      setSolicitudActual(solicitudGuardada);
      verificarEstado(solicitudGuardada.token);
    }
  }, []);

  // Verificar estado de la solicitud
  const verificarEstado = async (token) => {
    try {
      setLoading(true);
      const estado = await obtenerEstadoSolicitud(token);
      setEstadoSolicitud(estado);
      return estado;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Crear nueva solicitud
  const crearSolicitud = async (datosEquipo) => {
    try {
      setLoading(true);
      setError(null);

      // Obtener info del sistema
      const infoSistema = await obtenerInfoSistema();

      // Combinar datos
      const datosSolicitud = {
        ...datosEquipo,
        ...infoSistema,
        empresa_id: companyId,
      };

      // Crear solicitud
      const solicitud = await crearSolicitudAfiliacion(datosSolicitud);
      setSolicitudActual(solicitud);

      return solicitud;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Cancelar solicitud
  const cancelar = async () => {
    if (!solicitudActual?.id) return;

    try {
      setLoading(true);
      await cancelarSolicitud(solicitudActual.id);
      setSolicitudActual(null);
      setEstadoSolicitud(null);
      setCompanyId("");
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Limpiar datos
  const limpiar = () => {
    limpiarSolicitudGuardada();
    setSolicitudActual(null);
    setEstadoSolicitud(null);
    setCompanyId("");
    setError(null);
  };

  return {
    // Estado
    companyId,
    setCompanyId,
    loading,
    error,
    solicitudActual,
    estadoSolicitud,

    // Acciones
    crearSolicitud,
    verificarEstado,
    cancelar,
    limpiar,

    // Helpers
    tieneSolicitudPendiente: !!solicitudActual,
    esAprobada: estadoSolicitud?.estado === "aprobada",
    esRechazada: estadoSolicitud?.estado === "rechazada",
  };
};
