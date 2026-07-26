@echo off
setlocal
cd /d "%~dp0ml-service"
if not exist ".venv\Scripts\python.exe" (echo [ERROR] Jalankan ml-setup.bat terlebih dahulu.& pause& exit /b 1)
call ".venv\Scripts\activate.bat"
set PYTHONUTF8=1
python -m uvicorn app:app --host 127.0.0.1 --port 8000
if errorlevel 1 (echo [ERROR] ML service berhenti dengan error.& pause)
endlocal
