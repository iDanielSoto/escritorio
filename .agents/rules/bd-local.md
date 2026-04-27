---
trigger: always_on
---

Este es el esquema de la base de datos offline del sistema: 
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "cache_biometricos" (
	"id"	TEXT,
	"nombre"	TEXT,
	"tipo"	TEXT,
	"device_id"	TEXT,
	"estado"	TEXT,
	"es_activo"	INTEGER DEFAULT 1,
	"escritorio_id"	TEXT,
	"updated_at"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "cache_credenciales" (
	"id"	TEXT,
	"empleado_id"	TEXT NOT NULL,
	"pin_hash"	TEXT,
	"dactilar_template"	BLOB,
	"facial_descriptor"	BLOB,
	"updated_at"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "cache_empleados" (
	"empleado_id"	TEXT,
	"usuario_id"	TEXT NOT NULL,
	"nombre"	TEXT NOT NULL,
	"usuario"	TEXT,
	"correo"	TEXT,
	"estado_cuenta"	TEXT NOT NULL DEFAULT 'activo',
	"es_empleado"	INTEGER DEFAULT 1,
	"foto"	TEXT,
	"updated_at"	TEXT NOT NULL,
	PRIMARY KEY("empleado_id")
);
CREATE TABLE IF NOT EXISTS "cache_escritorio_info" (
	"escritorio_id"	TEXT,
	"nombre"	TEXT,
	"dispositivos_biometricos"	TEXT,
	"es_activo"	INTEGER DEFAULT 1,
	"updated_at"	TEXT NOT NULL,
	"prioridad_biometrico"	TEXT,
	PRIMARY KEY("escritorio_id")
);
CREATE TABLE IF NOT EXISTS "cache_horarios" (
	"horario_id"	TEXT,
	"empleado_id"	TEXT NOT NULL,
	"configuracion"	TEXT NOT NULL,
	"es_activo"	INTEGER DEFAULT 1,
	"updated_at"	TEXT NOT NULL,
	PRIMARY KEY("horario_id")
);
CREATE TABLE IF NOT EXISTS "offline_asistencias" (
	"local_id"	INTEGER,
	"idempotency_key"	TEXT NOT NULL UNIQUE,
	"server_id"	TEXT,
	"empleado_id"	TEXT NOT NULL,
	"tipo"	TEXT NOT NULL CHECK("tipo" IN ('entrada', 'salida')),
	"estado"	TEXT NOT NULL,
	"dispositivo_origen"	TEXT DEFAULT 'escritorio',
	"metodo_registro"	TEXT NOT NULL CHECK("metodo_registro" IN ('PIN', 'HUELLA', 'FACIAL')),
	"departamento_id"	TEXT,
	"fecha_registro"	TEXT NOT NULL,
	"payload_biometrico"	TEXT,
	"is_synced"	INTEGER DEFAULT 0,
	"sync_attempts"	INTEGER DEFAULT 0,
	"last_sync_error"	TEXT,
	"last_sync_attempt"	TEXT,
	"created_at"	TEXT DEFAULT (datetime('now', 'localtime')),
	PRIMARY KEY("local_id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "offline_raw_punches" (
	"id"	TEXT,
	"empleado_id"	TEXT NOT NULL,
	"metodo"	TEXT NOT NULL,
	"fecha_captura"	TEXT NOT NULL,
	"sincronizado"	INTEGER DEFAULT 0,
	"intentos"	INTEGER DEFAULT 0,
	"error"	TEXT,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "sync_metadata" (
	"tabla"	TEXT,
	"last_full_sync"	TEXT,
	"last_incremental_sync"	TEXT,
	"total_records"	INTEGER DEFAULT 0,
	PRIMARY KEY("tabla")
);
