@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PID_FILE=%SCRIPT_DIR%scripts\git-autocommit.pid"
set "LOG_FILE=%SCRIPT_DIR%git-autocommit.log"

echo ==========================================================
echo       Git Auto-Commit Service Status
echo ==========================================================
echo.

if not exist "%PID_FILE%" goto STOPPED

set /p PID=<"%PID_FILE%"
tasklist /FI "PID eq %PID%" 2>nul | findstr /I "powershell" >nul
if errorlevel 1 goto STOPPED

echo Status: RUNNING (PID: %PID%)
goto LOGS

:STOPPED
echo Status: STOPPED

:LOGS
echo.
echo Last 10 log entries:
echo ----------------------------------------------------------
if exist "%LOG_FILE%" (
    powershell -Command "Get-Content '%LOG_FILE%' -Tail 10"
) else (
    echo No log file found at %LOG_FILE%.
)
echo ----------------------------------------------------------
echo.
