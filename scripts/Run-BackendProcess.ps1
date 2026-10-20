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

# Rithmic Paper Trading connector (profile compatible with Bookmap 7.4.0.21)
$env:NTTOTV_RITHMIC_ENABLED = "1"
$env:NTTOTV_RITHMIC_SHADOW_MODE = "0"
$env:NTTOTV_RITHMIC_URI = "wss://rprotocol-mobile.rithmic.com:443"
$env:NTTOTV_RITHMIC_SYSTEM = "Rithmic Paper Trading"
$env:NTTOTV_RITHMIC_APP_NAME = "Bookmap"
$env:NTTOTV_RITHMIC_APP_VERSION = "7.4.0.21"
$env:NTTOTV_RITHMIC_EXCHANGE = "COMEX"
$env:NTTOTV_RITHMIC_SYMBOL = "GCZ6"
$env:NTTOTV_RITHMIC_CONTRACT = "GC 12-26"
$env:NTTOTV_RITHMIC_MODES = "l1,l2,mbo"
$env:NTTOTV_RITHMIC_QUALIFY_MS = "65000"

# Credentials are kept in a per-user DPAPI-encrypted CLIXML file outside the
# repository. Explicit process environment variables still take precedence.
$rithmicCredentialPath = Join-Path $env:LOCALAPPDATA "NTtoTV\rithmic.credential.xml"
if (
    (-not $env:NTTOTV_RITHMIC_USER -or -not $env:NTTOTV_RITHMIC_PASSWORD) -and
    (Test-Path -LiteralPath $rithmicCredentialPath)
) {
    $rithmicCredential = Import-Clixml -LiteralPath $rithmicCredentialPath
    $env:NTTOTV_RITHMIC_USER = $rithmicCredential.UserName
    $env:NTTOTV_RITHMIC_PASSWORD = $rithmicCredential.GetNetworkCredential().Password
}

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
