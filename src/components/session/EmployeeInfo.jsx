import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  AlertCircle,
  CheckCircle,
  Coffee,
  LogIn,
  LogOut,
  Calendar,
  Timer,
  MapPin,
  ChevronRight,
  Layers,
  Briefcase,
  RefreshCw,
  Loader2
} from "lucide-react";
import { formatTime } from "../../utils/dateHelpers";
import {
  getHorarioPorEmpleado,
  parsearHorario,
  calcularResumenSemanal,
  getInfoDiaActual,
  obtenerTurnoRelevante
} from "../../services/horariosService";
import DynamicLoader from "../common/DynamicLoader";

export default function EmployeeInfo({ time, empleado, horario: horarioProp, loading: loadingProp }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAllTurnos, setShowAllTurnos] = useState(false);
  const [horarioData, setHorarioData] = useState(null);
  const [loadingHorario, setLoadingHorario] = useState(true);
  const [errorHorario, setErrorHorario] = useState(null);

  // Obtener empleado_id de varias fuentes posibles
  const empleadoId = empleado?.empleado_id || empleado?.id || empleado?.empleadoInfo?.id;
  const token = localStorage.getItem('auth_token');

  // Cargar horario del empleado desde la API
  useEffect(() => {
    const cargarHorario = async () => {
      if (!empleadoId) {
        setLoadingHorario(false);
        setErrorHorario('No se encontró ID del empleado');
        return;
      }

      try {
        setLoadingHorario(true);
        setErrorHorario(null);

        let horario = null;
        try {
          horario = await getHorarioPorEmpleado(empleadoId, token);
        } catch (apiError) {
          console.warn('[EmployeeInfo] API no disponible, intentando cache local:', apiError.message);
          // Fallback: cargar desde la BD local (offline)
          if (window.electronAPI?.offlineDB?.getHorario) {
            const cachedHorario = await window.electronAPI.offlineDB.getHorario(empleadoId);
            if (cachedHorario && cachedHorario.configuracion) {
              horario = cachedHorario;
              console.log('[EmployeeInfo] Horario cargado desde cache local');
            }
          }
          if (!horario) {
            throw apiError;
          }
        }
        setHorarioData(horario);

      } catch (error) {
        console.error('Error cargando horario:', error.message);
        setErrorHorario(error.message);
        setHorarioData(null);
      } finally {
        setLoadingHorario(false);
      }
    };

    cargarHorario();
  }, [empleadoId, token]);

  // Actualizar tiempo cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Parsear horario y obtener información
  const horarioParsed = useMemo(() => {
    if (!horarioData) return null;
    return parsearHorario(horarioData);
  }, [horarioData]);

  const resumenSemanal = useMemo(() => {
    if (!horarioParsed) return { diasLaborales: 0, totalDias: 7, horasTotales: '0' };
    return calcularResumenSemanal(horarioParsed);
  }, [horarioParsed]);

  const infoHoy = useMemo(() => {
    if (!horarioParsed) return { trabaja: false, turnos: [] };
    return getInfoDiaActual(horarioParsed);
  }, [horarioParsed, currentTime]);

  const turnoRelevante = useMemo(() => {
    if (!infoHoy.trabaja || !infoHoy.turnos?.length) return null;
    return obtenerTurnoRelevante(infoHoy.turnos);
  }, [infoHoy, currentTime]);

  // Formatear fecha como en móvil
  const formatearFechaCompleta = () => {
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    const fecha = currentTime.toLocaleDateString('es-ES', opciones);
    return fecha.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Recargar horario
  const recargarHorario = async () => {
    if (!empleadoId) return;

    try {
      setLoadingHorario(true);
      setErrorHorario(null);
      let horario = null;
      try {
        horario = await getHorarioPorEmpleado(empleadoId, token);
      } catch (apiError) {
        if (window.electronAPI?.offlineDB?.getHorario) {
          const cachedHorario = await window.electronAPI.offlineDB.getHorario(empleadoId);
          if (cachedHorario && cachedHorario.configuracion) {
            horario = cachedHorario;
          }
        }
        if (!horario) throw apiError;
      }
      setHorarioData(horario);
    } catch (error) {
      setErrorHorario(error.message);
    } finally {
      setLoadingHorario(false);
    }
  };

  // Obtener configuración del badge según estado
  const getBadgeConfig = () => {
    if (loadingHorario) {
      return { text: 'CARGANDO', bgColor: 'bg-gray-500', dotColor: null };
    }
    if (errorHorario || !horarioParsed) {
      return { text: 'SIN HORARIO', bgColor: 'bg-gray-500', dotColor: null };
    }
    if (!infoHoy.trabaja) {
      return { text: 'DESCANSO', bgColor: 'bg-purple-500', dotColor: null };
    }
    if (!turnoRelevante || turnoRelevante.estado === 'finalizado') {
      return { text: 'FINALIZADO', bgColor: 'bg-gray-500', dotColor: null };
    }
    if (turnoRelevante.estado === 'activo') {
      return { text: 'ACTIVO', bgColor: 'bg-red-500', dotColor: 'bg-white animate-pulse' };
    }
    if (turnoRelevante.estado === 'proximo') {
      return { text: 'SIGUIENTE', bgColor: 'bg-blue-500', dotColor: null };
    }
    return { text: 'SIN HORARIO', bgColor: 'bg-gray-500', dotColor: null };
  };

  const badgeConfig = getBadgeConfig();

  // Loading state
  if (loadingHorario) {
    return (
      <>
        <div className="bg-bg-primary rounded-2xl shadow-lg p-4 flex-shrink-0">
          <div className="flex items-center justify-center py-8">
            <DynamicLoader text="Cargando horario..." size="medium" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 flex-shrink-0">
          <div className="bg-gray-300 dark:bg-gray-700 rounded-2xl p-4 animate-pulse h-32"></div>
          <div className="bg-gray-300 dark:bg-gray-700 rounded-2xl p-4 animate-pulse h-32"></div>
        </div>
        <div className="bg-bg-primary rounded-2xl shadow-lg p-4 flex-1 min-h-0">
          <div className="h-full flex items-center justify-center">
            <div className="w-full h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Tarjeta Principal - Estilo Móvil */}
      <div className="bg-bg-secondary rounded-2xl shadow-lg p-4 flex-1 border border-border-subtle flex flex-col">

        {/* Header con Badge y Fecha */}
        <div className="flex items-start justify-between mb-4">
          <div>
            {/* Badge de estado */}

            {/* Fecha */}
            <h2 className="text-xl font-bold text-text-primary">
              {formatearFechaCompleta()}
            </h2>
          </div>

          {/* Hora actual y botón refresh */}
          <div className="text-right flex items-start gap-2">
            <p className="text-2xl font-bold text-text-primary tabular-nums">
              {formatTime(time).replace(/\s/g, "\u00A0")}
            </p>
            <button
              onClick={recargarHorario}
              className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
              title="Recargar horario"
            >
              <RefreshCw className={`w-4 h-4 text-text-tertiary ${loadingHorario ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error state */}
        {errorHorario && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{errorHorario}</span>
            </div>
            <button
              onClick={recargarHorario}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Contenido según estado */}
        {!errorHorario && horarioParsed && infoHoy.trabaja && turnoRelevante && turnoRelevante.estado !== 'finalizado' ? (
          <>
            {/* Turno Relevante */}
            <div className="bg-bg-secondary rounded-xl p-4 mb-3 border border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E3F2FD] dark:bg-[#1565C0]/40 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#1976D2] dark:text-[#42A5F5]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-secondary font-medium mb-0.5">
                    {turnoRelevante.estado === 'activo' ? 'En turno' : 'Próximo turno'}
                  </p>
                  <p className="text-2xl font-bold text-text-primary">
                    {turnoRelevante.entrada} - {turnoRelevante.salida}
                  </p>
                </div>
              </div>
            </div>

            {/* Botón ver todos los turnos */}
            {infoHoy.turnos.length > 1 && (
              <button
                onClick={() => setShowAllTurnos(!showAllTurnos)}
                className="w-full flex items-center justify-center gap-2 bg-bg-secondary hover:bg-bg-tertiary rounded-xl p-3 mb-3 border border-border-subtle transition-colors"
              >
                <Layers className="w-4 h-4 text-[#1976D2]" />
                <span className="text-sm font-semibold text-[#1976D2] dark:text-[#42A5F5]">
                  {infoHoy.turnos.length} turnos hoy - {showAllTurnos ? 'Ocultar' : 'Ver todos'}
                </span>
                <ChevronRight className={`w-4 h-4 text-[#1976D2] transition-transform ${showAllTurnos ? 'rotate-90' : ''}`} />
              </button>
            )}

            {/* Lista expandible de turnos */}
            {showAllTurnos && (
              <div className="space-y-2 mb-3 animate-in slide-in-from-top-2 duration-200">
                {infoHoy.turnos.map((turno, index) => {
                  const esActivo = turnoRelevante &&
                    turnoRelevante.entrada === turno.entrada &&
                    turnoRelevante.salida === turno.salida &&
                    turnoRelevante.estado === 'activo';

                  const esProximo = turnoRelevante &&
                    turnoRelevante.entrada === turno.entrada &&
                    turnoRelevante.salida === turno.salida &&
                    turnoRelevante.estado === 'proximo';

                  return (
                    <div
                      key={index}
                      className={`rounded-xl p-3 ${esActivo
                        ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                        : esProximo
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 border-dashed'
                          : 'bg-bg-tertiary border border-border-subtle'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${esActivo
                            ? 'bg-green-500 text-white'
                            : esProximo
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-text-secondary'
                            }`}>
                            T{index + 1}
                          </span>
                          <span className="text-sm font-semibold text-text-primary">
                            {turno.entrada} - {turno.salida}
                          </span>
                        </div>
                        {esActivo && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium animate-pulse">
                            En curso
                          </span>
                        )}
                        {esProximo && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            Próximo
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </>
        ) : !errorHorario && horarioParsed && infoHoy.trabaja && turnoRelevante?.estado === 'finalizado' ? (
          /* Jornada Finalizada */
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-subtle text-center flex flex-col items-center justify-center flex-1">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E3F2FD] dark:bg-[#1565C0]/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#1976D2]" />
            </div>
            <p className="text-text-primary font-semibold">Jornada Completada</p>
            <p className="text-xs text-text-secondary mt-1">
              Todos los turnos de hoy han finalizado
            </p>
          </div>
        ) : !errorHorario && horarioParsed && !infoHoy.trabaja ? (
          /* Día de Descanso */
          <div className="bg-bg-secondary rounded-xl p-4 border border-border-subtle text-center flex flex-col items-center justify-center flex-1">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E3F2FD] dark:bg-[#1565C0]/30 flex items-center justify-center">
              <Coffee className="w-6 h-6 text-[#1976D2]" />
            </div>
            <p className="text-text-primary font-semibold">Día de Descanso</p>
            <p className="text-xs text-text-secondary mt-1">Disfruta tu día libre</p>
          </div>
        ) : !errorHorario && !horarioParsed ? (
          /* Sin horario asignado */
          <div className="bg-bg-secondary rounded-xl p-6 border border-border-subtle text-center flex flex-col items-center justify-center flex-1">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#E3F2FD] dark:bg-[#1565C0]/20 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-[#1976D2]" />
            </div>
            <p className="text-lg font-bold text-text-primary mb-1">Sin Horario Asignado</p>
            <p className="text-sm text-text-secondary">Contacta a tu supervisor para asignar tu horario</p>
          </div>
        ) : null}
      </div>



    </>
  );
}
