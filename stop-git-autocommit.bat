@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PID_FILE=%SCRIPT_DIR%scripts\git-autocommit.pid"

if not exist "%PID_FILE%" goto NOT_RUNNING

set /p PID=<"%PID_FILE%"
tasklist /FI "PID eq %PID%" 2>nul | findstr /I "powershell" >nul
if errorlevel 1 goto PROCESS_NOT_FOUND

echo Stopping Git auto-commit service (PID: %PID%)...
taskkill /F /PID %PID% >nul 2>&1

:CLEANUP
if exist "%PID_FILE%" (
    del "%PID_FILE%"
)
echo Git auto-commit service stopped successfully.
exit /b 0

:PROCESS_NOT_FOUND
echo Process %PID% not found or is not PowerShell. Removing stale PID file.
if exist "%PID_FILE%" (
    del "%PID_FILE%"
)
exit /b 0

:NOT_RUNNING
echo Git auto-commit service is not running (no PID file found).
exit /b 0
