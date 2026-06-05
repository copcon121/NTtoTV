$ErrorActionPreference = 'SilentlyContinue'
Write-Output "=== NinjaTrader core/custom dll locations ==="
Get-ChildItem "C:\Users\Administrator\Documents\NinjaTrader 8" -Recurse -Include NinjaTrader.Core.dll,NinjaTrader.Custom.dll,NinjaTrader.Cbi.dll,NinjaTrader.Data.dll -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty FullName

Write-Output "=== existing dotnet sdks (PATH dotnet) ==="
& dotnet --list-sdks 2>&1

Write-Output "=== msbuild on PATH ==="
(Get-Command msbuild -ErrorAction SilentlyContinue).Source

Write-Output "=== VS / BuildTools MSBuild ==="
Get-ChildItem "C:\Program Files\Microsoft Visual Studio","C:\Program Files (x86)\Microsoft Visual Studio" -Recurse -Filter MSBuild.exe -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty FullName

Write-Output "=== local dotnet dir already present? ==="
Test-Path "C:\Users\Administrator\dotnet\dotnet.exe"

Write-Output "DONE"
