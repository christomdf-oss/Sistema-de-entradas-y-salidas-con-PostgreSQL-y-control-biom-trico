-- ZENKAY / PostgreSQL. Ejecutar en una base vacía y privada.
-- Usar cuentas SQL distintas de las cuentas Google. No exponer puerto 5432 a Internet.
CREATE TABLE IF NOT EXISTS users (
 uid TEXT PRIMARY KEY,
 school_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','staff')),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS students (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL,
 matricula TEXT NOT NULL DEFAULT '',
 nombre TEXT NOT NULL,
 telefono_tutor TEXT NOT NULL DEFAULT '',
 correo_tutor TEXT NOT NULL DEFAULT '',
 grupo TEXT NOT NULL DEFAULT '',
 comunidad TEXT NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 enrollment_status TEXT NOT NULL DEFAULT 'pending',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_students_school_updated ON students(school_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_students_matricula ON students(school_id, matricula);
CREATE TABLE IF NOT EXISTS fingerprints (
 student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE RESTRICT,
 school_id TEXT NOT NULL,
 template_ciphertext BYTEA NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fingerprints_school_updated ON fingerprints(school_id, updated_at);
-- Auditoría sin guardar imágenes, templates ni datos biométricos sensibles.
CREATE TABLE IF NOT EXISTS fingerprint_audit (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL,
 student_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('deleted','enrolled')),
 details TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fingerprint_audit_student ON fingerprint_audit(school_id, student_id, created_at DESC);
CREATE TABLE IF NOT EXISTS attendance (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL,
 student_id TEXT NOT NULL,
 student_name TEXT NOT NULL,
 timestamp TIMESTAMPTZ NOT NULL,
 local_date DATE NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('entrada','salida','justificacion','permiso')),
 is_manual BOOLEAN NOT NULL DEFAULT FALSE,
 reason TEXT,
 voided BOOLEAN NOT NULL DEFAULT FALSE,
 void_reason TEXT,
 voided_by TEXT,
 voided_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_att_school_date ON attendance(school_id, local_date, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_att_school_student ON attendance(school_id, student_id, timestamp DESC);
CREATE TABLE IF NOT EXISTS communities (school_id TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY (school_id,name));
CREATE TABLE IF NOT EXISTS settings (school_id TEXT NOT NULL, key TEXT NOT NULL,
 payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(school_id,key));
CREATE TABLE IF NOT EXISTS email_outbox (
 id TEXT PRIMARY KEY, recipient TEXT NOT NULL, student_name TEXT NOT NULL,
 kind TEXT NOT NULL, attempts INT NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_error TEXT
);
-- Restricciones de acceso: nunca publicar esta base ni utilizar un usuario superadministrador en la app.
