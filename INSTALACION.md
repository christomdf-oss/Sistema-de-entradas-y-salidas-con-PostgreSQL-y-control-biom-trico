# Instalación ZENKAY V9 — PostgreSQL

Esta es una **versión candidata para pruebas**. Lee `MIGRACION_POSTGRESQL.md` antes de instalarla.

- Firebase Authentication: exclusivamente inicio de sesión con Google.
- PostgreSQL local: alumnos, asistencia, permisos, configuración, huellas cifradas y notificaciones.
- `docs/postgres_api.py`: API de los datos, puerto 5050.
- `docs/enroll_gui.py`: ZK9500, puerto 5000.
- Next.js: interfaz web, puerto 9002.

**No uses los scripts antiguos** `docs/scripts/setup_admin.py` ni `docs/scripts/migrate_legacy.py`.

No borres Firestore ni las copias de la versión 8.3 durante la migración.
