# ZENKAY V9 — Sistema de Entradas y Salidas

ZENKAY es un sistema de control de asistencia escolar que desarrollé para el **Colegio de Bachilleres del Estado de Campeche (COBACAM), Plantel 10 Chicbul**.

El proyecto surgió de la necesidad de llevar un mejor control de las entradas y salidas de los alumnos, evitando depender únicamente de registros en papel o listas de asistencia.

La idea fue desarrollar una aplicación que permitiera registrar movimientos mediante un lector de huellas digitales, consultar la información desde una interfaz web y enviar notificaciones a los tutores.

Con el tiempo fui agregando funciones como el registro manual, la administración de alumnos, los reportes y el control de usuarios.

Actualmente el proyecto se encuentra en su versión 9, en la que realicé la migración de los datos escolares de Firebase Firestore a PostgreSQL.

## ¿Qué hace el sistema?

ZENKAY permite administrar los registros de entrada y salida de los alumnos desde una aplicación web.

### Control de asistencia con huella digital

El sistema utiliza un lector biométrico **ZKTeco ZK9500**, conectado por USB a una computadora con Windows.

El funcionamiento está dividido en dos procesos:

**Registro de huellas**

Se selecciona un alumno y se capturan sus datos biométricos mediante el lector. La información se asocia con su registro para utilizarla posteriormente en la identificación.

**Registro de entradas y salidas**

El encargado activa el modo de entrada o salida. Cuando el alumno coloca su dedo en el lector, el sistema intenta identificarlo y registrar el movimiento correspondiente.

También se contempla la eliminación y el nuevo registro de huellas cuando es necesario actualizar la información biométrica de un alumno.

### Asistencia manual

Una de las cosas que consideré importantes fue que el sistema no dependiera completamente del lector.

Si el sensor presenta algún problema, el personal puede continuar trabajando desde el módulo de asistencia manual.

Este módulo permite buscar alumnos y registrar sus entradas o salidas desde la aplicación.

### Administración de alumnos

El sistema cuenta con un apartado para consultar y administrar la información de los estudiantes.

Entre los datos que maneja se encuentran:

- Nombre y matrícula.
- Grupo y comunidad.
- Información de contacto.
- Datos relacionados con la asistencia.
- Estado del registro biométrico.

### Historial de movimientos

Los registros de asistencia se almacenan en PostgreSQL y pueden consultarse desde la aplicación.

Se pueden revisar los movimientos realizados durante el día y consultar información histórica.

También se incorporó un mecanismo de anulación de movimientos para corregir registros administrativos sin perder completamente su historial.

### Reportes

La aplicación incluye un apartado de reportes para consultar la asistencia de los alumnos y revisar sus movimientos.

El objetivo es facilitar el seguimiento de la asistencia sin tener que revisar manualmente cada registro.

### Notificaciones por correo

El sistema cuenta con una integración para enviar notificaciones por correo electrónico a los tutores.

Esta función busca mantener informadas a las familias sobre los movimientos registrados.

### Acceso de usuarios

El inicio de sesión se realiza mediante **Firebase Authentication**.

Además de iniciar sesión, los usuarios necesitan contar con un rol autorizado para acceder a las funciones del sistema.

Los permisos se administran desde la base de datos.

---

## Tecnologías utilizadas

El proyecto combina tecnologías de desarrollo web, backend, bases de datos y comunicación con hardware.

| Tecnología | Uso dentro del proyecto |
|---|---|
| Next.js 15 | Aplicación web y navegación |
| React 19 | Componentes de la interfaz |
| TypeScript | Desarrollo del frontend |
| Tailwind CSS | Estilos y diseño responsivo |
| Python | Procesamiento y servicios del backend |
| Flask | API para comunicar los componentes |
| PostgreSQL | Almacenamiento de datos escolares |
| Firebase Authentication | Inicio de sesión con Google |
| ZKTeco ZK9500 | Captura e identificación de huellas |
| Gmail | Envío de notificaciones |
| Docker | Ejecución del frontend en contenedores |
| Git y GitHub | Control de versiones |

## ¿Cómo está organizado?

El sistema está dividido en tres partes principales.

**1. Aplicación web**

Es la interfaz que utiliza el personal de la escuela.

Desde aquí se administran alumnos, asistencias, reportes, usuarios y funciones del lector biométrico.

Está desarrollada con Next.js, React y TypeScript.

**2. Backend en Python**

Se encarga de procesar las solicitudes relacionadas con los datos y la comunicación con el lector biométrico.

Utiliza Flask para exponer servicios HTTP y módulos específicos para trabajar con PostgreSQL y el dispositivo.

**3. Base de datos PostgreSQL**

Almacena la información de los alumnos, los usuarios, las huellas registradas y los movimientos de asistencia.

En versiones anteriores utilicé Firestore. Posteriormente decidí migrar los datos escolares a PostgreSQL para tener mayor control sobre el almacenamiento y las consultas.

Firebase se mantiene para la autenticación de usuarios.

### Estructura del proyecto

Algunos de los archivos y directorios principales son:

- `src/app/`: páginas y módulos de la aplicación web.
- `src/components/`: componentes reutilizables.
- `src/firebase/`: configuración e integración con Firebase.
- `src/lib/`: funciones y utilidades de la aplicación.
- `docs/postgres_api.py`: API de datos en Python.
- `docs/pg_store.py`: operaciones relacionadas con PostgreSQL.
- `docs/enroll_gui.py`: funciones del servicio biométrico.
- `docs/hardware_manager.py`: administración del hardware.
- `docs/schema_postgres.sql`: estructura inicial de la base de datos.
- `docs/requirements.txt`: dependencias de Python.

---

## Instalación en Windows

El sistema está pensado principalmente para funcionar en una computadora con Windows, debido a la integración con el lector ZK9500.

### Requisitos

Para instalarlo se necesita:

- Node.js y npm.
- Python y las dependencias del proyecto.
- PostgreSQL.
- pgAdmin 4, recomendado para administrar la base de datos.
- Controladores y SDK compatibles con el ZKTeco ZK9500, cuando se utilice el lector.

### Configuración inicial

**1. Descargar el proyecto**

Clonar el repositorio desde GitHub o descargarlo como archivo ZIP.

**2. Preparar PostgreSQL**

Crear una base de datos llamada `zenkay` y configurar un usuario con los permisos necesarios.

Después, ejecutar el archivo:

`docs/schema_postgres.sql`

Si se está actualizando una instalación existente, revisar también:

`docs/ACTUALIZAR_V9_AUDITORIA.sql`

No se recomienda aplicar cambios a una base de datos con información real sin realizar antes un respaldo.

**3. Configurar las variables de entorno**

El proyecto utiliza archivos de configuración locales.

| Archivo | Contenido |
|---|---|
| `.env.local` | Configuración del frontend y Firebase |
| `docs/.env` | Conexión a PostgreSQL y configuración del backend |
| `docs/serviceAccountKey.json` | Credenciales privadas de Firebase Admin |

Estos archivos contienen información sensible y no deben publicarse en GitHub.

**4. Instalar las dependencias**

Desde Windows, ejecutar:

`INSTALAR_WINDOWS.bat`

**5. Comprobar PostgreSQL**

Desde la carpeta principal del proyecto, ejecutar:

`.\docs\venv\Scripts\python.exe docs\check_postgres.py`

Este comando permite verificar la conexión a la base de datos y la configuración de la clave de protección biométrica.

**6. Iniciar la aplicación**

Para trabajar en desarrollo, ejecutar:

`iniciar_desarrollo.bat`

La aplicación web utiliza el puerto `9002`.

Dirección local:

`http://localhost:9002`

Para preparar una ejecución fuera del entorno de desarrollo, el proyecto también incluye `PREPARAR_PRODUCCION.bat` e `iniciar_sistema.bat`.

La configuración completa se explica en los documentos de instalación incluidos en el repositorio.

---

## Ejecución con Docker

También agregué una configuración con Docker para practicar la creación y ejecución de contenedores y facilitar la reproducción del entorno web.

Los archivos utilizados son:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

Para construir la imagen e iniciar el contenedor, ejecutar:

`docker compose up --build`

Una vez iniciado, el frontend estará disponible en:

`http://localhost:9002`

Para detenerlo:

`docker compose down`

### Limitaciones de la configuración actual

Por el momento, Docker ejecuta únicamente el frontend de Next.js.

La API Python y PostgreSQL se configuran por separado.

Además, la comunicación con el lector biométrico depende de controladores de Windows, por lo que no está integrada directamente dentro del contenedor Linux.

La instalación que se utiliza para trabajar con el lector sigue siendo la de Windows, sin Docker.

---

## API y backend

La comunicación entre la aplicación y los datos se realiza mediante servicios desarrollados en Python.

El archivo principal de la API de PostgreSQL es:

`docs/postgres_api.py`

El backend se encarga de operaciones relacionadas con los registros escolares y la asistencia, mientras que otros módulos administran la comunicación con el lector biométrico.

La documentación detallada de las rutas HTTP y sus respuestas es una de las partes que continúo preparando.

Actualmente no se incluye una interfaz Swagger/OpenAPI configurada y verificada.

---

## Seguridad y manejo de datos

Debido a que el sistema trabaja con información escolar y biométrica, hay varios aspectos que considero importantes:

- Mantener las credenciales fuera del repositorio.
- Utilizar autenticación y permisos para restringir el acceso.
- Proteger las plantillas biométricas almacenadas.
- Realizar respaldos de PostgreSQL.
- Conservar un historial de las correcciones administrativas.
- Evitar utilizar datos reales de alumnos en pruebas públicas.

La versión 9 incluye configuración para proteger las plantillas biométricas mediante una clave de cifrado.

El uso del sistema en una institución requiere además políticas adecuadas de privacidad, autorización y protección de datos personales.

---

## Estado actual del proyecto

ZENKAY sigue en desarrollo y mejora.

Entre los cambios más importantes de las últimas versiones se encuentran:

- Migración de los datos escolares de Firestore a PostgreSQL.
- Ajustes al registro y administración de huellas digitales.
- Mejoras en los movimientos de entrada y salida.
- Incorporación de registros de auditoría.
- Mejoras al módulo de asistencia manual.
- Configuración de Docker para el frontend.
- Preparación de scripts para instalar y ejecutar el sistema en Windows.

He realizado pruebas de distintos componentes durante el desarrollo, pero todavía considero necesario seguir validando la estabilidad del sistema completo, especialmente con el lector biométrico y en instalaciones nuevas.

## ¿Qué aprendí desarrollándolo?

Este proyecto me ha permitido trabajar con problemas que van más allá de crear una interfaz.

Durante el desarrollo he tenido que investigar errores de conexión, configurar bases de datos, integrar servicios, trabajar con autenticación y resolver problemas relacionados con un dispositivo físico.

También he aprendido la importancia de organizar mejor el backend, proteger las credenciales, realizar pruebas y documentar los cambios.

Una parte importante del trabajo ha sido investigar documentación técnica, analizar errores y mejorar las soluciones a medida que encuentro problemas durante las pruebas.

Mi intención es seguir utilizando ZENKAY para mejorar mis conocimientos de desarrollo backend, bases de datos y despliegue de aplicaciones.

---

## Autor

Desarrollado por **christomdf-oss**.

Proyecto de desarrollo de software enfocado en la gestión de asistencia escolar, la integración de sistemas web y el control biométrico.