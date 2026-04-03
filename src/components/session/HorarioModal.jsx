import { useState, useEffect, useMemo } from "react";
import { X, Clock, Calendar, Sun, Coffee, Timer, CheckCircle2 } from "lucide-react";
import {
  getHorarioPorEmpleado,
  parsearHorario,
  calcularResumenSemanal
} from "../../services/horariosService";
import { obtenerTolerancia } from "../../services/asistenciaLogicService";
import DynamicLoader from "../common/DynamicLoader";

export default function HorarioModal({ onClose, usuario }) {
  const [horarioRaw, setHorarioRaw] = useState(null);
  const [tolerancia, setTolerancia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const diasSemana = [
    { key: "Lunes", abrev: "LUN" },
    { key: "Martes", abrev: "MAR" },
    { key: "Miércoles", abrev: "MIÉ" },
    { key: "Jueves", abrev: "JUE" },
    { key: "Viernes", abrev: "VIE" },
    { key: "Sábado", abrev: "SÁB" },
    { key: "Domingo", abrev: "DOM" },
  ];

  const hoy = new Date().getDay();
  const diaActualIndex = hoy === 0 ? 6 : hoy - 1;
  const empleadoId = usuario?.empleado_id || usuario?.id || usuario?.empleadoInfo?.id;
  const token = localStorage.getItem('auth_token');

  useEffect(() => {
    const cargarHorario = async () => {
      if (!empleadoId) {
        setLoading(false);
        setError('No se encontró ID del empleado');
        return;
      }
      try {
        setLoading(true);
        setError(null);

        let horario = null;

        // Intentar cargar del servidor
        try {
          horario = await getHorarioPorEmpleado(empleadoId, token);
        } catch (apiError) {
          console.warn('[HorarioModal] API no disponible, intentando cache local:', apiError.message);

          // Fallback: cargar desde la BD local (offline)
          if (window.electronAPI?.offlineDB?.getHorario) {
            const cachedHorario = await window.electronAPI.offlineDB.getHorario(empleadoId);
            if (cachedHorario && cachedHorario.configuracion) {
              horario = cachedHorario;
              console.log('[HorarioModal] Horario cargado desde cache local');
            }
          }

          if (!horario) {
            throw new Error('Sin conexión — No se pudo cargar el horario');
          }
        }

        setHorarioRaw(horario);

        // Cargar tolerancia según el rol del usuario
        const posiblesIds = [
          usuario?.token,
          usuario?.usuario_id,
          usuario?.id,
          usuario?.usuarioInfo?.id
        ];
        const usuarioIdReal = posiblesIds.find(id => id && typeof id === 'string' && id.startsWith('USU'));

        if (usuarioIdReal) {
          try {
            const tolOnline = await obtenerTolerancia(usuarioIdReal);
            setTolerancia(tolOnline);
          } catch (tolError) {
            console.warn('[HorarioModal] Error general cargando tolerancia:', tolError);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    cargarHorario();
  }, [empleadoId, token, usuario]);

  const horarioParsed = useMemo(() => horarioRaw ? parsearHorario(horarioRaw) : null, [horarioRaw]);
  const resumen = useMemo(() => horarioParsed ? calcularResumenSemanal(horarioParsed) : { diasLaborales: 0, horasTotales: '0' }, [horarioParsed]);
  const getDiaInfo = (nombreDia) => horarioParsed?.find(d => d.day === nombreDia);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4 font-sans">
      <div className="bg-bg-primary rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden">

        {/* Header */}
        <div className="bg-bg-primary px-5 py-4 flex items-center justify-between shrink-0 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#1976D2]" />
            <div>
              <h3 className="text-2xl font-bold text-text-primary">Mi Horario Semanal</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-text-secondary flex items-center gap-1">
                  <Timer className="w-3 h-3 text-[#1976D2]" /> {resumen.horasTotales} Horas Totales
                </span>
                <span className="text-sm text-text-secondary flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#1976D2]" /> {resumen.diasLaborales} Días Laborales
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:bg-bg-secondary rounded-lg p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 bg-bg-primary">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <DynamicLoader text="Cargando horario..." size="medium" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {diasSemana.map((dia, index) => {
                const diaInfo = getDiaInfo(dia.key);
                const activo = diaInfo?.active || false;
                const esHoy = index === diaActualIndex;
                const turnos = diaInfo?.turnos || [];

                return (
                  <div
                    key={dia.key}
                    className={`relative rounded-lg p-3 flex flex-col min-h-[160px] md:min-h-[220px] transition-all border
                      ${esHoy ? 'bg-white dark:bg-slate-800 border-[#1976D2] shadow-md ring-1 ring-[#1976D2]/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                      ${!activo && !esHoy ? 'bg-slate-50 dark:bg-slate-800/50 opacity-80' : ''}
                    `}
                  >
                    {/* Indicador HOY */}
                    {esHoy && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#1976D2] text-[9px] font-black text-white px-2 py-0.5 rounded shadow-sm flex items-center gap-1 uppercase tracking-tighter">
                        Hoy
                      </div>
                    )}

                    {/* Día Header */}
                    <div className="text-center border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">
                      <p className={`text-sm font-bold ${esHoy ? 'text-[#1976D2] dark:text-[#42A5F5]' : 'text-slate-700 dark:text-slate-300'}`}>
                        {dia.key}
                      </p>
                    </div>

                    {/* Turnos */}
                    <div className="flex-1 space-y-2">
                      {activo ? (
                        <>
                          <div className="space-y-1.5">
                            {turnos.map((turno, idx) => (
                              <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-md p-1.5 text-center group">
                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter leading-none mb-1">
                                  {turnos.length > 1 ? `T${idx + 1}` : 'Turno'}
                                </p>
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">{turno.entrada}</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">-</span>
                                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">{turno.salida}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Horas Totales Día */}
                          <div className="mt-auto pt-2 flex items-center justify-center gap-1 border-t border-slate-50 dark:border-slate-700">
                            <Clock className="w-3 h-3 text-[#1976D2] dark:text-[#42A5F5] opacity-70" />
                            <span className="text-[10px] font-black text-[#1976D2] dark:text-[#42A5F5]">{diaInfo?.hours}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                          <Coffee className="w-5 h-5 text-slate-400 dark:text-slate-500 mb-1" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 text-center leading-tight">
                            Libre
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reglas de Tiempo */}
          {tolerancia && !loading && !error && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                Reglas de Tiempo
              </h4>

              {/* Valores numéricos */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-black text-slate-900 dark:text-white">{tolerancia.minutos_retardo || 10}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Min. Retardo</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-black text-slate-900 dark:text-white">{tolerancia.minutos_falta || 30}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Min. Falta</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-black text-slate-900 dark:text-white">{tolerancia.minutos_anticipado_max || 60}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Min. Anticipado</p>
                </div>
              </div>

              {/* Comportamientos (checkmarks) */}
              <div className="flex flex-wrap gap-3 text-[10px]">
                {tolerancia.permite_registro_anticipado && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Registro anticipado
                  </span>
                )}
                {tolerancia.aplica_tolerancia_entrada && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Tolerancia entrada
                  </span>
                )}
                {tolerancia.aplica_tolerancia_salida && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Tolerancia salida
                  </span>
                )}
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}