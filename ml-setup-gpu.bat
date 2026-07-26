@echo off
setlocal
cd /d "%~dp0"
if not exist "ml-service\.venv\Scripts\python.exe" (
  echo [ERROR] Jalankan ml-setup.bat terlebih dahulu.
  pause & exit /b 1
)
if "%PYTORCH_CUDA_INDEX%"=="" set PYTORCH_CUDA_INDEX=cu130
echo [INFO] Installing PyTorch CUDA from %PYTORCH_CUDA_INDEX%...
call "ml-service\.venv\Scripts\python.exe" -m pip uninstall -y torch torchvision torchaudio
call "ml-service\.venv\Scripts\python.exe" -m pip install --upgrade torch --index-url "https://download.pytorch.org/whl/%PYTORCH_CUDA_INDEX%"
if errorlevel 1 (echo [ERROR] PyTorch CUDA install failed.& pause & exit /b 1)
call "ml-service\.venv\Scripts\python.exe" -m pip install -r "ml-service\requirements-gpu.txt"
if errorlevel 1 (echo [ERROR] Advanced ML dependencies failed.& pause & exit /b 1)
call "ml-service\.venv\Scripts\python.exe" -c "import torch; print('PyTorch:',torch.__version__); print('CUDA:',torch.version.cuda); print('GPU active:',torch.cuda.is_available()); print('Device:',torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'not detected')"
echo [OK] NusaMind R13.45 Advanced ML profile installed.
pause
