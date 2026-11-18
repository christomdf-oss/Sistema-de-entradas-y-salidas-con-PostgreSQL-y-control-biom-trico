# ZENKAY V9 — guía de migración de Firebase Firestore a PostgreSQL

**Estado: versión candidata, NO instalar directamente sobre producción sin pruebas.**

La versión 9 mantiene **Google / Firebase Authentication** como inicio de sesión y utiliza **PostgreSQL instalado en la PC de la escuela** para alumnos, permisos, asistencias, huellas, comunidades, configuración y correos. Ya no usa las cuotas de lecturas de Firestore para operar. PostgreSQL no tiene límite fijo de lecturas por día cuando está instalado localmente, pero **la PC, los discos y los respaldos sí tienen límites**.

## 1. Preparación y respaldo

1. **Guarda intacta tu versión 8.3.** No sobrescribas su carpeta ni sus archivos `docs/.private`, `docs/.env`, `.env.local` o `serviceAccountKey.json`.
2. Conserva una **copia/exportación verificable de Firestore**. Este paquete NO borra ni modifica las colecciones originales.
3. Usa la **misma computadora Windows** del ZK9500 para la prueba inicial. El API está enlazado a `127.0.0.1`; otras computadoras o celulares no podrán entrar hasta instalar un acceso remoto seguro.
4. Necesitas Node.js LTS, Python 3.10 x64 (como en la versión anterior), drivers/SDK de ZK9500 y acceso a tu proyecto actual de Firebase Authentication.

## 2. Instalar PostgreSQL en Windows

Descarga el instalador desde la página oficial: https://www.postgresql.org/download/windows/

- Instala PostgreSQL (por ejemplo, versión 18) con pgAdmin y las herramientas de línea de comandos.
- Conserva el puerto predeterminado **5432**, y **recuerda** la contraseña de la cuenta `postgres`.
- No abras el puerto 5432 a Internet. No uses la cuenta `postgres` para ejecutar la aplicación.

Abre **SQL Shell (psql)** instalado con PostgreSQL. Entra a la base `postgres` con el usuario `postgres`. Ejecuta por separado estos comandos, cambiando la contraseña por una propia y fuerte:

```sql
CREATE ROLE zenkay_app LOGIN PASSWORD 'TU_CONTRASENA_SEGURA';
CREATE DATABASE zenkay OWNER zenkay_app;
```

En PowerShell, dentro de la carpeta descomprimida, crea las tablas (ajusta `18` si instalaste otra versión):

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -U zenkay_app -d zenkay -f .\docs\schema_postgres.sql
```

Te pedirá la contraseña de `zenkay_app`. La instalación debe terminar sin errores.

## 3. Instalar dependencias y configurar claves

1. Descomprime **V9 en una carpeta nueva** (sin reemplazar la 8.3).
2. Ejecuta `INSTALAR_WINDOWS.bat` para instalar Node.js y paquetes Python del proyecto. Si ya tenías un SDK biométrico funcionando, mantenlo: el ZIP no distribuye DLL del fabricante.
3. Abre `.env.local` y copia los datos públicos `NEXT_PUBLIC_FIREBASE_*` y el `NEXT_PUBLIC_SCHOOL_ID` **idénticos** a los de tu proyecto original. Deja las URL locales: `NEXT_PUBLIC_KIOSK_URL=http://127.0.0.1:5000` y `NEXT_PUBLIC_DATA_API_URL=http://127.0.0.1:5050`.
4. Copia tu archivo secreto `serviceAccountKey.json` de forma privada a `docs/serviceAccountKey.json` en V9. **No lo subas a GitHub ni lo compartas por chat.**
5. Edita `docs/.env`: establece `DATABASE_URL=postgresql://zenkay_app:TU_CONTRASENA_SEGURA@127.0.0.1:5432/zenkay`, `SCHOOL_ID` y `FIREBASE_SERVICE_ACCOUNT=serviceAccountKey.json`. Si la contraseña contiene caracteres especiales de URL, debes codificarlos como `%HH`.
6. En una terminal de PowerShell desde la raíz del proyecto, genera una **clave de cifrado**:

```powershell
.\docs\venv\Scripts\python.exe docs\create_fernet_key.py
```

Copia el valor de `BIOMETRIC_FERNET_KEY=...` a `docs/.env` y guarda otra copia **fuera de la PC**, en un lugar seguro. Sin esa clave no podrás recuperar las huellas almacenadas en PostgreSQL.

Configura `GMAIL_USER`, `GMAIL_APP_PASSWORD` y `MAIL_FROM_NAME` en `docs/.env` si usas notificaciones. Las credenciales **nunca van en `.env.local`** ni dentro del frontend.

## 4. Copiar datos desde Firestore (solo una vez)

Desde PowerShell y dentro del proyecto, primero haz el recuento, **sin escribir nada**:

```powershell
.\docs\venv\Scripts\python.exe docs\migrate_firestore_to_postgres.py
```

Confirma que aparecen aproximadamente tus alumnos, huellas y asistencias. Si muestra **0 alumnos**, no ejecutes la migración: comprueba `SCHOOL_ID` y el proyecto Firebase de origen.

Si los números corresponden, haz la copia:

```powershell
.\docs\venv\Scripts\python.exe docs\migrate_firestore_to_postgres.py --apply
.\docs\venv\Scripts\python.exe docs\check_postgres.py
```

El importador realiza la copia dentro de una transacción PostgreSQL y utiliza los ID antiguos. Se pueden mantener identificadores y documentos históricos. La importación no borra Firestore, ni siquiera con `--apply`. Si hay asistencias con campos inválidos, el script avisará: **revisa esas advertencias antes de operar**.

**Importante:** mientras migras, no permitas que los empleados registren nuevas asistencias en V8.3 o cambios en Firestore. Así evitas que alguna asistencia quede fuera de la copia.

## 5. Arranque y pruebas iniciales

Cierra completamente V8.3 y detén su servicio Python. Para el primer arranque, ejecuta `iniciar_desarrollo.bat`. Abre **http://localhost:9002**.

Se abrirán tres ventanas: PostgreSQL API (5050), Sensor ZK9500 (5000), y Web Next.js (9002). El servidor PostgreSQL debe estar funcionando antes de lanzar el programa.

Para verificar el servicio de datos, abre **http://127.0.0.1:5050/api/health** y comprueba `database: postgresql`.

Prueba con un alumno **ficticio** y datos de prueba, en este orden:

1. Inicio de sesión con Google y rol correcto (importado desde Firestore).
2. Lista de alumnos y búsqueda del modo manual; registra **Entrada** y luego **Salida**. Deben aparecer solo dos movimientos del alumno en ese día. Repetir Entrada debe dar un aviso de duplicado.
3. Abre alumnos y **elimina solo la huella** mientras el modo de asistencia biométrica esté detenido. El servicio debe confirmar la eliminación de la plantilla en PostgreSQL y reconstruir la lista local del ZK9500 **sin volver a consultar Firestore**.
4. Registra otra vez **el mismo dedo** con cuatro capturas. Prueba una entrada y una salida del alumno de prueba.
5. Comprueba que el historial de entradas y salidas **se conserva** al borrar la huella; este historial es distinto de la plantilla biométrica. Si deseas anular una asistencia incorrecta, usa la opción de anulación con permisos de administrador.
6. Revisa reportes, Excel, comunidades, Gmail y roles. Verifica que el conteo de alumnos y registros coincida con la fuente.
7. Verifica el apagado/reinicio completo de la PC y el arranque de PostgreSQL antes de probar con alumnos reales.

Después, ejecuta `PREPARAR_PRODUCCION.bat` y, si compila correctamente, usa `iniciar_sistema.bat` para el modo normal. **No cambies a la versión 9 si alguna prueba crítica falla.**

## 6. Verificación de que Firebase ya no se usa para alumnos

En V9, las lecturas y escrituras escolares utilizan el API de PostgreSQL. Firebase se usa únicamente para iniciar sesión con Google y verificar sus tokens. La importación inicial de datos es la única operación que consulta Firestore desde los scripts activos.

Una vez que ya no haya V8.3 ni otros clientes antiguos en uso, puedes restringir Firestore publicando manualmente las reglas de `firestore.after-migration.rules`; **no lo hagas antes de comprobar que la copia y la operación en PostgreSQL funcionan**. Firebase Authentication seguirá funcionando.

## 7. Respaldos obligatorios y limitaciones

- **PostgreSQL local no tiene respaldo automático configurado por este proyecto.** Debes habilitar copias periódicas en un disco cifrado que no sea el disco principal y probar su restauración. Por ejemplo, un respaldo manual usando `pg_dump -F c` del PostgreSQL instalado (documentación: https://www.postgresql.org/docs/current/app-pgdump.html). Los respaldos contienen datos personales: mantenlos cifrados y con acceso restringido.
- Respalda **por separado** `BIOMETRIC_FERNET_KEY`: perderla hace inutilizables las plantillas cifradas incluso si recuperas la base.
- Si falla PostgreSQL o se apaga la computadora, la aplicación local no puede registrar asistencias hasta recuperarse. Necesitas respaldo de energía y plan de recuperación si buscas alta disponibilidad.
- Google Authentication necesita Internet para nuevos inicios de sesión y validaciones. El reconocimiento biométrico en la PC es local, pero el acceso administrativo sigue autenticado.
- La migración **no se ha probado con tu PC ni con un lector ZK9500 real**. Revisa permisos, recuperación tras un corte eléctrico, email, alta/baja de huellas y fallos de red con datos de prueba.
- No permitas acceso remoto abriendo PostgreSQL, Flask o puertos del sensor directamente a Internet. Para acceso remoto, se necesitaría VPN/proxy HTTPS con autenticación y permisos.

## 8. Problemas comunes

- **PostgreSQL no conecta:** confirma que el servicio está iniciado, el usuario/clave y el puerto 5432.
- **Cuenta sin autorización:** comprueba `docs/check_postgres.py` (usuarios) y tu UID en la tabla `users`. Para dar el primer rol si no se importó ninguno: `python docs/bootstrap_admin_pg.py TU_UID` en consola, con confirmación explícita.
- **Error con huellas cifradas:** revisa que la clave Fernet sea exactamente la misma que se usó al importar; no generes una distinta después.
- **No encuentra ZK9500:** utiliza el driver, DLL y arquitectura x64/Python que ya funcionaban en V8.3.
- **Windows nuevo no reconoce zona horaria:** ejecuta `pip install tzdata` en `docs/venv`.
- **Falla `npm run build` o el servicio Python:** no uses la nueva versión con alumnos. Conserva y utiliza V8.3 para la recuperación temporal hasta resolver el problema.

Esta versión proporciona un cambio real del código a PostgreSQL, pero **la puesta en operación y la validación física deben realizarse en el equipo de la escuela**.
