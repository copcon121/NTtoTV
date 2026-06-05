param(
    [switch]$DryRun,
    [switch]$NoBackup,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message"
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Resolve-RepoRoot {
    $scriptDir = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($scriptDir)) {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    }

    return (Resolve-Path -LiteralPath (Join-Path $scriptDir "..")).Path
}

function Assert-RepoRoot {
    param([string]$Root)

    $required = @(
        "backend\app\config.py",
        "backend\app\storage\tick_store.py",
        "nt-addon"
    )

    foreach ($item in $required) {
        $path = Join-Path $Root $item
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Refusing to reset data because repo marker is missing: $path"
        }
    }
}

function Get-DataSummary {
    param([string]$DataDir)

    if (-not (Test-Path -LiteralPath $DataDir)) {
        return [pscustomobject]@{
            Exists = $false
            FileCount = 0
            TotalBytes = 0L
            SqliteCount = 0
        }
    }

    $files = @(Get-ChildItem -LiteralPath $DataDir -Recurse -Force -File -ErrorAction Stop)
    $totalBytes = 0L
    foreach ($file in $files) {
        $totalBytes += [int64]$file.Length
    }

    return [pscustomobject]@{
        Exists = $true
        FileCount = $files.Count
        TotalBytes = $totalBytes
        SqliteCount = @($files | Where-Object { $_.Name -match "\.sqlite($|-)" }).Count
    }
}

function Format-Bytes {
    param([int64]$Bytes)

    if ($Bytes -ge 1GB) {
        return "{0:N2} GB" -f ($Bytes / 1GB)
    }
    if ($Bytes -ge 1MB) {
        return "{0:N2} MB" -f ($Bytes / 1MB)
    }
    if ($Bytes -ge 1KB) {
        return "{0:N2} KB" -f ($Bytes / 1KB)
    }
    return "$Bytes bytes"
}

function Get-BlockingProcesses {
    param([string]$Root)

    $rootPattern = [regex]::Escape($Root)
    $backendPattern = "uvicorn|backend[\\/]|backend\.app|app\.main|app\.app"

    $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $cmd = $_.CommandLine
        if ([string]::IsNullOrWhiteSpace($cmd)) {
            return $false
        }
        if ($cmd -notmatch $rootPattern) {
            return $false
        }
        if ($cmd -match "Reset-MarketData\.ps1") {
            return $false
        }
        return $cmd -match $backendPattern
    })

    return $processes
}

function New-UniqueBackupPath {
    param(
        [string]$BackupRoot,
        [string]$Stamp
    )

    $base = Join-Path $BackupRoot "backend-data-$Stamp"
    $candidate = $base
    $index = 1

    while (Test-Path -LiteralPath $candidate) {
        $candidate = "$base-$index"
        $index += 1
    }

    return $candidate
}

$repoRoot = Resolve-RepoRoot
Assert-RepoRoot -Root $repoRoot

$dataDir = Join-Path $repoRoot "backend\data"
$backupRoot = Join-Path $repoRoot "_data_backups"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Info "Repo root: $repoRoot"
Write-Info "Active data dir: $dataDir"

$summary = Get-DataSummary -DataDir $dataDir
if (-not $summary.Exists) {
    Write-Info "No active data directory exists. Creating a clean one."
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    }
    exit 0
}

Write-Info ("Found {0} files, {1} SQLite-related files, total {2}." -f `
    $summary.FileCount, $summary.SqliteCount, (Format-Bytes -Bytes $summary.TotalBytes))

$blockers = @(Get-BlockingProcesses -Root $repoRoot)
if ($blockers.Count -gt 0 -and -not $Force) {
    Write-Warn "Backend-like processes are running from this repo. Close them before resetting data."
    foreach ($process in $blockers) {
        Write-Warn ("PID {0}: {1}" -f $process.ProcessId, $process.CommandLine)
    }
    Write-Warn "Nothing was changed."
    exit 2
}

if ($DryRun) {
    if ($NoBackup) {
        Write-Info "Dry run: would permanently delete $dataDir and recreate it."
    } else {
        $backupPath = New-UniqueBackupPath -BackupRoot $backupRoot -Stamp $stamp
        Write-Info "Dry run: would move $dataDir to $backupPath and recreate a clean data directory."
    }
    exit 0
}

if ($NoBackup) {
    Write-Warn "Deleting active data directory without local backup."
    Remove-Item -LiteralPath $dataDir -Recurse -Force
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    Write-Info "Active data reset complete."
    exit 0
}

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$backupPath = New-UniqueBackupPath -BackupRoot $backupRoot -Stamp $stamp

Write-Info "Moving active data to backup: $backupPath"
Move-Item -LiteralPath $dataDir -Destination $backupPath
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

Write-Info "Active data reset complete. Backend will recreate SQLite files on next stream."
Write-Info "Local backup kept at: $backupPath"
