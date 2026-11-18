# COBACAM — Revisión 06

Base: COBACAM-revision-05-optimizada-pruebas.

## Cambios realizados
- `docs/enroll_gui.py`: eliminada la sincronización automática completa de huellas durante el bucle biométrico. Se cargan al iniciar servicio, al activar Entrada/Salida, al registrar huella y desde sincronización administrativa.
- Se conservó `validate_student()` consultando alumno y plantilla en Firestore ANTES de guardar cada asistencia (dos lecturas para cada huella reconocida), bloqueando bajas y cambios incluso si la caché del dispositivo conserva temporalmente la plantilla.
- `src/app/biometrics/page.tsx`: eliminado el bloque de Notificaciones por correo, el campo de pruebas y su consulta de estado. **El envío automático de correos desde Python se conserva.**
- Consultas de estado HTTP del panel reducidas de cada 15 a cada 60 segundos; los eventos Socket.IO siguen llegando en tiempo real.
- Eliminado parámetro `FINGERPRINT_SYNC_SECONDS` sin uso del `.env.example`.

## Se conservó sin cambios
- `attendance-movements.tsx`: confirmación rápida de anulación.
- `students/data-table.tsx`: fila con ID de Firestore.
- `students/page.tsx`: gestión y reinicio de alumnos de prueba.
- El diseño institucional, correo HTML, dashboard y restantes pantallas.

## Precauciones
- Cuando se cambian huellas/alumnos desde otra computadora, se debe activar un modo (que sincroniza) o sincronizar manualmente desde el servicio. Si se borra una huella durante una captura activa, la validación remota la bloquea aunque aún esté en memoria local.
- **No se implementó una eliminación irreversible de historiales:** las bajas siguen siendo lógicas y preservan registros para auditoría.
- Firestore agotado impedirá la sincronización y el registro hasta restablecer la cuota.
- No se ha probado el lector físico ni carga real de 300 alumnos. Revisar las consultas del frontend de Asistencia/Reportes para optimización posterior.
