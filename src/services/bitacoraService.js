// src/services/bitacoraService.js
// Servicio para gestionar la bitácora de eventos

/**
 * Acorta y formatea mensajes largos para una mejor visualización en la bitácora
 * @param {string} mensaje - Mensaje original
 * @returns {string} - Mensaje formateado y acortado
 */
const formatearMensaje = (mensaje) => {
  if (!mensaje) return 'Acción sin descripción';

  let nuevoMensaje = mensaje;

  // 1. Acortar mensajes de falta directa
  if (nuevoMensaje.includes('falta directa')) {
    nuevoMensaje = 'Rechazado: Falta directa en el turno';
  }
  
  // 2. Acortar errores genéricos de PIN o Facial
  nuevoMensaje = nuevoMensaje.replace(/Error en registro con (PIN|Facial) -/g, 'Error ($1):');

  // 3. Acortar prefijos de rechazo
  nuevoMensaje = nuevoMensaje.replace(/Registro rechazado(?: por el servidor)?:/g, 'Rechazado:');

  // 4. Acortar mensajes de offline sync
  nuevoMensaje = nuevoMensaje.replace(/Asistencia guardada localmente \(pendiente de sincronizar\)/g, 'Guardado local');

  // 5. Acortar intentos fallidos por cuentas desvinculadas
  nuevoMensaje = nuevoMensaje.replace(/Intento de registro - Usuario no asociado a empleado/g, 'Rechazado: Usuario sin empleado asignado');

  // 6. Simplificar sufijos de métodos (- PIN -> (PIN))
  nuevoMensaje = nuevoMensaje.replace(/ - (PIN|Facial)$/, ' ($1)');

  return nuevoMensaje.trim();
};

/**
 * Agregar un evento a la bitácora
 * @param {Object} evento - Datos del evento
 * @param {string} evento.user - Nombre del usuario
 * @param {string} evento.action - Descripción de la acción
 * @param {string} evento.type - Tipo de evento: 'success', 'error', 'info'
 */
export const agregarEvento = async (evento) => {
  try {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const actionFormateada = formatearMensaje(evento.action);

    const nuevoEvento = {
      timestamp,
      user: evento.user || 'Usuario desconocido',
      action: actionFormateada,
      type: evento.type || 'info',
      fecha: now.toISOString(),
    };

    if (window.electronAPI && window.electronAPI.bitacora) {
      // Uso de SQLite a través de Electron IPC
      await window.electronAPI.bitacora.saveEvent(nuevoEvento);
      console.log('📝 Evento agregado a bitácora (SQLite):', nuevoEvento);
      return nuevoEvento;
    } else {
      // Fallback a localStorage
      const bitacora = await obtenerBitacora();

      // Verificar si ya existe un evento similar en los últimos 2 segundos
      const eventosDuplicados = bitacora.filter((ev) => {
        const diffMs = now - new Date(ev.fecha);
        return (
          diffMs < 2000 &&
          ev.user === nuevoEvento.user &&
          ev.action === nuevoEvento.action &&
          ev.type === nuevoEvento.type
        );
      });

      if (eventosDuplicados.length > 0) {
        console.log('⚠️ Evento duplicado detectado, no se agregará:', nuevoEvento);
        return eventosDuplicados[0];
      }

      bitacora.unshift(nuevoEvento);
      if (bitacora.length > 100) {
        bitacora.splice(100);
      }

      localStorage.setItem('eventLog', JSON.stringify(bitacora));
      console.log('📝 Evento agregado a bitácora (localStorage):', nuevoEvento);
      return nuevoEvento;
    }
  } catch (error) {
    console.error('❌ Error al agregar evento a bitácora:', error);
    return null;
  }
};

/**
 * Obtener todos los eventos de la bitácora
 * @returns {Promise<Array>} - Array de eventos
 */
export const obtenerBitacora = async () => {
  try {
    if (window.electronAPI && window.electronAPI.bitacora) {
      const eventos = await window.electronAPI.bitacora.getEvents();
      return eventos || [];
    } else {
      const bitacoraStr = localStorage.getItem('eventLog');
      return bitacoraStr ? JSON.parse(bitacoraStr) : [];
    }
  } catch (error) {
    console.error('❌ Error al obtener bitácora:', error);
    return [];
  }
};

/**
 * Limpiar la bitácora
 */
export const limpiarBitacora = async () => {
  try {
    if (window.electronAPI && window.electronAPI.bitacora) {
      await window.electronAPI.bitacora.clearEvents();
      console.log('🗑️ Bitácora limpiada (SQLite)');
    } else {
      localStorage.removeItem('eventLog');
      console.log('🗑️ Bitácora limpiada (localStorage)');
    }
  } catch (error) {
    console.error('❌ Error al limpiar bitácora:', error);
  }
};

/**
 * Obtener eventos por tipo
 * @param {string} tipo - Tipo de evento: 'success', 'error', 'info'
 * @returns {Promise<Array>} - Array de eventos filtrados
 */
export const obtenerEventosPorTipo = async (tipo) => {
  try {
    const bitacora = await obtenerBitacora();
    return bitacora.filter((evento) => evento.type === tipo);
  } catch (error) {
    console.error('❌ Error al filtrar eventos por tipo:', error);
    return [];
  }
};

/**
 * Obtener eventos de hoy
 * @returns {Promise<Array>} - Array de eventos de hoy
 */
export const obtenerEventosDeHoy = async () => {
  try {
    const bitacora = await obtenerBitacora();
    const hoy = new Date().toLocaleDateString('es-MX');

    return bitacora.filter((evento) => {
      const fechaEvento = new Date(evento.fecha).toLocaleDateString('es-MX');
      return fechaEvento === hoy;
    });
  } catch (error) {
    console.error('❌ Error al obtener eventos de hoy:', error);
    return [];
  }
};
