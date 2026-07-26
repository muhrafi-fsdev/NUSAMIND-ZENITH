@echo off
setlocal
echo ==============================================
echo START / SETUP OLLAMA QWEN2.5 7B
echo ==============================================
ollama --version
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:7b
echo Jika service belum hidup, jalankan: ollama serve
echo Selesai.
pause
