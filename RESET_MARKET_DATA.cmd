@echo off
setlocal

cd /d "%~dp0"

echo.
echo GC market data reset
echo Repo: %CD%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Reset-MarketData.ps1" -StopBackend -RestartBackend
set RESET_EXIT=%ERRORLEVEL%

echo.
if not "%RESET_EXIT%"=="0" (
  echo Reset failed with exit code %RESET_EXIT%.
) else (
  echo Reset finished successfully.
)
echo.
pause
exit /b %RESET_EXIT%
