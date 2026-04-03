import Database from 'better-sqlite3';
import { app } from 'electron';
// Note: When running with `electron scripts/inspect_db.js`, `electron` module is available.
// But we might need to wait for app ready or not, usually for main process logic, but for pure node logic it might be fine.
// Actually, `app.getPath` requires app to be ready? No, `userData` is usually available early.
// But let's just hardcode the path for now to be safe, or use `process.env.APPDATA` if needed, but the previous script used a hardcoded path which is fine.

const dbPath = 'C:\\Users\\paulx\\AppData\\Roaming\\sistema-asistencia\\checador_offline.db'; // Adjust path if needed
console.log('Connecting to database:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });

    const tables = ['offline_asistencias', 'cache_empleados', 'cache_credenciales', 'cache_horarios', 'cache_tolerancias', 'cache_roles', 'cache_usuarios_roles', 'cache_departamentos', 'sync_metadata'];

    console.log('--- Database Summary ---');
    for (const table of tables) {
        try {
            const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
            console.log(`${table}: ${count} records`);
        } catch (e) {
            console.log(`${table}: Table not found or error accessing it.`);
        }
    }

    console.log('\n--- Recent Offline Asistencias (Last 5) ---');
    try {
        const recents = db.prepare('SELECT * FROM offline_asistencias ORDER BY created_at DESC LIMIT 5').all();
        console.table(recents);
    } catch (e) {
        console.log('No offline_asistencias found.');
    }

    console.log('\n--- Sync Metadata ---');
    try {
        const metadata = db.prepare('SELECT * FROM sync_metadata').all();
        console.table(metadata);
    } catch (e) {
        console.log('No sync_metadata found.');
    }

} catch (err) {
    console.error('Error opening database:', err.message);
}

// Exit explicitly as electron keeps running
import { exit } from 'process';
exit(0);
