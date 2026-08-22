[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'NTtoTV RDP IP Guard'
$stateRoot = Join-Path $env:ProgramData 'NTtoTV\RdpIpGuard'

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName 'NTtoTV RDP IP Guard - *' -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

Write-Output "Removed scheduled task and guard-created firewall rules."
Write-Output "State/logs remain at $stateRoot for audit and can be removed manually if desired."
