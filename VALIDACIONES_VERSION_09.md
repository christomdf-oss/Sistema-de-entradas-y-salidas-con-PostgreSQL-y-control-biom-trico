# Validaciones realizadas (ZENKAY V9)

- `python -m compileall -q docs`: **OK** (sintaxis Python).
- Análisis de sintaxis TypeScript/TSX con el parser TypeScript: **85 archivos, 0 errores sintácticos**.
- `python -m unittest discover -s docs/tests -p 'test_v9_local.py' -v`: **3 pruebas superadas**:
  1. Eliminación local de plantilla, reconstrucción y nuevo registro del mismo dedo.
  2. Sincronización de un alumno sin reconstrucción de otras plantillas.
  3. Exclusión de huellas pendientes o de alumnos retirados.
- Búsqueda de llamadas a Firestore en código de interfaz y `docs/enroll_gui.py`: **sin consultas de Firestore**.

**Pendiente/NO verificado en este entorno:**

- PostgreSQL local en ejecución: no hay servidor PostgreSQL ni credenciales de la escuela.
- Compilación real de Next.js (`npm run build`, `npm run typecheck`): la instalación de dependencias `npm ci` no terminó en este entorno; solo se revisó sintaxis.
- Integración real con ZK9500/SDK, eliminación y re-enrolamiento físico: requiere Windows y dispositivo conectado.
- Exportación y migración del Firebase de la escuela: no se ejecutó y el archivo de migración no ha escrito datos.
- Correos Gmail, permisos multicuenta y recuperación de respaldos: requieren configuración y pruebas operativas reales.

**No habilitar producción solo por estas pruebas unitarias.** Seguir `MIGRACION_POSTGRESQL.md` y verificar los procedimientos de aceptación.
