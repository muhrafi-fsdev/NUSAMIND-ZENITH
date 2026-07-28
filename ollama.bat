@echo off
setlocal
echo ==============================================
echo NUSAMIND ZENITH N1.4 - OLLAMA MODEL SETUP
echo ==============================================
ollama --version
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
ollama pull qwen2.5:7b
echo.
echo Main model     : qwen3:8b
echo Coding model   : qwen2.5-coder:7b
echo Fallback model : qwen2.5:7b
echo Jika service belum hidup, jalankan: ollama serve
echo Selesai.
pause
