[CmdletBinding()]
param(
    [string]$WhitelistIp = '171.245.254.163',
    [ValidateRange(1, 65535)]
    [int]$RdpPort = 3389
)

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'RdpIpGuard.ps1'
$stateRoot = Join-Path $env:ProgramData 'NTtoTV\RdpIpGuard'
$taskName = 'NTtoTV RDP IP Guard'

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Guard script not found: $scriptPath"
}

New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

$powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$argument = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -WhitelistOverride "{1}" -RdpPort {2}' -f $scriptPath, $WhitelistIp, $RdpPort
$action = New-ScheduledTaskAction -Execute $powershell -Argument $argument
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

# Run once immediately so current brute-force sources are handled now.
& $powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $scriptPath -WhitelistOverride $WhitelistIp -RdpPort $RdpPort

Get-ScheduledTask -TaskName $taskName | Select-Object TaskName,TaskPath,State
Write-Output "Installed: $taskName"
Write-Output "Whitelist: $WhitelistIp"
Write-Output "Rule: 3 RDP failures from one public IP within 10 minutes -> block TCP/$RdpPort for 60 minutes"
Write-Output "State/log directory: $stateRoot"
