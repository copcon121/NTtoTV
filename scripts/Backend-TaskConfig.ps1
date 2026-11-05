# Scheduled tasks must reload persisted settings instead of inheriting AO's
# environment. The machine-protected fallback supports boot before user logon.
function Get-BackendTaskCredentialPath {
    Join-Path $env:LOCALAPPDATA 'NTtoTV\backend-task\rithmic.bin'
}

function Save-BackendTaskCredential {
    Add-Type -AssemblyName System.Security
    $source = Join-Path $env:LOCALAPPDATA 'NTtoTV\rithmic.credential.xml'
    $userName = $env:NTTOTV_RITHMIC_USER
    $password = $env:NTTOTV_RITHMIC_PASSWORD
    if ((-not $userName -or -not $password) -and (Test-Path -LiteralPath $source)) {
        $credential = Import-Clixml -LiteralPath $source
        $userName = $credential.UserName
        $password = $credential.GetNetworkCredential().Password
    }
    if (-not $userName -or -not $password) { return }

    $path = Get-BackendTaskCredentialPath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @(
        [Security.Principal.WindowsIdentity]::GetCurrent().User,
        (New-Object Security.Principal.SecurityIdentifier 'S-1-5-18')
    )) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
        )
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $directory -AclObject $acl
    $payload = [Text.Encoding]::UTF8.GetBytes((@{user = $userName; password = $password} | ConvertTo-Json -Compress))
    try {
        $protected = [Security.Cryptography.ProtectedData]::Protect(
            $payload, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine
        )
        [IO.File]::WriteAllBytes($path, $protected)
    } finally { [Array]::Clear($payload, 0, $payload.Length) }
}

function Initialize-BackendTaskEnvironment {
    foreach ($scope in @('Machine', 'User')) {
        $settings = [Environment]::GetEnvironmentVariables($scope)
        foreach ($name in $settings.Keys) {
            if ($name -match '^(NTTOTV_|OPENAI_|MT5_)') {
                [Environment]::SetEnvironmentVariable($name, $settings[$name], 'Process')
            }
        }
    }
    if ($env:NTTOTV_RITHMIC_USER -and $env:NTTOTV_RITHMIC_PASSWORD) { return }
    $source = Join-Path $env:LOCALAPPDATA 'NTtoTV\rithmic.credential.xml'
    try {
        if (Test-Path -LiteralPath $source) {
            $credential = Import-Clixml -LiteralPath $source -ErrorAction Stop
            $env:NTTOTV_RITHMIC_USER = $credential.UserName
            $env:NTTOTV_RITHMIC_PASSWORD = $credential.GetNetworkCredential().Password
            return
        }
    } catch {
        # S4U at boot may not have the user's DPAPI master key available yet.
    }
    $path = Get-BackendTaskCredentialPath
    if (Test-Path -LiteralPath $path) {
        Add-Type -AssemblyName System.Security
        $payload = [Security.Cryptography.ProtectedData]::Unprotect(
            [IO.File]::ReadAllBytes($path), $null, [Security.Cryptography.DataProtectionScope]::LocalMachine
        )
        try {
            $credential = [Text.Encoding]::UTF8.GetString($payload) | ConvertFrom-Json
            $env:NTTOTV_RITHMIC_USER = $credential.user
            $env:NTTOTV_RITHMIC_PASSWORD = $credential.password
        } finally { [Array]::Clear($payload, 0, $payload.Length) }
    }
}
