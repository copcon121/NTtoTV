param(
    [string]$SshConfig = "C:\Users\Administrator\Desktop\NTtoTV-linux-rithmic\_oracle_stage\ssh_config",
    [int]$RemotePort = 18080,
    [int]$LocalPort = 8000
)

$ErrorActionPreference = "Stop"
$ssh = Join-Path $env:WINDIR "System32\OpenSSH\ssh.exe"
$runtimeDir = Join-Path $env:LOCALAPPDATA "NTtoTV\oracle-mt5-tunnel"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$lock = $null
try {
    # One supervisor per remote port, including manual invocations.
    $lock = [System.IO.File]::Open(
        (Join-Path $runtimeDir "$RemotePort.lock"),
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
} catch [System.IO.IOException] {
    exit 0
}

try {
    while ($true) {
        $arguments = @(
            "-F", ('"' + $SshConfig + '"'), "-N", "-T",
            "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes",
            "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3",
            "-o", "ConnectTimeout=12",
            "-R", "127.0.0.1:${RemotePort}:127.0.0.1:${LocalPort}", "oracle-a1"
        )
        $process = Start-Process -FilePath $ssh -ArgumentList $arguments `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $runtimeDir "ssh.stdout.log") `
            -RedirectStandardError (Join-Path $runtimeDir "ssh.stderr.log")
        Set-Content -LiteralPath (Join-Path $runtimeDir "ssh.pid") -Value $process.Id
        $process.WaitForExit()
        Start-Sleep -Seconds 10
    }
} finally {
    if ($process -and -not $process.HasExited) { $process.Kill() }
    $lock.Dispose()
}
