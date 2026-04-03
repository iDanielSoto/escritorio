import { getApiEndpoint } from '../config/apiEndPoint.js';

const API_URL = getApiEndpoint('/api');

/**
 * Usa la ruta: /api/empleados/:empleadoId/horario
 * @param {string} empleadoId - ID del empleado
 * @param {string} token - Token de autenticación
 * @returns {Promise<Object>} Datos del horario
 */
export const getHorarioPorEmpleado = async (empleadoId, token = null) => {
    try {
        const url = `${API_URL}/empleados/${empleadoId}/horario`;

        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();

            if (response.status === 404) {
                throw new Error('No tienes un horario asignado');
            }

            if (response.status === 401) {
                throw new Error('No autorizado. Verifica tu sesión.');
            }

            throw new Error(`Error del servidor (${response.status}): ${errorText}`);
        }

        const responseText = await response.text();

        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
            throw new Error(`Respuesta inválida del servidor`);
        }

        const horario = data.data || data;

        if (!horario.configuracion) {
            throw new Error('El horario no tiene configuración válida');
        }

        return horario;
    } catch (error) {
        throw error;
    }
};

/**
 * Parsear horario con estructura nueva (configuracion_semanal)
 * @param {Object} configuracionSemanal - Objeto con días como keys y arrays de turnos
 * @returns {Array} Array de días con su configuración
 */
const parsearHorarioNuevo = (configuracionSemanal) => {
    const diasMap = {
        'lunes': 'Lunes',
        'martes': 'Martes',
        'miercoles': 'Miércoles',
        'jueves': 'Jueves',
        'viernes': 'Viernes',
        'sabado': 'Sábado',
        'domingo': 'Domingo'
    };

    const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

    return diasSemana.map(dia => {
        const turnosDelDia = configuracionSemanal[dia] || [];
        const diaActivo = turnosDelDia.length > 0;

        const turnos = turnosDelDia.map(turno => ({
            entrada: turno.inicio,
            salida: turno.fin
        }));

        const tipo = turnos.length > 1 ? 'quebrado' : 'continuo';

        return {
            day: diasMap[dia],
            active: diaActivo,
            location: diaActivo ? 'Edificio A' : 'Día de descanso',
            time: diaActivo ? formatearHorarioTurnos(turnos) : '---',
            hours: diaActivo ? calcularHorasTurnos(turnos) : '',
            turnos: turnos,
            tipo: tipo
        };
    });
};

/**
 * Parsear configuración de horario del JSON config_excep o configuracion
 * @param {Object} horario - Objeto horario con config_excep o configuracion
 * @returns {Array} Array de días con su configuración
 */
export const parsearHorario = (horario) => {
    try {
        if (!horario) {
            return obtenerHorarioVacio();
        }

        const configRaw = horario.configuracion || horario.config_excep;

        if (!configRaw) {
            return obtenerHorarioVacio();
        }

        let config;
        try {
            config = typeof configRaw === 'string'
                ? JSON.parse(configRaw)
                : configRaw;
        } catch (parseError) {
            return obtenerHorarioVacio();
        }

        if (config.configuracion_semanal) {
            return parsearHorarioNuevo(config.configuracion_semanal);
        }

        if (!config.dias || !Array.isArray(config.dias)) {
            return obtenerHorarioVacio();
        }

        if (!config.turnos || !Array.isArray(config.turnos)) {
            return obtenerHorarioVacio();
        }

        const diasMap = {
            'lunes': 'Lunes',
            'martes': 'Martes',
            'miercoles': 'Miércoles',
            'jueves': 'Jueves',
            'viernes': 'Viernes',
            'sabado': 'Sábado',
            'domingo': 'Domingo'
        };

        const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

        return diasSemana.map(dia => {
            const diaActivo = config.dias.includes(dia);
            const turnos = config.turnos || [];

            return {
                day: diasMap[dia],
                active: diaActivo,
                location: diaActivo ? 'Edificio A' : 'Día de descanso',
                time: diaActivo ? formatearHorarioTurnos(turnos) : '---',
                hours: diaActivo ? calcularHorasTurnos(turnos) : '',
                turnos: diaActivo ? turnos : [],
                tipo: config.tipo || 'continuo'
            };
        });
    } catch (error) {
        return obtenerHorarioVacio();
    }
};

/**
 * Formatear turnos para mostrar (ej: "09:00 - 18:00" o "08:00-13:00 | 15:00-19:00")
 * @param {Array} turnos - Array de objetos {entrada, salida}
 * @returns {string} String formateado
 */
const formatearHorarioTurnos = (turnos) => {
    if (!turnos || turnos.length === 0) return '---';

    if (turnos.length === 1) {
        return `${turnos[0].entrada} - ${turnos[0].salida}`;
    }

    return turnos.map(t => `${t.entrada}-${t.salida}`).join(' | ');
};

/**
 * Calcular total de horas de turnos
 * @param {Array} turnos - Array de objetos {entrada, salida}
 * @returns {string} String con horas (ej: "8 horas")
 */
const calcularHorasTurnos = (turnos) => {
    if (!turnos || turnos.length === 0) return '';

    let totalMinutos = 0;

    turnos.forEach(turno => {
        if (!turno.entrada || !turno.salida) {
            return;
        }

        const [horaEntrada, minEntrada] = turno.entrada.split(':').map(Number);
        const [horaSalida, minSalida] = turno.salida.split(':').map(Number);

        const minutosTotalesEntrada = horaEntrada * 60 + minEntrada;
        const minutosTotalesSalida = horaSalida * 60 + minSalida;

        totalMinutos += minutosTotalesSalida - minutosTotalesEntrada;
    });

    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;

    if (minutos === 0) {
        return `${horas} horas`;
    }

    return `${horas}h ${minutos}m`;
};

/**
 * Obtener horario vacío (sin configuración)
 * @returns {Array} Array de días vacío
 */
const obtenerHorarioVacio = () => {
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    return dias.map(day => ({
        day,
        active: false,
        location: 'Sin configurar',
        time: '---',
        hours: '',
        turnos: [],
        tipo: 'continuo'
    }));
};

/**
 * Calcular resumen semanal del horario
 * @param {Array} horarioParsed - Array de días parseados
 * @returns {Object} Resumen con totales
 */
export const calcularResumenSemanal = (horarioParsed) => {
    try {
        const diasActivos = horarioParsed.filter(d => d.active);

        let horasTotales = 0;
        diasActivos.forEach(dia => {
            if (!dia.turnos || dia.turnos.length === 0) return;

            dia.turnos.forEach(turno => {
                if (!turno.entrada || !turno.salida) return;

                const [horaEntrada, minEntrada] = turno.entrada.split(':').map(Number);
                const [horaSalida, minSalida] = turno.salida.split(':').map(Number);

                const minutosTotalesEntrada = horaEntrada * 60 + minEntrada;
                const minutosTotalesSalida = horaSalida * 60 + minSalida;

                horasTotales += (minutosTotalesSalida - minutosTotalesEntrada) / 60;
            });
        });

        return {
            diasLaborales: diasActivos.length,
            totalDias: horarioParsed.length,
            horasTotales: horasTotales.toFixed(1)
        };
    } catch (error) {
        return {
            diasLaborales: 0,
            totalDias: 7,
            horasTotales: '0'
        };
    }
};

/**
 * Obtener información de entrada y salida del día actual
 * @param {Array} horarioParsed - Array de días parseados
 * @returns {Object} Info del día actual
 */
export const getInfoDiaActual = (horarioParsed) => {
    try {
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const hoy = new Date().getDay();
        const nombreDiaHoy = diasSemana[hoy];

        const diaActual = horarioParsed.find(d => d.day === nombreDiaHoy);

        if (!diaActual || !diaActual.active) {
            return {
                trabaja: false,
                entrada: null,
                salida: null,
                turnos: []
            };
        }

        return {
            trabaja: true,
            entrada: diaActual.turnos[0]?.entrada || null,
            salida: diaActual.turnos[diaActual.turnos.length - 1]?.salida || null,
            turnos: diaActual.turnos,
            tipo: diaActual.tipo
        };
    } catch (error) {
        return {
            trabaja: false,
            entrada: null,
            salida: null,
            turnos: []
        };
    }
};

/**
 * Obtener turno relevante (activo o próximo)
 * @param {Array} turnos - Array de turnos del día
 * @returns {Object|null} Turno relevante con estado
 */
export const obtenerTurnoRelevante = (turnos) => {
    if (!turnos?.length) return null;

    const horaActual = new Date().getHours() * 60 + new Date().getMinutes();

    const aMinutos = (hora) => {
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    };

    // 1. Buscar turno activo (estamos dentro del rango)
    for (const turno of turnos) {
        if (horaActual >= aMinutos(turno.entrada) && horaActual <= aMinutos(turno.salida)) {
            return { ...turno, estado: 'activo' };
        }
    }

    // 2. Buscar siguiente turno (el primero que aún no ha comenzado)
    for (const turno of turnos) {
        if (horaActual < aMinutos(turno.entrada)) {
            return { ...turno, estado: 'proximo' };
        }
    }

    // 3. Todos los turnos ya pasaron
    return { ...turnos[turnos.length - 1], estado: 'finalizado' };
};

/**
 * Cargar horario completo del empleado
 * @param {string} empleadoId - ID del empleado
 * @param {string} token - Token de autenticación
 * @returns {Promise<Object>} Datos del horario parseados y resumen
 */
export const cargarHorarioCompleto = async (empleadoId, token) => {
    try {
        const horario = await getHorarioPorEmpleado(empleadoId, token);

        if (!horario) {
            throw new Error('No se recibió información del horario');
        }

        const horarioParsed = parsearHorario(horario);
        const resumen = calcularResumenSemanal(horarioParsed);

        return { horarioParsed, resumen, horarioRaw: horario };

    } catch (error) {
        console.error('Error cargando horario:', error.message);
        return null;
    }
};

// Exportar todo el servicio
export default {
    getHorarioPorEmpleado,
    parsearHorario,
    calcularResumenSemanal,
    getInfoDiaActual,
    obtenerTurnoRelevante,
    cargarHorarioCompleto
};
