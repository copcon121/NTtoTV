param(
    [string]$SshConfig = "C:\Users\Administrator\Desktop\NTtoTV-linux-rithmic\_oracle_stage\ssh_config"
)

$ErrorActionPreference = "Stop"
$taskName = "NTtoTV Oracle MT5 private tunnel"
$runner = Join-Path $PSScriptRoot "Run-OracleMt5Tunnel.ps1"
if (-not (Test-Path -LiteralPath $SshConfig)) { throw "Pinned SSH config was not found" }
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (
    '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $runner + '" -SshConfig "' + $SshConfig + '"'
)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$triggers = @(New-ScheduledTaskTrigger -AtStartup)
Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal `
    -Settings $settings -Trigger $triggers -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Started private SSH forwarding: Oracle 127.0.0.1:18080 -> Windows 127.0.0.1:8000"
