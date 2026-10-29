param(
    [ValidateSet('muse', 'openai')]
    [string]$Provider = 'muse',
    [string]$MuseBaseUrl = 'http://127.0.0.1:18610/v1',
    [string]$MuseKeyFile = '',
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

if ($Provider -eq 'muse') {
    if (-not $MuseKeyFile) {
        $MuseKeyFile = Join-Path (Split-Path -Parent $repoRoot) 'muse2api\data\api_key'
    }
    $base = $MuseBaseUrl.TrimEnd('/')
    $serviceBase = $base -replace '/v1$', ''
    $ready = Invoke-RestMethod -Uri "$serviceBase/readyz" -TimeoutSec 5
    if (-not $ready.ready -or $ready.driver.driver -ne 'browser') {
        throw 'Muse gateway is not ready with a real account. Start muse2api and import an account first.'
    }
    $apiKey = (Get-Content -Raw -LiteralPath $MuseKeyFile).Trim()
    if (-not $apiKey) { throw 'Muse API key file is empty.' }
    # Confirm the key without displaying it or reading account cookies.
    $headers = @{ Authorization = "Bearer $apiKey" }
    $null = Invoke-RestMethod -Uri "$base/models" -Headers $headers -TimeoutSec 5
    $values = @{
        NTTOTV_MP_LLM_API_KEY = $apiKey
        NTTOTV_MP_LLM_BASE_URL = $base
        NTTOTV_MP_LLM_MODEL = 'muse-chat'
    }
    foreach ($name in $values.Keys) {
        [Environment]::SetEnvironmentVariable($name, $values[$name], 'User')
        [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
    }
}

[Environment]::SetEnvironmentVariable('NTTOTV_MP_LLM_PROVIDER', $Provider, 'User')
[Environment]::SetEnvironmentVariable('NTTOTV_MP_LLM_PROVIDER', $Provider, 'Process')
Write-Output "MP planner provider saved: $Provider"
if ($Restart) {
    & (Join-Path $PSScriptRoot 'Restart-Backend.ps1')
} else {
    Write-Output 'Run scripts\Restart-Backend.ps1 to apply the setting.'
}
