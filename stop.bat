@echo off
cd /d "%~dp0"
title Gmail Automation - Stop

echo Stopping the Gmail Automation app...

REM Close the two windows the launcher opened (web app + worker), plus any
REM node process listening on the web port 3000.
taskkill /FI "WINDOWTITLE eq Gmail Automation - Web App*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Gmail Automation - Worker*" /T /F >nul 2>nul

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)

echo Done. The web app and worker have been stopped.
echo.
timeout /t 3 /nobreak >nul
