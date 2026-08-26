[CmdletBinding()]
param(
    [string]$TaskName = "NTtoTV Bookmap Daily Maintenance",
    [string]$UtcPlus7Time = "04:30"
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
    throw "The Windows time zone must remain UTC so the UTC+7 maintenance time can be converted exactly. Current zone: $($timeZone.Id)"
}

$parsedTime = [TimeSpan]::Zero
if (-not [TimeSpan]::TryParseExact($UtcPlus7Time, "hh\:mm", [Globalization.CultureInfo]::InvariantCulture, [ref]$parsedTime)) {
    throw "UtcPlus7Time must use HH:mm format, for example 04:30."
}
if ($parsedTime.TotalHours -ge 24) {
    throw "UtcPlus7Time must be within one day."
}

$utcPlus7Offset = [TimeSpan]::FromHours(7)
$triggerUtcTime = $parsedTime.Subtract($utcPlus7Offset)
if ($triggerUtcTime -lt [TimeSpan]::Zero) {
    $triggerUtcTime = $triggerUtcTime.Add([TimeSpan]::FromDays(1))
}

$action = New-ScheduledTaskAction `
    -Execute $powershell `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$maintenanceScript`"" `
    -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At ([DateTime]::Today.Add($triggerUtcTime))
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
    -Description "Restart Bookmap, clear disposable cache/recordings, and verify the NTtoTV Bookmap source daily at $UtcPlus7Time UTC+7 ($($triggerUtcTime.ToString('hh\:mm')) UTC)." `
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
    TargetTimeUtcPlus7 = $UtcPlus7Time
    TriggerUtc = $task.Triggers[0].StartBoundary
    NextRunTimeUtc = $info.NextRunTime.ToUniversalTime().ToString("o")
    NextRunTimeUtcPlus7 = $info.NextRunTime.ToUniversalTime().Add($utcPlus7Offset).ToString("yyyy-MM-dd HH:mm:ss 'UTC+7'")
    Script = $maintenanceScript
}
