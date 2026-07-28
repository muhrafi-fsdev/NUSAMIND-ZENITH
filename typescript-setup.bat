@echo off
setlocal
cd /d "%~dp0"
title NusaMind N1.4.1 - TypeScript 7 Setup
where node >nul 2>nul || (echo [ERROR] Node.js tidak ditemukan.& pause& exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm tidak ditemukan.& pause& exit /b 1)
echo [INFO] Installing TypeScript 7 native and TypeScript 6 compatibility compiler...
call npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
if errorlevel 1 (echo [ERROR] npm install gagal.& pause& exit /b 1)
call npm run typescript:n141:status
call npm run typescript:n141:benchmark
echo [OK] TypeScript runtime N1.4.1 siap.
pause
endlocal
