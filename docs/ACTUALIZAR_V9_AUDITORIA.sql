-- Ejecutar UNA vez en pgAdmin, Query Tool de base zenkay, antes de arrancar los servidores.
CREATE TABLE IF NOT EXISTS fingerprint_audit (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL,
 student_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('deleted','enrolled')),
 details TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fingerprint_audit_student ON fingerprint_audit(school_id, student_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON fingerprint_audit TO zenkay_app;
