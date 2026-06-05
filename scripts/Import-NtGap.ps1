param(
    [string]$Contract = "GC 08-26",
    [string]$Last,
    [string]$Bid,
    [string]$Ask,
    [string]$DataDir,
    [string]$TicksDir,
    [string]$CacheDb,
    [string]$From,
    [string]$To,
    [string]$UtcOffset = "+00:00",
    [ValidateSet("missing-only", "replace-range")]
    [string]$Mode = "missing-only",
    [int]$ChunkSize = 100000,
    [switch]$DryRun,
    [switch]$NoRebuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir "..")).Path
$backendDir = Join-Path $repoRoot "backend"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    $python = "python"
}

if ([string]::IsNullOrWhiteSpace($Last)) {
    $Last = Join-Path $repoRoot "$Contract.Last.txt"
}
if ([string]::IsNullOrWhiteSpace($Bid)) {
    $Bid = Join-Path $repoRoot "$Contract.Bid.txt"
}
if ([string]::IsNullOrWhiteSpace($Ask)) {
    $Ask = Join-Path $repoRoot "$Contract.Ask.txt"
}

$argsList = @(
    "-m", "app.backfill.nt_export",
    "--contract", $Contract,
    "--last", $Last,
    "--bid", $Bid,
    "--ask", $Ask,
    "--utc-offset", $UtcOffset,
    "--mode", $Mode,
    "--chunk-size", $ChunkSize
)

if (-not [string]::IsNullOrWhiteSpace($DataDir)) {
    $argsList += @("--data-dir", $DataDir)
}
if (-not [string]::IsNullOrWhiteSpace($TicksDir)) {
    $argsList += @("--ticks-dir", $TicksDir)
}
if (-not [string]::IsNullOrWhiteSpace($CacheDb)) {
    $argsList += @("--cache-db", $CacheDb)
}
if (-not [string]::IsNullOrWhiteSpace($From)) {
    $argsList += @("--from", $From)
}
if (-not [string]::IsNullOrWhiteSpace($To)) {
    $argsList += @("--to", $To)
}
if ($DryRun) {
    $argsList += "--dry-run"
}
if ($NoRebuild) {
    $argsList += "--no-rebuild"
}

Push-Location $backendDir
try {
    & $python @argsList
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
