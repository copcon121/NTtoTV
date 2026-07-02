param(
    [int]$Port = 8000,
    [switch]$Force,
    [int]$TimeoutSec = 30
)

. (Join-Path $PSScriptRoot "Backend-Runtime.ps1")
Start-BackendRuntime -Port $Port -Force:$Force -TimeoutSec $TimeoutSec
