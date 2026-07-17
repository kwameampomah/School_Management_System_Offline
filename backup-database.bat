@echo off
title School Report Manager - Database Backup Utility
color 0B
cls

echo ==========================================================
echo        School Report Manager - Database Backup
echo ==========================================================
echo.

:: Define backup directory (inside project folder)
set BACKUP_DIR=%~dp0backups
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

:: Get current date and time in YYYYMMDD_HHMMSS format
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (set mytime=%%a%%b)
:: Clean up spaces
set mydate=%mydate: =%
set mytime=%mytime: =%
set TIMESTAMP=%mydate%_%mytime%

set FILE_NAME=%BACKUP_DIR%\school_report_backup_%TIMESTAMP%.sql

echo Backing up database to:
echo %FILE_NAME%
echo.

:: Run pg_dump
echo Running backup process...
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -p 5433 -U postgres school_report > "%FILE_NAME%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ SUCCESS: Database backup created successfully!
    echo.
    
    :: Auto-clean backups older than 30 days
    echo Cleaning up backups older than 30 days...
    forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path" 2>nul
    echo Done.
    echo.
) else (
    echo.
    echo ❌ ERROR: Database backup failed!
    echo Ensure PostgreSQL is running on port 5433.
    echo.
)

echo ==========================================================
pause
