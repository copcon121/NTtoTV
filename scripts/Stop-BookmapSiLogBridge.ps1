param(
    [string]$Root = "C:\Users\Administrator\Desktop\NTtoTV"
)

$ErrorActionPreference = "Stop"

$runDir = Join-Path $Root "_run_logs\bookmap-si-log-bridge"
$runtimeFile = Join-Path $runDir "runtime.json"

if (!(Test-Path -LiteralPath $runtimeFile)) {
    [pscustomobject]@{ Status = "not-running" }
    exit 0
}

$runtime = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
$pidValue = [int]$runtime.ProcessId
$bridgeProcesses = Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -match 'bookmap_si_log_bridge\.py' }
foreach ($bridgeProcess in $bridgeProcesses) {
    Stop-Process -Id ([int]$bridgeProcess.ProcessId) -Force -ErrorAction SilentlyContinue
}
$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
}
Remove-Item -LiteralPath $runtimeFile -Force

[pscustomobject]@{
    Status = "stopped"
    ProcessId = $pidValue
}
