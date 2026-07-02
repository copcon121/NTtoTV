$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return Split-Path -Parent $PSScriptRoot
}

function Get-BackendPaths {
    $root = Get-RepoRoot
    $backendDir = Join-Path $root "backend"
    $logDir = Join-Path $root "_run_logs\backend"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    return [pscustomobject]@{
        Root = $root
        BackendDir = $backendDir
        LogDir = $logDir
        Runner = Join-Path $root "scripts\Run-BackendProcess.ps1"
        Python = Join-Path $backendDir ".venv\Scripts\python.exe"
        Stdout = Join-Path $logDir "backend.stdout.log"
        Stderr = Join-Path $logDir "backend.stderr.log"
        State = Join-Path $logDir "backend-runtime.json"
    }
}

function Test-BackendHealth {
    param(
        [int]$Port = 8000,
        [int]$TimeoutSec = 3
    )

    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec $TimeoutSec
        if ($health.status -eq "ok") {
            return $health
        }
    } catch {
        return $null
    }
    return $null
}

function Get-CurrentProcessFamilyIds {
    $ids = New-Object "System.Collections.Generic.HashSet[int]"
    $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    $byId = @{}
    foreach ($process in $processes) {
        $byId[[int]$process.ProcessId] = $process
    }

    $current = [int]$PID
    while ($current -gt 0 -and $byId.ContainsKey($current)) {
        [void]$ids.Add($current)
        $current = [int]$byId[$current].ParentProcessId
    }
    return $ids
}

function Add-ProcessWithRelatives {
    param(
        [hashtable]$Selected,
        [hashtable]$ById,
        [int]$ProcessId,
        [string]$Root
    )

    if (-not $ById.ContainsKey($ProcessId)) {
        return
    }

    $process = $ById[$ProcessId]
    $Selected[$ProcessId] = $process

    $parentId = [int]$process.ParentProcessId
    if ($ById.ContainsKey($parentId)) {
        $parent = $ById[$parentId]
        $cmd = [string]$parent.CommandLine
        $rootPattern = [regex]::Escape($Root)
        if (
            $cmd -match $rootPattern -and
            (
                $cmd -match "uvicorn" -or
                $cmd -match "Run-BackendProcess\.ps1" -or
                $cmd -match "\.venv\\Scripts\\python\.exe"
            )
        ) {
            Add-ProcessWithRelatives -Selected $Selected -ById $ById -ProcessId $parentId -Root $Root
        }
    }
}

function Get-DescendantProcessIds {
    param(
        [hashtable]$ById,
        [int[]]$RootIds
    )

    $childrenByParent = @{}
    foreach ($process in $ById.Values) {
        $parentId = [int]$process.ParentProcessId
        if (-not $childrenByParent.ContainsKey($parentId)) {
            $childrenByParent[$parentId] = New-Object "System.Collections.Generic.List[int]"
        }
        $childrenByParent[$parentId].Add([int]$process.ProcessId)
    }

    $seen = New-Object "System.Collections.Generic.HashSet[int]"
    $queue = New-Object "System.Collections.Generic.Queue[int]"
    foreach ($id in $RootIds) {
        $queue.Enqueue($id)
    }

    while ($queue.Count -gt 0) {
        $id = $queue.Dequeue()
        if (-not $childrenByParent.ContainsKey($id)) {
            continue
        }
        foreach ($childId in $childrenByParent[$id]) {
            if ($seen.Add($childId)) {
                $queue.Enqueue($childId)
            }
        }
    }
    return @($seen)
}

function Get-BackendRuntimeProcesses {
    param(
        [int]$Port = 8000
    )

    $paths = Get-BackendPaths
    $root = $paths.Root
    $backendPattern = [regex]::Escape($paths.BackendDir)
    $rootPattern = [regex]::Escape($root)
    $currentFamily = Get-CurrentProcessFamilyIds
    $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    $byId = @{}
    foreach ($process in $processes) {
        $byId[[int]$process.ProcessId] = $process
    }

    $selected = @{}

    $listeners = @(
        Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
            Where-Object { $_.OwningProcess -gt 0 }
    )
    foreach ($listener in $listeners) {
        Add-ProcessWithRelatives -Selected $selected -ById $byId -ProcessId ([int]$listener.OwningProcess) -Root $root
    }

    foreach ($process in $processes) {
        $pidValue = [int]$process.ProcessId
        if ($currentFamily.Contains($pidValue)) {
            continue
        }
        $cmd = [string]$process.CommandLine
        if ([string]::IsNullOrWhiteSpace($cmd)) {
            continue
        }

        $isBackendPython = (
            $process.Name -eq "python.exe" -and
            $cmd -match "uvicorn" -and
            $cmd -match "app\.app:app" -and
            $cmd -match "--port\s+$Port"
        )
        $isBackendWorker = (
            $process.Name -eq "python.exe" -and
            $cmd -match $backendPattern -and
            $cmd -match "app\.mt5\.process_worker"
        )
        $isBackendWrapper = (
            $process.Name -eq "powershell.exe" -and
            $cmd -match $rootPattern -and
            (
                $cmd -match "Run-BackendProcess\.ps1" -or
                ($cmd -match "uvicorn" -and $cmd -match "app\.app:app" -and $cmd -match "--port\s+$Port")
            )
        )

        if ($isBackendPython -or $isBackendWorker -or $isBackendWrapper) {
            Add-ProcessWithRelatives -Selected $selected -ById $byId -ProcessId $pidValue -Root $root
        }
    }

    $descendants = Get-DescendantProcessIds -ById $byId -RootIds @($selected.Keys)
    foreach ($id in $descendants) {
        if ($currentFamily.Contains([int]$id)) {
            continue
        }
        if ($byId.ContainsKey([int]$id)) {
            $selected[[int]$id] = $byId[[int]$id]
        }
    }

    return @($selected.Values | Sort-Object ProcessId)
}

function Stop-BackendRuntime {
    param(
        [int]$Port = 8000,
        [int]$TimeoutSec = 15
    )

    $processes = @(Get-BackendRuntimeProcesses -Port $Port)
    if ($processes.Count -eq 0) {
        Write-Host "No backend runtime process found for port $Port."
        return
    }

    $ids = @($processes | ForEach-Object { [int]$_.ProcessId })
    $byId = @{}
    foreach ($process in $processes) {
        $byId[[int]$process.ProcessId] = $process
    }

    function Get-SelectedDepth([int]$ProcessId) {
        $depth = 0
        $cursor = $ProcessId
        while ($byId.ContainsKey($cursor)) {
            $parentId = [int]$byId[$cursor].ParentProcessId
            if (-not $byId.ContainsKey($parentId)) {
                break
            }
            $depth += 1
            $cursor = $parentId
        }
        return $depth
    }

    $ordered = @(
        $processes |
            Sort-Object @{ Expression = { Get-SelectedDepth ([int]$_.ProcessId) }; Descending = $true }, ProcessId
    )
    foreach ($process in $ordered) {
        Write-Host ("Stopping backend PID {0} ({1})" -f $process.ProcessId, $process.Name)
        Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction SilentlyContinue
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    do {
        $remaining = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
        if ($remaining.Count -eq 0) {
            Write-Host "Backend runtime stopped."
            return
        }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)

    $left = ($remaining | ForEach-Object { $_.Id }) -join ", "
    throw "Backend process(es) did not stop in time: $left"
}

function Start-BackendRuntime {
    param(
        [int]$Port = 8000,
        [switch]$Force,
        [int]$TimeoutSec = 30
    )

    $paths = Get-BackendPaths
    if (-not (Test-Path -LiteralPath $paths.Python)) {
        throw "Backend Python was not found: $($paths.Python)"
    }
    if (-not (Test-Path -LiteralPath $paths.Runner)) {
        throw "Backend runner was not found: $($paths.Runner)"
    }

    $health = Test-BackendHealth -Port $Port -TimeoutSec 3
    if ($health -and -not $Force) {
        Write-Host ("Backend already healthy on port {0}: status={1}, version={2}" -f $Port, $health.status, $health.version)
        return
    }

    if ($Force) {
        Stop-BackendRuntime -Port $Port
    } else {
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
        if ($listeners.Count -gt 0) {
            throw "Port $Port is already listening but /api/health is not OK. Run scripts\Restart-Backend.ps1."
        }
    }

    Remove-Item -LiteralPath $paths.Stdout -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $paths.Stderr -Force -ErrorAction SilentlyContinue

    $args = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $paths.Runner,
        "-Port", [string]$Port
    )
    $process = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList $args `
        -WorkingDirectory $paths.Root `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput $paths.Stdout `
        -RedirectStandardError $paths.Stderr

    Write-Host ("Started backend wrapper PID {0}; waiting for health." -f $process.Id)

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $lastError = $null
    do {
        $health = Test-BackendHealth -Port $Port -TimeoutSec 2
        if ($health) {
            $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
                Select-Object -First 1
            $listenerPid = if ($listener) { [int]$listener.OwningProcess } else { $null }
            [pscustomobject]@{
                startedAt = (Get-Date).ToString("o")
                port = $Port
                wrapperPid = [int]$process.Id
                listenerPid = $listenerPid
                stdout = $paths.Stdout
                stderr = $paths.Stderr
                env = @{
                    NTTOTV_MT5_BACKEND = "real"
                    NTTOTV_TRADING_ENABLED = "1"
                    NTTOTV_LIVE_TRADING_ENABLED = "1"
                    NTTOTV_INVITE_CODE = "join-9999"
                }
            } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.State
            Write-Host ("Backend health OK on port {0}: status={1}, version={2}, listenerPid={3}" -f $Port, $health.status, $health.version, $listenerPid)
            return
        }
        try {
            $null = Get-Process -Id $process.Id -ErrorAction Stop
        } catch {
            $lastError = "Backend wrapper exited before health became OK."
            break
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    if (-not $lastError) {
        $lastError = "Backend did not become healthy within $TimeoutSec seconds."
    }
    Write-Host $lastError
    if (Test-Path -LiteralPath $paths.Stderr) {
        Write-Host "Last backend stderr lines:"
        Get-Content -LiteralPath $paths.Stderr -Tail 80
    }
    throw $lastError
}

function Show-BackendRuntimeStatus {
    param([int]$Port = 8000)

    $health = Test-BackendHealth -Port $Port -TimeoutSec 3
    if ($health) {
        Write-Host ("Backend health: OK status={0}, version={1}" -f $health.status, $health.version)
    } else {
        Write-Host "Backend health: not responding"
    }

    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object LocalAddress, LocalPort, State, OwningProcess |
        Format-Table -AutoSize

    $processes = @(Get-BackendRuntimeProcesses -Port $Port)
    if ($processes.Count -eq 0) {
        Write-Host "No backend runtime process found."
        return
    }
    $processes |
        Select-Object ProcessId, ParentProcessId, Name, CommandLine |
        Format-List
}
