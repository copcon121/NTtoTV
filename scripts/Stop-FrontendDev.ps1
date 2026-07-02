param(
    [int]$Port = 5173,
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$frontendDir = Join-Path $repoRoot "frontend"
$frontendPattern = [regex]::Escape($frontendDir)

$processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $cmd = [string]$_.CommandLine
    if ([string]::IsNullOrWhiteSpace($cmd)) {
        return $false
    }
    if ($_.Name -eq "node.exe" -and $cmd -match $frontendPattern -and $cmd -match "vite") {
        return $true
    }
    if ($_.Name -eq "node.exe" -and $cmd -match "npm-cli\.js" -and $cmd -match "run dev" -and $cmd -match "--port $Port") {
        return $true
    }
    if ($_.Name -eq "esbuild.exe" -and $cmd -match $frontendPattern) {
        return $true
    }
    return $false
})

$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    $owner = Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f [int]$listener.OwningProcess) -ErrorAction SilentlyContinue
    if ($owner -and [string]$owner.CommandLine -match $frontendPattern) {
        $processes += $owner
    }
}

$ids = @($processes | ForEach-Object { [int]$_.ProcessId } | Sort-Object -Unique)
if ($ids.Count -eq 0) {
    Write-Host "No frontend dev server process found on port $Port."
    return
}

foreach ($id in $ids) {
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host ("Stopping frontend dev PID {0} ({1})" -f $id, $process.ProcessName)
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
}

$deadline = (Get-Date).AddSeconds($TimeoutSec)
do {
    $remaining = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
    if ($remaining.Count -eq 0) {
        Write-Host "Frontend dev server stopped."
        return
    }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)

$left = ($remaining | ForEach-Object { $_.Id }) -join ", "
throw "Frontend dev process(es) did not stop in time: $left"
