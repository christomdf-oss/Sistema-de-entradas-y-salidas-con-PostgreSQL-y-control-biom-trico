@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Instala Node.js LTS primero & pause & exit /b 1)
where py >nul 2>&1 || (echo Instala Python 3.10 o 3.11 primero & pause & exit /b 1)
echo Instalando dependencias de Next.js...
call npm ci || (echo Error npm & pause & exit /b 1)
echo Instalando dependencias biometricas...
py -3.10 -m venv docs\venv || (echo Instala Python 3.10 y vuelve a intentar & pause & exit /b 1)
docs\venv\Scripts\python.exe -m pip install -r docs\requirements.txt || (echo Error de dependencias python & pause & exit /b 1)
if not exist .env.local copy .env.example .env.local >nul
if not exist docs\.env copy docs\.env.example docs\.env >nul
echo Configura Firebase y credenciales siguiendo INSTALACION.md
pause
