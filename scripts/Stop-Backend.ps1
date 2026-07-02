param(
    [int]$Port = 8000,
    [int]$TimeoutSec = 15
)

. (Join-Path $PSScriptRoot "Backend-Runtime.ps1")
Stop-BackendRuntime -Port $Port -TimeoutSec $TimeoutSec
