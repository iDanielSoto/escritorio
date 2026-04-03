@echo off
echo Iniciando aplicacion Electron...
echo.
echo 1. Iniciando Vite en puerto 5173...
start /B cmd /c "npm run dev"

echo 2. Esperando a que Vite este listo...
timeout /t 5 /nobreak >nul

echo 3. Lanzando Electron...
set NODE_ENV=development
npx electron .

echo.
echo Aplicacion cerrada.
pause
