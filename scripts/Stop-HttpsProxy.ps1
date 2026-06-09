$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $repoRoot "_run_logs\caddy"
$pidFile = Join-Path $logDir "caddy.pid"

if (-not (Test-Path $pidFile)) {
    Write-Host "No Caddy pid file found."
    exit 0
}

$pidValue = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $pidValue) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Caddy pid file was empty."
    exit 0
}

$process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Host "Stopped Caddy PID $pidValue"
} else {
    Write-Host "Caddy PID $pidValue was not running."
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
