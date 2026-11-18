# ZENKAY — Revisión 03: módulos y tabla

## Cambios
- La tabla de Alumnos ahora utiliza el ID interno de Firestore como identificador de fila. Soluciona la advertencia de React por claves duplicadas cuando el Excel contiene matrículas vacías.
- El apartado Asistencia queda para consultar el calendario, listas y exportaciones. Se quitaron el control de entrada/salida y la actividad del lector de esta pantalla.
- Control Biométrico muestra botones para activar entrada, salida y detener, y una lista de mensajes en tiempo real de Socket.IO: asistencia registrada, huella desconocida o errores.
- El catálogo de Comunidades ahora se administra con un botón dentro de Alumnos; se eliminó la opción del menú lateral y la URL anterior redirige a Alumnos.

## Pendiente de probar en Windows
- Ejecutar `npm run typecheck` y `npm run build` después de instalar dependencias. No se completó la instalación en el entorno donde se preparó esta revisión.
- Probar eventos reales y estado de conexión con el servicio Python y SDK ZK9500; el error anterior `AlgorithmLibraryInitializationError` debe resolverse por separado.
- No usar datos biométricos reales hasta comprobar con alumnos ficticios. Conservar copia de Firebase y del proyecto anterior.

## Cómo instalar encima de tu copia de pruebas
1. Detén Next.js y el servidor Python.
2. Haz copia de tu carpeta ZENKAY actual (que incluye `.env.local`, `docs/.env` y credenciales de prueba).
3. Extrae este ZIP en una carpeta nueva. Copia tus archivos `.env.local`, `docs/.env` y `docs/serviceAccountKey.json` desde la copia de pruebas a la misma ubicación de la nueva carpeta. NO los compartas.
4. Ejecuta `INSTALAR_WINDOWS.bat`, `npm run typecheck` y `iniciar_sistema.bat`.
5. Prueba importación Excel con nombres y matrícula vacía, Asistencia sin controles, Control Biométrico y Comunidades dentro de Alumnos.
