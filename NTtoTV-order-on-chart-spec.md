# NTtoTV Order-on-Chart Build Spec

Spec này dùng cho repo `NTtoTV`: chart local kiểu TradingView cho GC futures,
feed từ NinjaTrader 8, và kế hoạch thêm đặt lệnh trực tiếp trên chart nhưng
khớp lệnh qua MT5/XAU.

Mục tiêu của file:

- Rà lại hướng thiết kế hiện tại và chốt các điểm cần sửa trước khi coding.
- Chia việc thành các task độc lập để copy giao cho coding agent.
- Gắn spec với codebase hiện tại, không giả định framework hoặc module chưa có.
- Mặc định an toàn: mọi phần đụng MT5 tiền thật phải chạy qua mock/demo trước.

## 0. Review kết luận

Bản spec cũ đúng hướng ở ý tưởng chính: user vẽ Entry/SL/TP trên chart GC, MT5
chỉ là nơi khớp lệnh, và giá gửi sang MT5 phải đi qua lớp basis GC -> XAU.
Tuy nhiên cần chỉnh các điểm sau để khớp repo và giảm rủi ro:

- `DrawingToolbar.tsx` hiện render tự động từ `DRAWING_TOOLS`; task F1 chỉ cần
  thêm registry entry trong `drawings/types.ts`, không cần hard-code nút mới
  trừ khi đổi UI riêng.
- `order_bracket` không được xem là profile drawing bình thường. Draft order và
  live order overlay phải tách khỏi `ChartProfilePayload.drawings`, khỏi
  `Delete All drawings`, và khỏi autosave profile.
- `/ws/chart` hiện chưa biết user. Muốn stream order/account riêng tư thì
  `ChartClient` và `OutboundEvent` phải có `user_id`/scope, đồng thời coalescing
  key phải tách theo user.
- Không nên lưu token trong `localStorage` cho luồng đặt lệnh. Spec mới dùng
  HttpOnly SameSite session cookie; WebSocket cùng origin tự mang cookie.
- Backend hiện chỉ có `fastapi`, `uvicorn`, `websockets`. Nếu thêm dependency
  auth/encryption phải ghi rõ trong `requirements.txt`; ưu tiên PBKDF2 stdlib
  cho password, chỉ thêm `cryptography` nếu cần mã hoá MT5 credential.
- Python package `MetaTrader5` không được import ở module top-level dùng bởi CI.
  Import chỉ nằm trong MT5 worker thật; test dùng `FakeMt5Backend`.
- Live trading phải fail closed: không gửi lệnh thật nếu chưa bật config rõ ràng
  và chưa có account demo/live được xác nhận.

## 1. Repo context bắt buộc

Trước khi làm bất kỳ task nào, đọc `AGENTS.md`. Các điểm quan trọng cho order
on chart:

- Backend: FastAPI trong `backend/app`.
- Runtime chính: `runtime.py` sở hữu `CacheStore`, `TickStore`,
  `ContractResolver`, `WebSocketRegistry`, `Pipeline`.
- Chart stream: `/ws/chart`, registry trong `backend/app/registry`.
- NT feed: `/ws/nt`, NinjaTrader AddOn đẩy Level 1 trade/quote GC.
- Frontend: Vite + React 18 + TypeScript strict trong `frontend/src`.
- Chart rendering: `lightweight-charts`, adapter trong
  `frontend/src/chart/lightweightChartsAdapter.ts`.
- Drawing system:
  - `frontend/src/chart/drawings/types.ts`
  - `frontend/src/chart/drawings/DrawingManager.ts`
  - `frontend/src/chart/drawings/*Primitive.ts`
  - `frontend/src/chart/DrawingToolbar.tsx`
- Profiles là layout chart, không phải user account:
  - `frontend/src/profiles/types.ts`
  - `backend/app/storage/profile_store.py`
- Same-origin là bắt buộc:
  - FE dùng `/api`
  - FE dùng `/ws/chart`
  - Không hard-code `:8000` trong frontend.
- Symbol chart hiện tại là `GC`.
- Derived chart/cache đọc bằng `contract=GC`.
- Raw tick shard mới cần contract thật như `GC 08-26`.

## 2. Nguyên tắc không được vi phạm

### 2.1 Hai venue khác nhau

Chart là GC futures từ NinjaTrader. Nơi khớp lệnh là XAU/XAUUSD trên MT5/Exness
hoặc broker tương tự.

GC và XAU khác nhau về:

- Giá: có basis future-spot, basis trôi theo thời gian.
- Tick size/digits.
- Phiên giao dịch và thời điểm quote.
- Fill/liquidity/slippage.

Không bao giờ giả định:

```text
GC price == XAU price
```

Mọi mức giá gửi sang MT5 phải đi qua basis engine.

### 2.2 GC là nguồn sự thật của order level

Entry/SL/TP user vẽ trên chart là level GC:

```text
entry_gc, sl_gc, tp_gc
```

MT5 nhận giá broker/XAU đã quy đổi:

```text
price_broker = round_to_xau_tick(level_gc + basis)
```

Mỗi order phải lưu cả hai hệ giá:

```text
entry_gc, sl_gc, tp_gc
entry_broker, sl_broker, tp_broker
basis_at_submit
basis_at_last_sync
```

Khi basis đổi, engine GC-anchored được phép modify SL/TP broker-side để giữ
level GC tương ứng, nhưng phải có debounce, threshold, min interval và stale
guard.

### 2.3 Fail closed

Không gửi lệnh thật nếu bất kỳ điều kiện nào đúng:

- Chưa login user.
- Chưa kết nối MT5 account.
- Chưa bật trading bằng cấu hình.
- Account live nhưng chưa bật live trading riêng.
- Basis stale hoặc jump bất thường.
- Symbol broker thiếu tick size/digits/stops_level.
- Volume vượt limit.
- Kill-switch đang bật.
- Order không pass ownership check.

## 3. Kiến trúc target

### 3.1 Backend components mới

```text
backend/app/rest/auth.py
backend/app/rest/mt5.py
backend/app/rest/orders.py
backend/app/rest/risk.py               optional, có thể gộp orders/presets

backend/app/models/auth.py
backend/app/models/orders.py
backend/app/models/mt5.py

backend/app/storage/user_store.py
backend/app/storage/order_store.py
backend/app/storage/order_preset_store.py

backend/app/engines/basis_engine.py
backend/app/engines/symbol_map.py
backend/app/engines/anchored_sync.py
backend/app/engines/order_guard.py
backend/app/engines/reconciliation.py

backend/app/mt5/base.py
backend/app/mt5/fake.py
backend/app/mt5/manager.py
backend/app/mt5/worker.py
```

Runtime mở rộng:

- `AppRuntime` tạo `UserStore`, `OrderStore`, `BasisEngine`, `Mt5Manager`.
- `AppRuntime.start()` chạy thêm loop:
  - basis poll/update loop
  - anchored sync loop
  - MT5 reconciliation loop
- Các loop phải cancellable như flush/heartbeat hiện tại.

Storage:

- Dùng cùng `backend/data/app.sqlite` qua `CacheStore.writer`.
- Thêm schema/migration trong `cache_store.py` hoặc collaborator rõ ràng.
- Không ghi order/account vào raw tick shards.

### 3.2 Frontend components mới

```text
frontend/src/auth/*
frontend/src/orders/types.ts
frontend/src/orders/OrderBracketPrimitive.ts     nếu tách khỏi drawings
frontend/src/orders/OrderOverlayManager.ts
frontend/src/orders/OrderTicket.tsx
frontend/src/orders/MarketOrderBar.tsx
frontend/src/orders/orderReducer.ts
frontend/src/orders/risk.ts
frontend/src/orders/api.ts                       hoặc mở rộng ApiClient
```

Drawing integration:

- `order_bracket` là tool để tạo draft order.
- Live orders/positions render bằng order overlay state riêng.
- Profile drawings không chứa order overlays.
- Delete-all drawings không cancel/close order thật.

### 3.3 Realtime privacy

Public market events:

- `bar_update`
- `quote_update`
- `volume_delta_update`
- `footprint_update`
- `big_trade`
- `alert_event` nếu vẫn profile-local
- `status`
- `ping`

Private trading events:

- `order_update`
- `position_update`
- `account_update`
- `basis_update`
- `risk_update`

Private events chỉ gửi tới client có `client.user_id == event.user_id`.

## 4. Auth/session spec

### 4.1 Session model

Dùng session cookie thay vì token trong `localStorage`.

- Cookie name: `nttotv_session`
- Flags: `HttpOnly`, `SameSite=Lax`, `Secure` khi chạy HTTPS
- Session token raw chỉ trả qua cookie.
- DB chỉ lưu hash của session token.
- WebSocket `/ws/chart` xác thực bằng cookie trong handshake.
- Cho phép Bearer token optional chỉ cho CLI/test nếu cần, không dùng làm FE mặc
  định.

Password hashing:

- Có thể dùng stdlib `hashlib.pbkdf2_hmac("sha256", ...)` với random salt và
  `hmac.compare_digest` để tránh dependency mới.
- Nếu dùng `bcrypt`/`argon2`, phải thêm vào `backend/requirements.txt` và test
  install rõ ràng.

Credential encryption:

- MT5 password phải mã hoá at-rest.
- Khuyến nghị `cryptography.fernet` với key từ env:
  `NTTOTV_CREDENTIAL_KEY`.
- Nếu key thiếu, `/api/mt5/connect` fail closed.
- Không log password, encrypted blob, raw session token.

### 4.2 Auth endpoints

```text
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

`POST /api/auth/login`:

```json
{
  "username": "local",
  "password": "..."
}
```

Response:

```json
{
  "user": {
    "id": "user_...",
    "username": "local"
  }
}
```

Also sets `nttotv_session`.

### 4.3 Auth acceptance

- Unauthenticated `/api/orders` returns 401 error envelope.
- `/ws/chart` accepts unauthenticated clients only for public market events if
  trading UI is disabled; private subscriptions require auth.
- Auth tests cover login, logout, expired session, bad password, WebSocket user
  resolution.

## 5. Order domain model

### 5.1 Enums

```text
OrderSide:
  buy | sell

OrderKind:
  market | limit | stop

OrderStatus:
  draft
  pending_submit
  submitted
  working
  partially_filled
  filled
  rejected
  cancelled
  closed
  sync_paused
  sync_error

OrderSource:
  chart_bracket | market_bar | api
```

### 5.2 Order record fields

Minimum `OrderRecord`:

```text
id                         uuid/string, internal primary id
user_id                    owner
account_id                 MT5 account owner uses
source                     chart_bracket | market_bar | api
symbol_internal            GC
contract_internal          GC
source_contract            actual active source snapshot, e.g. GC 08-26
symbol_broker              e.g. XAUUSDm
side                       buy | sell
kind                       market | limit | stop
volume_lots                broker lot
gc_anchored                true by default

entry_gc                   requested GC level, nullable for pure market until submit snapshot
sl_gc
tp_gc
entry_broker               converted broker price, nullable for market entry if broker fills
sl_broker
tp_broker

fill_price_broker          actual MT5 fill price, nullable until fill
fill_price_gc_estimate     fill broker mapped back via basis_at_fill
basis_at_submit
basis_at_last_sync
basis_at_fill
basis_stale_at_submit      bool

status
broker_order_ticket        pending order ticket
broker_position_ticket     position ticket
broker_deal_ticket         fill deal ticket
idempotency_key
reject_reason
last_broker_error_code
last_broker_error_message

created_at
updated_at
submitted_at
filled_at
closed_at
last_sync_at
```

Idempotency:

- Unique index should be `(user_id, idempotency_key)`, not global only.
- Repeating the same idempotency key returns the first order result.

### 5.3 Audit events

Every material transition writes `order_events`:

```text
id
order_id
user_id
event_type
payload_json
created_at
```

Examples:

- `created`
- `submitted_to_broker`
- `broker_accepted`
- `broker_rejected`
- `filled`
- `cancel_requested`
- `cancelled`
- `modify_requested`
- `modified`
- `basis_resync`
- `basis_stale_pause`
- `reconciled`
- `guard_rejected`

## 6. Basis engine

### 6.1 Inputs

GC reference:

- Prefer GC mid from NT quote when bid/ask fresh.
- Fallback to GC last trade when quote missing.
- Track `gc_time_ms`, `gc_price`, `gc_source`.

XAU reference:

- Use MT5 `symbol_info_tick` bid/ask.
- Prefer mid `(bid + ask) / 2`.
- Track `xau_time_ms`, `xau_bid`, `xau_ask`, `xau_symbol`.

### 6.2 Computation

```text
raw_basis = xau_mid - gc_reference
smoothed_basis = EMA or rolling median over short window
```

Default config proposal:

```text
BASIS_MAX_VENUE_AGE_MS       3000
BASIS_MAX_SKEW_MS            1500
BASIS_EMA_ALPHA              0.25
BASIS_JUMP_WARN              3.0
BASIS_RESYNC_THRESHOLD_TICKS 2
BASIS_RESYNC_DEBOUNCE_MS     500
BASIS_RESYNC_MIN_INTERVAL_MS 2000
```

Stale if:

- GC reference older than max age.
- XAU reference older than max age.
- Absolute timestamp skew exceeds max skew.
- MT5 tick missing bid/ask.
- Basis jump exceeds configured hard threshold.

### 6.3 Conversion helpers

```python
to_broker(level_gc) -> ConvertedPrice
from_broker(price_broker) -> ConvertedPrice
```

`ConvertedPrice` carries:

```text
price
basis
raw_price
rounded
digits
tick_size
stale
warnings
source_times
```

Rounding policy:

- Prices must align to broker tick/digits.
- Use side-aware risk-conservative rounding:
  - SL rounding must not increase risk versus raw converted level.
  - TP rounding may move toward entry rather than overstate reward.
  - Pending entry rounds to nearest valid tick unless broker requires otherwise.
- Record raw and rounded values in audit payload.

### 6.4 Basis endpoints/events

```text
GET /api/basis?symbol=GC
```

Response:

```json
{
  "symbolInternal": "GC",
  "symbolBroker": "XAUUSDm",
  "basis": -12.34,
  "stale": false,
  "warnings": [],
  "gc": { "price": 2350.1, "time": 1780000000000, "source": "quote_mid" },
  "broker": { "bid": 2337.75, "ask": 2337.85, "time": 1780000000100 }
}
```

`basis_update` is user-private if it depends on a user's broker account/symbol,
otherwise public. Prefer user-private because broker symbol suffix and account
quote can differ.

## 7. MT5 integration

### 7.1 Backend interface

Define a broker-neutral interface first:

```python
class Mt5Backend:
    def place_order(...)
    def modify_order(...)
    def modify_position_sl_tp(...)
    def cancel_order(...)
    def close_position(...)
    def account_info(...)
    def symbol_info(...)
    def positions(...)
    def orders(...)
    def symbol_tick(...)
```

Tests use `FakeMt5Backend`.

Do not import `MetaTrader5` package in `backend/app/mt5/base.py`,
`manager.py`, REST routers, tests, or app startup. Import it only inside the
real worker process path.

### 7.2 Worker/process rule

Python `MetaTrader5` is Windows-only and effectively one terminal/account per
process. Target:

- `Mt5Manager` routes by `(user_id, account_id)`.
- Each account has one worker process.
- Worker logs in one terminal/account.
- One worker failure does not kill other workers.
- Worker exposes RPC-like calls to backend service.
- Worker reconnects with backoff.
- Worker never logs credentials.

### 7.3 Trading gates

Config defaults:

```text
NTTOTV_TRADING_ENABLED=0
NTTOTV_LIVE_TRADING_ENABLED=0
NTTOTV_MT5_BACKEND=fake
```

Rules:

- Fake backend can run without `NTTOTV_TRADING_ENABLED`.
- Real MT5 submit requires `NTTOTV_TRADING_ENABLED=1`.
- Live account submit requires both `NTTOTV_TRADING_ENABLED=1` and
  `NTTOTV_LIVE_TRADING_ENABLED=1`.
- UI must show demo/live badge from account info.
- Backend guard is authoritative; UI badge is not security.

## 8. REST API spec

### 8.1 MT5 endpoints

```text
POST /api/mt5/connect
GET  /api/mt5/status
GET  /api/mt5/account
GET  /api/mt5/symbol
POST /api/mt5/disconnect
```

`POST /api/mt5/connect` request:

```json
{
  "login": 123456,
  "password": "...",
  "server": "Broker-Demo",
  "symbolBroker": "XAUUSDm",
  "terminalPath": "optional"
}
```

`GET /api/mt5/account` response:

```json
{
  "accountId": "acct_...",
  "login": 123456,
  "server": "Broker-Demo",
  "tradeMode": "demo",
  "currency": "USD",
  "balance": 10000.0,
  "equity": 10020.0,
  "margin": 100.0,
  "freeMargin": 9920.0
}
```

### 8.2 Order endpoints

```text
GET    /api/orders
POST   /api/orders
GET    /api/orders/{order_id}
PATCH  /api/orders/{order_id}
DELETE /api/orders/{order_id}
POST   /api/orders/{order_id}/close
```

`POST /api/orders` request:

```json
{
  "source": "chart_bracket",
  "side": "buy",
  "kind": "limit",
  "volumeLots": 0.10,
  "entryGc": 2350.1,
  "slGc": 2347.1,
  "tpGc": 2356.1,
  "gcAnchored": true,
  "idempotencyKey": "uuid-from-client"
}
```

Market order from quick bar:

```json
{
  "source": "market_bar",
  "side": "buy",
  "kind": "market",
  "volumeLots": 0.10,
  "slDistanceGc": 3.0,
  "tpDistanceGc": 6.0,
  "gcAnchored": true,
  "idempotencyKey": "uuid-from-client"
}
```

Backend responsibilities:

- Resolve current authenticated user.
- Resolve user's active MT5 account.
- Resolve broker symbol info.
- Resolve current GC mark and basis.
- Validate order side/kind/volume/stops_level.
- Convert GC levels to broker levels.
- Write order as `pending_submit`.
- Submit to MT5 manager.
- Update status/tickets.
- Emit `order_update` user-scoped.
- Return order record.

### 8.3 Order modify

`PATCH /api/orders/{order_id}` request:

```json
{
  "entryGc": 2351.0,
  "slGc": 2348.0,
  "tpGc": 2357.0,
  "expectedVersion": 7
}
```

Rules:

- Only owner can modify.
- `expectedVersion` prevents stale UI overwrites.
- For filled position, entry modify is ignored/rejected; only SL/TP modify.
- For pending order, entry/SL/TP can modify if broker permits.
- Backend updates `*_gc` first, then anchored sync converts to broker.

### 8.4 Preset endpoints

```text
GET /api/orders/preset
PUT /api/orders/preset
```

Preset fields:

```text
mode: fixed_lot | risk_percent
volume_lots
risk_percent
sl_distance_gc
tp_distance_gc
confirm_market
max_lot
max_open_orders
```

Preset is user-scoped and account-scoped.

## 9. WebSocket spec

### 9.1 Backend message types

Add to backend `EventType` and frontend `ChartEventType`:

```text
order_update
position_update
account_update
basis_update
risk_update
```

### 9.2 Registry changes

`ChartClient`:

```text
id
send
close
user_id: str | None
subscriptions
```

`OutboundEvent`:

```text
event_type
symbol
payload
key
user_id: str | None
```

Dispatch rule:

```text
event.user_id is None        -> public event; deliver by subscription
event.user_id == client.user -> private event; deliver by subscription
event.user_id != client.user -> never deliver
```

Coalescing key must include `user_id`:

```text
(event_type, symbol, user_id, key)
```

### 9.3 Message shapes

`order_update`:

```json
{
  "type": "order_update",
  "symbol": "GC",
  "order": {
    "id": "ord_...",
    "status": "working",
    "side": "buy",
    "kind": "limit",
    "entryGc": 2350.1,
    "slGc": 2347.1,
    "tpGc": 2356.1,
    "entryBroker": 2337.8,
    "slBroker": 2334.8,
    "tpBroker": 2343.8,
    "basisAtLastSync": -12.3,
    "brokerOrderTicket": 123,
    "brokerPositionTicket": null,
    "updatedAt": 1780000000000,
    "version": 7
  }
}
```

`position_update`:

```json
{
  "type": "position_update",
  "symbol": "GC",
  "position": {
    "brokerPositionTicket": 456,
    "orderId": "ord_...",
    "side": "buy",
    "volumeLots": 0.1,
    "entryBroker": 2338.0,
    "entryGcEstimate": 2350.3,
    "slGc": 2347.1,
    "tpGc": 2356.1,
    "profit": 42.5,
    "updatedAt": 1780000000000
  }
}
```

`account_update`:

```json
{
  "type": "account_update",
  "symbol": "GC",
  "account": {
    "accountId": "acct_...",
    "tradeMode": "demo",
    "balance": 10000.0,
    "equity": 10042.5,
    "freeMargin": 9900.0,
    "updatedAt": 1780000000000
  }
}
```

`basis_update` uses the response shape from `/api/basis`.

## 10. Frontend UX spec

### 10.1 Order bracket semantics

Anchor order must be explicit:

```text
anchors[0] = entry
anchors[1] = stop loss
anchors[2] = take profit
```

Side is inferred from bracket shape:

- `tp > entry > sl` means buy.
- `tp < entry < sl` means sell.
- Any other shape is invalid and should show validation error.

Order kind is inferred from side + current GC mark:

- Buy + entry below/at mark -> limit.
- Buy + entry above mark -> stop.
- Sell + entry above/at mark -> limit.
- Sell + entry below mark -> stop.
- Market orders come from `MarketOrderBar`, not from pending bracket entry.

### 10.2 Draft versus live overlay

Draft bracket:

- Created by selecting `order_bracket`.
- Stored in local order draft state, not profile.
- Opens `OrderTicket`.
- Can be cancelled without touching backend.
- On submit, backend returns `OrderRecord`; draft becomes live overlay.

Live overlay:

- Rendered from `OrderRecord` / `PositionRecord`.
- Dragging SL/TP sends debounced `PATCH`.
- Dragging entry allowed only for pending orders.
- Deleting a live overlay must show cancel/close confirmation, never silently
  remove it like a drawing.

### 10.3 Chart integration details

Current `DrawingManager` preview only handles two-anchor preview. For
`order_bracket`, update preview logic to:

```text
previewAnchors = [...placedAnchors, currentMouseAnchor]
```

`OrderBracketPrimitive` must tolerate partial anchors for preview:

- 1 anchor: draw entry line only.
- 2 anchors: draw entry + SL, risk area.
- 3 anchors: draw entry + SL + TP, risk/reward areas and labels.

Do not require current price inside primitive. Compute side from entry/SL/TP.
Compute limit/stop in `OrderTicket` where latest GC mark is available.

### 10.4 Visual requirements

- Entry line: neutral yellow/gray.
- SL line: red.
- TP line: green.
- Risk area: subtle red fill.
- Reward area: subtle green fill.
- Labels stay inside chart bounds.
- Hit targets are at least as usable as existing drawing handles.
- Text must not overlap excessively at mobile width.
- Use existing CSS style; no new framework.

### 10.5 Market order bar

`MarketOrderBar` sits below chart, outside canvas:

- Not floating over chart.
- BUY button green, SELL button red.
- Shows account mode demo/live.
- Shows preset summary.
- Mobile buttons at least 44px tall.
- On narrow viewport buttons wrap full width.
- Chart area resizes to leave room.

## 11. Safety and guard spec

Backend `order_guard.py` is authoritative.

Guard inputs:

- User/account trading enabled.
- Global trading enabled.
- Live trading enabled if account is live.
- Kill-switch off.
- Basis not stale.
- Broker symbol info available.
- Volume within min/max/step.
- Stop distance meets `stops_level`.
- Max open orders not exceeded.
- Max total exposure not exceeded.
- Account free margin sufficient if broker precheck supports it.

Error envelope examples:

```json
{
  "error": {
    "code": "basis_stale",
    "message": "GC/XAU basis is stale; trading is paused.",
    "field": "basis"
  }
}
```

Common error codes:

```text
unauthorized
forbidden
trading_disabled
live_trading_disabled
kill_switch_enabled
basis_stale
invalid_volume
invalid_stops
market_closed
not_enough_money
requote
broker_rejected
ownership_mismatch
version_conflict
```

## 12. Reconciliation spec

Loop polls MT5 account orders/positions and reconciles against `order_store`.

Responsibilities:

- Discover broker-accepted pending orders.
- Detect fills and position tickets.
- Detect cancelled/closed positions not initiated from UI.
- Update local order status.
- Emit user-scoped WS events.
- Write audit events.
- Keep broker-side SL/TP aligned with latest local `*_gc` when not stale.

Default cadence:

```text
normal: 1000-2000ms
error/backoff: Fibonacci/backoff, capped
```

Never close or modify orders purely because local store is stale. Reconciliation
must be conservative and auditable.

## 13. Task plan

Use one branch per task or tightly related task group. Suggested branch naming:

```text
order/<task-id>-short-name
```

After each FE task:

```powershell
cd frontend
npm run typecheck
npm run build
```

After each backend task:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
```

For MT5 tasks, CI/tests must pass without real MT5 by using fake backend.

### F1 - Add order_bracket tool registry

Files:

- `frontend/src/chart/drawings/types.ts`
- `frontend/src/chart/DrawingToolbar.tsx` only if test/style needs adjustment
- existing toolbar tests

Work:

- Add `"order_bracket"` to `DrawingToolType`.
- Add `DRAWING_TOOLS` entry with `anchors: 3`.
- Confirm toolbar auto-renders it from registry.
- Add/update test asserting button appears.

Prompt:

> In NTtoTV, add a new drawing tool type `order_bracket`. Update
> `frontend/src/chart/drawings/types.ts` by adding the union member and a
> `DRAWING_TOOLS` entry with label `Order`, `anchors: 3`, and a simple 3-line
> SVG path. `DrawingToolbar.tsx` already renders from the registry, so only
> touch it if a test or accessibility label needs adjustment. Add/update a FE
> test that the Order tool button renders and can become active. Run
> `npm run typecheck` and `npm run build`.

Acceptance:

- Order button appears.
- Clicking toggles active state.
- Typecheck/build pass.

### F2 - OrderBracketPrimitive and 3-anchor placement

Files:

- `frontend/src/chart/drawings/OrderBracketPrimitive.ts`
- `frontend/src/chart/drawings/DrawingManager.ts`
- `frontend/src/chart/drawings/index.ts` if needed
- tests for primitive/manager

Work:

- Create primitive based on `PriceRangePrimitive`.
- Anchor order: entry, SL, TP.
- Tolerate partial anchors.
- Update DrawingManager preview for more than two anchors.
- Register primitive in `_createPrimitive`.
- Add hit testing for order bracket lines/handles.

Prompt:

> Implement `OrderBracketPrimitive` for `order_bracket`. Anchor order is
> entry, stop loss, take profit. The primitive must support partial anchors for
> preview, then render three horizontal lines with risk/reward fills and labels
> when complete. Infer buy/sell from TP/SL around entry; do not require broker
> state in the primitive. Update `DrawingManager` so preview uses all placed
> anchors plus the current mouse anchor, register the primitive in
> `_createPrimitive`, and add hit testing. Run FE typecheck/build and focused
> tests.

Acceptance:

- User can place three anchors.
- Dragging any anchor updates labels/fill.
- Invalid bracket shape is visibly distinct or marked invalid.
- Typecheck/build pass.

### F3 - Separate draft/live order overlays from profile drawings

Files:

- `frontend/src/LiveApp.tsx`
- `frontend/src/chart/ChartContainer.tsx`
- `frontend/src/chart/drawings/DrawingManager.ts`
- `frontend/src/profiles/types.ts`
- new `frontend/src/orders/*`

Work:

- Draft order brackets should not persist to profile.
- Profile payload filters out `tool === "order_bracket"` as a short-term guard.
- Long-term: move order overlays into `orders` state, not generic drawings.
- Delete-all drawings must not cancel or remove live orders.

Prompt:

> Split order brackets from normal profile drawings. As an immediate guard,
> filter `tool === "order_bracket"` out of `ChartProfilePayload.drawings` before
> save/autosave/load. Then create order draft/overlay state under
> `frontend/src/orders` so live orders are rendered separately from profile
> drawings. Ensure Delete All drawings does not affect live order overlays.
> Add tests for profile save excluding order brackets. Run typecheck/build.

Acceptance:

- Save/load profile does not contain order brackets.
- Reload does not duplicate order overlays.
- Delete-all drawings leaves live orders intact.

### B1 - Session auth and user store

Files:

- `backend/app/storage/user_store.py`
- `backend/app/models/auth.py`
- `backend/app/rest/auth.py`
- `backend/app/app.py`
- `backend/app/storage/cache_store.py`
- `frontend/src/auth/*`
- `frontend/src/api/client.ts`
- `frontend/src/socket/ChartSocket.ts`

Work:

- Add users and sessions tables.
- Use HttpOnly session cookie.
- Add `get_current_user` dependency.
- Make `/ws/chart` resolve optional authenticated user from cookie.
- Add FE login guard for trading features.

Prompt:

> Add local session auth to NTtoTV. Store users and hashed sessions in
> `app.sqlite` through the existing single-writer pattern. Use HttpOnly
> SameSite cookie `nttotv_session`; do not store access tokens in localStorage.
> Implement login/logout/refresh/me REST endpoints and a `get_current_user`
> dependency. Extend `/ws/chart` registration so `ChartClient` can carry
> optional `user_id` from the session cookie. Add FE login state/guard for
> trading UI. Add pytest coverage for login/logout/expired session and WS user
> resolution. Run pytest and FE typecheck/build if FE touched.

Acceptance:

- Unauth private endpoints return 401.
- Authenticated REST sees correct user.
- `/ws/chart` can attach user id.
- Tests pass.

### B2 - User MT5 account storage

Files:

- `backend/app/storage/user_store.py`
- `backend/app/models/mt5.py`
- `backend/app/rest/mt5.py`
- `backend/app/storage/cache_store.py`

Work:

- Add `user_mt5_accounts` table.
- Encrypt password at rest.
- Store broker symbol and terminal path.
- Add connect/status/account endpoints using fake manager first.

Prompt:

> Add user-scoped MT5 account storage. Store login/server/symbol/terminal
> metadata and encrypted password blob in `app.sqlite`; encryption key comes
> from `NTTOTV_CREDENTIAL_KEY` and missing key fails closed. Add `/api/mt5`
> connect/status/account endpoints wired to a fake MT5 manager for now. Ensure
> user A cannot read user B's account. Add tests. Do not import the real
> `MetaTrader5` package in app startup or tests.

Acceptance:

- Credentials not logged.
- Missing encryption key blocks saving credential.
- Ownership tests pass.

### B3 - Order store and order models

Files:

- `backend/app/models/orders.py`
- `backend/app/storage/order_store.py`
- `backend/app/storage/cache_store.py`
- tests

Work:

- Add orders and order_events tables.
- Add CRUD methods.
- Add idempotency `(user_id, idempotency_key)`.
- Add version field for optimistic concurrency.

Prompt:

> Implement order domain models and SQLite storage. Add `orders` and
> `order_events` tables to `app.sqlite` with migrations. Model all GC and broker
> price fields, broker tickets, status, idempotency key, user/account ownership,
> version, and audit timestamps. Provide create/read/list/update_status/update_levels
> methods through a single-writer store. Add tests for CRUD, audit append,
> idempotency by user, and version conflict.

Acceptance:

- CRUD tests pass.
- Duplicate idempotency for same user returns/conflicts deterministically.
- Different users may reuse same idempotency key.

### B4 - Symbol map and basis engine

Files:

- `backend/app/engines/symbol_map.py`
- `backend/app/engines/basis_engine.py`
- `backend/app/config.py`
- `backend/app/runtime.py`
- tests

Work:

- Track GC reference from pipeline quote/trade.
- Track XAU reference from MT5 manager/fake.
- Compute smoothed basis.
- Expose conversion helpers.
- Add stale/jump flags.

Prompt:

> Build `symbol_map.py` and `basis_engine.py`. Map internal `GC` to the user's
> broker XAU symbol and symbol info. Compute basis from fresh GC reference and
> MT5 XAU tick, smooth it, expose `to_broker`/`from_broker`, and mark stale on
> old/skewed/missing quotes or jump threshold. Wire runtime updates without
> blocking the existing pipeline. Add tests for smoothing, stale detection,
> rounding, and conversion.

Acceptance:

- Conversion returns rounded broker price plus basis metadata.
- Stale basis blocks order submission in guard tests.
- Existing market-data tests still pass.

### B5 - Registry private event scoping

Files:

- `backend/app/registry/registry.py`
- `backend/app/registry/endpoint.py`
- `backend/app/models/messages.py`
- `frontend/src/socket/messages.ts`
- `frontend/src/socket/ChartSocket.ts`
- tests

Work:

- Add private event types.
- Add `user_id` to clients/events.
- Include `user_id` in coalescing key.
- Filter delivery by user.

Prompt:

> Extend `/ws/chart` for private trading events. Add order/position/account/basis
> event types to backend/frontend message unions. Add optional `user_id` to
> `ChartClient` from auth, optional `user_id` to `OutboundEvent`, include it in
> coalescing, and deliver private events only to matching users. Public market
> events must behave exactly as before. Add backend tests proving user isolation
> and public broadcast compatibility; run FE typecheck.

Acceptance:

- Private event for user A never reaches user B.
- Public chart events still reach subscribed clients.
- Coalescing does not merge two users' events.

### M1 - Fake MT5 backend

Files:

- `backend/app/mt5/base.py`
- `backend/app/mt5/fake.py`
- tests

Work:

- Define broker interface.
- Implement deterministic fake backend.
- Fake supports order lifecycle, account info, symbol info, positions/orders.

Prompt:

> Create the MT5 backend interface and a deterministic `FakeMt5Backend`.
> The fake must support symbol info, ticks, account info, place/modify/cancel/close,
> and positions/orders snapshots without real MT5. Use it in tests and local
> development by default. Do not import `MetaTrader5`. Add tests for order
> lifecycle and broker error simulation.

Acceptance:

- All tests run without MT5 installed.
- Fake can simulate accepted, rejected, filled, cancelled orders.

### M2 - Real MT5 worker and manager

Files:

- `backend/app/mt5/worker.py`
- `backend/app/mt5/manager.py`
- tests with fake/worker seam

Work:

- One process per account.
- Real worker imports `MetaTrader5` inside worker path only.
- Manager routes by user/account.
- Health check and reconnect.

Prompt:

> Implement real MT5 worker/manager behind the interface. Each account runs in
> an isolated worker process/terminal. Import `MetaTrader5` only inside the real
> worker path. Add health/reconnect and no-password logging. Manager routes
> calls by user/account and can still run with `FakeMt5Backend` for tests. Add
> tests for routing and worker isolation with fakes.

Acceptance:

- App/test startup does not require MT5 package.
- Fake manager tests pass.
- Real path is gated by config.

### O1 - Order guard and /api/orders

Files:

- `backend/app/engines/order_guard.py`
- `backend/app/rest/orders.py`
- `backend/app/app.py`
- tests

Work:

- Add guarded submit/modify/cancel/close.
- Convert GC levels to broker levels.
- Submit through MT5 manager.
- Emit order_update.

Prompt:

> Add `/api/orders` routes with backend guard enforcement. Submit flow: auth
> user -> active account -> basis conversion -> guard checks -> order_store
> pending row -> MT5 manager submit -> update order row/tickets/status -> audit
> -> user-scoped `order_update`. Implement list/get/patch/delete/close with
> ownership and version checks. Use FakeMt5 tests for create limit, market,
> modify, cancel, close, rejected broker, stale basis, kill-switch, and cross-user
> access.

Acceptance:

- Fake-backed order lifecycle works.
- Guards reject unsafe requests.
- Private WS emits order updates to owner only.

### O2 - Anchored sync engine

Files:

- `backend/app/engines/anchored_sync.py`
- `backend/app/runtime.py`
- tests

Work:

- Resync broker SL/TP and pending entry from GC levels when basis changes.
- Debounce/threshold/min interval.
- Pause on stale basis.
- Audit every sync.

Prompt:

> Implement `anchored_sync.py`. For open `gc_anchored` orders, treat `*_gc` as
> source of truth. When basis changes beyond threshold or user modifies a GC
> level, compute broker prices and modify MT5 only if outside hysteresis. Add
> debounce and min interval to prevent broker spam. Pause sync while basis is
> stale and emit/audit pause. Add FakeMt5 tests: basis drift modifies, small
> drift does not, stale pauses, broker rejection records sync_error.

Acceptance:

- Resync obeys thresholds and stale guard.
- No tight modify loop.
- Audit events record basis and broker price changes.

### O3 - Reconciliation loop

Files:

- `backend/app/engines/reconciliation.py`
- `backend/app/runtime.py`
- tests

Work:

- Poll MT5 orders/positions/account.
- Reconcile local store.
- Emit order/position/account updates.

Prompt:

> Add reconciliation loop. Poll the MT5 manager for each connected account,
> update local orders/positions conservatively, emit private WS updates, and
> write audit events. Detect fills, external closes/cancels, and account equity
> changes. Do not close/modify broker orders just because local state is stale.
> Add FakeMt5 tests for fill detection, external cancel, external close, and
> account update.

Acceptance:

- Reload UI can recover orders/positions from backend state.
- External broker changes are reflected without unsafe actions.

### X1 - Order ticket and risk calculator

Files:

- `frontend/src/orders/OrderTicket.tsx`
- `frontend/src/orders/risk.ts`
- `frontend/src/orders/types.ts`
- `frontend/src/api/client.ts`
- tests

Work:

- Bind draft bracket to ticket.
- Show Entry/SL/TP GC and read-only broker converted prices.
- Compute risk and lot.
- Validate broker constraints before submit.

Prompt:

> Build `OrderTicket` and risk helpers. It reads a draft bracket's GC levels,
> infers side/kind from latest GC mark, shows broker-converted prices from
> basis/symbol info, computes fixed lot or risk-percent lot, validates min/max/step
> and stop distance, and submits with an idempotency key. Add tests for risk
> math, invalid bracket shape, buy/sell inference, and submit payload. Run
> typecheck/build.

Acceptance:

- Ticket updates when bracket is dragged.
- Invalid risk/volume/stops disable submit.
- Submit payload uses GC levels as source truth.

### X2 - Live order overlay sync

Files:

- `frontend/src/orders/orderReducer.ts`
- `frontend/src/orders/OrderOverlayManager.ts`
- `frontend/src/chart/ChartContainer.tsx`
- `frontend/src/LiveApp.tsx`
- tests

Work:

- Fetch open orders on load.
- Subscribe to private events.
- Render live overlays.
- PATCH on drag with debounce.

Prompt:

> Connect frontend order state to REST and WS. On login/load, fetch open orders
> and render them as live order overlays. Subscribe to private `order_update`,
> `position_update`, `account_update`, and `basis_update`. Dragging SL/TP sends
> debounced PATCH with `expectedVersion`; pending entry drag modifies entry.
> Backend responses/WS are authoritative. Add reducer tests and typecheck/build.

Acceptance:

- Reload restores open orders/positions.
- Drag modify round-trips through backend/fake and updates by WS.
- Version conflict shows error and refreshes order.

### X3 - MarketOrderBar below chart

Files:

- `frontend/src/orders/MarketOrderBar.tsx`
- `frontend/src/styles.css`
- `frontend/src/LiveApp.tsx`
- backend preset store/routes if not done
- tests

Work:

- Add bottom order bar outside chart canvas.
- Responsive mobile layout.
- BUY/SELL market with preset.
- Confirm/optimistic/WS confirmation.

Prompt:

> Add `MarketOrderBar` below the chart, outside the canvas. It shows demo/live
> account badge, preset summary, and large BUY/SELL market buttons. Mobile
> layout must use at least 44px touch targets and not cover chart content.
> Button click submits a market order using the user preset and idempotency key,
> with confirmation if preset requires it. Add tests and run typecheck/build.

Acceptance:

- Bar does not overlay chart.
- Mobile viewport buttons are usable.
- Fake market order creates an order/position overlay.

### X4 - Safety UI and kill-switch

Files:

- frontend order UI
- backend guard/config/store
- tests

Work:

- Add confirm dialogs.
- Show account demo/live.
- Show basis stale and trading disabled states.
- Add kill-switch controls.
- Human-readable broker errors.

Prompt:

> Add final trading safety UX and backend guard coverage. UI shows active
> account, demo/live badge, basis stale warning, trading disabled/live disabled
> warning, and a kill-switch. Submits show confirmation with account and order
> details unless disabled by preset. Broker errors are mapped to readable
> messages. Backend kill-switch/limits remain authoritative. Add tests for
> guard and UI disabled states.

Acceptance:

- Kill-switch blocks backend submit.
- UI clearly indicates no-trade reasons.
- Live account cannot submit unless live trading config is enabled.

## 14. Definition of Done

Each task/PR is done only when:

- Relevant tests pass.
- FE typecheck/build pass if FE touched.
- Backend pytest pass if backend touched.
- No frontend hard-codes `:8000`.
- Private order/account events are user-scoped.
- Passwords, session tokens and encrypted credential blobs are not logged.
- MT5 real path is config-gated.
- Tests do not send real broker orders.
- Order levels use GC as source truth and broker prices are derived.
- Profile save/load does not persist live order overlays.
- Manual test notes mention mock/demo/live mode used.

## 15. Suggested focused test commands

Backend full:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
```

Backend focused after order work:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests\unit tests\integration
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm test
npm run build
```

MT5 project:

```powershell
cd nt-addon
dotnet test tests\NtAddOn.Tests\NtAddOn.Tests.csproj
```

MT5 AddOn tests are only needed if the task touches NinjaTrader AddOn code. This
order-on-chart spec should not change NT AddOn unless a future task explicitly
needs extra feed fields.
