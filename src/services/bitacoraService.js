// src/services/bitacoraService.js
// Servicio para gestionar la bitácora de eventos

/**
 * Agregar un evento a la bitácora
 * @param {Object} evento - Datos del evento
 * @param {string} evento.user - Nombre del usuario
 * @param {string} evento.action - Descripción de la acción
 * @param {string} evento.type - Tipo de evento: 'success', 'error', 'info'
 */
export const agregarEvento = (evento) => {
  try {
    // Obtener bitácora existente del localStorage
    const bitacora = obtenerBitacora();

    // Crear timestamp actual
    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Crear nuevo evento
    const nuevoEvento = {
      timestamp,
      user: evento.user || 'Usuario desconocido',
      action: evento.action || 'Acción sin descripción',
      type: evento.type || 'info',
      fecha: now.toISOString(),
    };

    // Verificar si ya existe un evento similar en los últimos 2 segundos
    const eventosDuplicados = bitacora.filter((ev) => {
      const diffMs = now - new Date(ev.fecha);
      return (
        diffMs < 2000 && // Menos de 2 segundos de diferencia
        ev.user === nuevoEvento.user &&
        ev.action === nuevoEvento.action &&
        ev.type === nuevoEvento.type
      );
    });

    // Si hay duplicados recientes, no agregar
    if (eventosDuplicados.length > 0) {
      console.log('⚠️ Evento duplicado detectado, no se agregará:', nuevoEvento);
      return eventosDuplicados[0];
    }

    // Agregar al inicio del array (eventos más recientes primero)
    bitacora.unshift(nuevoEvento);

    // Limitar la bitácora a los últimos 100 eventos
    if (bitacora.length > 100) {
      bitacora.splice(100);
    }

    // Guardar en localStorage
    localStorage.setItem('eventLog', JSON.stringify(bitacora));

    console.log('📝 Evento agregado a bitácora:', nuevoEvento);
    return nuevoEvento;
  } catch (error) {
    console.error('❌ Error al agregar evento a bitácora:', error);
    return null;
  }
};

/**
 * Obtener todos los eventos de la bitácora
 * @returns {Array} - Array de eventos
 */
export const obtenerBitacora = () => {
  try {
    const bitacoraStr = localStorage.getItem('eventLog');
    return bitacoraStr ? JSON.parse(bitacoraStr) : [];
  } catch (error) {
    console.error('❌ Error al obtener bitácora:', error);
    return [];
  }
};

/**
 * Limpiar la bitácora
 */
export const limpiarBitacora = () => {
  try {
    localStorage.removeItem('eventLog');
    console.log('🗑️ Bitácora limpiada');
  } catch (error) {
    console.error('❌ Error al limpiar bitácora:', error);
  }
};

/**
 * Obtener eventos por tipo
 * @param {string} tipo - Tipo de evento: 'success', 'error', 'info'
 * @returns {Array} - Array de eventos filtrados
 */
export const obtenerEventosPorTipo = (tipo) => {
  try {
    const bitacora = obtenerBitacora();
    return bitacora.filter((evento) => evento.type === tipo);
  } catch (error) {
    console.error('❌ Error al filtrar eventos por tipo:', error);
    return [];
  }
};

/**
 * Obtener eventos de hoy
 * @returns {Array} - Array de eventos de hoy
 */
export const obtenerEventosDeHoy = () => {
  try {
    const bitacora = obtenerBitacora();
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
