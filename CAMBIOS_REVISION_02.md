# Revisión 02 — primer cambio funcional

## Implementado
- Registro de alumnos con campos opcionales; al menos uno debe contener información.
- Correo opcional, validado si se introduce.
- Matrícula opcional: Firestore genera un identificador de documento cuando falta.
- Edición usa el ID real del documento, no la matrícula.
- La lista deja de ocultar alumnos sin nombre o matrícula.

## Pendiente antes de producción
- Adaptar todos los componentes, tablas, búsquedas y scripts biométricos a IDs internos.
- Implementar importación Excel con previsualización, deduplicación y manejo de errores.
- Revisar reglas Firestore y autenticación antes de utilizar datos reales.
- Corregir el lector, las notificaciones y el flujo de asistencias.
- Ejecutar pruebas de compilación y de integración; estos cambios aún no están probados.

No se han modificado datos de Firebase ni publicado cambios en GitHub.
