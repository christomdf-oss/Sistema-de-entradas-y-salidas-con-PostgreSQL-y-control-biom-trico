@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\next\dist\bin\next" (
  echo Ejecuta INSTALAR_WINDOWS.bat primero.
  pause
  exit /b 1
)
if not exist .env.local (
  echo Configura .env.local siguiendo INSTALACION.md.
  pause
  exit /b 1
)
echo Compilando web para modo produccion...
call npm run build
if errorlevel 1 (
  echo Error al compilar. Consulta el mensaje anterior.
  pause
  exit /b 1
)
echo Listo. Ahora inicia con iniciar_sistema.bat
pause
