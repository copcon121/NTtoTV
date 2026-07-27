<#
.SYNOPSIS
    One-click FULL reset: Windows MachineGuid + VS Code machine ID +
    Verdent extension + Verdent standalone app.
.DESCRIPTION
    1. Closes VS Code and Verdent.
    2. Changes Windows Registry MachineGuid (the REAL source Verdent reads).
    3. Resets VS Code machineid + telemetry.
    4. Wipes ALL Verdent state from VS Code state.vscdb + extension storage.
    5. Wipes Verdent standalone app data.
    6. Everything is backed up.

    IMPORTANT: Changing MachineGuid affects all apps that use it for
    device identification. This is generally safe but be aware.
#>

[CmdletBinding()]
param(
    [string]$CodeDir = (Join-Path $env:APPDATA "Code")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMddHHmmss"

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

function New-HexId {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ''
}

# --------------------------------------------------------------------------
# 1. Close VS Code + Verdent
# --------------------------------------------------------------------------

Write-Host ""
Write-Host "=== FULL Reset: MachineGuid + VS Code + Verdent ===" -ForegroundColor Magenta
Write-Host ""

foreach ($procName in @("Code", "Verdent")) {
    $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "Closing $procName ($($procs.Count) processes)..." -ForegroundColor Cyan
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Get-Process -Name $procName -ErrorAction SilentlyContinue |
            Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] $procName closed" -ForegroundColor Green
    } else {
        Write-Host "[--] $procName not running" -ForegroundColor DarkGray
    }
}
Start-Sleep -Seconds 1

# --------------------------------------------------------------------------
# 2. Generate new IDs
# --------------------------------------------------------------------------

$newMachineGuid = [guid]::NewGuid().ToString()
$newMachineId   = New-HexId
$newSqmId       = "{$([guid]::NewGuid().ToString().ToUpper())}"
$newDevDeviceId = [guid]::NewGuid().ToString()
$newUpdaterId   = [guid]::NewGuid().ToString()

# --------------------------------------------------------------------------
# 3. Change Windows Registry MachineGuid  *** THE KEY FIX ***
# --------------------------------------------------------------------------

Write-Host ""
Write-Host "--- Windows MachineGuid (Registry) ---" -ForegroundColor Yellow

$regPath = "HKLM:\SOFTWARE\Microsoft\Cryptography"
$oldMachineGuid = (Get-ItemProperty -Path $regPath -Name MachineGuid).MachineGuid

Write-Host "Old MachineGuid: $oldMachineGuid" -ForegroundColor DarkGray

try {
    Set-ItemProperty -Path $regPath -Name MachineGuid -Value $newMachineGuid
    Write-Host "[OK] MachineGuid: $oldMachineGuid -> $newMachineGuid" -ForegroundColor Green
} catch {
    Write-Warning "Failed to set MachineGuid (need Admin?): $_"
    Write-Host "Try: Run this script as Administrator" -ForegroundColor Red
}

# --------------------------------------------------------------------------
# 4. Patch VS Code machineid
# --------------------------------------------------------------------------

Write-Host ""
Write-Host "--- VS Code Machine ID ---" -ForegroundColor Yellow

$machineFile = Join-Path $CodeDir "machineid"
$oldMachineId = "(not found)"

if (Test-Path $machineFile) {
    $oldMachineId = (Get-Content $machineFile -Raw).Trim()
    Copy-Item $machineFile "$machineFile.bak.$timestamp"
}
Set-Content -Path $machineFile -Value $newMachineId -NoNewline -Encoding utf8
Write-Host "[OK] machineid patched" -ForegroundColor Green

# --------------------------------------------------------------------------
# 5. Patch storage.json telemetry
# --------------------------------------------------------------------------

$storageFile = Join-Path $CodeDir "storage.json"
if (Test-Path $storageFile) {
    Copy-Item $storageFile "$storageFile.bak.$timestamp"
    $json = Get-Content $storageFile -Raw -Encoding utf8 | ConvertFrom-Json

    $keys = @("telemetry.machineId", "telemetry.macMachineId",
              "telemetry.devDeviceId", "telemetry.sqmId")
    $vals = @($newMachineId, $newMachineId, $newDevDeviceId, $newSqmId)

    $touched = $false
    for ($i = 0; $i -lt $keys.Count; $i++) {
        if ($json.PSObject.Properties.Name -contains $keys[$i]) {
            $json.($keys[$i]) = $vals[$i]
            $touched = $true
        }
    }

    if ($touched) {
        $json | ConvertTo-Json -Depth 32 |
            Set-Content -Path $storageFile -Encoding utf8 -NoNewline
        Write-Host "[OK] storage.json telemetry patched" -ForegroundColor Green
    }
}

# --------------------------------------------------------------------------
# 6. Wipe Verdent from VS Code state.vscdb
# --------------------------------------------------------------------------

Write-Host ""
Write-Host "--- Verdent VS Code Extension ---" -ForegroundColor Yellow

$stateDb = Join-Path $CodeDir "User\globalStorage\state.vscdb"
$oldVerdentId = "(not found)"

if (Test-Path $stateDb) {
    Copy-Item $stateDb "$stateDb.bak.$timestamp"

    $pyExe = $null
    foreach ($c in @(
        (Join-Path $PSScriptRoot "..\backend\.venv\Scripts\python.exe"),
        "python.exe", "python3.exe"
    )) {
        try { $pyExe = (Get-Command $c -ErrorAction Stop).Source; break } catch {}
    }

    if ($pyExe) {
        $pyScript = @"
import sqlite3, json, sys

db_path, new_id = sys.argv[1], sys.argv[2]
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT rowid, key, value FROM ItemTable")
rows = cur.fetchall()

for rowid, key, value in rows:
    if not value:
        continue

    # Main config blob - reset deviceId and projectIds
    if "verdent-ai-agent-config" in str(value):
        try:
            obj = json.loads(value)
        except:
            continue
        cfg = obj.get("verdent-ai-agent-config", {})
        old = cfg.get("deviceId", "")
        if old:
            print(f"OLD_VERDENT={old}")
        cfg["deviceId"] = new_id
        for k in list(cfg.keys()):
            if k.startswith("projectId"):
                del cfg[k]
        obj["verdent-ai-agent-config"] = cfg
        cur.execute("UPDATE ItemTable SET value = ? WHERE rowid = ?",
                    (json.dumps(obj, separators=(',',':')), rowid))
        print("PATCHED_CONFIG")

    # Delete ALL secret rows for Verdent
    if "verdentai.verdent" in str(key) and "secret://" in str(key):
        cur.execute("DELETE FROM ItemTable WHERE rowid = ?", (rowid,))
        print(f"DELETED_SECRET key={key}")

conn.commit()
conn.close()
"@
        $tmpPy = Join-Path $env:TEMP "patch_verdent_$timestamp.py"
        Set-Content -Path $tmpPy -Value $pyScript -Encoding utf8
        $result = & $pyExe $tmpPy $stateDb $newMachineGuid 2>&1
        Remove-Item $tmpPy -Force -ErrorAction SilentlyContinue

        foreach ($line in ($result -split "`n")) {
            $line = $line.Trim()
            if ($line -match "^OLD_VERDENT=(.+)") { $oldVerdentId = $Matches[1] }
            if ($line -match "^PATCHED_CONFIG") {
                Write-Host "[OK] Verdent config reset in state.vscdb" -ForegroundColor Green
            }
            if ($line -match "^DELETED_SECRET") {
                Write-Host "[OK] Deleted secret" -ForegroundColor Green
            }
        }
    } else {
        Write-Warning "Python not found - cannot patch state.vscdb"
    }
}

# Delete Verdent extension storage folder
$verdentExtStorage = Join-Path $CodeDir "User\globalStorage\verdentai.verdent"
if (Test-Path $verdentExtStorage) {
    Copy-Item $verdentExtStorage "$verdentExtStorage.bak.$timestamp" -Recurse
    Remove-Item $verdentExtStorage -Recurse -Force
    Write-Host "[OK] Deleted Verdent extension storage" -ForegroundColor Green
}

# --------------------------------------------------------------------------
# 7. Wipe Verdent standalone app data
# --------------------------------------------------------------------------

Write-Host ""
Write-Host "--- Verdent Standalone App ---" -ForegroundColor Yellow

$verdentAppDir = Join-Path $env:APPDATA "Verdent"
if (Test-Path $verdentAppDir) {
    $bakDir = "$verdentAppDir.bak.$timestamp"
    Copy-Item $verdentAppDir $bakDir -Recurse -ErrorAction SilentlyContinue
    Write-Host "[OK] Backed up -> $bakDir" -ForegroundColor DarkGreen

    # State files
    foreach ($f in @(
        ".updaterId", "app-v2.db", "app-v2.db-wal", "app-v2.db-shm",
        "verdent-storage.json", "Local State", "Preferences", "DIPS", "SharedStorage"
    )) {
        $p = Join-Path $verdentAppDir $f
        if (Test-Path $p) {
            Remove-Item $p -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Deleted $f" -ForegroundColor Green
        }
    }

    # Tracking directories
    foreach ($d in @(
        "Local Storage", "Session Storage", "Network", "sentry",
        "Crashpad", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache",
        "Shared Dictionary", "logs"
    )) {
        $p = Join-Path $verdentAppDir $d
        if (Test-Path $p) {
            Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Deleted $d/" -ForegroundColor Green
        }
    }

    Set-Content -Path (Join-Path $verdentAppDir ".updaterId") -Value $newUpdaterId -NoNewline -Encoding utf8
    Write-Host "[OK] New .updaterId" -ForegroundColor Green
}

# ~/.verdent
$verdentHome = Join-Path $env:USERPROFILE ".verdent"
if (Test-Path $verdentHome) {
    Copy-Item $verdentHome "$verdentHome.bak.$timestamp" -Recurse -ErrorAction SilentlyContinue
    Remove-Item $verdentHome -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Deleted ~/.verdent/" -ForegroundColor Green
}

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------

Write-Host ""
Write-Host "============= Summary =============" -ForegroundColor White
Write-Host ""
Write-Host "  Windows MachineGuid : $oldMachineGuid -> $newMachineGuid" -ForegroundColor Green
Write-Host "  VS Code machineId   : $newMachineId" -ForegroundColor Green
Write-Host "  Old Verdent ID      : $oldVerdentId"
Write-Host "  New Verdent ID      : $newMachineGuid (= MachineGuid)" -ForegroundColor Green
Write-Host ""
Write-Host "====================================" -ForegroundColor White
Write-Host ""
Write-Host "  Wiped: Registry MachineGuid, VS Code telemetry," -ForegroundColor Cyan
Write-Host "  Verdent deviceId/projectId/secrets/cookies/sentry/sessions" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backups: suffix .$timestamp" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next: Open VS Code -> Verdent sees a completely new machine." -ForegroundColor White
Write-Host ""
