@echo off
title School Management System - Standalone Offline Launcher
color 0E
cls

echo ==========================================================
echo    School Management System - Fully Standalone Offline
echo ==========================================================
echo.

:: Clean up old server processes on ports 3000 and 8085
echo [1/4] Cleaning up old server ports (3000, 8085)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8085 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 > nul
echo Done.
echo.

:: Check Node.js and pnpm installation
echo [2/4] Verifying Node.js and pnpm...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this machine! Please install Node.js (v20+).
    pause
    exit /b
)
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pnpm package manager is not installed!
    echo Please install it by running: npm install -g pnpm
    pause
    exit /b
)
echo Verified successfully.
echo.

:: Database setup/seeding checks
echo [3/4] Checking offline database status...
if not exist "%~dp0school.db" (
    echo [DATABASE] Local SQLite database file 'school.db' not found.
    echo Building database schema...
    call pnpm --filter @workspace/db push
    echo Seeding default school data...
    call pnpm --filter @workspace/scripts seed
) else (
    echo Database 'school.db' found.
)
echo Done.
echo.

:: Launch the servers
echo [4/4] Starting Local Servers...

:: Start the API Server (port 8085)
start /min "Offline API Server" cmd /c "title API Server (SQLite) && cd /d %~dp0 && pnpm --filter @workspace/api-server run dev"
timeout /t 2 > nul

:: Start the Frontend Server (port 3000)
start /min "Offline Frontend Server" cmd /c "title Frontend Server && cd /d %~dp0 && set "PORT=3000" && set "BASE_PATH=/" && pnpm --filter @workspace/school-report run dev"
timeout /t 5 > nul

:: Launch browser to login page
echo.
echo Launching web browser to the login page...
start http://localhost:3000
echo.

cls
echo ==========================================================
echo       OFFLINE SYSTEM IS RUNNING ON PORT 3000
echo ==========================================================
echo.
echo   * URL to access: http://localhost:3000
echo.
echo   * Keep this window open during use.
echo     Press any key to stop all local servers.
echo.
echo ==========================================================
echo.

pause

echo.
echo Stopping all local servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8085 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo All servers shut down successfully.
timeout /t 2 >nul
