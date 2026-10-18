@echo off
setlocal
cd /d "%~dp0"
title TrendSignal Scout - Pruebas locales
where python >nul 2>nul || (echo ERROR: Python no esta en PATH.& pause & exit /b 1)
echo [1/3] Compilando Python con la instalacion activa (sin entorno virtual)...
python -m py_compile backend\app\main.py backend\app\editorial.py backend\engine\trendsignal_scout_v6_6.py
if errorlevel 1 goto :error
echo [2/3] Ejecutando pruebas del proyecto...
python -m unittest discover -s tests -v
if errorlevel 1 goto :error
echo [3/3] Ejecutando self-test del motor v6.6...
python backend\engine\trendsignal_scout_v6_6.py --self-test
if errorlevel 1 goto :error
echo.
echo VALIDACIONES BACKEND COMPLETADAS
if exist "frontend\node_modules" (
  echo Ejecutando build del frontend React...
  pushd frontend
  call npm run build
  if errorlevel 1 (popd & goto :error)
  popd
) else (
  echo NOTA: frontend aun sin dependencias. Ejecuta INICIAR_FRONTEND.bat para instalar npm packages.
)
pause
exit /b 0
:error
echo ERROR: una o mas pruebas fallaron.
pause
exit /b 1
