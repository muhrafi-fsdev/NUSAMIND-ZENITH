@echo off
setlocal
cd /d "%~dp0"
title NusaMind Zenith N1.0 - Development Server
echo ==============================================
echo NusaMind Zenith N1.0 - Next.js Dev
echo ==============================================
where node >nul 2>nul || (echo [ERROR] Node.js tidak ditemukan. Install Node.js 22 LTS.& pause& exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm tidak ditemukan.& pause& exit /b 1)
call npm config set registry https://registry.npmjs.org/ >nul
if not exist ".env" if exist ".env.example" copy /Y ".env.example" ".env" >nul
if not exist "node_modules" (
  echo [INFO] Installing dependencies dari registry npm publik...
  if exist "package-lock.json" (call npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund) else (call npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund)
  if errorlevel 1 (echo [WARN] npm ci/install pertama gagal, mencoba npm install...& call npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund)
  if errorlevel 1 (echo [ERROR] Dependency install gagal.& pause& exit /b 1)
)
echo [INFO] Jalankan Ollama di terminal lain: ollama serve
echo [INFO] Jalankan Python ML di terminal lain: ml-start.bat
echo [INFO] Backend: http://localhost:3000
call npm run dev
if errorlevel 1 (echo [ERROR] Server berhenti dengan error.& pause& exit /b 1)
endlocal
