param(
    [string]$Contract = "GC 06-26",
    [string]$SourceDir,
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
    [int]$RawRetentionDays = 2,
    [switch]$DryRun,
    [switch]$NoRebuild,
    [switch]$SkipDerived,
    [switch]$SkipRecentRaw,
    [switch]$ClearDerivedRange
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

if ([string]::IsNullOrWhiteSpace($SourceDir)) {
    $SourceDir = Join-Path $repoRoot "export data"
}

if ([string]::IsNullOrWhiteSpace($Last) -and -not (Test-Path -LiteralPath $SourceDir)) {
    $Last = Join-Path $repoRoot "$Contract.Last.txt"
}
if ([string]::IsNullOrWhiteSpace($Bid)) {
    $Bid = Join-Path $repoRoot "$Contract.Bid.txt"
}
if ([string]::IsNullOrWhiteSpace($Ask)) {
    $Ask = Join-Path $repoRoot "$Contract.Ask.txt"
}

function Add-CommonArgs {
    param([string[]]$ArgsList)

    if (-not [string]::IsNullOrWhiteSpace($DataDir)) {
        $ArgsList += @("--data-dir", $DataDir)
    }
    if (-not [string]::IsNullOrWhiteSpace($CacheDb)) {
        $ArgsList += @("--cache-db", $CacheDb)
    }
    if (-not [string]::IsNullOrWhiteSpace($From)) {
        $ArgsList += @("--from", $From)
    }
    if (-not [string]::IsNullOrWhiteSpace($To)) {
        $ArgsList += @("--to", $To)
    }
    if ($DryRun) {
        $ArgsList += "--dry-run"
    }
    return $ArgsList
}

function Get-CutoffIso {
    param([int]$Days)

    if ($Days -lt 1) {
        throw "RawRetentionDays must be >= 1"
    }
    return [DateTime]::UtcNow.Date.AddDays(-($Days - 1)).ToString("yyyy-MM-ddTHH:mm:ssZ", [Globalization.CultureInfo]::InvariantCulture)
}

function Get-LastNonEmptyLine {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    $lines = @(Get-Content -LiteralPath $Path -Tail 20)
    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
        $line = [string]$lines[$i]
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            return $line
        }
    }
    return $null
}

function Get-NtLineDate {
    param([string]$Line)

    if ([string]::IsNullOrWhiteSpace($Line) -or $Line.Length -lt 8) {
        return $null
    }
    $dateText = $Line.Substring(0, 8)
    try {
        return [DateTime]::ParseExact(
            $dateText,
            "yyyyMMdd",
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::AssumeUniversal
        ).Date
    } catch {
        return $null
    }
}

function Test-ExportTouchesRecentRaw {
    param(
        [string]$LastPath,
        [DateTime]$CutoffDay
    )

    $lastLine = Get-LastNonEmptyLine -Path $LastPath
    $lastDate = Get-NtLineDate -Line $lastLine
    if ($null -eq $lastDate) {
        return $true
    }
    return $lastDate -ge $CutoffDay
}

Push-Location $backendDir
try {
    if (-not $SkipDerived) {
        $derivedArgs = @(
            "-m", "app.backfill.nt_export",
            "--contract", $Contract,
            "--utc-offset", $UtcOffset,
            "--chunk-size", $ChunkSize,
            "--derived-only"
        )
        if (-not [string]::IsNullOrWhiteSpace($Last) -and (Test-Path -LiteralPath $Last)) {
            $derivedArgs += @("--last", $Last)
        } elseif (-not [string]::IsNullOrWhiteSpace($SourceDir) -and (Test-Path -LiteralPath $SourceDir)) {
            $derivedArgs += @("--source-dir", $SourceDir)
        } else {
            throw "No Last export file or source directory found for derived import."
        }
        if ($ClearDerivedRange) {
            $derivedArgs += "--clear-derived-range"
        }
        $derivedArgs = Add-CommonArgs -ArgsList $derivedArgs

        Write-Host "Importing lightweight history cache (bars + volume delta)..."
        & $python @derivedArgs
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }

    if ($SkipRecentRaw) {
        Write-Host "Skipping recent raw tick/quote import."
        exit 0
    }

    if (
        [string]::IsNullOrWhiteSpace($Last) -or
        [string]::IsNullOrWhiteSpace($Bid) -or
        [string]::IsNullOrWhiteSpace($Ask) -or
        -not (Test-Path -LiteralPath $Last) -or
        -not (Test-Path -LiteralPath $Bid) -or
        -not (Test-Path -LiteralPath $Ask)
    ) {
        Write-Host "No complete Last/Bid/Ask set supplied; derived cache import complete."
        exit 0
    }

    $cutoffIso = Get-CutoffIso -Days $RawRetentionDays
    $cutoffDay = [DateTime]::ParseExact(
        $cutoffIso.Substring(0, 10),
        "yyyy-MM-dd",
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal
    ).Date
    if (-not (Test-ExportTouchesRecentRaw -LastPath $Last -CutoffDay $cutoffDay)) {
        Write-Host "Export ends before $cutoffIso; no recent raw tick/quote import needed."
        exit 0
    }

    $rawArgs = @(
        "-m", "app.backfill.nt_export",
        "--contract", $Contract,
        "--last", $Last,
        "--bid", $Bid,
        "--ask", $Ask,
        "--utc-offset", $UtcOffset,
        "--mode", $Mode,
        "--chunk-size", $ChunkSize,
        "--from", $cutoffIso,
        "--no-rebuild"
    )
    if (-not [string]::IsNullOrWhiteSpace($DataDir)) {
        $rawArgs += @("--data-dir", $DataDir)
    }
    if (-not [string]::IsNullOrWhiteSpace($TicksDir)) {
        $rawArgs += @("--ticks-dir", $TicksDir)
    }
    if ($DryRun) {
        $rawArgs += "--dry-run"
    }

    Write-Host "Importing recent raw tick/quote data from $cutoffIso only..."
    & $python @rawArgs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
