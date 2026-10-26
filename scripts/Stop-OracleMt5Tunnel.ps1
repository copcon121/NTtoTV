param([switch]$Unregister)

$ErrorActionPreference = "Stop"
$taskName = "NTtoTV Oracle MT5 private tunnel"
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$pidFile = Join-Path $env:LOCALAPPDATA "NTtoTV\oracle-mt5-tunnel\ssh.pid"
if (Test-Path -LiteralPath $pidFile) {
    $tunnelProcessId = 0
    if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$tunnelProcessId)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $tunnelProcessId"
        if ($process -and $process.Name -eq "ssh.exe" -and
            $process.CommandLine -like "*127.0.0.1:18080:127.0.0.1:8000*") {
            Stop-Process -Id $tunnelProcessId
        }
    }
}
if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}
Write-Host "Stopped the Oracle MT5 private tunnel"
