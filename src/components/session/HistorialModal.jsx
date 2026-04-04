import React, { useState, useEffect, useCallback } from "react";
import { X, Calendar, Clock, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, RefreshCw, CalendarDays, WifiOff } from "lucide-react";
import { API_CONFIG, fetchApi } from "../../config/apiEndPoint";
import EquivalenciasPanel from "./EquivalenciasPanel";
import DynamicLoader from "../common/DynamicLoader";

export default function HistorialModal({ onClose, usuario }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // Default to today to show "by day" immediately
  const [asistencias, setAsistencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [estadisticas, setEstadisticas] = useState({
    puntuales: 0,
    retardos_a: 0,
    retardos_b: 0,
    faltas: 0
  });

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  /**
   * Carga asistencias desde la BD local (offline)
   */
  const cargarAsistenciasOffline = useCallback(async () => {
    try {
      if (!window.electronAPI?.offlineDB?.getRegistrosRango) return [];

      const primerDia = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const ultimoDia = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const fechaInicio = primerDia.toISOString().split('T')[0];
      const fechaFin = ultimoDia.toISOString().split('T')[0];

      const registros = await window.electronAPI.offlineDB.getRegistrosRango(
        usuario.empleado_id,
        fechaInicio,
        fechaFin
      );

      return Array.isArray(registros) ? registros : [];
    } catch (error) {
      console.error('[Historial] Error cargando datos offline:', error);
      return [];
    }
  }, [usuario, currentMonth]);

  const cargarAsistencias = useCallback(async () => {
    if (!usuario?.empleado_id) {
      setLoading(false);
      return;
    }

    try {
      const primerDia = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const ultimoDia = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const fechaInicio = primerDia.toISOString().split('T')[0];
      const fechaFin = ultimoDia.toISOString().split('T')[0];

      const url = `${API_CONFIG.ENDPOINTS.ASISTENCIAS}/empleado/${usuario.empleado_id}?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
      const response = await fetchApi(url);

      let data = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);

      const asistenciasOrdenadas = data.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
      setAsistencias(asistenciasOrdenadas);
      calcularEstadisticas(asistenciasOrdenadas);
      setIsOfflineData(false);
    } catch (error) {
      console.error('[Historial] Error cargando asistencias online, intentando offline:', error);
      // Fallback: cargar desde la BD local
      const offlineData = await cargarAsistenciasOffline();
      const asistenciasOrdenadas = offlineData.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
      setAsistencias(asistenciasOrdenadas);
      calcularEstadisticas(asistenciasOrdenadas);
      setIsOfflineData(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [usuario, currentMonth, cargarAsistenciasOffline]);

  const calcularEstadisticas = (data) => {
    const stats = { puntuales: 0, retardos_a: 0, retardos_b: 0, faltas: 0 };
    data.forEach(registro => {
      if (registro.tipo === 'entrada' || registro.tipo === 'sistema') {
        if (registro.estado === 'puntual') stats.puntuales++;
        if (registro.estado === 'retardo_a') stats.retardos_a++;
        if (registro.estado === 'retardo_b') stats.retardos_b++;
        if (registro.estado === 'falta' || registro.estado === 'falta_por_retardo') stats.faltas++;
      }
    });
    setEstadisticas(stats);
  };

  useEffect(() => {
    cargarAsistencias();
  }, [cargarAsistencias]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarAsistencias();
  };

  const cambiarMes = (direccion) => {
    const nuevoMes = new Date(currentMonth);
    nuevoMes.setMonth(currentMonth.getMonth() + direccion);
    setCurrentMonth(nuevoMes);
    setSelectedDate(null);
    setLoading(true);
  };

  const generarDiasCalendario = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const primerDiaSemana = new Date(year, month, 1).getDay();
    const diasEnMes = new Date(year, month + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primerDiaSemana; i++) dias.push(null);
    for (let dia = 1; dia <= diasEnMes; dia++) dias.push(dia);
    return dias;
  };

  const getEstadoDia = (dia) => {
    if (!dia) return null;
    const fecha = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dia);
    const registrosDia = asistencias.filter(registro => {
      const registroFecha = new Date(registro.fecha_registro);
      return registroFecha.toDateString() === fecha.toDateString() && (registro.tipo === 'entrada' || registro.tipo === 'sistema');
    });
    if (registrosDia.length === 0) return null;
    if (registrosDia.some(r => r.estado === 'falta' || r.estado === 'falta_por_retardo')) return 'falta';
    if (registrosDia.some(r => r.estado === 'retardo_b')) return 'retardo_b';
    if (registrosDia.some(r => r.estado === 'retardo_a')) return 'retardo_a';
    return 'puntual';
  };

  const seleccionarDia = (dia) => {
    if (!dia) return;
    const fecha = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dia);
    if (fecha > hoy) return; // No se puede seleccionar el futuro
    setSelectedDate(selectedDate?.toDateString() === fecha.toDateString() ? null : fecha);
  };

  const registrosFiltrados = selectedDate
    ? asistencias.filter(r => new Date(r.fecha_registro).toDateString() === selectedDate.toDateString())
    : []; // No longer showing all as "recent activity"

  const formatearFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    return `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const formatearHora = (fechaStr) => {
    return new Date(fechaStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const obtenerColorEstado = (estado) => {
    switch (estado) {
      case 'puntual': return { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800', dot: 'bg-emerald-500' };
      case 'retardo_a': return { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-800', dot: 'bg-amber-500' };
      case 'retardo_b': return { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-100 dark:border-orange-800', dot: 'bg-orange-500' };
      case 'falta_por_retardo':
      case 'falta': return { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-100 dark:border-red-800', dot: 'bg-red-500' };
      default: return { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-100 dark:border-slate-700', dot: 'bg-slate-400' };
    }
  };

  const hoy = new Date();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-bg-primary px-5 py-4 flex items-center justify-between shrink-0 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-[#1976D2]" />
            <div>
              <h3 className="text-2xl font-bold text-text-primary">Historial de Asistencia</h3>
              <p className="text-text-secondary text-sm mt-1">Registro de entradas y salidas</p>
              {isOfflineData && (
                <div className="flex items-center gap-1 mt-1">
                  <WifiOff className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-500 uppercase">Modo Offline — Solo registros locales</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onRefresh} className="text-text-secondary hover:bg-bg-secondary rounded-lg p-2 transition-all">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-text-secondary hover:bg-bg-secondary rounded-lg p-2 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800 py-20">
            <DynamicLoader text="Cargando historial..." size="medium" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

            {/* Panel Izquierdo: Calendario y Stats */}
            <div className="w-full md:w-[350px] border-r border-slate-100 dark:border-slate-700 p-5 flex flex-col gap-5 bg-white dark:bg-slate-900">

              {/* Navegación Mes */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                <button onClick={() => cambiarMes(-1)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md shadow-sm text-slate-500 dark:text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-tighter">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button
                  onClick={() => cambiarMes(1)}
                  disabled={currentMonth.getMonth() >= hoy.getMonth() && currentMonth.getFullYear() >= hoy.getFullYear()}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md shadow-sm text-slate-500 dark:text-slate-400 disabled:opacity-20"
                ><ChevronRight className="w-4 h-4" /></button>
              </div>

              {/* Grid Calendario */}
              <div className="grid grid-cols-7 gap-1">
                {dayNames.map(d => <div key={d} className="text-center text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase py-1">{d}</div>)}
                {generarDiasCalendario().map((dia, i) => {
                  const estado = getEstadoDia(dia);
                  const isSelected = selectedDate?.getDate() === dia && currentMonth.getMonth() === selectedDate.getMonth();
                  const isToday = dia && hoy.toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dia).toDateString();

                  return (
                    <button
                      key={i}
                      onClick={() => seleccionarDia(dia)}
                      disabled={!dia || (new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dia) > hoy)}
                      className={`relative aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all
                        ${!dia ? 'bg-transparent' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                        ${isSelected ? 'bg-[#1976D2] dark:bg-slate-200 text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 dark:text-slate-400'}
                        ${isToday && !isSelected ? 'border-2 border-[#1976D2] dark:border-slate-200' : ''}
                        ${dia && new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dia) > hoy ? 'opacity-20 cursor-not-allowed' : ''}
                      `}
                    >
                      {dia}
                      {estado && !isSelected && <div className={`absolute bottom-1 w-1 h-1 rounded-full ${obtenerColorEstado(estado).dot}`} />}
                    </button>
                  );
                })}
              </div>

              {/* EquivalenciasPanel Widget */}
              <EquivalenciasPanel
                empleadoId={usuario.empleado_id}
                mesSeleccionado={currentMonth}
              />
            </div>

            {/* Panel Derecho: Lista */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-widest">
                  {selectedDate ? `REGISTROS DEL DÍA ${selectedDate.getDate()}` : 'Seleccione un día'}
                </h4>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase">
                  {registrosFiltrados.length} Registros
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-2">
                {registrosFiltrados.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 py-10 text-center">
                    <Clock className="w-10 h-10 mb-2 opacity-10" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      {selectedDate ? 'Sin actividad en este día' : 'Selecciona un día en el calendario'}
                    </p>
                  </div>
                ) : (
                  registrosFiltrados.map((registro, idx) => {
                    const color = obtenerColorEstado(registro.estado);
                    return (
                      <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${registro.tipo === 'entrada' ? 'bg-[#1976D2] dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          {registro.tipo === 'entrada' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {registro.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            <span className="font-bold text-slate-600 dark:text-slate-300 italic">{formatearHora(registro.fecha_registro)}</span>
                            <span>•</span>
                            <span>{formatearFecha(registro.fecha_registro)}</span>
                          </div>
                        </div>
                        {registro.tipo === 'entrada' && (
                          <div className={`${color.bg} ${color.text} text-[9px] font-black px-2 py-0.5 rounded border ${color.border} uppercase`}>
                            {registro.estado}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}