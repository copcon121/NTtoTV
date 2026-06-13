# NTtoTV Project Overview

Cập nhật: 2026-06-11

File này tổng hợp kiến trúc, cấu trúc thư mục, luồng dữ liệu, lệnh chạy/test,
runtime data và các vùng cần tránh của project `NTtoTV`. Dùng file này như tài
liệu onboarding nhanh cho toàn bộ repo. Các quy tắc làm việc chi tiết cho agent
nằm trong `AGENTS.md`.

## 1. Tổng Quan

`NTtoTV` là một nền tảng chart local kiểu TradingView cho GC futures, có thêm
phần order-on-chart qua MT5. Hệ thống chính gồm:

- `backend/`: Python FastAPI. Nhận stream Level 1 từ NinjaTrader AddOn qua
  `/ws/nt`, ghi raw tick/quote, build bar/order-flow/cache, phát realtime qua
  `/ws/chart`, cung cấp REST API, alerts, profile, auth và MT5 trading bridge.
- `frontend/`: Vite + React + TypeScript. Render chart GC, indicator,
  footprint, delta, alerts, drawings, status, auth và order controls.
- `nt-addon/`: C#/.NET + NinjaTrader/NinjaScript bridge. Subscribe trade/quote
  GC trong NinjaTrader 8 và forward sang backend.
- `scripts/`: PowerShell workflow cho import NinjaTrader export, reset market
  data, cài/chạy Caddy proxy.
- `deploy/`: cấu hình deploy production, hiện có Caddy reverse proxy.

Symbol chart hiện tại là `GC`. Frontend dùng logical chart contract `GC`.
Contract nguồn thực tế từ NinjaTrader có thể là `GC 08-26`, `GC 06-26`, ...;
backend normalize dữ liệu chart/cache về `contract="GC"` trong khi raw tick
vẫn lưu theo contract thật.

## 2. Luồng Dữ Liệu Chính

```text
NinjaTrader 8
  -> nt-addon / NinjaScript AddOn
  -> WebSocket /ws/nt
  -> IngestionCoordinator + SequenceValidator
  -> TickStore raw SQLite shards
  -> ContractResolver + active source filter
  -> BarAggregator / VolumeDelta / Footprint / BigTrade / AlertEngine
  -> CacheStore backend/data/app.sqlite
  -> WebSocketRegistry /ws/chart
  -> Frontend React chart
```

Các điểm quan trọng:

- Raw tick/quote được ghi trước khi filter/throttle chart.
- Chart/cache realtime chỉ nhận source contract active.
- Chart REST/cache dùng `contract=GC`.
- Raw tick shard dùng contract thật, ví dụ `GC 08-26`.
- Nếu source active im lặng hơn 15 giây và contract khác có trade mới, pipeline
  có thể switch source để hỗ trợ đổi contract từ NinjaTrader.
- Registry throttle update UI khoảng 100-125 ms.
- Backend có loop heartbeat chart, retention raw tick, anchored MT5 sync và
  order reconciliation.

## 3. Trạng Thái Contract Hiện Tại

Backend default GC candidates nằm trong `backend/app/config.py`:

```text
GC 02-26
GC 04-26
GC 06-26
GC 08-26
```

Runtime default pin source về candidate cuối: `GC 08-26`.

NinjaScript config ở `nt-addon/ninjascript/gc-chart-bridge.json` cũng đang pin:

```json
{
  "manualContractOverride": "GC 08-26"
}
```

Quy ước đọc dữ liệu:

- Chart history/order-flow: dùng `symbol=GC&contract=GC`.
- Raw ticks: dùng source contract thật như `GC 08-26`.
- Không reintroduce contract selector trong frontend nếu không có yêu cầu rõ.

## 4. Cấu Trúc Root

```text
NTtoTV/
  AGENTS.md                         # quy tắc repo cho agent/dev
  PROJECT_OVERVIEW.md               # file tổng hợp này
  NTtoTV-order-on-chart-spec.md      # spec order-on-chart / MT5
  IMPORT_NT_EXPORT.cmd              # GUI import NinjaTrader export
  IMPORT_TODAY_LAST_TO_CHART.cmd    # import Last-only hiện tại vào chart cache
  RESET_MARKET_DATA.cmd             # reset market data, có backup/restart
  backend/                          # FastAPI backend
  frontend/                         # React frontend
  nt-addon/                         # NinjaTrader AddOn / bridge
  scripts/                          # PowerShell utilities
  deploy/caddy/Caddyfile            # production reverse proxy
  tools/caddy/                      # Caddy portable local files
  mt5-terminals/                    # MT5 terminal copies/downloads
  export data/                      # NinjaTrader historical exports
  _data_backups/                    # generated backups
  _import_logs/                     # generated import logs
  _import_test/                     # generated import test data
  _run_logs/                        # generated runtime logs
```

Root cũng có một số artifact MT5/ad-hoc như `SMC_LuxAlgo_*.mq5/.ex5`,
`SMCStrategyCore.mqh`, `smc_lux.py`. Không refactor hoặc xóa các file này nếu
không được yêu cầu.

## 5. Backend

Stack:

- Python >= 3.11
- FastAPI
- Uvicorn
- SQLite
- websockets
- pytest + Hypothesis cho test/property test
- Optional `MetaTrader5` package cho real MT5 backend

Layout chính:

```text
backend/
  app/
    app.py                    # FastAPI app factory, include REST + WS routers
    main.py                   # entrypoint chạy backend
    runtime.py                # singleton runtime: stores, resolver, registry, pipeline, MT5
    pipeline.py               # ingest -> engines -> cache -> registry
    config.py                 # ports, data dirs, candidates, MT5/trading env
    models/                   # canonical trade/quote/timestamp/message/auth/order schemas
    ingest/                   # /ws/nt, sequence validator, watchdog, control plane
    engines/                  # bars, delta, footprint, big trades, alerts, resolver, basis
    storage/                  # SQLite stores: cache, ticks, alerts, profiles, users, orders
    registry/                 # /ws/chart endpoint + throttled websocket registry
    rest/                     # REST routers
    mt5/                      # fake/real MT5 manager + worker/process client
    backfill/                 # NinjaTrader export parser/importer
  tests/
    unit/
    integration/
    property/
    parity/
    smoke/
  requirements.txt
  requirements-test.txt
  requirements-mt5.txt
  pyproject.toml
```

Runtime singletons trong `AppRuntime`:

- `CacheStore`: derived cache DB.
- `TickStore`: raw tick/quote day shards.
- `ContractResolver`: active contract/source resolver.
- `WebSocketRegistry`: coalesced chart broadcast.
- `Pipeline`: live trade/quote fan-out.
- `Mt5Manager`: fake hoặc real MT5 bridge.
- `BasisEngine`: basis giữa GC và broker symbol.
- `AnchoredSyncEngine`: sync anchored/order state.
- `ReconciliationEngine`: reconcile open orders/trades.

### Backend Storage

Mặc định backend chạy với working directory là `backend/`, nên data root là:

```text
backend/data/
```

Các store chính:

```text
backend/data/app.sqlite
backend/data/ticks/GC/<real-contract>/<YYYY-MM-DD>.sqlite
```

Quy tắc:

- `app.sqlite`: bars, volume delta, footprint, big trades, alerts, profiles,
  auth/users, orders, metadata.
- `ticks/`: raw trade/quote shards theo symbol, contract thật và ngày UTC.
- Raw tick retention mặc định là 2 calendar UTC days.
- Import lịch sử/deep import thường chỉ nên ghi bars + volume delta, không import
  full raw Bid/Ask trừ khi thật sự cần.

### Backend REST Và WebSocket

WebSocket:

- `GET /ws/nt`: NinjaTrader AddOn stream vào backend.
- `GET /ws/nt-capture`: endpoint capture/debug stream.
- `GET /ws/chart`: frontend chart realtime stream.

REST meta/chart:

- `GET /api/health`
- `GET /api/symbols`
- `GET /api/contracts?symbol=GC`
- `POST /api/contracts/active`
- `GET /api/history?symbol=GC&contract=GC&tf=1m&limit=...`

REST order-flow:

- `GET /api/orderflow/volume-delta`
- `GET /api/orderflow/footprint`
- `GET /api/orderflow/delta-profile`
- `GET /api/big-trades`

REST alerts/profiles/notifications:

- `GET/POST/PATCH/DELETE /api/alerts`
- `GET/PUT /api/me/profile`
- `GET/PUT/DELETE /api/profiles/{profile_id}`
- `GET/PUT/POST /api/notifications/telegram`

REST auth:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

REST local/app orders:

- `GET/POST /api/orders`
- `GET/PATCH/DELETE /api/orders/{order_id}`
- `POST /api/orders/{order_id}/close`

REST MT5:

- `GET /api/mt5/terminals`
- `POST /api/mt5/connect`
- `GET /api/mt5/open-trades`
- `POST /api/mt5/positions/{ticket}/close`
- `PATCH /api/mt5/positions/{ticket}`
- `DELETE /api/mt5/orders/{ticket}`
- `PATCH /api/mt5/orders/{ticket}`
- `GET /api/mt5/status`
- `GET /api/mt5/account`
- `GET /api/mt5/symbol`

### Backend Commands

Setup:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-test.txt
```

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.app:app --host 0.0.0.0 --port 8000
```

Health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
```

Tests:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m pytest -m property
```

Focused tests cho contract/import/pipeline:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests\unit\test_contract_resolver.py tests\unit\test_control_plane.py tests\unit\test_nt_export_backfill.py tests\integration\test_pipeline_wiring.py tests\integration\test_rest_contracts.py
```

### Backend Env Quan Trọng

Trading/MT5 default là fail-closed:

```text
NTTOTV_TRADING_ENABLED=0
NTTOTV_LIVE_TRADING_ENABLED=0
NTTOTV_MT5_BACKEND=fake
```

Real MT5 runtime cần:

```powershell
set NTTOTV_MT5_BACKEND=real
set NTTOTV_TRADING_ENABLED=1
set NTTOTV_LIVE_TRADING_ENABLED=1
set NTTOTV_CREDENTIAL_KEY=<stable random secret>
set NTTOTV_INVITE_CODE=join-9999
```

Các env khác:

- `NTTOTV_SESSION_TTL_DAYS`, default `30`
- `NTTOTV_BROKER_SYMBOL`, default `XAUUSDm`
- `NTTOTV_BROKER_TICK_SIZE`, default `0.01`
- `NTTOTV_BROKER_DIGITS`, default `2`
- `NTTOTV_BROKER_PIP_VALUE`, default `1.0`
- `NTTOTV_MT5_CONNECT_TIMEOUT_MS`, default `5000`
- `NTTOTV_BASIS_DEFAULT`, default `0.0`
- `NTTOTV_BASIS_STALE_AFTER_MS`, default `5000`

Lưu ý: `NTTOTV_CREDENTIAL_KEY` phải ổn định qua restart vì password MT5 lưu
trong DB được seal bằng key này.

## 6. Frontend

Stack:

- Vite
- React 18
- TypeScript strict
- `lightweight-charts`
- Vitest + jsdom
- fast-check property tests

Layout chính:

```text
frontend/
  index.html
  package.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    LiveApp.tsx
    styles.css
    api/                 # REST client
    auth/                # login/register/session UI
    chart/               # chart container, toolbar, indicators, drawings
    cache/               # history loader, memory cache, range patcher
    footprint/           # footprint canvas/model
    orderflow/           # delta profile helpers
    orders/              # order-on-chart controls/dialogs
    alerts/              # alert panel/types
    profiles/            # profile payload types
    socket/              # /ws/chart client + message types
    status/              # connection status UI
    test/                # fast-check setup/property helpers
```

Chart constants:

- `SYMBOL = "GC"`
- `CHART_CONTRACT = SYMBOL`

Networking:

- Public/browser entrypoint hien tai: `https://gcflowpy.xyz/`.
- Port `9999` khong con la route frontend dang su dung; chi dung neu chu dong
  start Vite dev server local de debug.
- Caddy serve frontend/domain va proxy `/api`, `/ws` sang backend
  `127.0.0.1:8000`.
- Khi chay Vite dev server local, Vite van proxy `/api` va `/ws` sang backend.
- Browser code nên dùng same-origin `/api` và `/ws/chart`.
- Không hard-code frontend gọi trực tiếp `:8000` nếu không cần, vì REST và WS
  có thể split sang hai backend process khác nhau.

Commands:

```powershell
cd frontend
npm run dev
```

Mở:

```text
https://gcflowpy.xyz/
```

Checks:

```powershell
cd frontend
npm run typecheck
npm test
npm run build
```

Sau thay đổi TypeScript/UI nên chạy ít nhất `npm run typecheck` hoặc
`npm run build`.

## 7. NT AddOn / NinjaTrader Bridge

Mục tiêu: subscribe GC Level 1 trade/quote trong NinjaTrader 8 và forward sang
backend qua `ws://127.0.0.1:8000/ws/nt`.

Layout:

```text
nt-addon/
  NtAddOn.sln
  config.sample.json
  README.md
  src/
    NtAddOn.Core/             # netstandard2.0, testable without NinjaTrader
      Buffering/
      Configuration/
      Json/
      MarketData/
      Streaming/
    NtAddOn.NinjaTrader/      # net48, NinjaTrader-coupled adapter
      NinjaTrader/
  tests/
    NtAddOn.Tests/            # xUnit + FsCheck
  ninjascript/
    GcChartBridgeAddOn.cs     # self-contained NinjaScript AddOn
    gc-chart-bridge.json      # deployed-style config, pins GC 08-26
```

Core responsibilities:

- Config model and loader.
- Bounded queue / overload handling.
- Canonical timestamp and normalized market data.
- Sequence generator.
- WebSocket worker/reconnect/control-plane handling.
- Subscription manager.

NinjaTrader-specific responsibilities:

- Subscribe/unsubscribe contracts.
- Adapt NinjaTrader MarketData callbacks.
- Bridge callbacks into normalized events.

Current NinjaScript config:

```json
{
  "candidateContracts": ["GC 02-26", "GC 04-26", "GC 06-26", "GC 08-26"],
  "backendHost": "127.0.0.1",
  "backendPort": 8000,
  "backendPath": "/ws/nt",
  "outboundQueueCapacity": 200000,
  "dropOnOverflow": false,
  "manualContractOverride": "GC 08-26"
}
```

Deployed paths on this machine:

```text
%USERPROFILE%\Documents\NinjaTrader 8\bin\Custom\AddOns\GcChartBridgeAddOn.cs
%USERPROFILE%\Documents\NinjaTrader 8\gc-chart-bridge.json
```

Nếu sửa `nt-addon/ninjascript/GcChartBridgeAddOn.cs` hoặc config và muốn live
trong NinjaTrader, copy file repo sang deployed paths, rồi compile bằng F5
trong NinjaScript Editor hoặc restart NinjaTrader.

Commands:

```powershell
cd nt-addon
dotnet build src\NtAddOn.Core\NtAddOn.Core.csproj
dotnet test tests\NtAddOn.Tests\NtAddOn.Tests.csproj
```

Full solution có thể cần NinjaTrader local install:

```powershell
cd nt-addon
dotnet build NtAddOn.sln -p:NinjaTraderBinDir="$env:USERPROFILE\Documents\NinjaTrader 8\bin"
```

Lưu ý: máy này từng thiếu .NET SDK, nên `dotnet test` có thể fail với
`No .NET SDKs were found`.

## 8. Import, Reset Và Data Workflow

GUI import:

```powershell
.\IMPORT_NT_EXPORT.cmd
```

Last-only import cho file hiện tại `export data\GC 08-26-5-6.Last.txt`:

```powershell
.\IMPORT_TODAY_LAST_TO_CHART.cmd
```

Direct Last-only import:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Import-TodayLastToChart.ps1
```

Workflow này:

- Defaults tới `export data\GC 08-26-5-6.Last.txt`.
- Infer source contract từ filename, ví dụ `GC 08-26`.
- Ghi derived chart cache dưới `contract=GC`.
- Skip raw Bid/Ask import.
- Clear bars + volume delta trong imported range trừ khi truyền `-NoClear`.

General NT gap import:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Import-NtGap.ps1 -Contract "GC 08-26" -Last "<path.Last.txt>" -SkipRecentRaw -ClearDerivedRange
```

Raw recent import chỉ nên dùng khi có đủ Last/Bid/Ask và export chạm retention
window gần đây. Với history/gap import, thường dùng `-SkipRecentRaw`.

Reset market data:

```powershell
.\RESET_MARKET_DATA.cmd
```

Script này chạy `scripts/Reset-MarketData.ps1 -StopBackend -RestartBackend`,
backup `backend/data` vào `_data_backups`, tạo data sạch và restart backend.
Đây là destructive workflow, chỉ chạy khi được yêu cầu rõ.

## 9. Deploy / Public Runtime

Production hiện dùng Caddy:

```text
deploy/caddy/Caddyfile
```

Domain:

```text
https://gcflowpy.xyz/
```

Caddy behavior:

- Redirect `www.gcflowpy.xyz` về `gcflowpy.xyz`.
- Serve `frontend/dist` static.
- Proxy `/api/*` sang `127.0.0.1:8000`.
- Proxy `/ws/chart*` sang `127.0.0.1:8000`.
- Dùng `try_files {path} /index.html` cho SPA routing.

Sau frontend build:

```powershell
cd frontend
npm run build
```

Caddy serve bundle mới từ `frontend/dist`; thường không cần restart Caddy. User
có thể cần hard refresh browser.

Backend port `8000` nên bị chặn inbound public; frontend/proxy là entrypoint
public. Loopback local vẫn cần hoạt động cho Vite/Caddy proxy và health check.

## 10. Testing Convention

Backend:

- Markers: `unit`, `integration`, `property`, `smoke`.
- Property tests dùng Hypothesis profile tối thiểu 100 examples.
- Mỗi property test cần tag comment đúng format:

```python
# Feature: gc-chart-platform, Property {n}: {property_text}
```

Frontend:

- Vitest test nằm cạnh source dưới dạng `*.test.ts(x)` hoặc property tests.
- fast-check global setup trong `frontend/src/test/fast-check.setup.ts`.
- Dùng helper `propertyTest` / `propertyTag` trong `frontend/src/test/property.ts`.

NT AddOn:

- xUnit + FsCheck.
- `NtAddOn.Core` phải testable không cần NinjaTrader assemblies.
- NinjaTrader-coupled code chỉ nằm trong `NtAddOn.NinjaTrader` hoặc file
  self-contained `nt-addon/ninjascript/GcChartBridgeAddOn.cs`.

## 11. Vùng Không Nên Đụng Nếu Không Được Yêu Cầu

Không sửa/xóa các vùng generated/runtime/user data này nếu không có yêu cầu rõ:

```text
backend/data/
data/
_data_backups/
_import_logs/
_import_test/
_run_logs/
export data/
frontend/node_modules/
frontend/dist/
frontend/*.tsbuildinfo
backend/.venv/
backend/.pytest_cache/
backend/.hypothesis/
*.sqlite
*.sqlite-wal
*.sqlite-shm
*.log
*_out.txt
```

Cũng không tự ý sửa deployed NinjaTrader files trong Documents nếu task không
phải deployment.

## 12. Quick Diagnosis

Frontend đứng hoặc không có data:

1. Check backend health:

   ```powershell
   Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
   ```

2. Check public frontend/domain:

   ```text
   https://gcflowpy.xyz/
   ```

3. Check active contract:

   ```text
   http://127.0.0.1:8000/api/contracts?symbol=GC
   ```

4. Check chart history:

   ```text
   http://127.0.0.1:8000/api/history?symbol=GC&contract=GC&tf=1m&limit=5
   ```

5. Check backend log xem `/ws/nt` và `/ws/chart` có accepted connection không.
6. Nếu NinjaTrader source đổi, đảm bảo NT AddOn config/manual override và
   backend active source đang khớp.

Bar stream sai hoặc bị merge:

1. Nghi ngờ nhiều source contracts đang merge.
2. Verify active source thường là `GC 08-26`.
3. Raw shards có thể vẫn nhận quote từ old contracts; chấp nhận được nếu
   chart/cache chỉ chạy với active source.
4. Nếu cache đã có row sai, clear hoặc re-import đúng range bars/delta; không
   wipe raw data nếu không được yêu cầu.

Gap/history import:

1. Nếu chỉ có `.Last.txt`, import bars + volume delta only.
2. Dùng `Import-TodayLastToChart.ps1` hoặc `Import-NtGap.ps1 -SkipRecentRaw`.
3. Chỉ import raw Last/Bid/Ask cho recent 2-day retention window khi đủ file.

## 13. Current Known Good Baseline

Theo cấu hình hiện tại của repo:

- Backend chạy port `8000`.
- Frontend/public browser entrypoint: `https://gcflowpy.xyz/`.
- Port `9999` khong con la route frontend dang su dung; chi coi la local Vite
  dev legacy khi duoc start thu cong.
- Backend default contract candidates: `GC 02-26`, `GC 04-26`, `GC 06-26`,
  `GC 08-26`.
- Active source mặc định: `GC 08-26`.
- Chart cache key: `GC`.
- NinjaScript config pin `manualContractOverride` là `GC 08-26`.
- Vite proxy giữ REST và websocket same-origin.
- Caddy serve `frontend/dist` và proxy API/WS sang backend loopback.
- MT5 real mode cần explicit env bật trading/live trading; default là fake.
