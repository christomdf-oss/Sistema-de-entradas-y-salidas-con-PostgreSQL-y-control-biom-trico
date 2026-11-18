@echo off
setlocal
cd /d "%~dp0"
if not exist "docs\venv\Scripts\python.exe" (echo Instala primero las dependencias con INSTALAR_WINDOWS.bat & pause & exit /b 1)
if not exist "docs\.env" (echo Configura docs\.env y PostgreSQL primero & pause & exit /b 1)
if not exist "node_modules\next\dist\bin\next" (echo Ejecuta INSTALAR_WINDOWS.bat primero & pause & exit /b 1)
if not exist ".next\BUILD_ID" (echo Ejecuta PREPARAR_PRODUCCION.bat primero & pause & exit /b 1)
start "ZENKAY - PostgreSQL API" cmd /k "cd /d %~dp0docs && venv\Scripts\python.exe postgres_api.py"
timeout /t 2 /nobreak >nul
start "ZENKAY - Sensor ZK9500" cmd /k "cd /d %~dp0docs && venv\Scripts\python.exe enroll_gui.py"
timeout /t 2 /nobreak >nul
start "ZENKAY - Web" cmd /k "cd /d %~dp0 && npm run start"
echo Abre http://localhost:9002
pause
