@echo off
setlocal
cd /d "%~dp0"
title TrendSignal Scout - Inicio completo
where python >nul 2>nul || (echo ERROR: Python no esta en PATH.& pause & exit /b 1)
where node >nul 2>nul || (echo ERROR: Instala Node.js LTS para el frontend independiente.& pause & exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm no esta en PATH.& pause & exit /b 1)
python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" || (echo ERROR: Se necesita Python 3.10 o superior.& pause & exit /b 1)
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Se ha creado .env. Editalo para introducir tu clave de OpenAI y vuelve a iniciar.
  notepad .env
  pause
  exit /b 0
)
echo Comprobando dependencias de Python en la instalacion actual (sin entorno virtual)...
python -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (echo ERROR instalando dependencias de Python.& pause & exit /b 1)
if not exist "frontend\node_modules" (
  echo Instalando dependencias del frontend...
  pushd frontend
  call npm install
  if errorlevel 1 (popd & pause & exit /b 1)
  popd
)
echo Iniciando backend y frontend en terminales independientes...
start "TrendSignal Backend :8000" /D "%~dp0" cmd /k "python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000"
start "TrendSignal Frontend :5173" /D "%~dp0frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:5173
exit /b 0
