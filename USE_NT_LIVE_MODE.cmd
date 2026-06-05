@echo off
setlocal
set "ROOT=%~dp0"
set "SRC=%ROOT%nt-addon\ninjascript\gc-chart-bridge.json"
set "DST=%USERPROFILE%\Documents\NinjaTrader 8\gc-chart-bridge.json"

if not exist "%SRC%" (
  echo Missing source config: "%SRC%"
  exit /b 1
)

copy /Y "%DST%" "%DST%.bak-live-switch" >nul 2>nul
copy /Y "%SRC%" "%DST%" >nul
if errorlevel 1 (
  echo Failed to write "%DST%"
  exit /b 1
)

echo NinjaTrader bridge config switched to LIVE chart mode.
echo Restart NinjaTrader or compile NinjaScript for the change to take effect.
