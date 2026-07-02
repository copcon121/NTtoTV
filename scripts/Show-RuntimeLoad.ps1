$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Listeners:"
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in @(80, 443, 5173, 8000, 9999) } |
    Select-Object LocalAddress, LocalPort, OwningProcess |
    Sort-Object LocalPort |
    Format-Table -AutoSize

Write-Host ""
Write-Host "Project/IDE/runtime processes by memory:"
$interestingNames = @(
    "python.exe",
    "powershell.exe",
    "node.exe",
    "esbuild.exe",
    "caddy.exe",
    "terminal64.exe",
    "NinjaTrader.exe",
    "Antigravity IDE.exe",
    "language_server_windows_x64.exe",
    "pyrefly.exe",
    "codex.exe"
)

$processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -in $interestingNames -or ([string]$_.CommandLine -match [regex]::Escape($repoRoot))
})
$byPid = @{}
foreach ($process in Get-Process -ErrorAction SilentlyContinue) {
    $byPid[$process.Id] = $process
}

$processes |
    ForEach-Object {
        $p = $byPid[[int]$_.ProcessId]
        [pscustomobject]@{
            Pid = [int]$_.ProcessId
            Name = $_.Name
            CPU = if ($p) { [math]::Round([double]$p.CPU, 1) } else { $null }
            MB = if ($p) { [math]::Round($p.WorkingSet64 / 1MB, 1) } else { $null }
            CommandLine = $_.CommandLine
        }
    } |
    Sort-Object MB -Descending |
    Select-Object -First 40 |
    Format-Table -AutoSize
