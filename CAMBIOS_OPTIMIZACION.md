# COBACAM — ajustes sobre Revisión 05 (pruebas)

Se conservaron los cambios del usuario:
- `src/app/attendance/attendance-movements.tsx`: anulación sin motivo manual; se guarda `Corrección administrativa`.
- `src/app/students/data-table.tsx`: identificador estable con ID del documento, no matrícula.
- `src/app/students/page.tsx`: versión proporcionada por el usuario con Reiniciar alumnos, importación y comunidades.
- `docs/enroll_gui.py`: correo limpio sin imágenes, más caché breve de permisos y sincronización biométrica menos frecuente.

Cambios adicionales:
- `src/app/page.tsx`: el dashboard escucha solo los movimientos del día actual y oculta los anulados al instante, en lugar de consultar la colección completa de asistencias al abrirse.
- `docs/enroll_gui.py`: `FINGERPRINT_SYNC_SECONDS` tiene un mínimo de 900 segundos. No elimina la verificación activa del alumno y plantilla contra Firestore en cada evento reconocido.

Pendientes por validar antes de producción:
- Revisar `src/app/attendance/page.tsx`: aún escucha toda la colección de asistencias para el calendario y exportaciones; implementar carga por mes sin perder informes históricos.
- Revisar reportes: actualmente puede descargar toda la asistencia; conviene consultar por alumno/fechas bajo demanda.
- Probar físicamente el ZK9500 y las revocaciones/bajas de alumno. No probado aquí.
- La cuota gratuita agotada no se restablece por instalar esta versión. Medir lecturas en Firestore tras el siguiente restablecimiento.
- Cambio de roles y revocación pueden propagarse con un retraso de hasta 60 segundos por la caché; operaciones de alto privilegio deben comprobarse especialmente antes de producción.
- El dashboard utiliza el día del navegador en el montaje; si queda abierto al cambiar de día, es necesario recargarlo.

No hay contraseñas, cuentas de servicio ni datos reales de alumnos en este ZIP. Conservar copia de la instalación actual.
