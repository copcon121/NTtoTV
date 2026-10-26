param(
    [int]$Days = 90,
    [string]$From = "",
    [string]$To = "",
    [int]$MaxHours = 0,
    [int]$MaxRetries = 0,
    [int]$RetrySeconds = 300
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"
$credentialPath = Join-Path $env:LOCALAPPDATA "NTtoTV\rithmic.credential.xml"
$credential = Import-Clixml -LiteralPath $credentialPath
$env:NTTOTV_RITHMIC_USER = $credential.UserName
$env:NTTOTV_RITHMIC_PASSWORD = $credential.GetNetworkCredential().Password
$env:NTTOTV_RITHMIC_SYSTEM = "Rithmic Paper Trading"
$env:NTTOTV_RITHMIC_APP_NAME = "Bookmap"
$env:NTTOTV_RITHMIC_APP_VERSION = "7.4.0.21"
$arguments = @("-u", (Join-Path $repoRoot "backend\scripts\download_rithmic_history.py"), "--days", "$Days")
$arguments += @("--max-retries", "$MaxRetries", "--retry-seconds", "$RetrySeconds")
if ($From) { $arguments += @("--from", $From) }
if ($To) { $arguments += @("--to", $To) }
if ($MaxHours -gt 0) { $arguments += @("--max-hours", "$MaxHours") }
try {
    & $python @arguments
    $downloadExitCode = $LASTEXITCODE
} finally {
    Remove-Item Env:NTTOTV_RITHMIC_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:NTTOTV_RITHMIC_USER -ErrorAction SilentlyContinue
}
exit $downloadExitCode
