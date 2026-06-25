# AGENTS.md

Huong dan always-on cho agent/dev moi trong repo `NTtoTV`. Doc file nay truoc
khi quet codebase. Muc tieu la nam du kien truc, lenh chay/test, du lieu
runtime, va cac vung can tranh de khong phai scan lai tu dau moi session.

## Tong Quan

Day la GC Chart Platform: mot chart web local kieu TradingView cho GC futures.
He thong gom 3 phan:

- `backend/`: Python FastAPI, nhan stream Level 1 tu NinjaTrader AddOn qua
  `/ws/nt`, ghi raw tick/quote, build bar/order-flow/cache, phat realtime qua
  `/ws/chart`, va cung cap REST API.
- `frontend/`: Vite + React + TypeScript, ve chart `GC`, indicators,
  footprint, alerts, profiles, drawings, va status.
- `nt-addon/`: C#/.NET + NinjaScript bridge cho NinjaTrader 8, subscribe Level
  1 trade/quote GC va forward sang backend.

Symbol hien tai la `GC`. Frontend chart dung logical chart contract `GC`, khong
con contract selector tren UI. NT source contract thuc te co the la
`GC 08-26`, `GC 06-26`, etc.; backend normalize derived chart/cache ve key
`contract="GC"` trong khi raw tick van giu contract that.

## Trang Thai Contract Hien Tai

- Backend default candidates nam trong `backend/app/config.py`:
  `("GC 02-26", "GC 04-26", "GC 06-26", "GC 08-26")`.
- Runtime default pin active source ve candidate cuoi, hien tai `GC 08-26`.
- `nt-addon/ninjascript/gc-chart-bridge.json` cung pin
  `"manualContractOverride": "GC 08-26"`.
- Pipeline chi chart/cache realtime mot source contract active. Trade/quote tu
  contract khac van co the duoc raw-record, nhung khong duoc dua vao
  bar/delta/footprint chart neu khong phai source active.
- Neu source active im lang hon 15 giay va contract khac co trade moi, pipeline
  co the switch source de ho tro doi contract ben NT.

Quan trong: dung key `contract=GC` khi doc chart history/order-flow tu
frontend/cache. Dung contract thuc (`GC 08-26`) khi doc raw tick shards.

## Thu Muc Chinh

Root:

- `backend/`: FastAPI backend.
- `frontend/`: React frontend.
- `nt-addon/`: C# core/addon + NinjaScript self-contained AddOn.
- `scripts/`: PowerShell utilities import/reset data.
- `export data/`: NT historical export `.Last/.Bid/.Ask.txt`.
- `_data_backups/`, `_import_logs/`, `_import_test/`: generated/runtime data.
- `IMPORT_NT_EXPORT.cmd`: GUI import NT export.
- `IMPORT_TODAY_LAST_TO_CHART.cmd`: one-click Last-only import into chart cache.
- `RESET_MARKET_DATA.cmd`: reset backend market data with backup/restart.

Non-project/ad-hoc root files include MT5 artifacts (`SMC_LuxAlgo_*.mq5/.ex5`,
`SMCStrategyCore.mqh`, `smc_lux.py`). Do not refactor or delete them unless the
user explicitly asks.

## Backend Layout

`backend/app/`:

- `app.py`: FastAPI app factory, includes REST routers and `/ws/nt`, `/ws/chart`.
- `runtime.py`: owns long-lived singletons: `CacheStore`, `TickStore`,
  `ContractResolver`, `WebSocketRegistry`, `Pipeline`; starts flush/heartbeat
  loops and raw retention loop.
- `config.py`: default ports, data dirs, GC candidates, tick retention, resolver
  scoring constants.
- `pipeline.py`: ingest -> raw record -> source filter -> engines -> cache ->
  websocket registry. This is the key realtime wiring file.
- `models/`: canonical trade/quote/timestamp and websocket message schemas.
- `ingest/`: `/ws/nt`, sequence validator, liveness watchdog, control plane.
- `engines/`: bar aggregator, volume delta, footprint, big trade, contract
  resolver, alert engine.
- `storage/`: SQLite stores.
  - `tick_store.py`: raw tick/quote day shards under `backend/data/ticks`.
  - `cache_store.py`, `keyed_store.py`: derived cache DB `backend/data/app.sqlite`.
  - `profile_store.py`, `alert_store.py`: profiles/alerts in cache DB.
- `registry/`: `/ws/chart` endpoint and throttled websocket registry.
- `rest/`: REST API for health/symbols/contracts/history/orderflow/big-trades,
  alerts, profiles, notifications.
- `backfill/nt_export.py`: NT export parser/importer.

Backend storage:

- Default data dir is relative to backend working directory: `backend/data/`.
- `backend/data/app.sqlite`: derived bars, order-flow, alerts, profiles,
  metadata.
- `backend/data/ticks/GC/<contract>/<YYYY-MM-DD>.sqlite`: raw trade/quote shards.
- Raw tick retention is 2 calendar UTC days by default.
- Historical/deep imports should generally write bars + volume delta only; do
  not import full raw Bid/Ask history unless explicitly needed.

Key REST endpoints:

- `GET /api/health`
- `GET /api/symbols`
- `GET /api/contracts?symbol=GC`
- `POST /api/contracts/active`
- `GET /api/history?symbol=GC&contract=GC&tf=1m&limit=...`
- `GET /api/orderflow/volume-delta?symbol=GC&contract=GC&tf=1m&limit=...`
- `GET /api/orderflow/footprint?symbol=GC&contract=GC&count=...`
- `GET /api/big-trades?symbol=GC&contract=GC&limit=...`

## Frontend Layout

Stack:

- Vite + React 18 + TypeScript strict.
- `lightweight-charts` for chart rendering.
- Vitest + jsdom + fast-check.

`frontend/src/`:

- `LiveApp.tsx`: main live chart application, profiles, alerts, socket, history.
  Constants: `SYMBOL = "GC"`, `CHART_CONTRACT = SYMBOL`.
- `chart/`: chart container, toolbar, timeframe selector, drawing toolbar,
  indicators, SMC/outside bar/EMA, lightweight-charts adapter.
- `socket/`: `/ws/chart` client and message types.
- `cache/`: history loader, memory cache, range patcher.
- `footprint/`: footprint canvas/model.
- `alerts/`: alert panel/types.
- `status/`: connection status indicator.
- `profiles/`: profile payload types.
- `test/`: fast-check setup and property helpers.
- `styles.css`: global layout and responsive/mobile toolbar styles.

Networking rule:

- In dev, Vite proxies `/api` and `/ws` to backend.
- Browser should use same-origin `/api` and `/ws/chart`, not hard-code `:8000`
  in frontend code, or REST and websocket can split across different backend
  processes.
- Current browser/public entrypoint is `https://gcflowpy.xyz/`. Do not assume
  local port `9999` is in use; that was the old Vite dev URL.
- Vite can still run locally for development if explicitly started, but production
  traffic is served through Caddy on `gcflowpy.xyz`.
- Important: after frontend/UI changes that must appear on the public domain,
  run `cd frontend; npm run build` so `frontend/dist` is updated. Then verify
  `https://gcflowpy.xyz/` references the new `/assets/index-*.js` bundle; a
  source-only change will not show up on the domain.

## NT AddOn Layout

`nt-addon/`:

- `NtAddOn.sln`: .NET solution.
- `src/NtAddOn.Core/`: platform-agnostic code, testable without NinjaTrader.
  Config, buffering, normalizer, websocket worker, reconnect, control plane.
- `src/NtAddOn.NinjaTrader/`: NinjaTrader-coupled project (`net48`).
- `tests/NtAddOn.Tests/`: xUnit + FsCheck tests.
- `ninjascript/GcChartBridgeAddOn.cs`: self-contained NinjaScript AddOn used
  for deployment by copying into NinjaTrader custom AddOns.
- `ninjascript/gc-chart-bridge.json`: matching config, currently pins
  `GC 08-26`.

Deployed NT paths used on this machine:

- AddOn source:
  `%USERPROFILE%\Documents\NinjaTrader 8\bin\Custom\AddOns\GcChartBridgeAddOn.cs`
- Config:
  `%USERPROFILE%\Documents\NinjaTrader 8\gc-chart-bridge.json`

If editing `nt-addon/ninjascript/GcChartBridgeAddOn.cs` or config and the user
wants it live in NT, copy the repo file to those deployed paths, then NinjaTrader
must compile (`F5` in NinjaScript Editor) or restart.

Current NinjaScript behavior:

- Startup subscribes only the active source (manual override if set, otherwise
  first candidate).
- Backend also sends control-plane subscribe/unsubscribe commands on `/ws/nt`
  connect to keep stale multi-contract subscriptions from merging into chart.

## Commands

Backend setup/run:

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.app:app --host 0.0.0.0 --port 8000
```

Backend health:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
```

Production runtime check/restart:

```powershell
$root = "C:\Users\Administrator\Desktop\NTtoTV"

# Check backend and public frontend first. If both are OK, leave processes alone.
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/health -TimeoutSec 5
$r = Invoke-WebRequest -UseBasicParsing -Uri https://gcflowpy.xyz/ -TimeoutSec 8
[pscustomobject]@{
    StatusCode = $r.StatusCode
    Asset = ([regex]::Match($r.Content, '/assets/index-[^"'']+\.js').Value)
}

# Inspect listeners. 80/443 should be Caddy; 8000 should be uvicorn/backend.
Get-NetTCPConnection -LocalPort 8000,80,443 -ErrorAction SilentlyContinue |
    Select-Object LocalAddress,LocalPort,State,OwningProcess
Get-CimInstance Win32_Process |
    Where-Object {
        $_.CommandLine -match 'caddy\.exe' -or
        ($_.CommandLine -match 'uvicorn' -and $_.CommandLine -match 'app\.app:app')
    } |
    Select-Object ProcessId,Name,CommandLine
```

Backend detached restart, so closing IDE/terminal does not stop it:

```powershell
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

Start-Process `
    -FilePath (Join-Path $backendDir ".venv\Scripts\python.exe") `
    -WorkingDirectory $backendDir `
    -ArgumentList "-m uvicorn app.app:app --host 0.0.0.0 --port 8000" `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "backend.stdout.log") `
    -RedirectStandardError (Join-Path $logDir "backend.stderr.log")

Invoke-RestMethod -Uri http://127.0.0.1:8000/api/health -TimeoutSec 10
```

Public frontend/Caddy restart:

```powershell
$root = "C:\Users\Administrator\Desktop\NTtoTV"

# Rebuild first only when frontend source changes need to appear on gcflowpy.xyz.
Push-Location (Join-Path $root "frontend")
try {
    npm run build
} finally {
    Pop-Location
}

powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\Stop-HttpsProxy.ps1")
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\Start-HttpsProxy.ps1")

$r = Invoke-WebRequest -UseBasicParsing -Uri https://gcflowpy.xyz/ -TimeoutSec 10
[pscustomobject]@{
    StatusCode = $r.StatusCode
    Asset = ([regex]::Match($r.Content, '/assets/index-[^"'']+\.js').Value)
}
```

Operational notes:

- `frontend/dist` is what Caddy serves on `https://gcflowpy.xyz/`; `npm run dev`
  is only for local development.
- `backend\start_backend.cmd` is useful for a visible console session, but for
  production-like runtime prefer the detached `Start-Process` flow above.
- Backend detached logs go to `_run_logs\backend\backend.stdout.log` and
  `_run_logs\backend\backend.stderr.log`; Caddy logs go to `_run_logs\caddy\`.
- Do not restart Caddy when only backend is down; Caddy proxies to backend on
  loopback and can keep serving the already-built frontend.

Frontend run:

```powershell
cd frontend
npm run dev
```

Current browser URL:

```text
https://gcflowpy.xyz/
```

Backend tests:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m pytest -m property
```

Focused backend tests commonly used for recent contract/import work:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests\unit\test_contract_resolver.py tests\unit\test_control_plane.py tests\unit\test_nt_export_backfill.py tests\integration\test_pipeline_wiring.py tests\integration\test_rest_contracts.py
```

Frontend checks:

```powershell
cd frontend
npm run typecheck
npm test
npm run build
```

NT AddOn tests/build, only if .NET SDK is installed:

```powershell
cd nt-addon
dotnet build src\NtAddOn.Core\NtAddOn.Core.csproj
dotnet test tests\NtAddOn.Tests\NtAddOn.Tests.csproj
```

Full NT project may require NinjaTrader local install:

```powershell
dotnet build NtAddOn.sln -p:NinjaTraderBinDir="$env:USERPROFILE\Documents\NinjaTrader 8\bin"
```

Note: this machine previously did not have a .NET SDK available, so `dotnet
test` can fail with "No .NET SDKs were found".

## Import / Reset Workflows

GUI import:

```powershell
.\IMPORT_NT_EXPORT.cmd
```

Last-only import for current `GC 08-26-5-6.Last.txt`:

```powershell
.\IMPORT_TODAY_LAST_TO_CHART.cmd
```

Direct Last-only import:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Import-TodayLastToChart.ps1
```

What this does:

- Defaults to `export data\GC 08-26-5-6.Last.txt`.
- Infers source contract from filename (`GC 08-26`).
- Writes derived chart cache under `contract=GC`.
- Skips raw Bid/Ask import.
- Clears existing bars + volume delta in the imported range unless `-NoClear`
  is supplied.

General NT gap import:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Import-NtGap.ps1 -Contract "GC 08-26" -Last "<path.Last.txt>" -SkipRecentRaw -ClearDerivedRange
```

Raw recent import only happens when a complete Last/Bid/Ask set is present and
the export touches the recent retention window. Use `-SkipRecentRaw` for
history/gap imports that should remain bars + delta only.

Reset market data:

```powershell
.\RESET_MARKET_DATA.cmd
```

This runs `scripts/Reset-MarketData.ps1 -StopBackend -RestartBackend`, backs up
`backend/data` into `_data_backups` by default, recreates clean data, then
restarts backend. Treat as destructive and only run when requested.

## Testing Conventions

Backend:

- `pytest` markers: `unit`, `integration`, `property`, `smoke`.
- Property tests use Hypothesis profile with at least 100 examples.
- Each property test must include exact tag comment:
  `Feature: gc-chart-platform, Property {n}: {property_text}`.

Frontend:

- Vitest tests live beside source as `*.test.ts(x)` / property tests.
- fast-check is globally configured in `frontend/src/test/fast-check.setup.ts`.
- Use `propertyTest` / `propertyTag` helpers from `frontend/src/test/property.ts`.

NT AddOn:

- xUnit + FsCheck property tests.
- Core project should remain testable without NinjaTrader assemblies.
- NinjaTrader-coupled code belongs only under `NtAddOn.NinjaTrader` or the
  self-contained `ninjascript` file.

## Coding Rules For This Repo

- Prefer existing patterns and local helpers. Do not introduce new frameworks.
- Keep edits scoped; this repo can have dirty/generated runtime files.
- Use `rg` / `rg --files` for search.
- Use `apply_patch` for manual edits.
- Avoid destructive git commands. Never reset or checkout user changes unless
  explicitly requested.
- Use ASCII by default for code/docs unless the file already requires Unicode.
- Do not commit generated runtime data, logs, caches, build outputs, exports,
  SQLite DBs, or NinjaTrader dumps.

Backend-specific:

- `NormalizedTrade`/`NormalizedQuote` use canonical ms UTC timestamps.
- Raw tick writes happen before chart throttling/filtering.
- Derived chart cache should use logical contract `GC`.
- Raw tick shards should use real source contract.
- If changing source/contract logic, update resolver/control-plane/pipeline
  tests together.
- Be careful with SQLite writer concurrency; use existing store methods.

Frontend-specific:

- Keep REST and websocket same-origin through Vite proxy.
- Keep mobile toolbar responsive; prior issue was toolbar controls covering the
  menu on mobile, fixed by two-row mobile layout in `styles.css`.
- Do not reintroduce a contract selector unless the user explicitly asks.
- `CHART_CONTRACT` is `GC`.
- Run `npm run typecheck` or `npm run build` after TypeScript/UI changes.
- For user-visible frontend changes on `https://gcflowpy.xyz/`, prefer
  `npm run build` over typecheck alone, because Caddy serves the built
  `frontend/dist` bundle.

NT-specific:

- Core C# code can use modern C# as project code.
- `nt-addon/ninjascript/GcChartBridgeAddOn.cs` targets NinjaScript compiler and
  intentionally avoids newer C# syntax such as expression-bodied members,
  null-conditional operators, string interpolation, `nameof`, and out-var.
- If changing deployed NinjaScript, copy to the Documents NinjaTrader path and
  tell the user to compile/restart NT.

## Do Not Touch Unless Asked

- `backend/data/`, `data/`: active runtime SQLite stores.
- `_data_backups/`, `_import_logs/`, `_import_test/`: generated backup/import
  areas.
- `export data/`: user NT exports; do not delete or overwrite.
- `frontend/node_modules/`, `frontend/dist/`, `*.tsbuildinfo`.
- `backend/.venv/`, `.pytest_cache/`, `.hypothesis/`.
- `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, `*.log`, `*_out.txt`.
- Deployed NinjaTrader files under Documents unless the task is specifically
  about deployment.
- Root MT5/trading artifacts unless explicitly requested.

## Quick Diagnosis Checklist

Frontend frozen / no data:

1. Check backend: `GET /api/health`.
2. Check public frontend/domain: `https://gcflowpy.xyz/`.
3. Check `/api/contracts?symbol=GC`; active should normally be `GC 08-26`.
4. Check `/api/history?symbol=GC&contract=GC&tf=1m&limit=5`.
5. Check backend log for `/ws/nt` and `/ws/chart` accepted connections.
6. If NT source changed, ensure NT AddOn config/manual override and backend
   active source agree.

Bar stream looks wrong:

1. Suspect multiple source contracts merging.
2. Verify active source is `GC 08-26`.
3. Raw shards may still receive quotes from old contracts; that is acceptable
   if chart/cache only moves with active source.
4. If cache already has bad rows, clear or re-import only affected bar/delta
   range; do not wipe raw data unless requested.

Gap/history import:

1. If only `.Last.txt` is available, import bars + volume delta only.
2. Use `Import-TodayLastToChart.ps1` or `Import-NtGap.ps1 -SkipRecentRaw`.
3. Only use raw Last/Bid/Ask import for the recent 2-day retention window when
   complete files exist.

## Current Known Good Baseline

After the latest fixes:

- Backend process runs on port `8000`.
- Frontend/public browser entrypoint is `https://gcflowpy.xyz/`.
- Port `9999` is no longer the active user-facing frontend route; only use it
  if a local Vite dev server was explicitly started for development.
- Caddy serves the frontend/domain and proxies `/api` and `/ws` to backend
  loopback.
- Frontend source changes are not visible on `https://gcflowpy.xyz/` until
  `frontend/dist` is rebuilt with `npm run build`; confirm the domain's
  `index.html` points to the new hashed asset.
- Backend port `8000` has an inbound Windows Firewall block rule:
  `NTtoTV Block Backend 8000 Inbound`. Local loopback still works for the
  Caddy proxy and health checks.
- Current real MT5 backend runtime env uses live trading enabled and invite-code
  gated self-registration:
  `NTTOTV_MT5_BACKEND=real`, `NTTOTV_TRADING_ENABLED=1`,
  `NTTOTV_LIVE_TRADING_ENABLED=1`, `NTTOTV_INVITE_CODE=join-9999`.
- Active REST contract is `GC 08-26`; chart cache key is `GC`.
- Last-only file `export data\GC 08-26-5-6.Last.txt` was imported into chart
  cache as bars + volume delta.
- Backend focused tests passed: resolver, control-plane, NT export backfill,
  pipeline wiring, REST contracts.
- Frontend `npm run build` passed.
