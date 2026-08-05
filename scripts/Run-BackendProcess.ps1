param(
    [int]$Port = 8000,
    [string]$StdoutLog = "",
    [string]$StderrLog = ""
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
$env:NTTOTV_MARKET_DATA_PREFERRED_SOURCE = "bookmap"

Set-Location -LiteralPath $backendDir
if ($StdoutLog -and $StderrLog) {
    # Use cmd /c to perform file-based redirection that survives the parent
    # terminal closing.  PowerShell's native 1> 2> operators inherit the
    # caller's console handles which may not exist in a -WindowStyle Hidden
    # wrapper.
    $cmdLine = "`"$python`" -m uvicorn app.app:app --host 0.0.0.0 --port $Port 1>`"$StdoutLog`" 2>`"$StderrLog`""
    cmd /c $cmdLine
    exit $LASTEXITCODE
} else {
    & $python -m uvicorn app.app:app --host 0.0.0.0 --port $Port
    exit $LASTEXITCODE
}
