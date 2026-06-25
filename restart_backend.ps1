$root = "C:\Users\Administrator\Desktop\NTtoTV"
$backendDir = Join-Path $root "backend"
$logDir = Join-Path $root "_run_logs\backend"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$oldBackend = Get-CimInstance Win32_Process |
    Where-Object {
        $_.CommandLine -match 'uvicorn' -and
        $_.CommandLine -match 'app\.app:app' -and
        $_.CommandLine -match '--port 8000'
    }
if ($oldBackend) {
    $oldBackend | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Start-Sleep -Seconds 2
}

$env:NTTOTV_MT5_BACKEND="real"
$env:NTTOTV_TRADING_ENABLED="1"
$env:NTTOTV_LIVE_TRADING_ENABLED="1"
$env:NTTOTV_INVITE_CODE="join-9999"

Start-Process `
    -FilePath (Join-Path $backendDir ".venv\Scripts\python.exe") `
    -WorkingDirectory $backendDir `
    -ArgumentList "-m uvicorn app.app:app --host 0.0.0.0 --port 8000" `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "backend.stdout.log") `
    -RedirectStandardError (Join-Path $logDir "backend.stderr.log")

Start-Sleep -Seconds 3
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/health -TimeoutSec 10
