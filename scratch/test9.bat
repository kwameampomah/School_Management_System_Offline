@echo off
set "ENV_PATH=%~dp0..\.env"
set "DB_MODE="
for /f "usebackq" %%a in (`powershell -NoProfile -Command "if (Test-Path $env:ENV_PATH) { $data = Get-Content $env:ENV_PATH | ConvertFrom-StringData; if ($data.DB_MODE) { $data.DB_MODE } }"`) do (
    set "DB_MODE=%%a"
)
echo DB_MODE is: "%DB_MODE%"
