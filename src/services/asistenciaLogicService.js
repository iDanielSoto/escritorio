/**
 * Servicio de lógica de asistencia compartido
 * Utilizado por PinModal y AsistenciaHuella para calcular el estado de registro
 * Siguiendo la lógica de la app móvil
 */
import { API_CONFIG, fetchApi } from "../config/apiEndPoint";

// Constantes
const MINUTOS_SEPARACION_TURNOS = 15;

// === CONTROL DE DUPLICADOS ===
let lastRequestTimestamp = 0;
let lastRequestEmpleadoId = null;
const MIN_REQUEST_INTERVAL_MS = 5000; // 5 segundos entre registros del mismo empleado

// === FUNCIONES DE UTILIDAD PARA HORARIOS ===

/**
 * Obtiene el día de la semana actual en español (sin acentos)
 */
export const getDiaSemana = () => {
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return dias[new Date().getDay()];
};

/**
 * Obtiene los minutos transcurridos del día
 */
export const getMinutosDelDia = (fecha = new Date()) => {
  return fecha.getHours() * 60 + fecha.getMinutes();
};

/**
 * Convierte hora en formato "HH:MM" a minutos del día
 */
export const horaAMinutos = (hora) => {
  if (!hora || typeof hora !== 'string') return 0;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Agrupa turnos concatenados del horario.
 * Si la diferencia entre salida de un turno y entrada del siguiente es <= 15 min,
 * se consideran parte del mismo grupo (turno continuo).
 * @param {Array} turnos - Array de objetos {entrada: "HH:MM", salida: "HH:MM"}
 * @returns {Array} - Array de grupos, donde cada grupo es un array de turnos
 */
export const agruparTurnosConcatenados = (turnos) => {
  if (!turnos || !Array.isArray(turnos) || turnos.length === 0) return [];
  if (turnos.length === 1) return [[turnos[0]]];

  // Ordenar turnos por hora de entrada
  const turnosOrdenados = [...turnos].sort((a, b) => {
    return horaAMinutos(a.entrada) - horaAMinutos(b.entrada);
  });

  const grupos = [];
  let grupoActual = [turnosOrdenados[0]];

  for (let i = 1; i < turnosOrdenados.length; i++) {
    const turnoAnterior = grupoActual[grupoActual.length - 1];
    const turnoActual = turnosOrdenados[i];

    if (!turnoAnterior?.salida || !turnoActual?.entrada) {
      continue;
    }

    const minutosSalida = horaAMinutos(turnoAnterior.salida);
    const minutosEntrada = horaAMinutos(turnoActual.entrada);
    const diferencia = minutosEntrada - minutosSalida;

    // Si la diferencia es <= 15 min, se considera el mismo grupo (turno continuo)
    if (diferencia <= MINUTOS_SEPARACION_TURNOS) {
      grupoActual.push(turnoActual);
    } else {
      grupos.push(grupoActual);
      grupoActual = [turnoActual];
    }
  }

  grupos.push(grupoActual);
  return grupos;
};

/**
 * Obtiene la hora de entrada y salida de un grupo de turnos.
 * Entrada: hora de entrada del primer turno del grupo
 * Salida: hora de salida del último turno del grupo
 * @param {Array} grupo - Array de turnos que forman un grupo
 * @returns {Object} - {entrada: "HH:MM", salida: "HH:MM"}
 */
export const getEntradaSalidaGrupo = (grupo) => {
  if (!grupo || !Array.isArray(grupo) || grupo.length === 0) {
    return { entrada: '00:00', salida: '23:59' };
  }
  return {
    entrada: grupo[0]?.entrada || '00:00',
    salida: grupo[grupo.length - 1]?.salida || '23:59'
  };
};

// === FUNCIONES DE OBTENCIÓN DE DATOS ===

/**
 * Obtiene el último registro de asistencia del día para un empleado
 */
export const obtenerUltimoRegistro = async (empleadoId) => {
  try {
    if (!empleadoId) return null;

    const response = await fetchApi(`${API_CONFIG.ENDPOINTS.ASISTENCIAS}/empleado/${empleadoId}`);

    if (!response.data?.length) return null;

    const hoy = new Date().toDateString();
    const registrosHoy = response.data.filter(registro => {
      const fechaRegistro = new Date(registro.fecha_registro);
      return fechaRegistro.toDateString() === hoy;
    });

    if (!registrosHoy.length) return null;

    // Ordenar registros por fecha descendente para obtener el más reciente
    const registrosOrdenados = registrosHoy.sort((a, b) => {
      return new Date(b.fecha_registro) - new Date(a.fecha_registro);
    });

    const ultimo = registrosOrdenados[0];

    console.log('[AsistenciaLogic] Registros de hoy:', registrosOrdenados.length);
    console.log('[AsistenciaLogic] Último registro:', ultimo.tipo, '-', new Date(ultimo.fecha_registro).toLocaleTimeString());

    return {
      tipo: ultimo.tipo,
      estado: ultimo.estado,
      fecha_registro: new Date(ultimo.fecha_registro),
      hora: new Date(ultimo.fecha_registro).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      totalRegistrosHoy: registrosOrdenados.length
    };
  } catch (err) {
    console.error('[AsistenciaLogic] Error obteniendo último registro:', err);
    return null;
  }
};

/**
 * Obtiene el horario del empleado y fusiona bloques consecutivos.
 */
export const obtenerHorario = async (empleadoId) => {
  try {
    if (!empleadoId) return null;

    const response = await fetchApi(`${API_CONFIG.ENDPOINTS.EMPLEADOS}/${empleadoId}/horario`);
    const horario = response.data || response.horario || response;

    if (!horario?.configuracion) return null;

    let config = typeof horario.configuracion === 'string'
      ? JSON.parse(horario.configuracion)
      : horario.configuracion;

    const diaHoy = getDiaSemana();
    let turnosHoy = [];

    if (config.configuracion_semanal?.[diaHoy]) {
      turnosHoy = config.configuracion_semanal[diaHoy].map(t => ({
        entrada: t.inicio,
        salida: t.fin
      }));
    } else if (config.dias?.includes(diaHoy)) {
      turnosHoy = config.turnos || [];
    }

    if (!turnosHoy || !Array.isArray(turnosHoy) || turnosHoy.length === 0) {
      return { trabaja: false, turnos: [], gruposTurnos: [], turnosOriginales: [] };
    }

    // Guardar turnos originales antes de agrupar
    const turnosOriginales = [...turnosHoy];

    // Agrupar turnos concatenados (diferencia <= 15 min = mismo grupo)
    const gruposTurnos = agruparTurnosConcatenados(turnosHoy);

    console.log('[AsistenciaLogic] Turnos originales:', turnosOriginales);
    console.log('[AsistenciaLogic] Grupos de turnos:', gruposTurnos);

    // Obtener entrada del primer grupo y salida del último grupo
    const primerGrupo = gruposTurnos[0];
    const ultimoGrupo = gruposTurnos[gruposTurnos.length - 1];
    const entradaGeneral = getEntradaSalidaGrupo(primerGrupo).entrada;
    const salidaGeneral = getEntradaSalidaGrupo(ultimoGrupo).salida;

    return {
      trabaja: true,
      turnos: turnosOriginales,
      gruposTurnos: gruposTurnos,
      turnosOriginales: turnosOriginales,
      entrada: entradaGeneral,
      salida: salidaGeneral,
      tipo: gruposTurnos.length > 1 ? 'quebrado' : 'continuo'
    };
  } catch (err) {
    console.error('[AsistenciaLogic] Error obteniendo horario:', err);
    return null;
  }
};

/**
 * Obtiene la tolerancia aplicable al empleado basándose en el rol con mayor jerarquía.
 * El rol con MENOR número tiene MAYOR jerarquía.
 */
export const obtenerTolerancia = async (usuarioId) => {
  const defaultTolerancia = {
    minutos_retardo: 10,
    minutos_falta: 30,
    permite_registro_anticipado: true,
    minutos_anticipado_max: 60,
    aplica_tolerancia_entrada: true,
    aplica_tolerancia_salida: true,
    minutos_anticipado_salida: 10
  };

  try {
    if (!usuarioId) return defaultTolerancia;

    // 1. Obtener todos los roles del usuario (incluye tolerancia_id y posicion)
    const rolesResponse = await fetchApi(`${API_CONFIG.ENDPOINTS.USUARIOS}/${usuarioId}/roles`);
    const roles = rolesResponse.data || rolesResponse || [];

    if (!roles.length) {
      console.log('[AsistenciaLogic] Usuario sin roles asignados, usando tolerancia por defecto');
      return defaultTolerancia;
    }

    // 2. Identificar el rol con menor posición (mayor jerarquía)
    const rolMayorJerarquia = roles.reduce((mayor, actual) => {
      const posActual = actual.posicion ?? 999;
      const posMayor = mayor.posicion ?? 999;
      return posActual < posMayor ? actual : mayor;
    });

    if (!rolMayorJerarquia) {
      console.log('[AsistenciaLogic] No se pudo determinar rol con mayor jerarquía');
      return defaultTolerancia;
    }

    console.log('[AsistenciaLogic] Rol con mayor jerarquía:', rolMayorJerarquia.rol_id, 'posicion:', rolMayorJerarquia.posicion);

    // 3. Obtener tolerancia usando tolerancia_id del rol
    if (!rolMayorJerarquia.tolerancia_id) {
      console.log('[AsistenciaLogic] El rol no tiene tolerancia asignada');
      return defaultTolerancia;
    }

    const toleranciaResponse = await fetchApi(`${API_CONFIG.ENDPOINTS.TOLERANCIAS}/${rolMayorJerarquia.tolerancia_id}`);
    const toleranciaData = toleranciaResponse.data || toleranciaResponse;

    if (!toleranciaData || !toleranciaData.id) {
      console.log('[AsistenciaLogic] No se encontró tolerancia con id:', rolMayorJerarquia.tolerancia_id);
      return defaultTolerancia;
    }

    console.log('[AsistenciaLogic] Tolerancia encontrada:', toleranciaData.nombre || toleranciaData.id);

    // Asegurar que tenga los valores de salida
    return {
      ...defaultTolerancia,
      ...toleranciaData,
      minutos_anticipado_salida: toleranciaData.minutos_anticipado_salida || toleranciaData.minutos_retardo || 10
    };
  } catch (err) {
    console.error('[AsistenciaLogic] Error obteniendo tolerancia:', err);
    return defaultTolerancia;
  }

};

/**
 * Obtiene el departamento activo del empleado
 */
export const obtenerDepartamentoEmpleado = async (empleadoId) => {
  try {
    if (!empleadoId) return null;

    const response = await fetchApi(`${API_CONFIG.ENDPOINTS.EMPLEADOS}/${empleadoId}/departamentos`);
    const departamentos = response.data || response;

    if (!departamentos?.length) return null;

    const departamentoActivo = departamentos.find(d => d.es_activo === true || d.es_activo === 1);

    return departamentoActivo?.departamento_id || departamentos[0]?.departamento_id || null;
  } catch (err) {
    console.error('[AsistenciaLogic] Error obteniendo departamento del empleado:', err);
    return null;
  }
};

// === FUNCIONES DE VALIDACIÓN ===

/**
 * Verifica si un bloque de horario ya tiene entrada y salida registradas hoy
 * @param {Object} grupo - Grupo de turnos a verificar
 * @param {Array} registrosHoy - Lista de registros del día actual
 * @param {Object} tolerancia - Objeto de tolerancia para calcular márgenes
 * @returns {boolean} - true si el bloque ya está completado
 */
export const bloqueCompletado = (grupo, registrosHoy, tolerancia) => {
  if (!registrosHoy || registrosHoy.length === 0) return false;

  const { entrada: horaEntrada, salida: horaSalida } = getEntradaSalidaGrupo(grupo);
  const minEntrada = horaAMinutos(horaEntrada);
  const minSalida = horaAMinutos(horaSalida);

  // Márgenes para considerar registros dentro del bloque
  const margenAnticipado = tolerancia?.minutos_anticipado_max || 60;
  const margenRetardo = tolerancia?.minutos_falta || 30;

  const inicioBloque = minEntrada - margenAnticipado;
  const finBloque = minSalida + margenRetardo;

  // Filtrar registros que caen dentro de este bloque
  const registrosEnBloque = registrosHoy.filter(reg => {
    // Extraer hora del registro
    let horaReg;
    if (reg.fecha_registro) {
      const fecha = new Date(reg.fecha_registro);
      horaReg = fecha.getHours() * 60 + fecha.getMinutes();
    } else if (reg.hora) {
      horaReg = horaAMinutos(reg.hora);
    } else {
      return false;
    }
    return horaReg >= inicioBloque && horaReg <= finBloque;
  });

  const tieneEntrada = registrosEnBloque.some(r => r.tipo === 'entrada');
  const tieneSalida = registrosEnBloque.some(r => r.tipo === 'salida');

  console.log(`   [bloqueCompletado] Bloque ${horaEntrada}-${horaSalida}: entrada=${tieneEntrada}, salida=${tieneSalida}`);

  return tieneEntrada && tieneSalida;
};

/**
 * Valida si el empleado puede registrar entrada y determina la clasificación:
 * - 'entrada': Llegada dentro de la tolerancia permitida (puntual)
 * - 'retardo': Llegada después del tiempo de retardo pero antes de falta
 * - 'falta': Llegada después del tiempo de falta pero antes del fin de turno
 */
export const validarEntrada = (horario, tolerancia, minutosActuales, grupoInicio = 0, registrosHoy = []) => {
  if (!horario?.gruposTurnos || !Array.isArray(horario.gruposTurnos) || horario.gruposTurnos.length === 0) {
    return {
      puedeRegistrar: false,
      tipoRegistro: 'entrada',
      clasificacion: null,
      estadoHorario: 'fuera_horario',
      jornadaCompleta: false,
      hayTurnoFuturo: false,
      mensaje: 'No hay turnos configurados'
    };
  }

  let hayTurnoFuturo = false;
  const gruposAValidar = horario.gruposTurnos.slice(grupoInicio);

  console.log('[AsistenciaLogic] Validando entrada desde grupo:', grupoInicio, 'de', horario.gruposTurnos.length);

  for (const grupo of gruposAValidar) {
    const { entrada: horaEntrada, salida: horaSalida } = getEntradaSalidaGrupo(grupo);

    const minEntrada = horaAMinutos(horaEntrada);
    const minSalida = horaAMinutos(horaSalida);

    // Verificar si este bloque ya está completado (entrada + salida registradas)
    if (bloqueCompletado(grupo, registrosHoy, tolerancia)) {
      console.log('   ⏭️ Bloque ya completado, saltando...');
      continue;
    }

    // Ventanas de tiempo basadas en tolerancia y COMPORTAMIENTOS
    const minutosAnticipado = tolerancia.minutos_anticipado_max || 60;
    const ventanaInicio = minEntrada - minutosAnticipado;

    // Lógica dinámica de Post-its:
    // Puntual: <= 10 minutos (tolerancia general asumida)
    const margenPuntual = minEntrada + 10;
    const margenRetardoA = minEntrada + 20; // Hasta 20 min
    const margenRetardoB = minEntrada + 29; // Hasta 29 min

    console.log('   Grupo:', horaEntrada, '-', horaSalida);
    console.log('   Ventanas: inicio=', ventanaInicio, 'puntual=', margenPuntual,
      'retardoA=', margenRetardoA, 'retardoB=', margenRetardoB, 'salida=', minSalida);
    console.log('   Hora actual:', minutosActuales);

    // Si ya pasó la hora de salida de este turno, este grupo ya no es válido
    if (minutosActuales > minSalida) {
      console.log('   ⏭️ Turno ya terminó, saltando...');
      continue;
    }

    // Verificar si hay un grupo/turno futuro
    if (minutosActuales < ventanaInicio) {
      hayTurnoFuturo = true;
      console.log('   ⏳ Turno futuro detectado');
      continue;
    }

    // Validar registro anticipado si está antes de la hora de entrada y no está permitido
    if (tolerancia.permite_registro_anticipado === false && minutosActuales < minEntrada) {
      console.log('   ❌ Registro anticipado no permitido');
      return {
        puedeRegistrar: false,
        tipoRegistro: 'entrada',
        clasificacion: 'rechazado',
        estadoHorario: 'anticipado_no_permitido',
        jornadaCompleta: false,
        hayTurnoFuturo: false,
        mensaje: 'No se permite registro anticipado para tu rol',
        grupoActual: grupo
      };
    }

    // PUNTUAL: hasta +10 min
    if (minutosActuales >= ventanaInicio && minutosActuales <= margenPuntual) {
      console.log('   ✅ Entrada puntual');
      return {
        puedeRegistrar: true,
        tipoRegistro: 'entrada',
        clasificacion: 'puntual',
        estadoHorario: 'puntual',
        jornadaCompleta: false,
        hayTurnoFuturo: false,
        grupoActual: grupo
      };
    }

    // RETARDO A: 11 a 20 min
    if (minutosActuales > margenPuntual && minutosActuales <= margenRetardoA) {
      console.log('   ⚠️ Entrada con retardo tipo A');
      return {
        puedeRegistrar: true,
        tipoRegistro: 'entrada',
        clasificacion: 'retardo_a',
        estadoHorario: 'retardo_a',
        jornadaCompleta: false,
        hayTurnoFuturo: false,
        grupoActual: grupo
      };
    }

    // RETARDO B: 21 a 29 min
    if (minutosActuales > margenRetardoA && minutosActuales <= margenRetardoB) {
      console.log('   ⚠️ Entrada con retardo tipo B');
      return {
        puedeRegistrar: true,
        tipoRegistro: 'entrada',
        clasificacion: 'retardo_b',
        estadoHorario: 'retardo_b',
        jornadaCompleta: false,
        hayTurnoFuturo: false,
        grupoActual: grupo
      };
    }

    // FALTA POR RETARDO: 30 o más minutos pero antes de fin de turno
    if (minutosActuales > margenRetardoB && minutosActuales <= minSalida) {
      console.log('   ❌ Entrada como falta por retardo');
      return {
        puedeRegistrar: true,
        tipoRegistro: 'entrada',
        clasificacion: 'falta_por_retardo',
        estadoHorario: 'falta_por_retardo',
        jornadaCompleta: false,
        hayTurnoFuturo: false,
        grupoActual: grupo
      };
    }
  }

  return {
    puedeRegistrar: false,
    tipoRegistro: 'entrada',
    clasificacion: null,
    estadoHorario: 'fuera_horario',
    jornadaCompleta: false,
    hayTurnoFuturo: hayTurnoFuturo,
    mensaje: hayTurnoFuturo ? 'Aún no es hora de entrada' : 'Fuera de horario'
  };
};

/**
 * Valida si el empleado puede registrar salida y determina la clasificación:
 * - 'salida_puntual': Salida dentro de la ventana de salida permitida
 * - 'salida_temprana': Salida antes de la ventana (pero cumple tiempo mínimo)
 * - 'tiempo_insuficiente': No ha trabajado el tiempo mínimo requerido
 */
export const validarSalida = (horario, tolerancia, minutosActuales, ultimoRegistro = null) => {
  if (!horario?.gruposTurnos || !Array.isArray(horario.gruposTurnos) || horario.gruposTurnos.length === 0) {
    return {
      puedeRegistrar: false,
      tipoRegistro: 'salida',
      clasificacion: null,
      estadoHorario: 'fuera_horario',
      jornadaCompleta: false,
      mensaje: 'No hay turnos configurados'
    };
  }

  // Calcular el grupo actual basado en registros completados
  const totalRegistros = ultimoRegistro?.totalRegistrosHoy || 1;
  const gruposCompletados = Math.floor(totalRegistros / 2);

  const grupoActualIndex = gruposCompletados;
  const grupoActual = horario.gruposTurnos[grupoActualIndex] || horario.gruposTurnos[0];
  const { entrada: horaEntrada, salida: horaSalida } = getEntradaSalidaGrupo(grupoActual);

  const minEntrada = horaAMinutos(horaEntrada);
  const minSalida = horaAMinutos(horaSalida);
  const duracionTurno = minSalida - minEntrada;

  console.log('[AsistenciaLogic] Validando salida:');
  console.log('   - Grupo actual:', grupoActualIndex);
  console.log('   - Entrada grupo:', horaEntrada, '(', minEntrada, 'min)');
  console.log('   - Salida grupo:', horaSalida, '(', minSalida, 'min)');
  console.log('   - Hora actual:', minutosActuales, 'min');

  // NUEVA LÓGICA DE SALIDA:
  // - anticipacion: margen ANTES y DESPUÉS de hora salida para ser puntual
  // - retardo: margen adicional DESPUÉS de anticipacion para ser retardo
  // - muy tarde: después de retardo = FALTA

  const anticipacion = tolerancia.aplica_tolerancia_salida !== false
    ? (tolerancia.minutos_anticipado_max || 5)
    : 0; // Sin tolerancia = solo hora exacta

  const retardoSalida = tolerancia.minutos_retardo || 0;

  // Ventanas de clasificación de salida
  const ventanaPuntualInicio = minSalida - anticipacion;     // Ej: 17:55 si salida 18:00
  const ventanaPuntualFin = minSalida + anticipacion;        // Ej: 18:05
  const ventanaRetardoFin = ventanaPuntualFin + retardoSalida; // Ej: 18:08 con retardo=3

  console.log('   - Anticipación:', anticipacion, 'min, Retardo:', retardoSalida, 'min');
  console.log('   - Ventana PUNTUAL:', ventanaPuntualInicio, '-', ventanaPuntualFin);
  console.log('   - Ventana RETARDO:', ventanaPuntualFin, '-', ventanaRetardoFin);
  console.log('   - Hora actual:', minutosActuales);

  // TEMPRANA (muy antes): antes de la ventana puntual
  // Si aplica_tolerancia_salida = false y es antes de hora, rechazar
  if (minutosActuales < ventanaPuntualInicio) {
    console.log('   ⚠️ Salida muy temprana (antes de ventana)');
    return {
      puedeRegistrar: false,
      tipoRegistro: 'salida',
      clasificacion: null,
      estadoHorario: 'tiempo_insuficiente',
      jornadaCompleta: false,
      mensaje: 'Aún no puedes registrar salida',
      minutosRestantes: ventanaPuntualInicio - minutosActuales
    };
  }

  // PUNTUAL: dentro de la ventana ±anticipacion
  if (minutosActuales >= ventanaPuntualInicio && minutosActuales <= ventanaPuntualFin) {
    console.log('   ✅ Salida puntual');
    return {
      puedeRegistrar: true,
      tipoRegistro: 'salida',
      clasificacion: 'salida_puntual',
      estadoHorario: 'puntual',
      jornadaCompleta: false,
      grupoActual: grupoActual
    };
  }

  // RETARDO: después de anticipacion pero dentro de margen de retardo
  if (minutosActuales > ventanaPuntualFin && minutosActuales <= ventanaRetardoFin) {
    console.log('   ⚠️ Salida con retardo');
    return {
      puedeRegistrar: true,
      tipoRegistro: 'salida',
      clasificacion: 'salida_retardo',
      estadoHorario: 'retardo',
      jornadaCompleta: false,
      grupoActual: grupoActual
    };
  }

  // FALTA: muy tarde (después del margen de retardo)
  if (minutosActuales > ventanaRetardoFin) {
    console.log('   ❌ Salida como falta (muy tarde)');
    return {
      puedeRegistrar: true,
      tipoRegistro: 'salida',
      clasificacion: 'salida_falta',
      estadoHorario: 'falta',
      jornadaCompleta: false,
      grupoActual: grupoActual
    };
  }

  console.log('   ❌ Fuera de horario');
  return {
    puedeRegistrar: false,
    tipoRegistro: 'salida',
    clasificacion: null,
    estadoHorario: 'fuera_horario',
    jornadaCompleta: false
  };
};

/**
 * Calcula el estado actual del registro basándose en:
 * - Último registro del día (si existe)
 * - Horario con grupos de turnos concatenados
 * - Tolerancia según rol de mayor jerarquía
 */
export const calcularEstadoRegistro = (ultimo, horario, tolerancia, registrosHoy = []) => {
  if (!horario?.trabaja) {
    console.log('[AsistenciaLogic] No trabaja hoy');
    return {
      puedeRegistrar: false,
      tipoRegistro: 'entrada',
      clasificacion: null,
      estadoHorario: 'fuera_horario',
      jornadaCompleta: false,
      mensaje: 'No tienes horario configurado para hoy'
    };
  }

  if (!horario?.gruposTurnos || !Array.isArray(horario.gruposTurnos) || horario.gruposTurnos.length === 0) {
    console.log('[AsistenciaLogic] No hay grupos de turnos');
    return {
      puedeRegistrar: false,
      tipoRegistro: 'entrada',
      clasificacion: null,
      estadoHorario: 'fuera_horario',
      jornadaCompleta: false,
      mensaje: 'No hay turnos configurados'
    };
  }

  const ahora = getMinutosDelDia();
  const totalGrupos = horario.gruposTurnos.length;

  console.log('[AsistenciaLogic] Estado actual:');
  console.log('   - Hora actual (minutos):', ahora);
  console.log('   - Total grupos:', totalGrupos);
  console.log('   - Último registro:', ultimo ? `${ultimo.tipo} - ${ultimo.hora}` : 'ninguno');

  // Si no hay registro previo hoy, debe registrar entrada
  if (!ultimo) {
    console.log('[AsistenciaLogic] Sin registros hoy, validando entrada desde grupo 0');
    return validarEntrada(horario, tolerancia, ahora, 0, registrosHoy);
  }

  const conteoRegistros = ultimo.totalRegistrosHoy || 1;
  const gruposCompletados = Math.floor(conteoRegistros / 2);

  console.log('   - Registros hoy:', conteoRegistros);
  console.log('   - Grupos completados:', gruposCompletados);

  // Si última fue ENTRADA → debe registrar SALIDA
  if (ultimo.tipo === 'entrada') {
    console.log('[AsistenciaLogic] Último fue entrada, validando salida');
    return validarSalida(horario, tolerancia, ahora, ultimo);
  }

  // Si última fue SALIDA → debe registrar ENTRADA del siguiente grupo
  if (ultimo.tipo === 'salida') {
    console.log('[AsistenciaLogic] Último fue salida, verificando si hay más grupos');

    // Verificar si completó todos los grupos de turnos
    if (gruposCompletados >= totalGrupos) {
      console.log('[AsistenciaLogic] Todos los grupos completados (', gruposCompletados, '>=', totalGrupos, ')');

      const resultadoEntrada = validarEntrada(horario, tolerancia, ahora, 0, registrosHoy);

      // Si estamos dentro de alguna ventana de entrada válida, permitir
      if (resultadoEntrada.puedeRegistrar) {
        console.log('[AsistenciaLogic] Aún hay ventana de entrada disponible, permitiendo registro');
        return resultadoEntrada;
      }

      // Si no hay turno futuro y no puede registrar, jornada completa
      if (!resultadoEntrada.hayTurnoFuturo) {
        console.log('[AsistenciaLogic] Jornada realmente completada');
        return {
          puedeRegistrar: false,
          tipoRegistro: 'entrada',
          clasificacion: null,
          estadoHorario: 'completado',
          jornadaCompleta: true,
          mensaje: 'Jornada completada por hoy'
        };
      }

      console.log('[AsistenciaLogic] Hay turno futuro, esperando...');
      return resultadoEntrada;
    }

    // Aún hay grupos pendientes
    console.log('[AsistenciaLogic] Validando entrada para grupo', gruposCompletados);
    return validarEntrada(horario, tolerancia, ahora, gruposCompletados, registrosHoy);
  }

  return validarEntrada(horario, tolerancia, ahora, 0, registrosHoy);
};

/**
 * Carga todos los datos necesarios para calcular el estado del registro
 * @param {string|number} empleadoId - ID del empleado
 * @param {string|number} usuarioId - ID del usuario
 * @returns {Object} - { ultimo, horario, tolerancia, estado }
 */
export const cargarDatosAsistencia = async (empleadoId, usuarioId) => {
  try {
    const [ultimo, horario, tolerancia] = await Promise.all([
      obtenerUltimoRegistro(empleadoId),
      obtenerHorario(empleadoId),
      obtenerTolerancia(usuarioId)
    ]);

    let estado = null;
    if (horario && tolerancia) {
      estado = calcularEstadoRegistro(ultimo, horario, tolerancia);
    }

    return {
      ultimo,
      horario,
      tolerancia,
      estado
    };
  } catch (err) {
    console.error('[AsistenciaLogic] Error cargando datos de asistencia:', err);
    return {
      ultimo: null,
      horario: null,
      tolerancia: null,
      estado: null
    };
  }
};

/**
 * Registra la asistencia en el servidor
 * @param {Object} params - Parámetros del registro
 * @returns {Object} - Resultado del registro
 */
export const registrarAsistenciaEnServidor = async ({
  empleadoId,
  departamentoId,
  tipoRegistro,
  clasificacion,
  estadoHorario,
  metodoRegistro = 'PIN',
  token
}) => {
  // Validación anti-duplicados: mismo empleado en intervalo corto
  const now = Date.now();
  if (
    lastRequestEmpleadoId === empleadoId &&
    now - lastRequestTimestamp < MIN_REQUEST_INTERVAL_MS
  ) {
    const segundosRestantes = Math.ceil((MIN_REQUEST_INTERVAL_MS - (now - lastRequestTimestamp)) / 1000);
    console.warn(`⚠️ Solicitud duplicada bloqueada. Espera ${segundosRestantes}s`);
    throw new Error(`Por favor espera ${segundosRestantes} segundos antes de intentar nuevamente`);
  }

  // Actualizar tracking
  lastRequestTimestamp = now;
  lastRequestEmpleadoId = empleadoId;

  const payload = {
    empleado_id: empleadoId,
    dispositivo_origen: 'escritorio',
    metodo_registro: metodoRegistro,
    departamento_id: departamentoId,
    ubicacion: null, // Siempre null para escritorio
  };

  if (tipoRegistro) payload.tipo = tipoRegistro;
  if (clasificacion) payload.clasificacion = clasificacion;
  if (estadoHorario) payload.estado = estadoHorario;

  console.log('[AsistenciaLogic] Enviando registro:', payload);

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ASISTENCIAS}/registrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || localStorage.getItem('auth_token') || ''}`,
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data;

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      throw new Error('Error del servidor: respuesta inválida');
    }

    if (!response.ok) {
      const errorMsg = data.message || data.error || `Error del servidor (${response.status})`;
      const error = new Error(errorMsg);
      error.responseData = data; // Attach response data for frontend processing
      throw error;
    }

    return data;
  } catch (fetchError) {
    // === FALLBACK OFFLINE ===
    // Si el fetch falla por red, guardar en cola offline (solo en Electron)
    const isNetworkError = fetchError.name === 'TypeError'
      || fetchError.message.includes('Failed to fetch')
      || fetchError.message.includes('NetworkError')
      || fetchError.message.includes('ERR_INTERNET_DISCONNECTED');

    if (isNetworkError && window.electronAPI && window.electronAPI.rawOfflineDB) {
      console.log('📴 [AsistenciaLogic] Sin conexión — guardando en cola offline cruda');

      const offlineResult = await window.electronAPI.rawOfflineDB.savePunch({
        empleado_id: empleadoId,
        metodo: metodoRegistro || 'PIN',
        fecha_captura: new Date().toISOString(),
      });

      if (offlineResult && offlineResult.success) {
        return {
          success: true,
          offline: true,
          message: 'Asistencia guardada en dispositivo (Offline). Se sincronizará en automático',
          data: offlineResult.data,
          tipoMovimiento: "OFFLINE",
          estado: "Pendiente",
          estadoTexto: '📴 Modo Offline',
          clasificacion: 'guardado local',
        };
      }
    }

    // Si no es error de red o no hay offlineDB, re-lanzar el error original
    throw fetchError;
  }
};

/**
 * Obtiene el texto y emoji según la clasificación
 */
export const obtenerInfoClasificacion = (clasificacion, tipoRegistro) => {
  let estadoTexto = '';
  let emoji = '✅';
  let tipoEvento = 'success';

  switch (clasificacion) {
    case 'entrada':
      estadoTexto = 'puntual';
      emoji = '✅';
      break;
    case 'retardo':
      estadoTexto = 'con retardo';
      emoji = '⚠️';
      tipoEvento = 'warning';
      break;
    case 'falta':
      estadoTexto = 'fuera de tolerancia (falta)';
      emoji = '❌';
      tipoEvento = 'warning';
      break;
    case 'salida_puntual':
      estadoTexto = 'salida puntual';
      emoji = '✅';
      break;
    case 'salida_temprana':
      estadoTexto = 'salida anticipada';
      emoji = '⚠️';
      tipoEvento = 'warning';
      break;
    default:
      estadoTexto = tipoRegistro === 'salida' ? 'salida registrada' : 'entrada registrada';
      emoji = '✅';
  }

  return { estadoTexto, emoji, tipoEvento };
};

/**
 * Formatea minutos en formato legible "X horas y Y minutos"
 * @param {number} minutos - Minutos totales
 * @returns {string} - Formato legible
 */
export const formatearTiempoRestante = (minutos) => {
  if (!minutos || minutos <= 0) return '0 minutos';
  if (minutos < 60) return `${minutos} minuto${minutos !== 1 ? 's' : ''}`;

  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;

  if (mins === 0) {
    return `${horas} hora${horas !== 1 ? 's' : ''}`;
  }

  return `${horas} hora${horas !== 1 ? 's' : ''} y ${mins} minuto${mins !== 1 ? 's' : ''}`;
};

/**
 * Mapea el estado interno a los estados requeridos
 * @param {Object} estadoCalculado - Estado calculado por validarEntrada/validarSalida
 * @returns {string} - Estado normalizado: Puntual/Retardo/Falta/Pendiente/Rechazado
 */
export const mapearEstado = (estadoCalculado) => {
  if (!estadoCalculado) return 'Pendiente';

  if (!estadoCalculado.puedeRegistrar) {
    if (estadoCalculado.estadoHorario === 'tiempo_insuficiente') return 'Pendiente';
    if (estadoCalculado.estadoHorario === 'fuera_horario') return 'Rechazado';
    if (estadoCalculado.estadoHorario === 'anticipado_no_permitido') return 'Rechazado';
    if (estadoCalculado.jornadaCompleta) return 'Completado';
    if (estadoCalculado.hayTurnoFuturo) return 'Pendiente';
    return 'Rechazado';
  }

  switch (estadoCalculado.clasificacion) {
    case 'puntual':
    case 'salida_puntual':
      return 'Puntual';
    case 'retardo':
    case 'salida_retardo':
    case 'salida_temprana':
      return 'Retardo';
    case 'falta':
    case 'salida_falta':
      return 'Falta';
    default:
      return estadoCalculado.estadoHorario === 'puntual' ? 'Puntual' : 'Pendiente';
  }
};

/**
 * Genera mensaje descriptivo para el usuario
 * @param {Object} estadoCalculado - Estado calculado
 * @returns {string} - Mensaje legible para el usuario
 */
export const generarMensaje = (estadoCalculado) => {
  if (!estadoCalculado) return 'Error al calcular estado';

  if (!estadoCalculado.puedeRegistrar) {
    if (estadoCalculado.mensaje) return estadoCalculado.mensaje;

    if (estadoCalculado.estadoHorario === 'tiempo_insuficiente') {
      const tiempoFormateado = formatearTiempoRestante(estadoCalculado.minutosRestantes);
      return `Faltan ${tiempoFormateado} para habilitar tu salida`;
    }

    if (estadoCalculado.jornadaCompleta) return 'Ya completaste tu jornada de hoy';
    if (estadoCalculado.hayTurnoFuturo) return 'Aún no es hora de entrada';
    if (estadoCalculado.estadoHorario === 'anticipado_no_permitido') {
      return 'No se permite registro anticipado para tu rol';
    }

    return 'Fuera del horario de registro';
  }

  const tipo = estadoCalculado.tipoRegistro === 'salida' ? 'Salida' : 'Entrada';

  switch (estadoCalculado.clasificacion) {
    case 'puntual':
    case 'salida_puntual':
      return `${tipo} puntual`;
    case 'retardo':
    case 'salida_retardo':
      return `${tipo} con retardo`;
    case 'salida_temprana':
      return 'Salida anticipada';
    case 'falta':
    case 'salida_falta':
      return `${tipo} registrada como falta`;
    default:
      return `${tipo} registrada`;
  }
};

/**
 * Normaliza la respuesta del estado de registro al formato JSON estandarizado
 * @param {Object} estadoCalculado - Estado calculado por calcularEstadoRegistro
 * @param {Object} horario - Horario del empleado
 * @returns {{ autorizado: boolean, estado: string, mensaje: string, bloque_trabajo: object }}
 */
export const normalizarRespuestaRegistro = (estadoCalculado, horario) => {
  let bloqueActual = { inicio: '00:00', fin: '23:59' };

  if (estadoCalculado?.grupoActual) {
    bloqueActual = getEntradaSalidaGrupo(estadoCalculado.grupoActual);
  } else if (horario?.entrada && horario?.salida) {
    bloqueActual = { inicio: horario.entrada, fin: horario.salida };
  } else if (horario?.gruposTurnos?.length > 0) {
    bloqueActual = getEntradaSalidaGrupo(horario.gruposTurnos[0]);
  }

  return {
    autorizado: estadoCalculado?.puedeRegistrar ?? false,
    estado: mapearEstado(estadoCalculado),
    mensaje: generarMensaje(estadoCalculado),
    bloque_trabajo: {
      inicio: bloqueActual.entrada || bloqueActual.inicio,
      fin: bloqueActual.salida || bloqueActual.fin
    }
  };
};

/**
 * Mapea la clasificación del frontend a valores válidos del ENUM de la BD
 * BD ENUM: "puntual", "retardo", "falta"
 * @param {string} clasificacion - Clasificación del frontend
 * @returns {string} - Valor válido para la BD
 */
export const mapearClasificacionBD = (clasificacion) => {
  const mapa = {
    'puntual': 'puntual',
    'salida_puntual': 'puntual',
    'retardo': 'retardo',
    'salida_retardo': 'retardo',
    'salida_temprana': 'retardo',
    'falta': 'falta',
    'salida_falta': 'falta'
  };
  return mapa[clasificacion] || 'puntual';
};

export default {
  getDiaSemana,
  getMinutosDelDia,
  horaAMinutos,
  agruparTurnosConcatenados,
  getEntradaSalidaGrupo,
  obtenerUltimoRegistro,
  obtenerHorario,
  obtenerTolerancia,
  obtenerDepartamentoEmpleado,
  bloqueCompletado,
  validarEntrada,
  validarSalida,
  calcularEstadoRegistro,
  cargarDatosAsistencia,
  registrarAsistenciaEnServidor,
  obtenerInfoClasificacion,
  formatearTiempoRestante,
  mapearEstado,
  generarMensaje,
  normalizarRespuestaRegistro,
  mapearClasificacionBD
};
