@echo off
setlocal
cd /d "%~dp0ml-service"
if exist ".venv\Scripts\python.exe" (call ".venv\Scripts\activate.bat")
python smoke.py
if errorlevel 1 (echo [ERROR] ML smoke test gagal.& pause& exit /b 1)
pause
endlocal
