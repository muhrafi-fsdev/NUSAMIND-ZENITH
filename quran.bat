@echo off
chcp 65001 > nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\cli\nusamind-chat.ps1" -Mode quran
