@echo off
:: Self-minimizing check: If this is a new launch, restart minimized
if not "%1"=="min" (
    start /min "" "%~0" min
    exit /b
)

title Ghana GES School Report Manager Launcher
color 0A
cls

:: Load DB_MODE from .env file if it exists
set "ENV_PATH=%~dp0.env"
for /f "usebackq" %%a in (`powershell -NoProfile -Command "if (Test-Path $env:ENV_PATH) { $data = Get-Content $env:ENV_PATH | ConvertFrom-StringData; if ($data.DB_MODE) { $data.DB_MODE } }"`) do (
    set "DB_MODE=%%a"
)


echo ==========================================================
echo       Ghana GES School Report Manager Startup
echo ==========================================================
echo.

:: Clean up dangling server processes on ports 3000, 8085, and 5433
echo [1/6] Cleaning up old server processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8085 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5433 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 > nul
echo Done.
echo.

:: Start Git Auto-Commit background service
echo Starting Git Auto-Commit background service...
call "%~dp0start-git-autocommit.bat"
echo.

:: Detect local IP address
echo [2/6] Detecting local IP address...
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
)
if "%LOCAL_IP%"=="" (
    set LOCAL_IP=127.0.0.1
)
echo Local Server IP detected as: %LOCAL_IP%
echo.

:: Check if PostgreSQL is already running on port 5433 using pg_isready
echo [3/6] Checking PostgreSQL status...
if "%DB_MODE%"=="cloud" (
    echo Database is running in CLOUD mode - Neon. Skipping local PostgreSQL startup.
    goto start_api
)

"C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 -p 5433 >nul 2>&1
if "%errorlevel%"=="0" (
    echo Database is already running on port 5433.
    goto start_api
)

echo Database is stopped. 

rem Delete old postmaster.pid lock file if present (recovers database after power cut / crash)
if exist "%USERPROFILE%\pgdata\postmaster.pid" (
    echo Recovering database lock file...
    del "%USERPROFILE%\pgdata\postmaster.pid" >nul 2>&1
)

echo Starting custom PostgreSQL server on port 5433...
start /min "PostgreSQL Database Server" "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "%USERPROFILE%\pgdata" -p 5433
timeout /t 5 > nul

:start_api
echo.

:: Start API Server minimized (HTTP) on port 8085
echo [4/6] Starting API Backend Server on port 8085...
if "%DB_MODE%"=="cloud" (
    start /min "Ghana GES - API Server" cmd /c "title API Server && cd /d %~dp0 && pnpm --filter @workspace/api-server run dev"
) else (
    start /min "Ghana GES - API Server" cmd /c "title API Server && cd /d %~dp0 && set "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/school_report" && set "SESSION_SECRET=78e8117fe38132cc1bb461ed6cf88b316dc9c0785075d4d6f1ed5508488bbe2b7740737bc6f2189c1541b0c311cd28f835dda744afd2a1fa129e89ad3034bf85" && set "PORT=8085" && set "NODE_ENV=development" && set "HTTPS=false" && pnpm --filter @workspace/api-server run dev"
)
timeout /t 2 > nul
echo.

:: Start Frontend Server minimized (HTTP)
echo [5/6] Starting Frontend Server on port 3000...
start /min "Ghana GES - Frontend Server" cmd /c "title Frontend Server && cd /d %~dp0 && set "PORT=3000" && set "BASE_PATH=/" && pnpm --filter @workspace/school-report run dev"
timeout /t 5 > nul
echo.

:: Automatically open browser
echo [6/6] Launching default web browser to the login page...
start http://localhost:3000
echo.

cls
echo ==========================================================
echo       SYSTEM IS RUNNING SEAMLESSLY ON YOUR NETWORK
echo ==========================================================
echo.
echo   * Local access URL:
echo     http://localhost:3000
echo.
echo   * School Network (LAN) access URL:
echo     http://%LOCAL_IP%:3000
echo.
echo   * Share the School Network URL with teachers and
echo     admins connected to the same school Wi-Fi.
echo.
echo   * Keep this window open during school hours.
echo     Press any key to shut down all servers.
echo.
echo ==========================================================
echo.

pause

echo.
echo Shutting down all servers...
:: Kill API Server
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8085 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
:: Kill Frontend Server
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
:: Stop Git Auto-Commit Service
call "%~dp0stop-git-autocommit.bat" >nul

echo All servers shut down successfully.
timeout /t 2 >nul
