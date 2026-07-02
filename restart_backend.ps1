$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $root "scripts\Restart-Backend.ps1")
