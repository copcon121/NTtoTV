@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\Import-NtExportGui.ps1"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Import finished.
) else (
  echo Import failed with exit code %RC%.
)
pause
exit /b %RC%
