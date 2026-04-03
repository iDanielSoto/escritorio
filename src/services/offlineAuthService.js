/**
 * OfflineAuthService — Servicio de autenticación contra la caché local SQLite
 * Valida PIN, huella y facial cuando no hay conexión al servidor.
 */

import {
  calcularEstadoRegistro,
  getDiaSemana,
  agruparTurnosConcatenados,
  getEntradaSalidaGrupo
} from './asistenciaLogicService';

// ============================================================
// HELPERS
// ============================================================

/**
 * Verifica si estamos en Electron con offlineDB disponible
 */
function hasOfflineDB() {
  return !!(window.electronAPI && window.electronAPI.offlineDB);
}

/**
 * Calcula distancia euclidiana entre dos descriptores faciales
 * Réplica de la función del servidor (credenciales.controller.js)
 * @param {Array|Float32Array} desc1
 * @param {Array|Float32Array} desc2
 * @returns {number}
 */
function calcularDistanciaEuclidiana(desc1, desc2) {
  if (desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Convierte un BYTEA/Buffer a Float32Array
 * Para descriptores faciales almacenados como BLOB en SQLite
 * @param {ArrayBuffer|Uint8Array|Array} data
 * @returns {Float32Array}
 */
function bufferToFloat32Array(data) {
  if (!data) return null;

  try {
    // Si ya es un Float32Array
    if (data instanceof Float32Array) return data;

    // Si es un ArrayBuffer
    if (data instanceof ArrayBuffer) {
      return new Float32Array(data);
    }

    // Si es un Uint8Array o Buffer de Node
    if (data instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))) {
      return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    }

    // Si es un array de números (descriptor serializado como JSON)
    if (Array.isArray(data)) {
      return new Float32Array(data);
    }

    // Si es base64
    if (typeof data === 'string') {
      // Intentar parsear como JSON primero
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return new Float32Array(parsed);
        // Soporte para serialización de NodeJS Buffer: {"type":"Buffer","data":[...]}
        if (parsed && parsed.type === 'Buffer' && Array.isArray(parsed.data)) {
          const bytes = new Uint8Array(parsed.data);
          return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
        }
      } catch {
        // No es JSON, intentar como base64
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Float32Array(bytes.buffer);
      }
    }

    return null;
  } catch (error) {
    console.error('[OfflineAuth] Error convirtiendo a Float32Array:', error);
    return null;
  }
}

// ============================================================
// IDENTIFICACIÓN OFFLINE POR PIN
// ============================================================

/**
 * Identifica un empleado por PIN contra la caché local
 * NOTA: La verificación real de Argon2id requiere librería crypto del servidor.
 * En modo offline, comparamos el PIN ingresado contra un hash almacenado.
 * Para una implementación segura con argon2, se necesitaría importar argon2 en Electron.
 *
 * Alternativa práctica: almacenar un hash SHA-256 del PIN localmente como fallback offline.
 *
 * @param {string} usuarioIngresado - Usuario o correo ingresado
 * @param {string} pinIngresado - PIN de 6 dígitos
 * @returns {Promise<Object|null>} empleado identificado o null
 */
export async function identificarPorPinOffline(usuarioIngresado, pinIngresado) {
  if (!hasOfflineDB()) {
    console.warn('[OfflineAuth] offlineDB no disponible');
    return null;
  }

  try {
    const credenciales = await window.electronAPI.offlineDB.getAllCredenciales();

    if (!credenciales || credenciales.length === 0) {
      console.warn('[OfflineAuth] No hay credenciales en caché');
      return null;
    }

    // Buscar por PIN y usuario
    for (const cred of credenciales) {
      if (!cred.pin_hash) continue;

      // Obtenemos el empleado para validar si es el usuario o correo correcto
      const empleado = await window.electronAPI.offlineDB.getEmpleado(cred.empleado_id);
      if (!empleado || empleado.estado_cuenta !== 'activo') continue;

      // El usuarioIngresado puede ser el username o el correo
      const matchesUsuario = (empleado.usuario && empleado.usuario.toLowerCase() === usuarioIngresado.toLowerCase()) ||
        (empleado.correo && empleado.correo.toLowerCase() === usuarioIngresado.toLowerCase());

      if (!matchesUsuario) continue;

      // Si el hash coincide con el PIN (ya sea hash salteado o texto plano)
      if (cred.pin_hash === pinIngresado || await verificarPinLocal(pinIngresado, cred.pin_hash)) {
        console.log(`✅ [OfflineAuth] PIN match → empleado ${cred.empleado_id}`);
        return {
          empleado_id: cred.empleado_id,
          nombre: empleado.nombre || cred.nombre,
          usuario_id: empleado.usuario_id,
          metodo: 'PIN',
        };
      }
    }

    console.log('❌ [OfflineAuth] PIN no coincide con ningún empleado');
    return null;
  } catch (error) {
    console.error('[OfflineAuth] Error en identificación por PIN:', error);
    return null;
  }
}

/**
 * Verificación local de PIN contra hash Argon2id
 * NOTA: Esto es un placeholder. Para verificación real de Argon2id offline,
 * se necesita el módulo argon2 compilado para Electron.
 * @param {string} pin
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verificarPinLocal(pin, hash) {
  // Si comienza con un prefijo local como $localhash$ que hemos definido
  if (hash && hash.startsWith('$localhash$')) {
    try {
      // Formato: $localhash$salt$hashHex
      const parts = hash.split('$');
      if (parts.length === 4) {
        const saltHex = parts[2];
        const storedHashHex = parts[3];

        // Usamos crypto a través de una función asíncrona IPC si es necesario
        // Pero OfflineAuthService está en el renderer, así que NO podemos usar crypto nativo directamente.
        // Pero SÍ tenemos la Web Crypto API.

        // Convertir salt hex a Uint8Array
        const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        // Encode pin
        const encoder = new TextEncoder();
        const pinBytes = encoder.encode(pin);

        // Import pin as base key
        const baseKey = await window.crypto.subtle.importKey(
          'raw', pinBytes, 'PBKDF2', false, ['deriveBits']
        );

        // Derive key using PBKDF2
        const derivedBits = await window.crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 100000,
            hash: 'SHA-256'
          },
          baseKey,
          256
        );

        // Convert to hex
        const derivedHex = Array.from(new Uint8Array(derivedBits))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        return derivedHex === storedHashHex;
      }
    } catch (err) {
      console.error('[OfflineAuth] Error verificando hash local', err);
      return false;
    }
  }

  if (hash && hash.startsWith('$argon2id$')) {
    console.warn('[OfflineAuth] Verificación Argon2id offline requiere módulo nativo');
    return false;
  }

  return pin === hash;
}

// ============================================================
// IDENTIFICACIÓN OFFLINE POR HUELLA DACTILAR
// ============================================================

/**
 * Identifica un empleado por template de huella contra la caché local
 * NOTA: El matching de huellas requiere el SDK de DigitalPersona.
 * La comparación se delega al BiometricMiddleware via WebSocket local.
 *
 * @param {string} templateBase64 - Template de huella en Base64
 * @returns {Promise<Object|null>} empleado identificado o null
 */
export async function identificarPorHuellaOffline(templateBase64) {
  if (!hasOfflineDB()) {
    console.warn('[OfflineAuth] offlineDB no disponible');
    return null;
  }

  try {
    const credenciales = await window.electronAPI.offlineDB.getAllCredenciales();
    const conHuella = credenciales.filter(c => c.dactilar_template);

    if (conHuella.length === 0) {
      console.warn('[OfflineAuth] No hay templates de huella en caché');
      return null;
    }

    // El matching de huellas requiere el SDK de DigitalPersona
    // que corre en el BiometricMiddleware (C#) localmente.
    // El middleware sigue funcionando offline (es un proceso local).
    // Delegamos la comparación al middleware via su WebSocket local.
    console.log(`🔍 [OfflineAuth] ${conHuella.length} huellas en caché para matching offline`);

    // La comparación se hace template vs template usando el BiometricMiddleware
    // que opera localmente sin necesidad de internet
    // El renderer ya maneja esto via useBiometricWebSocket

    return {
      templates: conHuella,
      count: conHuella.length,
      metodo: 'HUELLA',
    };
  } catch (error) {
    console.error('[OfflineAuth] Error en identificación por huella:', error);
    return null;
  }
}

// ============================================================
// IDENTIFICACIÓN OFFLINE POR FACIAL
// ============================================================

/**
 * Identifica un empleado por descriptor facial contra la caché local
 * Usa distancia euclidiana, misma lógica que el servidor.
 *
 * @param {Array|Float32Array} descriptorCapturado - Descriptor de 128 dimensiones
 * @param {number} umbral - Umbral máximo de distancia (default 0.45)
 * @returns {Promise<Object|null>} empleado identificado o null
 */
export async function identificarPorFacialOffline(descriptorCapturado, umbral = 0.45) {
  if (!hasOfflineDB()) {
    console.warn('[OfflineAuth] offlineDB no disponible');
    return null;
  }

  try {
    const credenciales = await window.electronAPI.offlineDB.getAllCredenciales();
    const conFacial = credenciales.filter(c => c.facial_descriptor);

    if (conFacial.length === 0) {
      console.warn('[OfflineAuth] No hay descriptores faciales en caché');
      return null;
    }

    console.log(`🔍 [OfflineAuth] Comparando rostro contra ${conFacial.length} descriptores en caché...`);

    let bestMatch = null;
    let bestDistance = Infinity;

    for (const cred of conFacial) {
      const storedDescriptor = bufferToFloat32Array(cred.facial_descriptor);
      if (!storedDescriptor || storedDescriptor.length === 0) continue;

      const distance = calcularDistanciaEuclidiana(
        Array.from(descriptorCapturado),
        Array.from(storedDescriptor)
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = cred;
      }
    }

    if (bestMatch && bestDistance < umbral) {
      const empleado = await window.electronAPI.offlineDB.getEmpleado(bestMatch.empleado_id);

      console.log(`✅ [OfflineAuth] Facial match → empleado ${bestMatch.empleado_id} (distancia: ${bestDistance.toFixed(4)})`);

      return {
        empleado_id: bestMatch.empleado_id,
        nombre: empleado?.nombre || bestMatch.nombre,
        usuario_id: empleado?.usuario_id,
        distancia: bestDistance,
        metodo: 'FACIAL',
      };
    }

    console.log(`❌ [OfflineAuth] No se encontró match facial (mejor distancia: ${bestDistance.toFixed(4)}, umbral: ${umbral})`);
    return null;
  } catch (error) {
    console.error('[OfflineAuth] Error en identificación facial:', error);
    return null;
  }
}

// ============================================================
// GUARDADO DE ASISTENCIA OFFLINE (NUEVO MÉTODO CIEGO)
// ============================================================

// Variables para control de duplicados (en memoria)
let lastRequestTimestamp = 0;
let lastRequestEmpleadoId = null;
const MIN_REQUEST_INTERVAL_MS = 5000; // 5 segundos

/**
 * Guarda un registro de asistencia "en bruto" en la nueva cola offline
 * @param {Object} data - { empleadoId, metodoRegistro }
 * @returns {Promise<Object>}
 */
export async function guardarAsistenciaOffline(data) {
  if (!window.electronAPI || !window.electronAPI.rawOfflineDB) {
    throw new Error('Sistema offline de asistencias crudas no disponible');
  }

  const empleadoId = data.empleadoId || data.empleado_id;

  // 1. Validación Anti-Spam Básica
  const now = Date.now();
  if (
    lastRequestEmpleadoId === empleadoId &&
    now - lastRequestTimestamp < MIN_REQUEST_INTERVAL_MS
  ) {
    const segundosRestantes = Math.ceil((MIN_REQUEST_INTERVAL_MS - (now - lastRequestTimestamp)) / 1000);
    console.warn(`⚠️ [Offline] Solicitud duplicada bloqueada. Espera ${segundosRestantes}s`);
    throw new Error(`Por favor espera ${segundosRestantes} segundos antes de intentar nuevamente`);
  }

  // ACTUALIZACIÓN INMEDIATA
  lastRequestTimestamp = now;
  lastRequestEmpleadoId = empleadoId;

  // 2. Guardar en nueva SQLite Cruda
  try {
    const result = await window.electronAPI.rawOfflineDB.savePunch({
      empleado_id: empleadoId,
      metodo: data.metodoRegistro || data.metodo_registro || 'PIN',
      fecha_captura: new Date().toISOString()
    });

    if (!result.success) {
      throw new Error(result.error || 'Error guardando asistencia cruda offline');
    }

    console.log('📝 [OfflineAuth] Asistencia cruda guardada:', result.data);
    return result.data;

  } catch (err) {
    lastRequestTimestamp = 0;
    lastRequestEmpleadoId = null;
    console.error('[OfflineAuth] Error en guardarAsistenciaOffline:', err);
    throw err;
  }
}

// ============================================================
// FUNCIONES LEGACY (RETENIDAS SOLO PARA LECTURA / HORARIO)
// ============================================================

/**
 * Normaliza un registro offline para que coincida con el formato esperado por asistenciaLogicService
 * @param {Object} reg - Registro offline
 * @param {Array} todosRegistros - Array completo para calcular total
 */
function normalizarRegistroOffline(reg, todosRegistros) {
  if (!reg) return null;
  return {
    tipo: reg.tipo,
    estado: reg.estado,
    fecha_registro: new Date(reg.fecha_registro),
    hora: new Date(reg.fecha_registro).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    totalRegistrosHoy: todosRegistros.length
  };
}

/**
 * Carga datos necesarios para el cálculo de estado desde la caché local
 * Y calcula el estado actual usando la lógica compartida
 * @param {string} empleadoId
 * @returns {Promise<Object>} { horario, tolerancia, registrosHoy, departamento, estado, ultimo }
 */
export async function cargarDatosOffline(empleadoId) {
  if (!hasOfflineDB()) {
    return { horario: null, tolerancia: null, registrosHoy: [], departamento: null, estado: null };
  }

  try {
    const [horarioRaw, registrosHoyRaw] = await Promise.all([
      window.electronAPI.offlineDB.getHorario(empleadoId),
      window.electronAPI.offlineDB.getRegistrosHoy(empleadoId),
    ]);

    // 1. Procesar Horario
    const horario = horarioRaw ? {
      id: horarioRaw.horario_id,
      horario_id: horarioRaw.horario_id,
      configuracion: horarioRaw.configuracion, // Ya viene parseado u objeto desde sqliteManager
      es_activo: horarioRaw.es_activo,
      trabaja: true // Asumimos true si existe, asistenciaLogic lo validará a fondo
    } : null;

    // asistenciaLogic espera un objeto con 'turnos', 'gruposTurnos' ya procesados.
    // PERO obtenerHorario en asistenciaLogic hace fetch y procesa. 
    // Aquí tenemos el raw config. Debemos procesarlo similar a obtenerHorario.
    // Reutilizaremos logic de obtenerHorario parseando la config aqui mismo o
    // simulando la estructura si asistenciaLogic exporta el procesador.
    // Revisando asistenciaLogic, 'obtenerHorario' hace todo el trabajo.
    // Como no exporta la función de procesar config aislada (está dentro de obtenerHorario),
    // vamos a replicar la parte de extracción de turnos aquí para pasarle un objeto compatible.

    // Helpers importados arriba
    // const { getDiaSemana, agruparTurnosConcatenados, getEntradaSalidaGrupo } = require('./asistenciaLogicService');

    let horarioProcesado = null;
    if (horario && horario.configuracion) {
      let config = typeof horario.configuracion === 'string'
        ? JSON.parse(horario.configuracion)
        : horario.configuracion;

      const diaHoy = getDiaSemana(); // "lunes", "martes"...
      let turnosHoy = [];

      if (config.configuracion_semanal?.[diaHoy]) {
        turnosHoy = config.configuracion_semanal[diaHoy].map(t => ({
          entrada: t.inicio,
          salida: t.fin
        }));
      } else if (config.dias?.includes(diaHoy)) {
        turnosHoy = config.turnos || [];
      }

      if (turnosHoy && Array.isArray(turnosHoy) && turnosHoy.length > 0) {
        const gruposTurnos = agruparTurnosConcatenados(turnosHoy);
        const primerGrupo = gruposTurnos[0];
        const ultimoGrupo = gruposTurnos[gruposTurnos.length - 1];
        const entradaGeneral = getEntradaSalidaGrupo(primerGrupo).entrada;
        const salidaGeneral = getEntradaSalidaGrupo(ultimoGrupo).salida;

        horarioProcesado = {
          trabaja: true,
          turnos: turnosHoy,
          gruposTurnos: gruposTurnos,
          turnosOriginales: turnosHoy,
          entrada: entradaGeneral,
          salida: salidaGeneral,
          tipo: gruposTurnos.length > 1 ? 'quebrado' : 'continuo',
          configuracion: config
        };
      } else {
        horarioProcesado = { trabaja: false, turnos: [], gruposTurnos: [] };
      }
    }

    // 2. Procesar Tolerancia (Default ya no existe tabla offline)
    const tolerancia = {
      minutos_retardo: 10,
      minutos_falta: 30,
      permite_registro_anticipado: true,
      minutos_anticipado_max: 60,
      aplica_tolerancia_entrada: true,
      aplica_tolerancia_salida: true,
      minutos_anticipado_salida: 10
    };

    // 3. Procesar Registros
    const registrosHoy = registrosHoyRaw || [];
    // Ordenar para encontrar el último (descendiente)
    const registrosOrdenados = [...registrosHoy].sort((a, b) => {
      return new Date(b.fecha_registro) - new Date(a.fecha_registro);
    });

    const ultimoRaw = registrosOrdenados[0];
    const ultimo = ultimoRaw ? normalizarRegistroOffline(ultimoRaw, registrosOrdenados) : null;

    // 4. Calcular Estado
    let estado = null;
    if (horarioProcesado && tolerancia) {
      estado = calcularEstadoRegistro(ultimo, horarioProcesado, tolerancia, registrosHoy);
    }

    return {
      horario: horarioProcesado,
      tolerancia: tolerancia,
      registrosHoy: registrosOrdenados,
      ultimo: ultimoRaw, // Solo devolvemos raw, ya no usamos el estado calculado
      departamento: null,
    };
  } catch (error) {
    console.error('[OfflineAuth] Error cargando datos offline:', error);
    return { horario: null, tolerancia: null, registrosHoy: [], departamento: null };
  }
}

// ============================================================
// EAGER PUSH — guarda localmente y sincroniza de inmediato
// ============================================================

/**
 * Guarda la asistencia en la cola local SQLite y, si hay conexión,
 * intenta un push inmediato al servidor.
 *
 * @param {object} params
 * @param {number}  params.empleadoId        - ID del empleado
 * @param {string}  params.metodoRegistro    - 'PIN' | 'FACIAL' | 'HUELLA'
 * @param {boolean} params.isDatabaseConnected - desde ConnectivityContext
 *
 * @returns {Promise<{
 *   pendiente: boolean,
 *   tipo?:     'entrada' | 'salida',
 *   estado?:   string,
 *   hora?:     string,
 *   fecha_registro?: string
 * }>}
 */
export async function guardarYSincronizarAsistencia({ empleadoId, metodoRegistro, isDatabaseConnected }) {
  // === NUEVA VALIDACIÓN OFFLINE ===
  // Prevenir generación de colas innecesarias si el empleado no tiene horario hoy.
  const offlineSystemAvailable = !isDatabaseConnected && window.electronAPI && window.electronAPI.offlineDB;
  if (offlineSystemAvailable) {
    try {
      const datosOffline = await cargarDatosOffline(empleadoId);
      if (!datosOffline.horario || !datosOffline.horario.trabaja) {
        console.warn(`[EagerSync] ⛔ Empleado ${empleadoId} intentó registrar offline pero no trabaja hoy.`);
        return {
          rechazado: true,
          errorServidor: "No tienes un horario asignado para el día de hoy. No se registrará la asistencia.",
          pendiente: false
        };
      }
    } catch (err) {
      console.error('[EagerSync] Error validando horario offline antes de guardar:', err);
      // Fallback: Si hay error validando, permitimos el guardado y que el servidor/sincronizador decida después
    }
  }

  // 1. Guardar siempre en la cola local (offline-first garantizado)
  let localResult = null;
  try {
    localResult = await guardarAsistenciaOffline({ empleadoId, metodoRegistro });
  } catch (err) {
    console.error('[EagerSync] Error al guardar localmente:', err);
    return { pendiente: true };
  }

  // 2. Sin conexión → pendiente de sincronizar
  if (!isDatabaseConnected || !window.electronAPI?.rawOfflineDB) {
    return { pendiente: true };
  }

  // 3. Intentar push inmediato al servidor
  try {
    console.log('[EagerSync] Intentando push inmediato...');
    const pushResult = await window.electronAPI.rawOfflineDB.pushNow();

    // Si el push en sí falló (red, auth, timeout)
    if (!pushResult || pushResult.busy) {
      return { pendiente: true };
    }

    const punchId = localResult?.id;
    const sincronizados = pushResult?.sincronizados ?? [];
    const rechazados    = pushResult?.rechazados    ?? [];

    // ── ¿El punch fue rechazado definitivamente por el servidor? ──
    const punchRechazado = punchId
      ? rechazados.find(r => r.id_local === punchId)
      : rechazados[rechazados.length - 1];

    if (punchRechazado) {
      console.warn('[EagerSync] ⛔ Punch rechazado por el servidor:', punchRechazado.error);
      return {
        rechazado: true,
        errorServidor: punchRechazado.error || 'El servidor rechazó el registro',
      };
    }

    // ── ¿El punch fue sincronizado con éxito? ──
    const syncedPunch = (punchId && sincronizados.find(s => s.id_local === punchId))
      || sincronizados[sincronizados.length - 1];

    if (syncedPunch?.tipo) {
      console.log('[EagerSync] ✅ Clasificación recibida:', syncedPunch.tipo, syncedPunch.estado);
      return {
        pendiente: false,
        rechazado: false,
        tipo: syncedPunch.tipo,       // 'entrada' | 'salida'
        estado: syncedPunch.estado,   // 'puntual' | 'retardo' | ...
        hora: syncedPunch.hora
          || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        fecha_registro: syncedPunch.fecha_registro,
      };
    }

    // El servidor respondió 200 pero nuestro punch no está en ninguna lista
    // (race condition o batch con otros punches previos aún pendientes)
    console.warn('[EagerSync] Punch no encontrado en respuesta del servidor, queda pendiente.');
    return { pendiente: true };

  } catch (err) {
    console.warn('[EagerSync] Push falló, queda pendiente:', err.message);
    return { pendiente: true };
  }
}


// ============================================================
// EXPORTACIÓN
// ============================================================

export default {
  identificarPorPinOffline,
  identificarPorHuellaOffline,
  identificarPorFacialOffline,
  cargarDatosOffline,
  guardarAsistenciaOffline,
  guardarYSincronizarAsistencia,
  hasOfflineDB,
};
