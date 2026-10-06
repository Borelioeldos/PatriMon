@echo off
title PatriMon - Export des Donnees pour Docker / Home Assistant
echo =======================================================
echo    PatriMon - Export des Donnees (/data)
echo =======================================================
echo.
cd /d "%~dp0.."
python scripts/prepare_docker_data.py
echo.
pause
