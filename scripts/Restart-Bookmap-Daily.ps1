[CmdletBinding()]
param(
    [string]$BookmapExe = "C:\Program Files\Bookmap\Bookmap.exe",
    [string]$BookmapRoot = "C:\Bookmap",
    [string]$MarketStatusUrl = "http://127.0.0.1:8000/api/market-data/status",
    [int]$GracefulTimeoutSec = 90,
    [int]$ReconnectTimeoutSec = 300,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $repoRoot "_run_logs\bookmap-maintenance"
$logFile = Join-Path $logDir ("maintenance-{0}.log" -f (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd"))
$cachePath = Join-Path $BookmapRoot "Cache"
$remoteCachePath = Join-Path $BookmapRoot "Remote cache"
$dataLibraryPath = Join-Path $BookmapRoot "Data library"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-MaintenanceLog {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )

    $line = "{0} [{1}] {2}" -f (Get-Date).ToUniversalTime().ToString("o"), $Level, $Message
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Get-PathStats {
    param(
        [string]$Path,
        [string]$Filter = "*"
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ Files = 0; Bytes = [int64]0 }
    }

    $files = @(Get-ChildItem -LiteralPath $Path -Recurse -File -Force -Filter $Filter -ErrorAction SilentlyContinue)
    $measure = $files | Measure-Object -Property Length -Sum
    $bytes = if ($null -eq $measure -or $null -eq $measure.Sum) {
        [int64]0
    } else {
        [int64]$measure.Sum
    }
    return [pscustomobject]@{
        Files = $files.Count
        Bytes = $bytes
    }
}

function Assert-MaintenancePath {
    param(
        [string]$Path,
        [string]$ExpectedLeaf
    )

    $root = [IO.Path]::GetFullPath($BookmapRoot).TrimEnd('\')
    $target = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    if ([IO.Path]::GetDirectoryName($target) -ne $root) {
        throw "Refusing maintenance outside the Bookmap root: $target"
    }
    if ([IO.Path]::GetFileName($target) -ne $ExpectedLeaf) {
        throw "Unexpected Bookmap maintenance target: $target"
    }
}

function Get-BookmapProcesses {
    $expectedExe = [IO.Path]::GetFullPath($BookmapExe)
    return @(
        Get-CimInstance Win32_Process -Filter "Name='Bookmap.exe'" -ErrorAction SilentlyContinue |
            Where-Object {
                $_.ExecutablePath -and
                [IO.Path]::GetFullPath([string]$_.ExecutablePath) -eq $expectedExe
            }
    )
}

function Stop-Bookmap {
    $processes = @(Get-BookmapProcesses)
    if ($processes.Count -eq 0) {
        Write-MaintenanceLog "Bookmap is not running; cleanup will continue."
        return
    }

    foreach ($process in $processes) {
        Write-MaintenanceLog ("Requesting graceful shutdown for Bookmap PID {0}." -f $process.ProcessId)
        try {
            $liveProcess = Get-Process -Id ([int]$process.ProcessId) -ErrorAction Stop
            $null = $liveProcess.CloseMainWindow()
        } catch {
            Write-MaintenanceLog ("Graceful shutdown request failed for PID {0}: {1}" -f $process.ProcessId, $_.Exception.Message) "WARN"
        }
    }

    $deadline = (Get-Date).AddSeconds($GracefulTimeoutSec)
    do {
        if (@(Get-BookmapProcesses).Count -eq 0) {
            Write-MaintenanceLog "Bookmap stopped gracefully."
            return
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    $remaining = @(Get-BookmapProcesses)
    Write-MaintenanceLog ("Bookmap did not stop within {0}s; forcing exact remaining PID(s): {1}." -f $GracefulTimeoutSec, (($remaining.ProcessId) -join ", ")) "WARN"
    foreach ($process in $remaining) {
        Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction SilentlyContinue
    }

    $forceDeadline = (Get-Date).AddSeconds(15)
    do {
        if (@(Get-BookmapProcesses).Count -eq 0) {
            Write-MaintenanceLog "Bookmap process is fully stopped."
            return
        }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $forceDeadline)

    throw "Bookmap process remained alive after the forced shutdown."
}

function Clear-DirectoryContents {
    param(
        [string]$Path,
        [string]$ExpectedLeaf
    )

    Assert-MaintenancePath -Path $Path -ExpectedLeaf $ExpectedLeaf
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-MaintenanceLog "Maintenance target does not exist: $Path"
        return
    }

    $stats = Get-PathStats -Path $Path
    Write-MaintenanceLog ("Clearing {0}: {1} files, {2:N2} GiB logical." -f $Path, $stats.Files, ($stats.Bytes / 1GB))
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $children = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue)
            foreach ($child in $children) {
                Remove-Item -LiteralPath $child.FullName -Recurse -Force -ErrorAction Stop
            }
            Write-MaintenanceLog "Cleared $Path."
            return
        } catch {
            if ($attempt -eq 3) {
                throw
            }
            Write-MaintenanceLog ("Cleanup attempt {0} failed for {1}: {2}" -f $attempt, $Path, $_.Exception.Message) "WARN"
            Start-Sleep -Seconds 2
        }
    }
}

function Clear-DataLibraryRecordings {
    Assert-MaintenancePath -Path $dataLibraryPath -ExpectedLeaf "Data library"
    if (-not (Test-Path -LiteralPath $dataLibraryPath)) {
        Write-MaintenanceLog "Data library does not exist: $dataLibraryPath"
        return
    }

    $recordings = @(Get-ChildItem -LiteralPath $dataLibraryPath -File -Force -Filter "*.bml" -ErrorAction SilentlyContinue)
    $measure = $recordings | Measure-Object -Property Length -Sum
    $bytes = if ($null -eq $measure -or $null -eq $measure.Sum) {
        [int64]0
    } else {
        [int64]$measure.Sum
    }
    Write-MaintenanceLog ("Removing Bookmap data recordings: {0} files, {1:N2} MiB." -f $recordings.Count, ($bytes / 1MB))
    foreach ($recording in $recordings) {
        Remove-Item -LiteralPath $recording.FullName -Force -ErrorAction Stop
    }
    Write-MaintenanceLog "Bookmap .bml recordings removed."
}

function Get-MarketStatus {
    try {
        return Invoke-RestMethod -Uri $MarketStatusUrl -TimeoutSec 4
    } catch {
        return $null
    }
}

function Start-Bookmap {
    if (-not (Test-Path -LiteralPath $BookmapExe)) {
        throw "Bookmap executable was not found: $BookmapExe"
    }

    $process = Start-Process `
        -FilePath $BookmapExe `
        -WorkingDirectory (Split-Path -Parent $BookmapExe) `
        -PassThru
    Write-MaintenanceLog ("Started Bookmap PID {0}." -f $process.Id)
    Start-Sleep -Seconds 3
    if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
        throw "Bookmap exited immediately after restart."
    }

    # Bookmap may show a modal GPU/OpenGL failure dialog even when GPU
    # acceleration is disabled. It blocks workspace loading until dismissed.
    # Wait until the check has had time to appear, then dismiss the modal for
    # this exact Bookmap process. Enter is harmless on the main chart window.
    Start-Sleep -Seconds 22
    $liveProcess = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
    if ($null -ne $liveProcess) {
        try {
            $shell = New-Object -ComObject WScript.Shell
            if ($shell.AppActivate($process.Id)) {
                Start-Sleep -Milliseconds 250
                $shell.SendKeys('{ENTER}')
                Write-MaintenanceLog ("Sent Enter to skip the Bookmap GPU acceleration dialog for PID {0}." -f $process.Id)
            } else {
                Write-MaintenanceLog ("Could not activate Bookmap PID {0} to skip the GPU acceleration dialog." -f $process.Id) "WARN"
            }
        } catch {
            Write-MaintenanceLog ("GPU acceleration dialog skip failed for PID {0}: {1}" -f $process.Id, $_.Exception.Message) "WARN"
        }
    }
}

function Wait-ForBookmapBackend {
    param([bool]$BackendWasAvailable)

    if (-not $BackendWasAvailable) {
        Write-MaintenanceLog "Backend was unavailable before maintenance; Bookmap process restart is complete, but source recovery cannot be verified." "WARN"
        return
    }

    $deadline = (Get-Date).AddSeconds($ReconnectTimeoutSec)
    $connectedAt = $null
    $lastSummary = ""
    do {
        $status = Get-MarketStatus
        if ($status -and $status.sources -and $status.sources.bookmap) {
            $bookmap = $status.sources.bookmap
            $summary = "active={0}, connected={1}, eligible={2}" -f $status.activeSource, $bookmap.connected, $bookmap.eligible
            if ($summary -ne $lastSummary) {
                Write-MaintenanceLog "Backend source status: $summary"
                $lastSummary = $summary
            }
            if ([bool]$bookmap.connected) {
                if ($null -eq $connectedAt) {
                    $connectedAt = Get-Date
                }
                if ([string]$status.activeSource -eq "bookmap") {
                    Write-MaintenanceLog "Bookmap is connected, eligible, and active again."
                    return
                }
                if (-not [bool]$bookmap.eligible -and ((Get-Date) - $connectedAt).TotalSeconds -ge 60) {
                    Write-MaintenanceLog "Bookmap is connected but not eligible yet, which is expected while the market is closed or before the first complete bar." "WARN"
                    return
                }
            }
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    if (@(Get-BookmapProcesses).Count -gt 0) {
        Write-MaintenanceLog ("Bookmap is running, but backend did not restore it as active within {0}s; NT fallback remains available." -f $ReconnectTimeoutSec) "WARN"
        return
    }
    throw "Bookmap was not running at the end of the reconnect timeout."
}

$mutex = New-Object Threading.Mutex($false, "Global\NTtoTVBookmapDailyMaintenance")
$hasMutex = $false
$exitCode = 0
try {
    $hasMutex = $mutex.WaitOne(0)
    if (-not $hasMutex) {
        Write-MaintenanceLog "Another Bookmap maintenance instance is already running; exiting."
        exit 0
    }

    Assert-MaintenancePath -Path $cachePath -ExpectedLeaf "Cache"
    Assert-MaintenancePath -Path $remoteCachePath -ExpectedLeaf "Remote cache"
    Assert-MaintenancePath -Path $dataLibraryPath -ExpectedLeaf "Data library"

    $cacheStats = Get-PathStats -Path $cachePath
    $remoteStats = Get-PathStats -Path $remoteCachePath
    $recordingStats = Get-PathStats -Path $dataLibraryPath -Filter "*.bml"
    $preStatus = Get-MarketStatus
    if ($preStatus) {
        Write-MaintenanceLog ("Starting maintenance: activeSource={0}, BookmapConnected={1}, NTConnected={2}." -f $preStatus.activeSource, $preStatus.sources.bookmap.connected, $preStatus.sources.nt.connected)
    } else {
        Write-MaintenanceLog "Starting maintenance while backend status is unavailable." "WARN"
    }
    Write-MaintenanceLog ("Targets: cache={0:N2} GiB/{1} files, remoteCache={2:N2} MiB/{3} files, recordings={4:N2} MiB/{5} files." -f ($cacheStats.Bytes / 1GB), $cacheStats.Files, ($remoteStats.Bytes / 1MB), $remoteStats.Files, ($recordingStats.Bytes / 1MB), $recordingStats.Files)

    if ($DryRun) {
        Write-MaintenanceLog "Dry-run complete; Bookmap and its files were not changed."
    } else {
        Stop-Bookmap
        Clear-DirectoryContents -Path $cachePath -ExpectedLeaf "Cache"
        Clear-DirectoryContents -Path $remoteCachePath -ExpectedLeaf "Remote cache"
        Clear-DataLibraryRecordings
        Start-Bookmap
        Wait-ForBookmapBackend -BackendWasAvailable ($null -ne $preStatus)
        Write-MaintenanceLog "Bookmap daily maintenance completed."
    }
} catch {
    $exitCode = 1
    Write-MaintenanceLog $_.Exception.Message "ERROR"
} finally {
    if ($hasMutex) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}

exit $exitCode
