@echo off
title PatriMon - Lancement de l'application
echo =======================================================
echo          PatriMon - Suivi de Patrimoine Intelligent
echo =======================================================
echo.
echo [1/2] Demarrage du Backend FastAPI (Port 8000)...
start "PatriMon Backend" powershell -ExecutionPolicy Bypass -NoExit -Command "$env:PYTHONPATH = '%~dp0backend'; $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); cd '%~dp0backend'; python run.py"

timeout /t 3 /nobreak >nul

echo [2/2] Demarrage du Frontend Vite (Port 5173)...
start "PatriMon Frontend" powershell -ExecutionPolicy Bypass -NoExit -Command "cd '%~dp0frontend'; npm.cmd run dev"

echo.
echo =======================================================
echo Application lancee avec succes !
echo   - Frontend Web & Mobile : http://localhost:5173
echo   - Backend API & Swagger : http://localhost:8000/docs
echo =======================================================
echo.
pause
