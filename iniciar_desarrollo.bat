@echo off
setlocal
cd /d "%~dp0"
if not exist "docs\venv\Scripts\python.exe" (echo Ejecuta INSTALAR_WINDOWS.bat & pause & exit /b 1)
start "ZENKAY - PostgreSQL API" cmd /k "cd /d %~dp0docs && venv\Scripts\python.exe postgres_api.py"
timeout /t 2 /nobreak >nul
start "ZENKAY - Sensor ZK9500" cmd /k "cd /d %~dp0docs && venv\Scripts\python.exe enroll_gui.py"
timeout /t 2 /nobreak >nul
start "ZENKAY - Web (dev)" cmd /k "cd /d %~dp0 && npm run dev"
echo Abre http://localhost:9002
pause
