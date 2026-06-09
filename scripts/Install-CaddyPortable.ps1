param(
    [string]$InstallDir = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $InstallDir) {
    $InstallDir = Join-Path $repoRoot "tools\caddy"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$caddyExe = Join-Path $InstallDir "caddy.exe"
if (Test-Path $caddyExe) {
    & $caddyExe version
    exit 0
}

$downloadPath = Join-Path $env:TEMP "caddy-windows-amd64.zip"
$extractDir = Join-Path $env:TEMP ("caddy-" + [guid]::NewGuid().ToString("N"))
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/caddyserver/caddy/releases/latest"
$asset = $release.assets |
    Where-Object { $_.name -match "^caddy_.+_windows_amd64\.zip$" } |
    Select-Object -First 1
if (-not $asset) {
    throw "Could not find the latest Caddy windows_amd64 release asset."
}
$url = $asset.browser_download_url

Write-Host "Downloading Caddy from $url"
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $downloadPath

$bytes = Get-Content -LiteralPath $downloadPath -Encoding Byte -TotalCount 2
if ($bytes.Length -ge 2 -and $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
    Move-Item -LiteralPath $downloadPath -Destination $caddyExe -Force
} else {
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
    Expand-Archive -LiteralPath $downloadPath -DestinationPath $extractDir -Force
    $extracted = Get-ChildItem -LiteralPath $extractDir -Recurse -Filter caddy.exe |
        Select-Object -First 1
    if (-not $extracted) {
        throw "Downloaded Caddy archive did not contain caddy.exe"
    }
    Copy-Item -LiteralPath $extracted.FullName -Destination $caddyExe -Force
    Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Installed $caddyExe"
& $caddyExe version
