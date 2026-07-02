param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backendDir = Join-Path $repoRoot "backend"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Backend Python was not found: $python"
}

$env:NTTOTV_MT5_BACKEND = "real"
$env:NTTOTV_TRADING_ENABLED = "1"
$env:NTTOTV_LIVE_TRADING_ENABLED = "1"
$env:NTTOTV_INVITE_CODE = "join-9999"

Set-Location -LiteralPath $backendDir
& $python -m uvicorn app.app:app --host 0.0.0.0 --port $Port
exit $LASTEXITCODE
