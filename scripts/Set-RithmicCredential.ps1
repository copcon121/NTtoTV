param(
    [string]$User = ""
)

$ErrorActionPreference = "Stop"

if (-not $User) {
    $User = Read-Host "Rithmic user"
}
if (-not $User) {
    throw "Rithmic user is required."
}

$password = Read-Host "Rithmic password" -AsSecureString
$credential = [System.Management.Automation.PSCredential]::new($User, $password)
$directory = Join-Path $env:LOCALAPPDATA "NTtoTV"
$path = Join-Path $directory "rithmic.credential.xml"

$null = New-Item -ItemType Directory -Path $directory -Force
$credential | Export-Clixml -LiteralPath $path
Write-Host "Saved the Rithmic credential with Windows DPAPI: $path"
