$ErrorActionPreference = "Stop"

$rules = @(
    @{ Name = "NTtoTV HTTPS Proxy 80"; Port = 80 },
    @{ Name = "NTtoTV HTTPS Proxy 443"; Port = 443 }
)

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Set-NetFirewallRule -DisplayName $rule.Name -Enabled True -Direction Inbound -Action Allow
    } else {
        New-NetFirewallRule `
            -DisplayName $rule.Name `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $rule.Port | Out-Null
    }
}

Get-NetFirewallRule -DisplayName "NTtoTV HTTPS Proxy 80","NTtoTV HTTPS Proxy 443" |
    Select-Object DisplayName, Enabled, Direction, Action
