# ZENKAY — Versión 8 (optimización biométrica y de Firestore)

**Partiendo del ZIP original versión 7, sin eliminar funciones ni modificar los roles `admin` y `staff`.** Esta entrega modifica archivos de código en una copia local; **no** accedió a Firebase ni eliminó ningún dato real.

## Cambios implementados

1. `docs/enroll_gui.py`:
   - Sincronización inicial completa de `students` + `fingerprints` (una vez), seguida por consultas incrementales sobre `updatedAt`.
   - Reconciliación completa cada 7 días o manualmente desde el panel. La invalidación explícita `settings/biometricSync.cacheEpoch` también fuerza una carga completa tras borrados definitivos de prueba.
   - `force=False` ahora realmente significa *sincronizar solo cambios* (antes se descargaba todo).
   - El lector conserva su base local y solo reconstruye su DB en memoria si hay cambios. Al enrolar, se actualiza **un único ID de la DB del SDK**, sin llamar a `sync_students(force=True)`.
   - Registro con **4 colocaciones** distintas: se exige levantar el dedo cada vez; `DBMerge` combina las primeras 3 y `DBMatch` comprueba la cuarta. `DBMatch` también rechaza huellas ya asignadas a otro alumno.
   - Un evento biométrico de `entrada` y uno de `salida` como máximo por alumno/día; IDs deterministas + creación condicional evitan duplicados, incluso si se reinicia el programa. Los intentos fallidos no escriben asistencias.
   - Se debe levantar el dedo antes de intentar otra lectura.
   - Se verifica el alumno y **la plantilla** contra Firebase antes de escribir **cada** evento biométrico. Sin conexión o si se desactivó la huella, no hay registro. Por seguridad no se eliminan esas verificaciones puntuales.
   - Bloqueo de reinicio del hilo del sensor hasta que el anterior haya terminado.
   - Cola local persistente para reintentar correos sin perder el registro de asistencia.

2. `docs/biometric_cache.py` (nuevo): caché SQLite local; perfiles/plantillas/correos **cifrados con Windows DPAPI**, vinculados al usuario Windows de la PC. Guardado transaccional; no se exporta dentro del ZIP.
3. `src/app/students/page.tsx`: escucha de alumnos con cambios incrementales; se eliminan recargas masivas automáticas después de cada modificación; altas/importaciones/ediciones/bajas incluyen `updatedAt: serverTimestamp()`. Las bajas y los borrados de huella se sincronizan sin volver a leer todos los registros. Las eliminaciones definitivas de prueba actualizan la marca de invalidación.
4. `src/app/students/enroll-fingerprint-dialog.tsx`: instrucciones de cuatro capturas y advertencia de volver a colocar el dedo.
5. `src/app/biometrics/page.tsx`: botón para que el **administrador** solicite sincronización completa cuando sea necesario, sin habilitar esta función al personal `staff`.
6. `firestore.rules`: **NO se cambiaron los roles ni sus capacidades**. Únicamente se agregó el campo permitido `updatedAt` al esquema de creación de alumnos, necesario para los nuevos registros. Debes publicar esta versión de reglas en el proyecto correcto antes de crear alumnos desde la nueva web.
7. Windows: `iniciar_sistema.bat` inicia Next.js en producción (puerto 9002); `iniciar_desarrollo.bat` mantiene el modo anterior. `PREPARAR_PRODUCCION.bat` compila la web después de configurarla.

## Estimación con 400 alumnos, 80% de asistencia

- Primera carga biométrica: ~400 perfiles + ~400 huellas = ~800 lecturas, más lecturas administrativas y mínimos de consultas.
- Encendido posterior sin cambios: consulta de marca y búsquedas incrementales, **no 800 lecturas por encendido**.
- Asistencias esperadas: 320 entradas + 320 salidas = 640 escrituras/día. El backend mantiene 2 lecturas de verificación por asistencia válida (aprox. 1,280 lecturas/día). A esto se suman panel web, reglas, autenticación, cambios y otras consultas.
- El registro de 400 huellas es una actividad puntual: **4 capturas físicas → 1 plantilla por alumno**; no son 4 documentos.
- El límite gratuito puede seguir alcanzándose si hay mucho uso adicional o configuraciones incorrectas. Verificar mediciones reales en la consola.

## Precauciones y límites conocidos

- **NO probada con lector físico ZK9500** ni contra tu Firebase porque ninguno está conectado a este entorno. Prueba con usuarios ficticios antes de usar huellas de alumnos reales.
- La funcionalidad de `DBMatch`, `DBMerge`, `DBAdd`, `DBDel`, `DBClear` se debe verificar en **tu versión exacta** del SDK de Windows. Si no funciona, no reutilices este ZIP en producción sin ajustes.
- Toda sincronización requiere Internet para validar cambios; **cada asistencia requiere conexión a Firebase** por seguridad (fail closed).
- Ediciones hechas directamente desde Firebase Console que omitan `updatedAt` no aparecen de inmediato en el delta. Se detectan con la sincronización manual/conciliación semanal, pero la verificación remota bloquea mientras tanto huellas borradas o alumnos desactivados.
- La caché DPAPI **solo se puede descifrar con la misma cuenta Windows**. No copies el `.sqlite3` a otra PC ni incluyas `docs/.private/` en respaldos sin protección.
- Los IDs diarios impiden nuevas entradas/salidas biométricas del mismo tipo ese día, incluso si un administrador anuló el documento original. Para corregir una asistencia consulta las herramientas de administración existentes; no borres eventos como solución improvisada.
- Los reintentos SMTP son al menos una vez; si se apaga la PC exactamente después del envío pero antes de guardar el estado, puede repetirse un correo. Revisar registros si ocurre.
- **No se probaron dependencias ni compilación Next.js completas**: `npm ci --offline` falló por paquetes no disponibles en caché y `npm ci` no se completó. Ejecutar `PREPARAR_PRODUCCION.bat` en Windows con Internet.

## Pruebas hechas en este entorno

Se ejecutaron `python -m py_compile` y ocho pruebas unitarias con objetos simulados de Firestore y sensor:
- Caché cifrada y recuperación; aislamiento por plantel.
- Cola local de correo e idempotencia.
- Primera carga de 400 alumnos y dos sincronizaciones posteriores sin volver a descargar 400 documentos.
- Cambio de un perfil sin repetir consultas completas.
- Baja de un alumno y retirada del SDK simulado.
- Prevención de doble asistencia para el mismo alumno/tipo/día.
- Invalidación de caché por borrado definitivo.
- Registro simulado con cuatro colocaciones separadas y una sola alta local de huella.

La batería está en `docs/tests/test_v8.py`; no prueba el hardware ni confirma cuotas reales.
