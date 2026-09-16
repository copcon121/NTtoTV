[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 65535)]
    [int]$Port,
    [switch]$RestartService
)

$ErrorActionPreference = 'Stop'

$rdpKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp'
$listenerRuleName = 'NTtoTV RDP Listener (TCP-In)'
$oldPort = [int](Get-ItemPropertyValue -LiteralPath $rdpKey -Name PortNumber)

if ($Port -ne $oldPort) {
    $conflict = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conflict) {
        throw "TCP/$Port is already in use by process $($conflict.OwningProcess)."
    }
}

$rule = Get-NetFirewallRule -DisplayName $listenerRuleName -ErrorAction SilentlyContinue
if ($null -eq $rule) {
    New-NetFirewallRule -DisplayName $listenerRuleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -Profile Any | Out-Null
} else {
    $rule | Enable-NetFirewallRule | Out-Null
    $rule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port | Out-Null
}

# Keep Network Level Authentication and the native TLS security layer enabled.
Set-ItemProperty -LiteralPath $rdpKey -Name UserAuthentication -Type DWord -Value 1
Set-ItemProperty -LiteralPath $rdpKey -Name SecurityLayer -Type DWord -Value 2
Set-ItemProperty -LiteralPath $rdpKey -Name PortNumber -Type DWord -Value $Port

if ($Port -eq 3389) {
    Enable-NetFirewallRule -Name 'RemoteDesktop-UserMode-In-TCP' -ErrorAction SilentlyContinue | Out-Null
} else {
    Disable-NetFirewallRule -Name 'RemoteDesktop-UserMode-In-TCP' -ErrorAction SilentlyContinue | Out-Null
}

if ($RestartService) {
    Restart-Service -Name TermService -Force
}

[pscustomobject]@{
    OldPort = $oldPort
    NewPort = $Port
    NlaEnabled = 1
    TlsSecurityLayer = 2
    ServiceRestarted = [bool]$RestartService
}
