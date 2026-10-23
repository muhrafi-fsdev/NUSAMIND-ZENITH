@echo off
rem NusaMind profil 4 GB: model kecil, jendela konteks 4096, KV cache q8_0, satu model dimuat sekali.
rem Nilai variabel di bawah harus sama dengan profil 4gb di data/runtime/hardware-profiles.json (dicek oleh benchmark).
rem PENTING: tutup dulu aplikasi Ollama di system tray. Variabel hanya berlaku untuk server yang dijalankan dari jendela ini.
set OLLAMA_FLASH_ATTENTION=1
set OLLAMA_KV_CACHE_TYPE=q8_0
set OLLAMA_NUM_PARALLEL=1
set OLLAMA_MAX_LOADED_MODELS=1
set OLLAMA_CONTEXT_LENGTH=4096
echo Menjalankan Ollama untuk profil 4 GB di jendela baru...
start "Ollama profil 4 GB" cmd /k ollama serve
timeout /t 6 /nobreak >nul
echo Menarik model profil 4 GB (sekitar 3 GB total)...
ollama pull qwen3:1.7b
ollama pull qwen2.5-coder:1.5b
ollama pull qwen3:0.6b
echo Selesai. Biarkan jendela "Ollama profil 4 GB" tetap terbuka, lalu jalankan dev.bat.
echo Periksa pemakaian memori dengan: ollama ps
