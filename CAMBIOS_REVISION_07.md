# COBACAM — Revisión 07 (candidato para validación)

Basada estrictamente en Revisión 06: conserva diseño, correos biométricos, SDK ZK9500, roles y componentes de anulación.

## Cambios
- **Pruebas:** el botón Borrar datos de prueba elimina documentos de alumnos, plantillas y asistencias del plantel del proyecto Firebase de pruebas `campuscheck-copia-640387-b1383`. Antes, solo marcaba `active:false`.
- **Alumno individual:** en el mismo proyecto de pruebas, lo desactiva primero y elimina sus movimientos, su huella y su documento. En otros proyectos la opción conserva una baja lógica para proteger el historial escolar.
- **Reglas Firestore:** permite eliminación por administradores de alumnos y asistencias; el frontend restringe la limpieza irreversible al proyecto de pruebas. ADVERTENCIA: un administrador con un cliente propio y permisos válidos también podría borrar documentos si se publican estas reglas en producción. Antes del despliegue real deben endurecerse las reglas o delegar el borrado a un backend seguro.
- **Asistencia:** suscripción a asistencias únicamente del mes seleccionado, en vez de toda la historia. Excel mensual sigue usando el mes consultado.
- **Registro Manual:** consulta solo asistencias del día, excluye movimientos anulados y alumnos inactivos; anula movimientos manuales de forma auditable en vez de intentar un borrado que las reglas bloqueaban.
- **Reportes:** la búsqueda no descarga todas las asistencias al entrar. Al elegir un alumno solo lee sus movimientos (con índice `studentId`). Los totales de faltas/tasa en el Excel personal se indican como no calculables sin calendario escolar; la lista de ausentes se mantiene en Asistencia.
- **Panel de Control:** oculta eventos de alumnos inactivos además de los anulados.

## Límites y precauciones importantes
- Borrar alumnos/asistencias es irreversible en el proyecto de pruebas. Nunca ejecutar mientras el lector está tomando huellas, y después usar el botón de sincronizar antes de nuevas entradas.
- Firestore cuenta las lecturas y eliminaciones necesarias para limpiar documentos. La eliminación no es atómica cuando abarca varios lotes: si falla, repetir y verificar las colecciones.
- No se borran automáticamente colecciones antiguas fuera de `schools/plantel-10-chicbul`, ni subcolecciones desconocidas bajo cada alumno. No borrarlas sin inventario.
- No es una versión certificada para producción. Es imprescindible ejecutar pruebas integradas, comprobar reglas publicadas y respaldos, sensor real, SMTP y Firebase de nube.
- El ZIP no contiene credenciales reales. Mantener `.env.local`, `docs/.env` y `docs/serviceAccountKey.json` en el equipo de despliegue, nunca enviarlos por chat.
