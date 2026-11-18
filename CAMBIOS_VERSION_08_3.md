# Versión 8.3 — Optimización de lecturas Firestore y sensor ZK9500

## Qué se corrigió

1. **Alumnos: una descarga completa por sesión web autenticada y pestaña.**
   - `src/components/data/students-provider.tsx`: lectura inicial de `schools/{SCHOOL_ID}/students` una sola vez.
   - Después se escucha únicamente `updatedAt >= comienzo de la sesión` para actualizar localmente solo el documento de un alumno modificado.
   - Los cambios de pantalla reutilizan el mismo proveedor; no generan otra lectura completa.
   - En React desarrollo, descargas iniciales simultáneas del mismo usuario se comparten.
   - Pulsar *Sincronizar* o *Refrescar* consulta solo alumnos modificados desde el comienzo de la sesión; no vuelve a descargar toda la lista. Una nueva pestaña o inicio de sesión sí genera la descarga inicial.
   - La memoria de alumnos existe solo durante esa sesión de la pestaña: no se guardan plantillas biométricas en el navegador.

2. **Asistencias de hoy compartidas en web.**
   - Nuevo `src/components/data/today-attendance-provider.tsx` en el layout autenticado.
   - Panel, gestión de asistencias y registros manuales reutilizan la misma suscripción del día.
   - Durante el día, cada nueva asistencia aparece como cambio individual; cambiar de pantalla no re-descarga los registros de hoy.
   - La suscripción cambia automáticamente al día siguiente.

3. **Pantalla de asistencias: solamente el día seleccionado.**
   - Ya no descarga todo un mes cada vez que se abre la pantalla.
   - Si se selecciona una fecha anterior, escucha únicamente las asistencias de ese día.
   - **Exportar Reporte Mensual** sí descarga el mes completo, pero solamente cuando el usuario lo solicita. Esto puede consumir muchas lecturas con un mes de alto volumen.
   - Los indicadores del calendario muestran únicamente los días ya consultados (no se escanea el mes completo para dibujar puntos).

4. **Backend biométrico: sincronización individual.**
   - `docs/enroll_gui.py`: después de la carga inicial o cuando existe una caché válida, consulta solo documentos modificados (`updatedAt`).
   - Al detectar un solo cambio, aplica `DBAdd`/`DBDel` únicamente a la plantilla afectada en el SDK ZK9500, sin `DBClear` y sin reconstruir las otras 400 huellas.
   - `docs/biometric_cache.py`: SQLite modifica solo los registros locales cambiados mediante `save_changes`; no reescribe toda la caché cifrada.
   - Se retira la conciliación semanal automática que descargaba todo; la descarga completa queda reservada para caché nueva, invalidación especial o sincronización manual del administrador.
   - **Importante:** si se realizan modificaciones directas desde la consola de Firebase sin `updatedAt`, es necesario utilizar la sincronización manual completa del lector.

5. **Borrar y volver a registrar huellas.**
   - Se conserva el flujo de la 8.2 de eliminar la plantilla del SDK y de Firestore y registrar de nuevo el mismo dedo.
   - La sincronización incremental también maneja la baja y el nuevo alta individualmente.

## Lo que no se debe confundir

- Las **lecturas** Firestore no son **huellas registradas** ni ocupación de memoria. Son documentos recuperados, y cuentan para la cuota gratuita diaria.
- Una entrada o salida biométrica válida mantiene dos consultas puntuales de seguridad (perfil del alumno y plantilla), más una escritura de asistencia. Esto evita registrar huellas borradas o alumnos desactivados, incluso si el SDK tenía una plantilla local antigua.
- La web seguirá leyendo documentos necesarios al iniciar la sesión y al ver el día o exportar reportes. La versión 8.3 evita las recargas masivas innecesarias, no promete cero lecturas ni disponibilidad ilimitada.

## Instalación y pruebas

1. Haz un respaldo del proyecto 8.2 y exporta/respalda los datos de Firebase antes de cambiar nada.
2. Cierra la web de Next.js, el modo de asistencia y el proceso Python.
3. Descomprime 8.3. Mantén tu propia configuración local (`.env`, `docs/.env`, `docs/serviceAccountKey.json`) y, si quieres conservar huellas ya descargadas, la carpeta `docs/.private/` del equipo anterior. **La caché DPAPI requiere la misma cuenta de Windows.** No publiques credenciales ni datos de huellas.
4. Inicia el proyecto con tus scripts habituales (por ejemplo `iniciar_sistema.bat`). No es necesario cambiar reglas de Firestore para esta optimización, pero sí mantener las reglas y los permisos de la versión anterior.
5. Inicia sesión con la web, verifica una única carga inicial de alumnos; navega entre panel, alumnos, asistencia, registros manuales. No debe haber nuevas lecturas equivalentes al total de alumnos solo por navegar.
6. Con el lector detenido, borra una huella y regístrala de nuevo; luego prueba una entrada y una salida. Confirma que no aparecen nuevas líneas `Conciliación completa` ante cada acción.
7. En la consola de Firebase, mide las lecturas de estas pruebas, con las otras pestañas y procesos cerrados. Ten presente que el gráfico puede mostrar los datos con retraso.

## Pruebas incluidas

- Ejecuta `python -m unittest discover -s docs/tests -v` desde la raíz del proyecto.
- 14 pruebas unitarias/estáticas aprobaron antes de empaquetar, con un sensor y Firestore simulados. Además se validó la sintaxis de los archivos TypeScript/TSX cambiados.
- **No se han podido ejecutar un build completo de Next.js, pruebas reales con credenciales Firebase ni pruebas físicas con el sensor ZK9500.** Validar en una copia antes de llevar a producción.

## Archivos modificados o añadidos

- `src/components/data/students-provider.tsx`
- `src/components/data/today-attendance-provider.tsx` (nuevo)
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/attendance/page.tsx`
- `src/app/manual-entry/page.tsx`
- `docs/enroll_gui.py`
- `docs/biometric_cache.py`
- `docs/tests/test_v8.py`
- `docs/tests/test_v81_web.py`
- `CAMBIOS_VERSION_08_3.md` (este archivo)
