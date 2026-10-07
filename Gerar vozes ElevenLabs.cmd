@echo off
rem Gera as vozes da ElevenLabs (Carla e Fabio). Pede a chave na hora; nada fica salvo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0site\ferramentas\gerar-vozes.ps1"
echo.
pause
