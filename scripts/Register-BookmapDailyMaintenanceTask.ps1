[CmdletBinding()]
param(
    [string]$TaskName = "NTtoTV Bookmap Daily Maintenance",
    [string]$UtcTime = "04:10"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$maintenanceScript = Join-Path $repoRoot "scripts\Restart-Bookmap-Daily.ps1"
$powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path -LiteralPath $maintenanceScript)) {
    throw "Bookmap maintenance script was not found: $maintenanceScript"
}

$timeZone = Get-TimeZone
if ($timeZone.BaseUtcOffset -ne [TimeSpan]::Zero -or $timeZone.SupportsDaylightSavingTime) {
    throw "The Windows time zone must remain UTC for an exact daily UTC trigger. Current zone: $($timeZone.Id)"
}

$parsedTime = [TimeSpan]::Zero
if (-not [TimeSpan]::TryParseExact($UtcTime, "hh\:mm", [Globalization.CultureInfo]::InvariantCulture, [ref]$parsedTime)) {
    throw "UtcTime must use HH:mm format, for example 04:10."
}
if ($parsedTime.TotalHours -ge 24) {
    throw "UtcTime must be within one day."
}

$action = New-ScheduledTaskAction `
    -Execute $powershell `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$maintenanceScript`"" `
    -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At ([DateTime]::Today.Add($parsedTime))
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal `
    -UserId $identity `
    -LogonType Interactive `
    -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -WakeToRun `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description "Restart Bookmap, clear disposable cache/recordings, and verify the NTtoTV Bookmap source daily at $UtcTime UTC." `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
[pscustomobject]@{
    TaskName = $task.TaskName
    State = $task.State
    RunAs = $task.Principal.UserId
    LogonType = $task.Principal.LogonType
    TriggerUtc = $task.Triggers[0].StartBoundary
    NextRunTimeUtc = $info.NextRunTime.ToUniversalTime().ToString("o")
    Script = $maintenanceScript
}
