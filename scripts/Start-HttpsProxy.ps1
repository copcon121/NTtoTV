param(
    [switch]$BuildFrontend
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$caddyExe = Join-Path $repoRoot "tools\caddy\caddy.exe"
$caddyFile = Join-Path $repoRoot "deploy\caddy\Caddyfile"
$frontendDist = Join-Path $repoRoot "frontend\dist"
$logDir = Join-Path $repoRoot "_run_logs\caddy"
$pidFile = Join-Path $logDir "caddy.pid"

if (-not (Test-Path $caddyExe)) {
    & (Join-Path $repoRoot "scripts\Install-CaddyPortable.ps1")
}

if ($BuildFrontend -or -not (Test-Path (Join-Path $frontendDist "index.html"))) {
    Push-Location (Join-Path $repoRoot "frontend")
    try {
        npm run build
    } finally {
        Pop-Location
    }
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$env:XDG_DATA_HOME = Join-Path $logDir "data"
$env:XDG_CONFIG_HOME = Join-Path $logDir "config"
New-Item -ItemType Directory -Force -Path $env:XDG_DATA_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $env:XDG_CONFIG_HOME | Out-Null

if (Test-Path $pidFile) {
    $existingPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($existingPid) {
        $existing = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "Caddy is already running with PID $existingPid"
            exit 0
        }
    }
}

& $caddyExe validate --config $caddyFile --adapter caddyfile

$stdout = Join-Path $logDir "caddy.stdout.log"
$stderr = Join-Path $logDir "caddy.stderr.log"
$process = Start-Process `
    -FilePath $caddyExe `
    -ArgumentList @("run", "--config", $caddyFile, "--adapter", "caddyfile") `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr

Set-Content -LiteralPath $pidFile -Value $process.Id
Write-Host "Started Caddy HTTPS proxy with PID $($process.Id)"
Write-Host "Logs: $stdout and $stderr"
