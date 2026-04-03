import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

let db = null;

function getDbPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'checador_offline.db'); // Reusing the same DB file
}

export function initRawQueueDB() {
    if (db) return db;

    const dbPath = getDbPath();
    console.log('[RawQueue] Initialization: Inicializando base de datos en:', dbPath);

    try {
        db = new Database(dbPath);
    } catch (error) {
        console.error('[RawQueue] Error: Error abriendo base de datos:', error.message);
        db = null;
        return null;
    }

    db.pragma('journal_mode = WAL');

    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS offline_raw_punches (
                id TEXT PRIMARY KEY,
                empleado_id TEXT NOT NULL,
                metodo TEXT NOT NULL,
                fecha_captura TEXT NOT NULL,
                sincronizado INTEGER DEFAULT 0,
                intentos INTEGER DEFAULT 0,
                error TEXT
            );
        `);
        console.log('[RawQueue] Status: Tabla offline_raw_punches creada/verificada');
    } catch (migError) {
        console.error('[RawQueue] Error: Error creando tabla:', migError.message);
    }

    return db;
}

export function saveRawPunch(data) {
    if (!db) initRawQueueDB();
    if (!db) throw new Error("Database not initialized");

    const id = uuidv4();
    const stmt = db.prepare(`
        INSERT INTO offline_raw_punches
        (id, empleado_id, metodo, fecha_captura)
        VALUES (?, ?, ?, ?)
    `);

    stmt.run(
        id,
        data.empleado_id,
        data.metodo,
        data.fecha_captura || new Date().toISOString()
    );

    console.log(`[RawQueue] Action: Asistencia raw guardada offline - id=${id}, empleado_id=${data.empleado_id}`);

    return {
        id,
        ...data
    };
}

export function getPendingRawPunches(limit = 50) {
    if (!db) return [];
    const stmt = db.prepare(`
        SELECT * FROM offline_raw_punches
        WHERE sincronizado = 0
        ORDER BY fecha_captura ASC
        LIMIT ?
    `);
    return stmt.all(limit);
}

export function markRawPunchSynced(id) {
    if (!db) return;
    const stmt = db.prepare(`
        UPDATE offline_raw_punches
        SET sincronizado = 1
        WHERE id = ?
    `);
    stmt.run(id);
}

export function markRawPunchError(id, errorStr, definitive = false) {
    if (!db) return;
    const stmt = db.prepare(`
        UPDATE offline_raw_punches
        SET sincronizado = CASE WHEN ? = 1 THEN -1 ELSE 0 END,
            intentos = intentos + 1,
            error = ?
        WHERE id = ?
    `);
    stmt.run(definitive ? 1 : 0, errorStr, id);
}

export function getPendingRawCount() {
    if (!db) return { pending: 0 };
    const stmt = db.prepare(`
        SELECT COUNT(*) as pending FROM offline_raw_punches WHERE sincronizado = 0
    `);
    const row = stmt.get();
    return { pending: row.pending || 0 };
}

export default {
    initRawQueueDB,
    saveRawPunch,
    getPendingRawPunches,
    markRawPunchSynced,
    markRawPunchError,
    getPendingRawCount
};
