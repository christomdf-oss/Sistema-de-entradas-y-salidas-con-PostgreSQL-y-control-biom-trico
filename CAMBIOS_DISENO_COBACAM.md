# Diseño COBACAM — Sistema de Entradas y Salidas

Basado en Revisión 03. Se sustituyó el nombre ZENKAY en la interfaz principal por Sistema de Entradas y Salidas, utilizando el logo proporcionado de COBACAM Plantel 10 Chicbul.

## Incluye
- Nuevo aspecto rojo tecnológico en sidebar, encabezado y tarjetas.
- Pantalla de acceso con logo institucional y Google.
- Rediseño de Control Biométrico manteniendo los mismos comandos y eventos autenticados.
- Plantilla HTML de correo con logo embebido mediante Content-ID y versión texto; datos de contacto según la captura del plantel.
- Metadatos y favicon actualizados.

## Datos del plantel
Clave 04ECB0010U. Calle Juan Escutia (Carr. al ejido Abelardo R. Rodríguez), Barrio de Guadalupe, Chicbul, Carmen, Campeche, CP 24373. Teléfono (982) 82 4-03-20. Correo plantel10@cobacam.edu.mx. Turno matutino.

## Instalación
Conserva la instalación anterior. Copia .env.local, docs/.env y docs/serviceAccountKey.json del proyecto de pruebas a la misma ubicación en esta versión, sin compartirlos. Ejecuta INSTALAR_WINDOWS.bat y luego iniciar_sistema.bat. El administrador y sus roles siguen en Firebase.

## Atención
El lector ZK9500 sigue requiriendo sus DLL y el SDK correcto: esta revisión visual no resuelve AlgorithmLibraryInitializationError. Las vistas no inventan conectividad física. No usar datos reales hasta verificar reglas, lector, correos y permisos. El correo HTML no se ha validado enviándolo con Gmail real.
