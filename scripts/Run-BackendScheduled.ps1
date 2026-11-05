param(
    [int]$Port = 8000,
    [int]$PollSeconds = 10,
    [int]$StartupGraceSeconds = 120,
    [int]$HealthFailureLimit = 3
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Backend-Runtime.ps1')
. (Join-Path $PSScriptRoot 'Backend-TaskConfig.ps1')
$paths = Get-BackendPaths
$supervisorLog = Join-Path $paths.LogDir 'backend-supervisor.log'

function Write-SupervisorLog([string]$Message) {
    Add-Content -LiteralPath $supervisorLog -Value ('{0} {1}' -f (Get-Date).ToString('o'), $Message)
}

Write-SupervisorLog "Supervisor started PID=$PID port=$Port task=$(Get-BackendTaskName -Port $Port)"
try {
    while ($true) {
        $runnerProcess = $null
        try {
            Stop-BackendRuntime -Port $Port -KeepScheduledTask
            Initialize-BackendTaskEnvironment
            $env:PYTHONFAULTHANDLER = '1'
            foreach ($log in @($paths.Stdout, $paths.Stderr)) {
                if (Test-Path -LiteralPath $log) {
                    Move-Item -LiteralPath $log -Destination "$log.previous" -Force
                }
            }
            # Keep the existing production runner as the authority for source,
            # trading, provider and retention settings. Wait for its full lifetime.
            $runnerArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$($paths.Runner)`" -Port $Port -StdoutLog `"$($paths.Stdout)`" -StderrLog `"$($paths.Stderr)`""
            $runnerProcess = Start-Process -FilePath 'powershell.exe' `
                -ArgumentList $runnerArgs -WorkingDirectory $paths.Root `
                -WindowStyle Hidden -PassThru
            $launchedAt = Get-Date
            $failures = 0
            $recorded = $false
            Write-SupervisorLog "Backend runner started PID=$($runnerProcess.Id)"
            while (-not $runnerProcess.HasExited) {
                $health = Test-BackendHealth -Port $Port -TimeoutSec 3
                if ($health) {
                    $failures = 0
                    if (-not $recorded) {
                        $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
                            Select-Object -First 1
                        [pscustomobject]@{
                            startedAt = $launchedAt.ToString('o')
                            port = $Port
                            manager = 'TaskScheduler'
                            taskName = Get-BackendTaskName -Port $Port
                            supervisorPid = $PID
                            wrapperPid = $runnerProcess.Id
                            listenerPid = [int]$listener.OwningProcess
                            stdout = $paths.Stdout
                            stderr = $paths.Stderr
                            supervisorLog = $supervisorLog
                        } | ConvertTo-Json | Set-Content -LiteralPath $paths.State
                        Write-SupervisorLog "Backend healthy listenerPID=$($listener.OwningProcess)"
                        $recorded = $true
                    }
                } elseif (((Get-Date) - $launchedAt).TotalSeconds -ge $StartupGraceSeconds) {
                    $failures++
                    Write-SupervisorLog "Health failure $failures/$HealthFailureLimit"
                    if ($failures -ge $HealthFailureLimit) {
                        Write-SupervisorLog 'Health failure limit reached; restarting backend.'
                        break
                    }
                }
                Start-Sleep -Seconds $PollSeconds
                $runnerProcess.Refresh()
            }
            $runnerProcess.Refresh()
            if ($runnerProcess.HasExited) {
                $runnerProcess.WaitForExit()
                Write-SupervisorLog "Backend runner exited PID=$($runnerProcess.Id) exitCode=$($runnerProcess.ExitCode)"
            }
        } catch {
            Write-SupervisorLog "Recovery required: $($_.Exception.Message)"
        } finally {
            Stop-BackendRuntime -Port $Port -KeepScheduledTask
            if ($runnerProcess) { $runnerProcess.Dispose() }
        }
        Write-SupervisorLog "Retrying in $PollSeconds seconds."
        Start-Sleep -Seconds $PollSeconds
    }
} finally {
    Write-SupervisorLog 'Supervisor stopping.'
    Stop-BackendRuntime -Port $Port -KeepScheduledTask
}
