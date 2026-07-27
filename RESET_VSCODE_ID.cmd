@echo off
title Reset VS Code + Verdent IDs (Full)
echo.
echo  =============================================
echo   Reset MachineGuid + VS Code + Verdent IDs
echo   (Requires Administrator privileges)
echo  =============================================
echo.

:: Self-elevate to Admin if not already
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Reset-VSCodeMachineId.ps1"
echo.
pause
