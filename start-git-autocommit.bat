@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%scripts\git-autocommit.ps1"
set "PID_FILE=%SCRIPT_DIR%scripts\git-autocommit.pid"

if not exist "%PID_FILE%" goto START_SERVICE

set /p PID=<"%PID_FILE%"
tasklist /FI "PID eq %PID%" 2>nul | findstr /I "powershell" >nul
if errorlevel 1 goto START_SERVICE

echo Git auto-commit service is already running in background with PID %PID%.
exit /b 0

:START_SERVICE
echo Starting Git auto-commit service in the background...
start "" /min powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -IntervalSeconds 300

ping 127.0.0.1 -n 3 >nul

if not exist "%PID_FILE%" goto FAIL

set /p NEW_PID=<"%PID_FILE%"
echo Git auto-commit service started successfully (PID: %NEW_PID%).
exit /b 0

:FAIL
echo Failed to start Git auto-commit service or PID file not generated.
exit /b 1
