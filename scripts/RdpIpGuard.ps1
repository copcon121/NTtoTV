[CmdletBinding()]
param(
    [string[]]$WhitelistOverride,
    [ValidateRange(1, 65535)]
    [int]$RdpPort = 3389
)

# RDP brute-force guard for Windows Server.
# Three RDP credential failures from one public IP within ten minutes cause a
# temporary firewall block on the configured RDP TCP port for one hour. Keep
# the operator's current
# public IP in this list so a changing failure count cannot lock out the owner.

$ErrorActionPreference = 'Stop'

$Threshold = 3
$FailureWindowMinutes = 10
$BlockMinutes = 60
$MaxEventsPerRun = 2000
$MaxActiveBlocks = 500
$Whitelist = @(
    '171.245.254.163'
)
if ($WhitelistOverride -and $WhitelistOverride.Count -gt 0) {
    $Whitelist = $WhitelistOverride
}

$StateRoot = Join-Path $env:ProgramData 'NTtoTV\RdpIpGuard'
$StatePath = Join-Path $StateRoot 'state.json'
$LogPath = Join-Path $StateRoot 'guard.log'
$RulePrefix = 'NTtoTV RDP IP Guard - '
$NowUtc = (Get-Date).ToUniversalTime()

New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null

function Write-GuardLog {
    param([string]$Message)
    $line = '{0:u} {1}' -f (Get-Date), $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Normalize-Ip {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -eq '-') {
        return $null
    }

    try {
        $ip = [System.Net.IPAddress]::Parse($Value.Trim())
        if ($ip.IsIPv4MappedToIPv6) {
            $ip = $ip.MapToIPv4()
        }
        return $ip.ToString()
    } catch {
        return $null
    }
}

function Test-PublicIp {
    param([string]$Value)
    try {
        $ip = [System.Net.IPAddress]::Parse($Value)
        if ([System.Net.IPAddress]::IsLoopback($ip)) {
            return $false
        }

        $bytes = $ip.GetAddressBytes()
        if ($ip.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
            if ($bytes[0] -eq 0 -or $bytes[0] -eq 10 -or $bytes[0] -eq 127) { return $false }
            if ($bytes[0] -eq 169 -and $bytes[1] -eq 254) { return $false }
            if ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) { return $false }
            if ($bytes[0] -eq 192 -and $bytes[1] -eq 168) { return $false }
            return $true
        }

        # Ignore IPv6 link-local and unique-local addresses.
        if (($bytes[0] -band 0xfe) -eq 0xfc -or ($bytes[0] -eq 0xfe -and (($bytes[1] -band 0xc0) -eq 0x80))) {
            return $false
        }
        return $true
    } catch {
        return $false
    }
}

function Get-RuleName {
    param([string]$Ip)
    return ($RulePrefix + $Ip)
}

function Convert-ToUtcDateTime {
    param($Value)
    if ($Value -is [string]) {
        return ([datetime]::Parse($Value)).ToUniversalTime()
    }
    if ($Value.PSObject.Properties['value']) {
        return ([datetime]$Value.value).ToUniversalTime()
    }
    return ([datetime]$Value).ToUniversalTime()
}

function Remove-GuardRule {
    param([string]$Ip)
    $ruleName = Get-RuleName $Ip
    $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($null -ne $rule) {
        Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        Write-GuardLog "Unblocked expired IP $Ip"
    }
}

function Add-GuardRule {
    param([string]$Ip)
    $ruleName = Get-RuleName $Ip
    $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($null -eq $rule) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Block `
            -Protocol TCP -LocalPort $RdpPort -RemoteAddress $Ip -Profile Any | Out-Null
        Write-GuardLog "Blocked IP $Ip on TCP/$RdpPort for $BlockMinutes minutes after $Threshold RDP failures"
    }
}

$whitelistSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($item in $Whitelist) {
    $normalized = Normalize-Ip $item
    if ($normalized) {
        [void]$whitelistSet.Add($normalized)
    }
}

# State is intentionally simple JSON so the guard can be audited or removed.
$failures = @{}
$blocks = @{}
$lastRecordId = [int64]0
if (Test-Path -LiteralPath $StatePath) {
    try {
        $saved = Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($saved.LastRecordId) {
            $lastRecordId = [int64]$saved.LastRecordId
        }
        if ($saved.Failures) {
            foreach ($property in $saved.Failures.PSObject.Properties) {
                $failures[$property.Name] = @($property.Value | ForEach-Object { Convert-ToUtcDateTime $_ })
            }
        }
        if ($saved.Blocks) {
            foreach ($property in $saved.Blocks.PSObject.Properties) {
                $blocks[$property.Name] = Convert-ToUtcDateTime $property.Value
            }
        }
    } catch {
        Write-GuardLog "State read failed; starting with empty state: $($_.Exception.Message)"
        $failures = @{}
        $blocks = @{}
        $lastRecordId = 0
    }
}

# Reconcile rules created by an earlier run. This protects expiry tracking if
# the machine was interrupted while state.json was being written.
$existingGuardRules = @(Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object {
    $_.DisplayName -like ($RulePrefix + '*')
})
foreach ($rule in $existingGuardRules) {
    $ruleIp = Normalize-Ip ($rule.DisplayName.Substring($RulePrefix.Length))
    $portFilter = $rule | Get-NetFirewallPortFilter
    if ($portFilter.LocalPort -ne [string]$RdpPort) {
        $portFilter | Set-NetFirewallPortFilter -LocalPort $RdpPort | Out-Null
        Write-GuardLog "Moved existing block for $ruleIp to TCP/$RdpPort"
    }
    if ($ruleIp -and -not $blocks.ContainsKey($ruleIp)) {
        $blocks[$ruleIp] = $NowUtc.AddMinutes($BlockMinutes)
        Write-GuardLog "Recovered firewall rule state for $ruleIp"
    }
}

# Remove expired rules before processing new failures.
foreach ($ip in @($blocks.Keys)) {
    if ($blocks[$ip] -le $NowUtc) {
        Remove-GuardRule $ip
        $blocks.Remove($ip)
    }
}

$failureCutoff = $NowUtc.AddMinutes(-$FailureWindowMinutes)
foreach ($ip in @($failures.Keys)) {
    $recent = @($failures[$ip] | Where-Object { ([datetime]$_).ToUniversalTime() -ge $failureCutoff })
    if ($recent.Count -eq 0) {
        $failures.Remove($ip)
    } else {
        $failures[$ip] = $recent
    }
}

try {
    $events = @(Get-WinEvent -FilterHashtable @{
        LogName = 'Microsoft-Windows-RemoteDesktopServices-RdpCoreTS/Operational'
        Id = 140
        StartTime = (Get-Date).AddMinutes(-($FailureWindowMinutes + 2))
    } -MaxEvents $MaxEventsPerRun -ErrorAction SilentlyContinue | Sort-Object RecordId)

    foreach ($event in $events) {
        if ($event.RecordId -le $lastRecordId) {
            continue
        }
        $lastRecordId = [int64]$event.RecordId

        # Event 140 states: "... IP address of X failed because ...".
        $match = [regex]::Match($event.Message, 'IP address of\s+([^\s]+)\s+failed', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if (-not $match.Success) {
            continue
        }

        $ip = Normalize-Ip $match.Groups[1].Value
        if (-not $ip -or -not (Test-PublicIp $ip) -or $whitelistSet.Contains($ip)) {
            continue
        }

        $eventUtc = ([datetime]$event.TimeCreated).ToUniversalTime()
        if (-not $failures.ContainsKey($ip)) {
            $failures[$ip] = @()
        }
        $failures[$ip] = @($failures[$ip] + $eventUtc | Where-Object { ([datetime]$_) -ge $failureCutoff })

        if ($failures[$ip].Count -ge $Threshold -and -not $blocks.ContainsKey($ip)) {
            if ($blocks.Count -lt $MaxActiveBlocks) {
                Add-GuardRule $ip
                $blocks[$ip] = $NowUtc.AddMinutes($BlockMinutes)
                $failures.Remove($ip)
            } else {
                Write-GuardLog "Block limit $MaxActiveBlocks reached; did not block $ip"
            }
        }
    }
} catch {
    Write-GuardLog "Event processing failed: $($_.Exception.Message)"
}

$serializedFailures = [ordered]@{}
foreach ($ip in $failures.Keys) {
    $serializedFailures[$ip] = @($failures[$ip] | ForEach-Object {
        (Convert-ToUtcDateTime $_).ToString('o')
    })
}
$serializedBlocks = [ordered]@{}
foreach ($ip in $blocks.Keys) {
    $serializedBlocks[$ip] = (Convert-ToUtcDateTime $blocks[$ip]).ToString('o')
}

$state = [ordered]@{
    LastRecordId = $lastRecordId
    Failures = $serializedFailures
    Blocks = $serializedBlocks
    UpdatedUtc = $NowUtc.ToString('o')
}
$state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $StatePath -Encoding UTF8


