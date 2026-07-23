param(
    [string]$Root = "C:\Users\Administrator\Desktop\NTtoTV",
    [string]$LogDir = "C:\Bookmap\Logs",
    [string]$BackendUrl = "http://127.0.0.1:8000/api/bookmap/si/events",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$runDir = Join-Path $Root "_run_logs\bookmap-si-log-bridge"
$runtimeFile = Join-Path $runDir "runtime.json"
$stdout = Join-Path $runDir "stdout.log"
$stderr = Join-Path $runDir "stderr.log"
$stateFile = Join-Path $runDir "state.json"
$python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$script = Join-Path $Root "scripts\bookmap_si_log_bridge.py"

New-Item -ItemType Directory -Force -Path $runDir | Out-Null

if (!(Test-Path -LiteralPath $python)) {
    throw "Python not found: $python"
}
if (!(Test-Path -LiteralPath $script)) {
    throw "Bridge script not found: $script"
}

if (Test-Path -LiteralPath $runtimeFile) {
    $runtime = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
    $pidValue = [int]$runtime.ProcessId
    $existing = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    $bridgeProcesses = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -match 'bookmap_si_log_bridge\.py' }
    if (($existing -or $bridgeProcesses) -and !$Force) {
        [pscustomobject]@{
            Status = "already-running"
            ProcessId = $pidValue
            Stdout = $stdout
            Stderr = $stderr
        }
        exit 0
    }
    if ($Force) {
        foreach ($bridgeProcess in $bridgeProcesses) {
            Stop-Process -Id ([int]$bridgeProcess.ProcessId) -Force -ErrorAction SilentlyContinue
        }
        if ($existing) {
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        }
    }
}

$arguments = @(
    $script,
    "--log-dir", $LogDir,
    "--backend-url", $BackendUrl,
    "--state-file", $stateFile
)

$process = Start-Process `
    -FilePath $python `
    -ArgumentList $arguments `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru

[pscustomobject]@{
    ProcessId = $process.Id
    StartedAt = (Get-Date).ToUniversalTime().ToString("o")
    LogDir = $LogDir
    BackendUrl = $BackendUrl
    Stdout = $stdout
    Stderr = $stderr
    State = $stateFile
} | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding ASCII

[pscustomobject]@{
    Status = "started"
    ProcessId = $process.Id
    Stdout = $stdout
    Stderr = $stderr
    State = $stateFile
}
