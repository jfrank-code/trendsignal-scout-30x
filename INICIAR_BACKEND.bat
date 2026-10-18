@echo off
setlocal
cd /d "%~dp0"
title TrendSignal Scout - Backend Python
where python >nul 2>nul || (echo ERROR: Python no esta en PATH.& pause & exit /b 1)
python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" || (echo ERROR: Se necesita Python 3.10 o superior.& pause & exit /b 1)
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Se ha creado .env. Editalo para introducir tu clave de OpenAI y vuelve a ejecutar.
  notepad .env
  pause
  exit /b 0
)
echo Comprobando e instalando dependencias en el Python activo (sin entorno virtual)...
python -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (echo ERROR instalando dependencias de Python.& pause & exit /b 1)
echo.
echo Iniciando BACKEND en http://127.0.0.1:8000 (documentacion en /docs)
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
pause
