param(
    [string]$Last,
    [string]$Contract,
    [string]$From,
    [string]$To,
    [string]$UtcOffset = "+00:00",
    [string]$CacheDb,
    [switch]$DryRun,
    [switch]$NoClear
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir "..")).Path
$importScript = Join-Path $scriptDir "Import-NtGap.ps1"

if ([string]::IsNullOrWhiteSpace($Last)) {
    $Last = Join-Path $repoRoot "export data\GC 08-26-5-6.Last.txt"
}
if (-not (Test-Path -LiteralPath $Last)) {
    throw "Last export not found: $Last"
}
$Last = (Resolve-Path -LiteralPath $Last).Path

function Get-CanonicalContractFromLastPath {
    param([string]$Path)

    $name = [IO.Path]::GetFileName($Path) -replace "\.Last\.txt$", ""
    if ($name -match "^(GC \d{2}-\d{2})") {
        return $Matches[1]
    }
    return $name
}

if ([string]::IsNullOrWhiteSpace($Contract)) {
    $Contract = Get-CanonicalContractFromLastPath -Path $Last
}

$params = @{
    Contract = $Contract
    Last = $Last
    UtcOffset = $UtcOffset
    SkipRecentRaw = $true
}
if (-not $NoClear) {
    $params.ClearDerivedRange = $true
}
if (-not [string]::IsNullOrWhiteSpace($From)) {
    $params.From = $From
}
if (-not [string]::IsNullOrWhiteSpace($To)) {
    $params.To = $To
}
if (-not [string]::IsNullOrWhiteSpace($CacheDb)) {
    $params.CacheDb = $CacheDb
}
if ($DryRun) {
    $params.DryRun = $true
}

Write-Host "Importing Last-only export into chart cache..."
Write-Host "  Last:     $Last"
Write-Host "  Source:   $Contract"
Write-Host "  ChartKey: GC"
Write-Host "  Raw:      skipped"
Write-Host "  Clear:    $(-not $NoClear)"
& $importScript @params
$rc = $LASTEXITCODE
if ($rc -ne 0) {
    exit $rc
}

Write-Host ""
Write-Host "Import complete. Verify:"
Write-Host "  http://127.0.0.1:8000/api/history?symbol=GC&contract=GC&tf=1m&limit=5"
Write-Host "  http://127.0.0.1:8000/api/orderflow/volume-delta?symbol=GC&contract=GC&tf=1m&limit=5"
