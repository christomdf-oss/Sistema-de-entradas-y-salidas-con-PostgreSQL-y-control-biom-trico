# COBACAM – Sistema de Entradas y Salidas · Revisión 05

Esta revisión mantiene el diseño institucional rojo de la V04 y se ha realizado sobre su código original.

## Correcciones aplicadas

1. `src/app/attendance/daily-absence-list.tsx`: las filas usan el ID de Firestore, no la matrícula (opcional), eliminando la advertencia de claves duplicadas por matrículas vacías.
2. `src/app/students/page.tsx`: el cuadro de administración de comunidades incluye un título accesible `DialogTitle`, resolviendo la advertencia de Radix UI.
3. `src/app/attendance/page.tsx`: los movimientos se escuchan mediante `onSnapshot`; aparecen actualizaciones de la nube sin recargar. La pestaña **Movimientos** muestra **cada** entrada y salida del día, incluidos registros repetidos y salidas sin entrada. La pestaña Presentes sigue siendo un **resumen** del primer acceso y la última salida de cada alumno.
4. `src/app/attendance/attendance-movements.tsx`: el administrador puede **anular** individualmente un registro explicando el motivo (mínimo 8 caracteres). El registro original no se elimina físicamente y se conserva su traza. **Es obligatorio publicar las nuevas reglas de `firestore.rules` antes de utilizar esta opción**.
5. `docs/enroll_gui.py`: información adicional cuando faltan credenciales SMTP y dos endpoints de administrador: `GET /api/email-status` y `POST /api/test-email`. Estos endpoints requieren sesión válida; el segundo envía un mensaje de prueba al destinatario que indique el administrador.
6. `src/app/biometrics/page.tsx`: panel de estado del correo y envío de prueba, visible únicamente a administradores.

## Qué NO se ha hecho todavía

- **Eliminar todo**: aún no se activó un botón de borrado masivo irreversible. Debe implementarse sobre un respaldo verificable, exclusivamente con rol de administrador, confirmaciones adicionales y protección para no borrar los datos de otros planteles. La baja individual conserva el historial.
- No se ha comprobado el lector ZK9500, el envío SMTP real ni las consultas del Firebase en tu computadora.
- La compilación completa TypeScript (`npm run typecheck`) no ha podido ejecutarse con dependencias completas en este entorno. Se verificó el parseo TSX de los archivos modificados y la sintaxis Python. En Windows instala dependencias y ejecuta ambos `npm run typecheck` y `npm run build`.

## Actualización sin perder el administrador

1. Conserva la carpeta de V04 como respaldo.
2. Descomprime este ZIP en una carpeta NUEVA.
3. Copia desde V04 **únicamente** `.env.local`, `docs/.env` y `docs/serviceAccountKey.json` a sus rutas correspondientes de V05. Nunca publiques estos archivos.
4. Compara y publica `firestore.rules` en el Firebase DE PRUEBAS que estás usando. Sin esas reglas, la acción «Corregir» no funcionará.
5. Ejecuta `INSTALAR_WINDOWS.bat`, luego `iniciar_sistema.bat`.
6. Abre `http://localhost:9002` con tu cuenta actual (no necesitas ejecutar `setup_admin.py` de nuevo).
7. En Control Biométrico, revisa «Notificaciones por correo». Configura `GMAIL_USER` con el Gmail remitente y `GMAIL_APP_PASSWORD` con su **contraseña de aplicación NUEVA de 16 caracteres** en `docs/.env`. Reinicia Python después de cambiarlo. Usa el botón «Enviar correo de prueba».
8. En Asistencia, abre «Movimientos» para ver los registros individuales. Si anulas uno, asegúrate de que refleje el motivo y que ya no cuente en el resumen.

## Diagnóstico sobre entradas y salidas

La versión anterior agrupaba toda la actividad del día en una sola entrada (la más temprana) y una salida (la más tardía) para cada alumno. Eso explicaba por qué Control Biométrico mostraba varias operaciones, pero Asistencia parecía mostrar una sola. V05 mantiene ese resumen y añade un historial completo, independiente, de cada movimiento.

Si el correo de prueba falla: revisa la terminal Python, la configuración Gmail, la verificación en dos pasos y la contraseña de aplicación. No envíes la contraseña por chat ni la subas a GitHub.
