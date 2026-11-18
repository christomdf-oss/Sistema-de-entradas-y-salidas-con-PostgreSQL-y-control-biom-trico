# ZENKAY — Versión 8.1: menos lecturas al navegar por la web

**Base:** el ZIP de la versión 8 corregida previamente entregada. Cambios en una copia local, sin acceder ni alterar tu Firebase. Se conservan los roles, permisos y funciones existentes.

## Problema observado

Las capturas del usuario mostraron que las lecturas seguían creciendo. Su terminal mostró dos conciliaciones completas: 619 alumnos + 2 huellas, y luego 620 alumnos + 3 huellas. Una conciliación puede ser normal al iniciar desde una caché nueva; otra puede producirse por invalidación después de eliminar datos de prueba, por una orden manual o por el intervalo semanal. Los registros anteriores no indicaban el motivo.

También había cuatro páginas que descargaban de nuevo `schools/{SCHOOL_ID}/students` en cada visita: panel, alumnos, asistencias y reportes, y una quinta para registro manual.

## Cambios de la versión 8.1

1. `src/components/data/students-provider.tsx` (**nuevo**): una sola suscripción `onSnapshot` por sesión autenticada y pestaña. Las páginas reutilizan la lista en memoria. Las novedades de la colección se reciben por la misma escucha, sin volver a solicitar todos los alumnos al navegar de una pantalla a otra.
2. `src/app/layout.tsx`: instala el proveedor de alumnos **dentro** del control de acceso existente, para no suscribirse antes de autorizar al usuario.
3. `src/app/page.tsx`: el tablero deja de llamar a `getDocs(students)`; mantiene su consulta acotada a asistencias del día y los filtros de alumnos activos.
4. `src/app/attendance/page.tsx`: deja de consultar la colección de alumnos por separado; mantiene asistencias del mes seleccionado, ausentes, exportaciones, movimientos y anulación administrativa.
5. `src/app/reports/page.tsx`: deja de consultar a todos los alumnos de nuevo al entrar. Conserva los filtros y consulta el historial del alumno **solo al abrir su reporte**.
6. `src/app/manual-entry/page.tsx`: reutiliza la lista compartida y conserva el historial del día y las operaciones manuales.
7. `src/app/students/page.tsx`: usa la lista compartida, conservando edición, importación, comunidades, huellas y eliminación de pruebas. El botón **Refrescar** hace una consulta explícita únicamente cuando se pulsa.
8. `docs/enroll_gui.py`: informa en el terminal el motivo de cada carga completa: **primera caché**, **sincronización solicitada**, **conciliación semanal** o **invalidación por eliminación definitiva**. No cambia permisos ni valida menos asistencias.

## Qué ahorro es realista

- Con ~620 alumnos, una primera apertura autenticada puede seguir leyendo aproximadamente 620 documentos; es normal y necesaria para la lista completa.
- Navegar del panel a alumnos, asistencias, reportes o registro manual en la misma pestaña **ya no crea por sí solo otras lecturas completas de `students`**. Es la misma suscripción compartida.
- Otros datos siguen teniendo lecturas: asistencias del día/mes, cambios de alumnos, validación biométrica de cada evento, permisos, otras pestañas y reconexiones de Firebase.
- El backend biométrico sigue haciendo dos verificaciones remotas por asistencia válida y puede volver a sincronizar completo por motivos de seguridad.
- **No hay garantía de consumo cero ni de no llegar nunca a la cuota gratuita**. Compara lecturas en el panel de Uso y el terminal durante una prueba controlada.

## Instalación desde V8 sin perder la caché

1. Cierra las dos consolas de la versión anterior (web + ZK9500) y todas las pestañas del sistema. **No uses dos versiones al mismo tiempo**.
2. Haz una copia de seguridad privada. Descomprime este ZIP en **otra carpeta**, sin borrar la versión 8 anterior.
3. Desde tu propia PC copia las configuraciones privadas **que no se incluyen en el ZIP**: `.env.local`, `docs/.env`, `docs/serviceAccountKey.json` y los controladores/DLL que hayas instalado para el ZK9500.
4. Para **evitar otra conciliación inicial completa**, con el servicio **apagado**, copia también `docs/.private/biometrics.sqlite3` (si existe) de V8 a la misma ruta en V8.1 **solo si usas la misma cuenta Windows y el mismo SCHOOL_ID**. Está cifrado con DPAPI; protege esa copia. Si no lo copias, V8.1 descargará los alumnos/huellas una vez para crear su propia caché.
5. En la nueva carpeta ejecuta `INSTALAR_WINDOWS.bat` (necesita Internet), después `PREPARAR_PRODUCCION.bat` y luego `iniciar_sistema.bat`. No copies `node_modules` o `venv` antiguos entre entornos de Python diferentes.
6. Abre `http://localhost:9002`, prueba con 1–3 alumnos ficticios y revisa los mensajes **Sincronización COMPLETA** o **Sincronización INCREMENTAL**. Verifica envío de correo, entrada/salida y ausencia de duplicados.
7. Si todavía no publicaste las reglas de la V8 en tu proyecto de **pruebas**, revisa `LEEME_PRIMERO_VERSION_8.md`. Esta V8.1 no introduce ningún cambio adicional a las reglas.

## Limitaciones de verificación

Las pruebas Python de la versión 8 y la comprobación de sintaxis TypeScript pasan en este entorno. **No se ha compilado el proyecto con `npm ci`/`next build` aquí, ni probado el lector ZK9500, ni se ha conectado Firebase del usuario**. Ejecuta `PREPARAR_PRODUCCION.bat` y las pruebas funcionales en Windows antes de usar datos reales. Una advertencia de Python 3.10 es una recomendación de actualización, no explica las lecturas de Firestore; cambia la versión solo cuando verifiques compatibilidad con SDK y DLL.
