@echo off
setlocal
cd /d "%~dp0frontend"
title TrendSignal Scout - Frontend React + Bootstrap
where node >nul 2>nul || (echo ERROR: Instala Node.js LTS para utilizar npm.& pause & exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm no esta en PATH.& pause & exit /b 1)
if not exist "node_modules" (
  echo Instalando React, Vite, Bootstrap y Bootstrap Icons...
  call npm install
  if errorlevel 1 goto :error
)
echo.
echo Iniciando FRONTEND React en http://127.0.0.1:5173
call npm run dev
pause
exit /b 0
:error
echo No se pudieron instalar las dependencias npm. Revisa la conexion y vuelve a intentarlo.
pause
exit /b 1
