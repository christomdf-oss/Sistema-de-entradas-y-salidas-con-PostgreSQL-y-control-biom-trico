# LEER PRIMERO: ZENKAY Versión 8

## Qué es

Copia independiente de la versión 7, optimizada para **una computadora Windows** con lector **ZK9500**, aproximadamente **400 alumnos** y entrada/salida diariamente. Conserva la web, la administración de alumnos, asistencia manual, reportes, correos y permisos previos.

## Cómo pasar de V7 a V8 SIN perder alumnos ni huellas

1. **Respalda todo lo que tienes en V7**, especialmente los archivos `.env.local`, `docs/.env`, `docs/serviceAccountKey.json`, el SDK/controladores ZKTeco y tus respaldos de Firestore. No envíes las claves por chat.
2. **No borres el proyecto Firebase ni los alumnos**. La V8 usa las mismas rutas de documentos; los 400 alumnos con huellas ya guardadas se cargarán en la primera sincronización sin necesidad de enrolarlos otra vez.
3. Descomprime el ZIP **en una carpeta nueva**; no sobrescribas V7. Instala/valida el driver y las DLL del ZK9500 existentes.
4. Copia a la carpeta nueva **solo desde tu computadora, de forma privada**, tus `.env.local`, `docs/.env` y `docs/serviceAccountKey.json`. Revisa que `NEXT_PUBLIC_SCHOOL_ID` y `SCHOOL_ID` coincidan y que la configuración apunte inicialmente al proyecto **de pruebas**.
5. **Antes de crear o importar alumnos con V8**, publica las reglas incluidas en `firestore.rules` en el proyecto de pruebas correcto; el único ajuste de permiso/esquema es permitir el campo `updatedAt` en las nuevas altas. No se cambió qué puede hacer el administrador ni el personal.
6. Con Node.js LTS y Python 3.10, ejecuta `INSTALAR_WINDOWS.bat` para dependencias. Luego `PREPARAR_PRODUCCION.bat` para compilar Next.js. Si falla, **NO uses la versión en producción**: corrige el error y vuelve a compilar.
7. Ejecuta `iniciar_sistema.bat`. Abre `http://localhost:9002`. Deja de usar V7 en paralelo para no competir por el mismo sensor ni generar movimientos de prueba en dos servicios.
8. En **Control Biométrico**, verifica el número de huellas. Si falta alguna, con la captura detenida y desde la cuenta administrador pulsa **Sincronizar todas las huellas**.
9. Con **1–3 alumnos de prueba**, realiza 4 capturas separadas por levantadas de dedo; prueba entrada, segundo intento (no duplicar), salida, envío de correo y baja de huella. Comprueba el consumo real de Firestore. Solo después considera migrar a la PC definitiva.
10. Para producción, aplica una política de respaldos de Firestore, protección de datos biométricos, acceso físico a la computadora y recuperación ante fallos; consulta la dirección del plantel antes de usar datos reales.

## Cambios de uso

- **Primera carga:** descarga todas las huellas activas de Firestore (normal).
- **Días posteriores:** consulta qué cambió; no vuelve a descargar todas salvo conciliación semanal, cambio de borrado definitivo en pruebas o sincronización manual.
- **Registro individual:** 4 colocaciones del MISMO dedo levantándolo entre cada una. El SDK forma una sola plantilla a partir de 3 y comprueba la cuarta. **No** se guardan 4 huellas.
- **Asistencias:** a lo sumo una entrada y una salida biométrica por alumno y fecha, con validación contra Firestore. Los intentos fallidos no generan registros.
- **Permisos de usuario:** `admin` y `staff` mantienen sus capacidades. El botón de sincronización completa es exclusivo del admin.
- **Caché:** `docs/.private/biometrics.sqlite3` se crea automáticamente cifrado para la cuenta Windows. No la borres durante el día de operación. Si cambias de usuario Windows, cierra el servicio y **elimina solo la caché antigua** de forma segura; se reconstruirá desde Firebase en el primer inicio con conexión.

## Solución de problemas

- **No inicia web:** ejecuta `PREPARAR_PRODUCCION.bat`, lee los errores, configura `.env.local` y verifica Node.js.
- **No aparecen alumnos nuevos:** comprueba que `firestore.rules` fue actualizado, que la operación guardó `updatedAt`, y pulsa sincronización manual si editaste directamente en Firebase Console.
- **Falla el registro de 4 capturas:** retira completamente el dedo entre lecturas, no uses otro dedo y prueba la función `DBMatch` de tu SDK con un alumno ficticio.
- **No sale correo:** confirma `GMAIL_USER`, `GMAIL_APP_PASSWORD`, Internet, y revisa el terminal de Python. La cola vuelve a intentar envíos fallidos.
- **Sin Internet:** por seguridad no se aceptan asistencias nuevas hasta poder validarlas contra Firebase.
- **Caché dañada o Windows cambió de cuenta:** cierra el programa; conserva una copia protegida para diagnóstico y retira `docs/.private/biometrics.sqlite3`. Inicia con Internet y haz una sincronización completa.

Más detalles técnicos en `CAMBIOS_VERSION_08.md`. Instala usando las instrucciones generales de `INSTALACION.md`, pero **este archivo V8 tiene prioridad cuando difieran**.
