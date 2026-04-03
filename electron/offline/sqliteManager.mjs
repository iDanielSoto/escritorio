/**
 * SQLiteManager — Módulo de persistencia local Offline-First
 * Gestiona la base de datos SQLite para cola de asistencias y caché de datos maestros.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

let db = null;

// ============================================================
// INICIALIZACIÓN Y MIGRACIONES
// ============================================================

/**
 * Obtiene la ruta del archivo SQLite en la carpeta de datos de usuario
 */
function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'checador_offline.db');
}

/**
 * Inicializa la base de datos SQLite y ejecuta migraciones
 * @returns {Database} instancia de better-sqlite3
 */
export function initDatabase() {
  if (db) return db;

  const dbPath = getDbPath();
  console.log('[SQLite] Initialization: Inicializando base de datos en:', dbPath);

  try {
    db = new Database(dbPath);
  } catch (error) {
    console.error('[SQLite] Error: Error abriendo base de datos:', error.message);
    console.error('[SQLite] Info: Si ves un error de módulo nativo, ejecuta:');
    console.error('   npx electron-rebuild -f -w better-sqlite3');
    db = null;
    return null;
  }

  // Optimizaciones para rendimiento
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  try {
    runMigrations();
  } catch (migError) {
    console.error('[SQLite] Error: Error en migraciones:', migError.message);
  }

  console.log('[SQLite] Status: Base de datos inicializada correctamente');
  return db;
}

/**
 * Ejecuta las migraciones para crear/actualizar las tablas
 */
function runMigrations() {
  console.log('[SQLite] Action: Ejecutando migraciones...');

  db.exec(`
    -- Cola de registros de asistencia pendientes
    CREATE TABLE IF NOT EXISTS offline_asistencias (
      local_id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      server_id TEXT,
      empleado_id TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida')),
      estado TEXT NOT NULL,
      dispositivo_origen TEXT DEFAULT 'escritorio',
      metodo_registro TEXT NOT NULL CHECK(metodo_registro IN ('PIN', 'HUELLA', 'FACIAL')),
      departamento_id TEXT,
      fecha_registro TEXT NOT NULL,
      payload_biometrico TEXT,
      is_synced INTEGER DEFAULT 0,
      sync_attempts INTEGER DEFAULT 0,
      last_sync_error TEXT,
      last_sync_attempt TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Caché de empleados
    CREATE TABLE IF NOT EXISTS cache_empleados (
      empleado_id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      nombre TEXT NOT NULL,
      usuario TEXT,
      correo TEXT,
      estado_cuenta TEXT NOT NULL DEFAULT 'activo',
      es_empleado INTEGER DEFAULT 1,
      foto TEXT,
      updated_at TEXT NOT NULL
    );

    -- Caché de credenciales para validación offline
    CREATE TABLE IF NOT EXISTS cache_credenciales (
      id TEXT PRIMARY KEY,
      empleado_id TEXT NOT NULL,
      pin_hash TEXT,
      dactilar_template BLOB,
      facial_descriptor BLOB,
      updated_at TEXT NOT NULL
    );

    -- Caché de horarios
    CREATE TABLE IF NOT EXISTS cache_horarios (
      horario_id TEXT PRIMARY KEY,
      empleado_id TEXT NOT NULL,
      configuracion TEXT NOT NULL,
      es_activo INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );


    -- Metadata de sincronización
    CREATE TABLE IF NOT EXISTS sync_metadata (
      tabla TEXT PRIMARY KEY,
      last_full_sync TEXT,
      last_incremental_sync TEXT,
      total_records INTEGER DEFAULT 0
    );

    -- Caché de información de escritorio
    CREATE TABLE IF NOT EXISTS cache_escritorio_info (
      escritorio_id TEXT PRIMARY KEY,
      nombre TEXT,
      dispositivos_biometricos TEXT,
      es_activo INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    -- Caché de dispositivos biométricos registrados
    CREATE TABLE IF NOT EXISTS cache_biometricos (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      tipo TEXT,
      device_id TEXT,
      estado TEXT,
      es_activo INTEGER DEFAULT 1,
      escritorio_id TEXT,
      updated_at TEXT NOT NULL
    );

    -- Índices para rendimiento
    CREATE INDEX IF NOT EXISTS idx_offline_asistencias_synced
      ON offline_asistencias(is_synced);
    CREATE INDEX IF NOT EXISTS idx_offline_asistencias_empleado
      ON offline_asistencias(empleado_id, fecha_registro);
    CREATE INDEX IF NOT EXISTS idx_cache_credenciales_empleado
      ON cache_credenciales(empleado_id);
    CREATE INDEX IF NOT EXISTS idx_cache_horarios_empleado
      ON cache_horarios(empleado_id);
    CREATE INDEX IF NOT EXISTS idx_cache_biometricos_escritorio
      ON cache_biometricos(escritorio_id);
  `);

  // Inicializar sync_metadata si están vacías
  const initMeta = db.prepare(`
    INSERT OR IGNORE INTO sync_metadata (tabla) VALUES (?)
  `);
  const tables = ['cache_empleados', 'cache_credenciales', 'cache_horarios', 'cache_escritorio_info', 'cache_biometricos'];
  for (const t of tables) {
    initMeta.run(t);
  }

  // Migración: agregar columnas usuario y correo si no existen
  try {
    const tableInfo = db.prepare("PRAGMA table_info(cache_empleados)").all();
    const columns = tableInfo.map(col => col.name);
    if (!columns.includes('usuario')) {
      db.exec("ALTER TABLE cache_empleados ADD COLUMN usuario TEXT");
      console.log('[SQLite] Action: Migracion - columna "usuario" agregada a cache_empleados');
    }
    if (!columns.includes('correo')) {
      db.exec("ALTER TABLE cache_empleados ADD COLUMN correo TEXT");
      console.log('[SQLite] Action: Migracion - columna "correo" agregada a cache_empleados');
    }
  } catch (alterError) {
    console.warn('[SQLite] Error: Error en migracion de columnas:', alterError.message);
  }

  // Migración: agregar columna prioridad_biometrico a cache_escritorio_info
  try {
    const escInfo = db.prepare("PRAGMA table_info(cache_escritorio_info)").all();
    const escCols = escInfo.map(col => col.name);
    if (!escCols.includes('prioridad_biometrico')) {
      db.exec("ALTER TABLE cache_escritorio_info ADD COLUMN prioridad_biometrico TEXT");
      console.log('[SQLite] Action: Migracion - columna "prioridad_biometrico" agregada a cache_escritorio_info');
    }
  } catch (e) {
    console.warn('[SQLite] Error: Error en migracion de cache_escritorio_info:', e.message);
  }

  // Migración: crear índice UNIQUE para deduplicación por device_id en cache_biometricos
  try {
    const bioInfo = db.prepare("PRAGMA index_list(cache_biometricos)").all();
    const hasUniqueDeviceId = bioInfo.some(idx => idx.name === 'idx_cache_biometricos_device_id_unique');
    if (!hasUniqueDeviceId) {
      // Antes de crear el índice UNIQUE, limpiar duplicados existentes (conservar el más reciente)
      db.exec(`
        DELETE FROM cache_biometricos
        WHERE rowid NOT IN (
          SELECT MAX(rowid)
          FROM cache_biometricos
          WHERE device_id IS NOT NULL AND device_id != ''
          GROUP BY device_id, escritorio_id
        ) AND device_id IS NOT NULL AND device_id != ''
      `);
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_biometricos_device_id_unique
          ON cache_biometricos(device_id, escritorio_id)
          WHERE device_id IS NOT NULL AND device_id != ''
      `);
      console.log('[SQLite] Action: Migracion - índice UNIQUE (device_id, escritorio_id) creado en cache_biometricos');
    }
  } catch (e) {
    console.warn('[SQLite] Error: Error en migracion de cache_biometricos unique device_id:', e.message);
  }

  console.log('[SQLite] Status: Migraciones completadas');
}

// ============================================================
// CRUD — COLA DE ASISTENCIAS OFFLINE
// ============================================================

/**
 * Guarda un registro de asistencia en la cola local
 * @param {Object} data
 * @returns {Object} registro insertado con local_id e idempotency_key
 */
export function saveOfflineAsistencia(data) {
  const idempotencyKey = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO offline_asistencias
      (idempotency_key, empleado_id, tipo, estado, dispositivo_origen, metodo_registro,
       departamento_id, fecha_registro, payload_biometrico)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    idempotencyKey,
    data.empleado_id,
    data.tipo,
    data.estado,
    data.dispositivo_origen || 'escritorio',
    data.metodo_registro,
    data.departamento_id || null,
    data.fecha_registro || new Date().toISOString(),
    data.payload_biometrico ? JSON.stringify(data.payload_biometrico) : null
  );

  console.log(`[SQLite] Action: Asistencia offline guardada - local_id=${result.lastInsertRowid}, key=${idempotencyKey}`);

  return {
    local_id: result.lastInsertRowid,
    idempotency_key: idempotencyKey,
    ...data
  };
}

/**
 * Obtiene todos los registros pendientes de sincronización, ordenados cronológicamente
 * @param {number} limit - máximo de registros (default 50)
 * @returns {Array}
 */
export function getPendingAsistencias(limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM offline_asistencias
    WHERE is_synced = 0
    ORDER BY fecha_registro ASC
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Marca un registro como sincronizado exitosamente
 * @param {number} localId
 * @param {string} serverId - ID asignado por el servidor
 */
export function markAsSynced(localId, serverId) {
  const stmt = db.prepare(`
    UPDATE offline_asistencias
    SET is_synced = 1, server_id = ?, last_sync_attempt = datetime('now', 'localtime')
    WHERE local_id = ?
  `);
  stmt.run(serverId, localId);
}

/**
 * Marca un registro con error de sincronización
 * @param {number} localId
 * @param {string} error - mensaje de error
 * @param {boolean} definitivo - si es un error definitivo (no reintentar)
 */
export function markSyncError(localId, error, definitivo = false) {
  const stmt = db.prepare(`
    UPDATE offline_asistencias
    SET is_synced = CASE WHEN ? = 1 THEN -1 ELSE 0 END,
        sync_attempts = sync_attempts + 1,
        last_sync_error = ?,
        last_sync_attempt = datetime('now', 'localtime')
    WHERE local_id = ?
  `);
  stmt.run(definitivo ? 1 : 0, error, localId);
}

/**
 * Obtiene el conteo de registros pendientes
 * @returns {Object} { pending, errors, synced }
 */
export function getPendingCount() {
  const stmt = db.prepare(`
    SELECT
      SUM(CASE WHEN is_synced = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN is_synced = -1 THEN 1 ELSE 0 END) as errors,
      SUM(CASE WHEN is_synced = 1 THEN 1 ELSE 0 END) as synced
    FROM offline_asistencias
  `);
  const row = stmt.get();
  return {
    pending: row.pending || 0,
    errors: row.errors || 0,
    synced: row.synced || 0
  };
}

/**
 * Obtiene registros de asistencia del día actual para un empleado
 * (usado para calcular entrada/salida offline)
 * @param {string} empleadoId
 * @returns {Array}
 */
export function getRegistrosHoy(empleadoId) {
  const hoy = new Date().toISOString().split('T')[0];
  const stmt = db.prepare(`
    SELECT * FROM offline_asistencias
    WHERE empleado_id = ? AND fecha_registro LIKE ? || '%'
    ORDER BY fecha_registro ASC
  `);
  return stmt.all(empleadoId, hoy);
}

/**
 * Obtiene registros de asistencia offline de un empleado en un rango de fechas
 * @param {string} empleadoId
 * @param {string} fechaInicio - formato YYYY-MM-DD
 * @param {string} fechaFin - formato YYYY-MM-DD
 * @returns {Array}
 */
export function getRegistrosByRange(empleadoId, fechaInicio, fechaFin) {
  const stmt = db.prepare(`
    SELECT * FROM offline_asistencias
    WHERE empleado_id = ?
      AND fecha_registro >= ?
      AND fecha_registro < date(?, '+1 day')
    ORDER BY fecha_registro DESC
  `);
  return stmt.all(empleadoId, fechaInicio, fechaFin);
}

/**
 * Obtiene registros con error definitivo para revisión administrativa
 * @returns {Array}
 */
export function getErrorRecords() {
  const stmt = db.prepare(`
    SELECT * FROM offline_asistencias
    WHERE is_synced = -1
    ORDER BY fecha_registro ASC
  `);
  return stmt.all();
}

// ============================================================
// CRUD — CACHÉ DE DATOS MAESTROS
// ============================================================

/**
 * Upsert masivo de empleados desde el servidor
 * @param {Array} empleados - lista de empleados del servidor
 */
export function upsertEmpleados(empleados) {
  const stmt = db.prepare(`
    INSERT INTO cache_empleados (empleado_id, usuario_id, nombre, usuario, correo, estado_cuenta, es_empleado, foto, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(empleado_id) DO UPDATE SET
      usuario_id = excluded.usuario_id,
      nombre = excluded.nombre,
      usuario = excluded.usuario,
      correo = excluded.correo,
      estado_cuenta = excluded.estado_cuenta,
      es_empleado = excluded.es_empleado,
      foto = excluded.foto,
      updated_at = excluded.updated_at
  `);

  const upsertMany = db.transaction((items) => {
    for (const emp of items) {
      stmt.run(
        emp.empleado_id || emp.id,
        emp.usuario_id,
        emp.nombre,
        emp.usuario || null,
        emp.correo || null,
        emp.estado_cuenta || 'activo',
        emp.es_empleado ? 1 : 0,
        emp.foto || null
      );
    }
  });

  upsertMany(empleados);
  updateMetaCount('cache_empleados');
  console.log(`[SQLite] Status: ${empleados.length} empleados cacheados`);
}

/**
 * Upsert masivo de credenciales
 * @param {Array} credenciales
 */
export function upsertCredenciales(credenciales) {
  const stmt = db.prepare(`
    INSERT INTO cache_credenciales (id, empleado_id, pin_hash, dactilar_template, facial_descriptor, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(id) DO UPDATE SET
      empleado_id = excluded.empleado_id,
      pin_hash = excluded.pin_hash,
      dactilar_template = excluded.dactilar_template,
      facial_descriptor = excluded.facial_descriptor,
      updated_at = excluded.updated_at
  `);

  const upsertMany = db.transaction((items) => {
    for (const cred of items) {
      // Serializar campos que puedan ser objetos (defensivo)
      let dactilar = cred.dactilar_template || cred.dactilar || null;
      let facial = cred.facial_descriptor || cred.facial || null;
      if (dactilar && typeof dactilar === 'object') {
        dactilar = JSON.stringify(dactilar);
      }
      if (facial && typeof facial === 'object') {
        facial = JSON.stringify(facial);
      }

      stmt.run(
        cred.id,
        cred.empleado_id,
        cred.pin_hash || cred.pin || null,
        dactilar,
        facial
      );
    }
  });

  upsertMany(credenciales);
  updateMetaCount('cache_credenciales');
  console.log(`[SQLite] Status: ${credenciales.length} credenciales cacheadas`);
}

/**
 * Upsert de horario para un empleado
 * @param {string} empleadoId
 * @param {Object} horario
 */
export function upsertHorario(empleadoId, horario) {
  const stmt = db.prepare(`
    INSERT INTO cache_horarios (horario_id, empleado_id, configuracion, es_activo, updated_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(horario_id) DO UPDATE SET
      empleado_id = excluded.empleado_id,
      configuracion = excluded.configuracion,
      es_activo = excluded.es_activo,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    horario.id || horario.horario_id,
    empleadoId,
    typeof horario.configuracion === 'string' ? horario.configuracion : JSON.stringify(horario.configuracion),
    horario.es_activo ? 1 : 0
  );
}


// ============================================================
// LECTURAS — Para autenticación y lógica offline
// ============================================================

/**
 * Obtiene un empleado por su ID desde la caché
 * @param {string} empleadoId
 * @returns {Object|undefined}
 */
export function getEmpleado(empleadoId) {
  const stmt = db.prepare('SELECT * FROM cache_empleados WHERE empleado_id = ? AND estado_cuenta = ?');
  return stmt.get(empleadoId, 'activo');
}

/**
 * Obtiene TODOS los empleados activos desde la caché
 * @returns {Array}
 */
export function getAllEmpleados() {
  if (!db) return [];
  const stmt = db.prepare("SELECT * FROM cache_empleados WHERE estado_cuenta = 'activo'");
  return stmt.all();
}

/**
 * Obtiene las credenciales de un empleado
 * @param {string} empleadoId
 * @returns {Object|undefined}
 */
export function getCredenciales(empleadoId) {
  const stmt = db.prepare('SELECT * FROM cache_credenciales WHERE empleado_id = ?');
  return stmt.get(empleadoId);
}

/**
 * Obtiene TODAS las credenciales (para matching 1:N offline)
 * @returns {Array}
 */
export function getAllCredenciales() {
  const stmt = db.prepare(`
    SELECT cc.*, ce.nombre, ce.estado_cuenta
    FROM cache_credenciales cc
    INNER JOIN cache_empleados ce ON ce.empleado_id = cc.empleado_id
    WHERE ce.estado_cuenta = 'activo'
  `);
  return stmt.all();
}

/**
 * Obtiene el horario activo de un empleado
 * @param {string} empleadoId
 * @returns {Object|undefined}
 */
export function getHorario(empleadoId) {
  const stmt = db.prepare('SELECT * FROM cache_horarios WHERE empleado_id = ? AND es_activo = 1');
  const row = stmt.get(empleadoId);
  if (row && row.configuracion) {
    try {
      row.configuracion = JSON.parse(row.configuracion);
    } catch (e) {
      // Ya es un objeto
    }
  }
  return row;
}


/**
 * Obtiene la información cacheada de un escritorio
 * @param {string} escritorioId
 * @returns {Object|undefined}
 */
export function getEscritorioInfo(escritorioId) {
  if (!db) return null;
  const stmt = db.prepare('SELECT * FROM cache_escritorio_info WHERE escritorio_id = ? AND es_activo = 1');
  const row = stmt.get(escritorioId);
  if (row && row.dispositivos_biometricos) {
    try { row.dispositivos_biometricos = JSON.parse(row.dispositivos_biometricos); } catch (e) { }
  }
  if (row && row.prioridad_biometrico) {
    try { row.prioridad_biometrico = JSON.parse(row.prioridad_biometrico); } catch (e) { }
  }
  return row;
}

/**
 * Obtiene los dispositivos biométricos registrados para un escritorio
 * @param {string} escritorioId
 * @returns {Array}
 */
export function getBiometricosRegistrados(escritorioId) {
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM cache_biometricos WHERE escritorio_id = ? AND es_activo = 1');
  return stmt.all(escritorioId);
}

// ============================================================
// METADATA DE SINCRONIZACIÓN
// ============================================================

/**
 * Actualiza el conteo de registros de una tabla
 * @param {string} tabla
 */
function updateMetaCount(tabla) {
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM ${tabla}`);
  const count = countStmt.get().count;
  const updateStmt = db.prepare('UPDATE sync_metadata SET total_records = ? WHERE tabla = ?');
  updateStmt.run(count, tabla);
}

/**
 * Registra el timestamp de un full sync
 * @param {string} tabla
 */
export function setLastFullSync(tabla) {
  const stmt = db.prepare(`
    UPDATE sync_metadata SET last_full_sync = datetime('now', 'localtime') WHERE tabla = ?
  `);
  stmt.run(tabla);
}

/**
 * Registra el timestamp de un sync incremental
 * @param {string} tabla
 */
export function setLastIncrementalSync(tabla) {
  const stmt = db.prepare(`
    UPDATE sync_metadata SET last_incremental_sync = datetime('now', 'localtime') WHERE tabla = ?
  `);
  stmt.run(tabla);
}

/**
 * Obtiene metadata de sync
 * @param {string} tabla
 * @returns {Object|undefined}
 */
export function getSyncMetadata(tabla) {
  const stmt = db.prepare('SELECT * FROM sync_metadata WHERE tabla = ?');
  return stmt.get(tabla);
}

/**
 * Obtiene toda la metadata de sincronización
 * @returns {Array}
 */
export function getAllSyncMetadata() {
  const stmt = db.prepare('SELECT * FROM sync_metadata');
  return stmt.all();
}

/**
 * Actualiza todos los datos de referencia en una sola transacción.
 * Evita errores de "database is locked" al consolidar múltiples escrituras.
 * @param {Object} data - { empleados, horarios, credenciales }
 */
export function setReferenciaData(data) {
  if (!db) return;

  const { empleados = [], horarios = [], credenciales = [], escritorios = [], biometricos = [] } = data;

  // Statements preparados para cada tabla
  const empStmt = db.prepare(`
    INSERT INTO cache_empleados (empleado_id, usuario_id, nombre, usuario, correo, estado_cuenta, es_empleado, foto, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(empleado_id) DO UPDATE SET
      usuario_id = excluded.usuario_id,
      nombre = excluded.nombre,
      usuario = excluded.usuario,
      correo = excluded.correo,
      estado_cuenta = excluded.estado_cuenta,
      es_empleado = excluded.es_empleado,
      foto = excluded.foto,
      updated_at = excluded.updated_at
  `);

  const credStmt = db.prepare(`
    INSERT INTO cache_credenciales (id, empleado_id, pin_hash, dactilar_template, facial_descriptor, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(id) DO UPDATE SET
      empleado_id = excluded.empleado_id,
      pin_hash = excluded.pin_hash,
      dactilar_template = excluded.dactilar_template,
      facial_descriptor = excluded.facial_descriptor,
      updated_at = excluded.updated_at
  `);

  const horStmt = db.prepare(`
    INSERT INTO cache_horarios (horario_id, empleado_id, configuracion, es_activo, updated_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(horario_id) DO UPDATE SET
      empleado_id = excluded.empleado_id,
      configuracion = excluded.configuracion,
      es_activo = excluded.es_activo,
      updated_at = excluded.updated_at
  `);

  const transaction = db.transaction(() => {
    // 1. Empleados
    for (const emp of empleados) {
      empStmt.run(
        emp.id || emp.empleado_id,
        emp.usuario_id,
        emp.nombre,
        emp.usuario || null,
        emp.correo || null,
        emp.es_activo ? 'activo' : 'inactivo',
        1, // es_empleado
        emp.foto || null
      );
    }

    // 2. Credenciales (Asegurar 1:1 con el empleado y estabilidad en el PK)
    for (const cred of credenciales) {
      let facial = cred.facial || cred.facial_descriptor || null;
      if (facial && typeof facial === 'object') {
        facial = JSON.stringify(facial);
      }

      let dactilar = cred.dactilar || cred.dactilar_template || null;
      // better-sqlite3 maneja Buffers automáticamente como BLOB, 
      // pero si viene como objeto stringificado o array, lo normalizamos
      if (dactilar && typeof dactilar === 'object' && !Buffer.isBuffer(dactilar)) {
        dactilar = JSON.stringify(dactilar);
      }

      credStmt.run(
        `C_${cred.empleado_id}`, // ID estable por empleado
        cred.empleado_id,
        cred.pin || null,
        dactilar,
        facial
      );
    }

    // 3. Horarios (Asignar configuración a cada empleado para permitir búsqueda por empleado_id)
    const configsMap = new Map();
    for (const h of horarios) {
      configsMap.set(h.id || h.horario_id, h);
    }

    for (const emp of empleados) {
      const hId = emp.horario_id;
      if (hId && configsMap.has(hId)) {
        const config = configsMap.get(hId);
        horStmt.run(
          `H_${emp.id}`, // Horario ID único por empleado para evitar colisiones en el PK
          emp.id || emp.empleado_id,
          typeof config.configuracion === 'string' ? config.configuracion : JSON.stringify(config.configuracion),
          config.es_activo ? 1 : 0
        );
      }
    }

    // 4. Limpiar empleados eliminados (si es sync completo)
    const serverIds = empleados.map(e => e.id || e.empleado_id);
    if (serverIds.length > 0) {
      const placeholders = serverIds.map(() => '?').join(',');
      db.prepare(`
        UPDATE cache_empleados
        SET estado_cuenta = 'eliminado', updated_at = datetime('now', 'localtime')
        WHERE empleado_id NOT IN (${placeholders}) AND estado_cuenta != 'eliminado'
      `).run(...serverIds);
    }

    // 5. Escritorios
    const escStmt = db.prepare(`
      INSERT INTO cache_escritorio_info (escritorio_id, nombre, dispositivos_biometricos, prioridad_biometrico, es_activo, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(escritorio_id) DO UPDATE SET
        nombre = excluded.nombre,
        dispositivos_biometricos = excluded.dispositivos_biometricos,
        prioridad_biometrico = excluded.prioridad_biometrico,
        es_activo = excluded.es_activo,
        updated_at = excluded.updated_at
    `);
    for (const esc of escritorios) {
      const bioJson = esc.dispositivos_biometricos
        ? (typeof esc.dispositivos_biometricos === 'string'
          ? esc.dispositivos_biometricos
          : JSON.stringify(esc.dispositivos_biometricos))
        : null;
      const prioJson = esc.prioridad_biometrico
        ? (typeof esc.prioridad_biometrico === 'string'
          ? esc.prioridad_biometrico
          : JSON.stringify(esc.prioridad_biometrico))
        : null;
      escStmt.run(esc.id, esc.nombre, bioJson, prioJson, esc.es_activo ? 1 : 0);
    }

    // 6. Biométricos (con deduplicación por device_id)
    const seenBios = new Map();
    for (const b of biometricos) {
      const key = `${b.device_id || ''}::${b.escritorio_id || ''}`;
      if (!b.device_id || b.device_id.trim() === '') {
        // Si no tiene device_id, usar su ID como clave para no considerarlo duplicado
        seenBios.set(b.id, b);
      } else if (!seenBios.has(key)) {
        seenBios.set(key, b);
      } else {
        console.warn(`[SQLite] Info: Duplicado ignorado en pull: device_id=${b.device_id} ya existe en este lote`);
      }
    }

    const bioStmt = db.prepare(`
      INSERT INTO cache_biometricos (id, nombre, tipo, device_id, estado, es_activo, escritorio_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(id) DO UPDATE SET
        nombre = excluded.nombre,
        tipo = excluded.tipo,
        device_id = excluded.device_id,
        estado = excluded.estado,
        es_activo = excluded.es_activo,
        escritorio_id = excluded.escritorio_id,
        updated_at = excluded.updated_at
      ON CONFLICT(device_id, escritorio_id) WHERE device_id IS NOT NULL AND device_id != '' DO UPDATE SET
        nombre = excluded.nombre,
        tipo = excluded.tipo,
        estado = excluded.estado,
        es_activo = excluded.es_activo,
        updated_at = excluded.updated_at
    `);
    
    for (const b of [...seenBios.values()]) {
      bioStmt.run(b.id, b.nombre, b.tipo, b.device_id || null, b.estado, b.es_activo ? 1 : 0, b.escritorio_id);
    }

    // 7. Actualizar metadata
    const now = new Date().toISOString();
    db.prepare("UPDATE sync_metadata SET last_full_sync = ? WHERE tabla = ?")
      .run(now, 'cache_empleados');
    db.prepare("UPDATE sync_metadata SET last_full_sync = ? WHERE tabla = ?")
      .run(now, 'cache_credenciales');
    db.prepare("UPDATE sync_metadata SET last_full_sync = ? WHERE tabla = ?")
      .run(now, 'cache_horarios');
    db.prepare("UPDATE sync_metadata SET last_full_sync = ? WHERE tabla = ?")
      .run(now, 'cache_escritorio_info');
    db.prepare("UPDATE sync_metadata SET last_full_sync = ? WHERE tabla = ?")
      .run(now, 'cache_biometricos');
  });

  transaction();

  // Actualizar conteos
  updateMetaCount('cache_empleados');
  updateMetaCount('cache_credenciales');
  updateMetaCount('cache_horarios');
  updateMetaCount('cache_escritorio_info');
  updateMetaCount('cache_biometricos');

  console.log(`[SQLite] Status: Sincronización masiva completada (${empleados.length} emp, ${credenciales.length} cred, ${horarios.length} hor, ${escritorios.length} esc, ${biometricos.length} bio)`);
}

/**
 * Elimina empleados del caché que ya no existen en el servidor
 * @param {Array} serverIds - IDs de empleados que existen en el servidor
 * @returns {number} cantidad de empleados marcados como eliminados
 */
export function markDeletedEmpleados(serverIds) {
  if (!serverIds || serverIds.length === 0) return 0;

  const placeholders = serverIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    UPDATE cache_empleados
    SET estado_cuenta = 'eliminado', updated_at = datetime('now', 'localtime')
    WHERE empleado_id NOT IN (${placeholders}) AND estado_cuenta != 'eliminado'
  `);
  const result = stmt.run(...serverIds);
  if (result.changes > 0) {
    console.log(`[SQLite] Info: ${result.changes} empleados marcados como eliminados`);
  }
  return result.changes;
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Cierra la conexión a la base de datos
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[SQLite] Status: Base de datos cerrada');
  }
}

/**
 * Obtiene la instancia de la base de datos
 * @returns {Database|null}
 */
export function getDatabase() {
  return db;
}

export default {
  initDatabase,
  closeDatabase,
  getDatabase,
  // Asistencias offline
  saveOfflineAsistencia,
  getPendingAsistencias,
  markAsSynced,
  markSyncError,
  getPendingCount,
  getRegistrosHoy,
  getRegistrosByRange,
  getErrorRecords,
  // Caché de datos maestros
  upsertEmpleados,
  upsertCredenciales,
  upsertHorario,
  markDeletedEmpleados,
  // Lecturas
  getEmpleado,
  getAllEmpleados,
  getCredenciales,
  getAllCredenciales,
  getHorario,
  getEscritorioInfo,
  getBiometricosRegistrados,
  // Sync metadata
  setLastFullSync,
  setLastIncrementalSync,
  getSyncMetadata,
  getAllSyncMetadata,
  setReferenciaData,
};
