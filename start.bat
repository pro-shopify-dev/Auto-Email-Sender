@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Gmail Automation - Launcher

echo ==================================================
echo    Gmail Automation Platform - Starting up
echo ==================================================
echo.

REM --- 1. Check Node.js is installed ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on your PATH.
  echo Install Node.js 20+ from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

REM --- 2. Make sure there is a .env file ---
if not exist ".env" (
  echo [SETUP] No .env found - creating one from .env.example ...
  copy ".env.example" ".env" >nul
  echo         Edit .env to add your MongoDB URI and Google OAuth keys,
  echo         then run this launcher again.
  echo.
  pause
)

REM --- 3. Install dependencies on first run ---
if not exist "node_modules" (
  echo [SETUP] Installing dependencies - this only happens once...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. See the messages above.
    echo.
    pause
    exit /b 1
  )
  echo.
)

REM --- 4. Start the web app and the worker in their own windows ---
REM Prefer IPv4 for outbound calls (Google OAuth, MongoDB Atlas) — avoids "Premature close"
REM on machines with broken/half-configured IPv6.
echo [RUN] Opening the Web App window...
start "Gmail Automation - Web App" cmd /k "set NODE_OPTIONS=--dns-result-order=ipv4first&& npm run dev"

echo [RUN] Opening the Worker window...
start "Gmail Automation - Worker" cmd /k "set NODE_OPTIONS=--dns-result-order=ipv4first&& npm run worker"

REM --- 5. Wait until the server actually responds, THEN open the browser ---
echo.
echo The first start compiles the app - this can take 15-30 seconds.
echo Please leave the two new windows open. Waiting for the server...
echo.

set /a tries=0
:waitloop
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto ready
set /a tries+=1
if !tries! geq 40 goto giveup
<nul set /p "=."
timeout /t 2 /nobreak >nul
goto waitloop

:ready
echo.
echo Server is up!
start "" http://localhost:3000
goto done

:giveup
echo.
echo [NOTE] The server is taking longer than expected. Check the "Web App"
echo        window for errors. If it says "Ready", open http://localhost:3000
echo        in your browser manually.

:done
echo.
echo ==================================================
echo    Running. Two windows are open:
echo      - "Web App"  = the site  (keep open)
echo      - "Worker"   = sends your emails  (keep open)
echo.
echo    To stop everything, run  stop.bat
echo ==================================================
echo.
echo You can close THIS launcher window now.
pause
