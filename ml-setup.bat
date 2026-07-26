@echo off
setlocal
cd /d "%~dp0ml-service"
where python >nul 2>nul || (echo [ERROR] Python tidak ditemukan di PATH.& pause& exit /b 1)
if not exist ".venv\Scripts\python.exe" python -m venv .venv
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (echo [ERROR] Instalasi ML gagal.& pause& exit /b 1)
python train.py --dataset intent-seed.csv
if errorlevel 1 echo [WARN] Training seed gagal; rule/hash fallback tetap tersedia.
python smoke.py
pause
endlocal
