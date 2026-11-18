# ZENKAY V9 — Sistema de Entradas y Salidas

Esta versión reemplaza Firestore por PostgreSQL para los datos escolares; **Firebase Authentication solo se mantiene para iniciar sesión con Google**. Conserva las funciones de alumnos, huellas, asistencia, reportes, configuración, roles y notificaciones por Gmail. Modo manual simplificado: buscar nombre/matrícula, pulsar Entrada o Salida.

Ver [MIGRACION_POSTGRESQL.md](MIGRACION_POSTGRESQL.md) para instalar y migrar de forma segura. No instales sobre la versión 8.3 sin respaldo.

**Estado:** código migrado, pendiente de prueba real en Windows con PostgreSQL y ZK9500. No se incluyen claves, bases privadas ni dependencias.
