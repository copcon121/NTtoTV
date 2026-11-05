param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Backend-Runtime.ps1')
. (Join-Path $PSScriptRoot 'Backend-TaskConfig.ps1')

$root = Get-RepoRoot
$supervisor = Join-Path $PSScriptRoot 'Run-BackendScheduled.ps1'
$taskName = Get-BackendTaskName -Port $Port
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not (Get-BackendScheduledTask -Port $Port)) {
    throw "Task '$taskName' belongs to a different workspace; refusing to replace it."
}
Save-BackendTaskCredential
$action = New-ScheduledTaskAction `
    -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$supervisor`" -Port $Port" `
    -WorkingDirectory $root
$startup = New-ScheduledTaskTrigger -AtStartup
$startup.Delay = 'PT20S'
# A periodic trigger also covers forcible termination that Windows does not retry.
$recovery = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType S4U -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -Priority 4
Register-ScheduledTask -TaskName $taskName -Action $action `
    -Trigger @($startup, $recovery) -Principal $principal -Settings $settings `
    -Description 'Independent backend supervisor: boot startup, health checks and automatic recovery.' `
    -Force | Out-Null
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
