# Option AI Analyst Architecture

Tài liệu này mô tả cấu trúc và cách vận hành của option AI analyst trong repo
`NTtoTV`, dùng cho phát triển tiếp. Trạng thái mô tả ở đây phản ánh thiết kế
hiện tại sau khi chuyển AI sang vai trò phân tích context H1/M15/M5 và để trader
tự timing thủ công ở khung thấp hơn.

## Mục Tiêu

Option AI hiện không phải hệ thống auto-trade. Nó là lớp đọc market context và
đưa ra nhận định ngắn gọn:

- `no_trade`: không đủ điều kiện hoặc conflict mạnh.
- `wait_for_buy`: bối cảnh H1/M15/M5 ủng hộ buy, chờ trader timing thủ công.
- `wait_for_sell`: bối cảnh H1/M15/M5 ủng hộ sell, chờ trader timing thủ công.

Các quyết định `buy_candidate` và `sell_candidate` vẫn còn trong schema chung cũ
để tương thích dữ liệu lịch sử, nhưng LLM schema hiện tại không cho model trả về
hai enum này. Nếu proxy/model vẫn trả lệch, backend sẽ hạ về `wait_for_buy` hoặc
`wait_for_sell`.

Quy tắc bất biến:

- `allowedToAutoTrade` luôn phải là `false`.
- AI không được tự tạo facts ngoài payload được cấp.
- AI không phân tích M1 như một confirmation.
- AI chỉ đọc context H1/M15/M5.
- Lower-timeframe timing là thủ công, nằm ngoài quyết định của AI.

## Hai Luồng Chính

Option AI hiện có hai luồng khác nhau.

### 1. Manual Analyst Run

Luồng này chạy khi user gọi endpoint `/api/analyst/run`.

Mục đích:

- Build snapshot tổng quan từ cache.
- Gửi snapshot H1/M15/M5 cho LLM.
- Lưu report thủ công vào `llm_analyst_reports`.
- Có thể gửi Telegram report nếu profile đã cấu hình notification.

Flow:

```text
Frontend / user
  -> POST /api/analyst/run
  -> run_analyst_once()
  -> SnapshotBuilder
  -> AnalystLlmClient
  -> AnalystStore.insert_snapshot()
  -> AnalystStore.insert_report()
  -> optional Telegram analyst report
```

File chính:

- `backend/app/analyst/routes.py`
- `backend/app/analyst/scheduler.py`
- `backend/app/analyst/snapshot_builder.py`
- `backend/app/analyst/llm_client.py`
- `backend/app/analyst/store.py`

Snapshot manual chỉ chứa các timeframe:

```text
H1, M15, M5
```

Không có `M1` trong `timeframes` của manual snapshot.

### 2. Event-Driven M5 POI Scanner

Luồng này chạy nền khi backend bật analyst. Nó không chạy theo timer 30 phút cũ.
Pipeline sau khi persist bars/delta sẽ enqueue scanner, scanner coalesce queue để
chỉ xử lý latest-state.

Mục đích:

- Build POI từ H1/M15/M5.
- Chỉ chọn M5 POI làm active event zone.
- Filter demand/supply theo HTF preferred side và `biasAligned`.
- Khi giá chạm POI hoặc POI bị invalidated, gọi provider.
- Nếu profile đã bật event AI và LLM configured, dùng real provider.
- Nếu không, dùng mock provider.
- Lưu event vào `poi_events`.
- Gửi Telegram POI event nếu event real và profile bật.

Flow:

```text
NT / cache update
  -> Pipeline._handle_trade()
  -> persist derived bars/delta
  -> analyst_event_sink()
  -> PoiScanner.enqueue_latest()
  -> PoiScanner.process_once()
  -> build HTF/M5 structure and POI
  -> select one best M5 POI event
  -> provider.analyze(event_snapshot)
  -> AnalystStore.insert_poi_event()
  -> optional Telegram POI event
```

File chính:

- `backend/app/pipeline.py`
- `backend/app/runtime.py`
- `backend/app/analyst/poi_scanner.py`
- `backend/app/analyst/poi_zones.py`
- `backend/app/analyst/confluence.py`
- `backend/app/analyst/event_provider.py`
- `backend/app/analyst/poi_models.py`
- `backend/app/analyst/store.py`

## Runtime Wiring

`AppRuntime` tạo `AnalystStore` và `PoiScanner` khi `NTTOTV_ANALYST_ENABLED=1`.

```text
AppRuntime
  -> CacheStore backend/data/app.sqlite
  -> AnalystStore backend/data/analyst.sqlite
  -> PoiScanner
      provider=MockAnalystEventProvider()
      real_provider=LlmAnalystEventProvider.from_settings()
      provider_mode=NTTOTV_ANALYST_EVENT_PROVIDER
```

Pipeline nhận `analyst_event_sink`:

```text
Pipeline(..., analyst_event_sink=poi_scanner.enqueue_latest)
```

Sau mỗi batch persist derived data, pipeline gọi sink này. Scanner có queue size
mặc định `1`, nên nếu thị trường update nhanh, scanner bỏ các state cũ và xử lý
state mới nhất.

## Timeframes Và Vai Trò

### Manual Analyst

`SnapshotBuilder.TIMEFRAME_MAP`:

```text
H1  -> 1h,  240 bars
M15 -> 15m, 240 bars
M5  -> 5m,  300 bars
```

Vai trò:

- `H1`: primary bias.
- `M15`: setup context.
- `M5`: execution context và zone gần nhất.

### Event Scanner

`POI_TIMEFRAMES`:

```text
H1  -> 1h,  240 bars
M15 -> 15m, 240 bars
M5  -> 5m,  300 bars
```

Scanner cũng đọc thêm `M1` bars nội bộ để lấy latest price probe cho việc xác
định giá đã chạm POI hay chưa. Điểm quan trọng:

- M1 không được gửi như context cho LLM.
- Payload event không có `m1Context`.
- `triggerEvidence.priceSource` là `latest_price_probe`, không phải signal M1.
- Decision context dùng `timing: manual_entry`.

## POI Scanner Logic

Scanner hiện chỉ phát event cho M5 POI.

Các hằng chính trong `poi_scanner.py`:

```text
EVENT_POI_TIMEFRAME = M5
EVENT_POI_KINDS = {"ob", "fvg"}
```

Pipeline xử lý mỗi lần:

1. Đọc bars/deltas H1/M15/M5 và M1 price probe.
2. Build external structure map cho H1/M15/M5.
3. Build CVD state cho H1/M15/M5.
4. Build POI zones từ SMC zones.
5. Tính PD context và `biasAligned`.
6. Lấy preferred side từ H1/M15:
   - H1 bullish và M15 không bearish: buy.
   - H1 range/unknown và M15 bullish: buy.
   - H1 bearish và M15 không bullish: sell.
   - H1 range/unknown và M15 bearish: sell.
   - Còn lại: neutral.
7. Chỉ giữ M5 POI cùng hướng:
   - buy: `side=demand` và `biasAligned=true`.
   - sell: `side=supply` và `biasAligned=true`.
8. Tính confluence với các zone cùng side ở H1/M15/M5.
9. Tính status:
   - `inside` khi giá nằm/chạm POI.
   - `approaching` khi cách POI <= 8 ticks.
   - `invalidated` khi phá khỏi zone quá 2 ticks.
   - `active` cho trạng thái còn lại.
10. Sinh event:
   - `price_entered_poi`
   - `poi_invalidated`
11. Nếu có nhiều event, chọn một event tốt nhất.
12. Áp cooldown symbol-level và zone-level.
13. Gọi provider và lưu `poi_events`.

Thứ tự chọn event tốt nhất:

1. Ưu tiên `price_entered_poi`.
2. Ưu tiên status `inside`.
3. Zone gần giá hơn.
4. Ưu tiên `ob` hơn `fvg`.
5. Zone mới hơn.
6. `zone_id` để deterministic.

## Demand/Supply Và Bias Filter

POI được build từ `build_smc_zones()` nhưng scanner chỉ lấy các kind:

```text
ob, fvg, supply_demand, other
```

Trong event scanner, event thực tế hiện chỉ dùng:

```text
ob, fvg
```

Mapping side:

```text
zone.direction = bullish -> side = demand
zone.direction = bearish -> side = supply
```

`biasAligned` trong `poi_zones.py`:

- Demand hợp lệ khi external trend của timeframe là bullish và PD zone là
  `discount` hoặc `unknown`.
- Supply hợp lệ khi external trend của timeframe là bearish và PD zone là
  `premium` hoặc `unknown`.

Đây là lớp filter đầu tiên để giảm nhiều POI rác. Scanner sau đó còn filter theo
preferred side HTF.

## Confluence

`confluence.py` tính confluence cho active M5 POI bằng cách so với các POI cùng
side ở H1/M15/M5.

Một zone được xem là match khi:

- Cùng side.
- Chưa invalidated/expired.
- Overlap đủ lớn so với zone nhỏ hơn.
- Midpoint của zone nhỏ nằm trong zone lớn với tolerance.

Output confluence:

```json
{
  "level": "none|weak|moderate|strong",
  "score": 0,
  "overlappingZones": [],
  "clusterTop": null,
  "clusterBottom": null,
  "priceRelation": "unknown|far|near|inside"
}
```

Confluence hiện ảnh hưởng confidence của mock provider và là context để LLM đọc.

## Provider Modes

Event scanner có hai provider:

### MockAnalystEventProvider

Dùng khi:

- LLM chưa configured.
- Chưa profile nào bật event AI.
- `NTTOTV_ANALYST_EVENT_PROVIDER` không dùng real.

Mock deterministic, dùng cho test và fallback. Nó không gọi network.

### LlmAnalystEventProvider

Dùng khi:

- Có `NTTOTV_OPENAI_API_KEY`.
- Ít nhất một profile bật `/api/analyst/event-ai`.
- Provider mode cho phép real.

Nó gửi `event_snapshot` với schema `gc_poi_event_report`.

LLM event schema chỉ cho:

```text
decision: no_trade | wait_for_buy | wait_for_sell
riskState: no_trade | wait
allowedToAutoTrade: false
```

Nếu provider/proxy trả lệch như `buy_candidate`, backend guard sẽ hạ về
`wait_for_buy` hoặc `wait_for_sell`, hoặc `no_trade` nếu không khớp context.

## Manual LLM Client

Manual analyst dùng `AnalystLlmClient`.

Payload gửi model:

```json
{
  "model": "cx/gpt-5.5",
  "input": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "{\"market_state\":...}"}
  ],
  "max_output_tokens": 700,
  "text": {
    "format": {
      "type": "json_schema",
      "name": "gc_analyst_report",
      "strict": true,
      "schema": {}
    }
  },
  "reasoning": {"effort": "high|medium|..."}
}
```

Manual LLM schema chỉ cho:

```text
decision: no_trade | wait_for_buy | wait_for_sell
riskState: no_trade | wait
allowedToAutoTrade: false
```

Backend có thêm sanitizer text:

- Nếu `reason`, `invalidIf`, hoặc `nextConfirmation` chứa đúng token `M1` hoặc
  `1m`, text đó bị thay bằng fallback.
- Mục tiêu là tránh UI tiếp tục hiển thị phân tích M1 do model/proxy lệch prompt.

## Decision Context Manual

`SnapshotBuilder._decision_context()` tính context sơ bộ:

Output:

```json
{
  "preferredSide": "buy|sell|neutral",
  "qualityScore": 0,
  "conflicts": [],
  "riskState": "no_trade|wait",
  "allowedToAutoTrade": false
}
```

Score hiện tăng khi:

- H1 có bias buy/sell.
- M15 align với H1.
- M5 align với H1.
- CVD H1/M15/M5 có `confirming_structure`.
- M15/M5 có BOS hoặc CHoCH gần đây.
- Không có conflict.

Conflict chính:

- `H1_vs_M15_structure_conflict`
- `H1_vs_M5_structure_conflict`
- `cvd_price_divergence`
- `incomplete_market_state`

`riskState` manual không trả `candidate`; score tốt chỉ lên `wait`.

## REST Endpoints

Các endpoint chính:

```text
GET  /api/analyst/latest
GET  /api/analyst/reports?limit=20
POST /api/analyst/run
GET  /api/analyst/event-ai?profileId=default
PUT  /api/analyst/event-ai?profileId=default
GET  /api/analyst/poi-events?limit=50
GET  /api/analyst/poi-state
GET  /api/analyst/auto-send
PUT  /api/analyst/auto-send
```

Ghi chú:

- `/api/analyst/run` cần login.
- `/api/analyst/event-ai` cần login.
- `/api/analyst/latest` trả manual report mới nhất hoặc real POI event mới hơn.
- `/api/analyst/auto-send` là compatibility noop vì timer 30 phút đã được thay
  bằng event-driven POI scanner.

`PUT /api/analyst/event-ai` sẽ reject enable nếu LLM chưa configured và trả lỗi:

```text
Analyst LLM is not configured
```

Nguyên nhân thường là backend process không có `NTTOTV_OPENAI_API_KEY` trong env.

## Storage

Analyst dùng DB riêng:

```text
backend/data/analyst.sqlite
```

Không ghi chung vào `backend/data/app.sqlite` để có thể tháo option AI mà không
đụng market cache chính.

Tables chính:

```text
analyst_settings
market_state_snapshots
llm_analyst_reports
poi_zones
poi_events
analyst_provider_errors
```

Vai trò:

- `analyst_settings`: lưu setting theo user/profile, ví dụ event AI enabled.
- `market_state_snapshots`: snapshot manual đã gửi hoặc đã build.
- `llm_analyst_reports`: manual reports.
- `poi_zones`: trạng thái POI scanner hiện tại.
- `poi_events`: event POI đã sinh, gồm input snapshot, response, error, latency.
- `analyst_provider_errors`: chỗ dành cho lỗi provider.

Không nên sửa SQLite bằng tay khi backend đang chạy.

## Config Và Env Vars

Các env chính trong `backend/app/config.py`:

```text
NTTOTV_ANALYST_ENABLED=1
NTTOTV_ANALYST_DB_NAME=analyst.sqlite
NTTOTV_ANALYST_EVENT_PROVIDER=mock|real
NTTOTV_ANALYST_MANUAL_PROVIDER=real
NTTOTV_ANALYST_TICK_SIZE=0.1
NTTOTV_ANALYST_EVENT_COOLDOWN_S=1800
NTTOTV_ANALYST_SCANNER_QUEUE_SIZE=1
NTTOTV_ANALYST_M1_INTERNAL_ENABLED=1
NTTOTV_OPENAI_API_KEY=<key>
NTTOTV_OPENAI_BASE_URL=<base-url>
OPENAI_BASE_URL=<fallback-base-url>
NTTOTV_LLM_MODEL=cx/gpt-5.5
NTTOTV_LLM_REASONING_EFFORT=medium
NTTOTV_LLM_MANUAL_REASONING_EFFORT=high
NTTOTV_LLM_EVENT_REASONING_EFFORT=high
```

Current runtime restart thường cần load key từ User env vì process env có thể
không tự inherit:

```powershell
$env:NTTOTV_OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('NTTOTV_OPENAI_API_KEY','User')
$env:OPENAI_BASE_URL = [Environment]::GetEnvironmentVariable('OPENAI_BASE_URL','User')
$env:NTTOTV_LLM_MODEL = [Environment]::GetEnvironmentVariable('NTTOTV_LLM_MODEL','User')
$env:NTTOTV_ANALYST_ENABLED = '1'
```

Sau đó start backend:

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.app:app --host 0.0.0.0 --port 8000
```

## Cooldown Và Chống Spam

Scanner có cooldown mặc định 1800 giây.

Có hai lớp dedupe:

1. Symbol-level cooldown:
   - Nếu có real, non-deduped POI event gần nhất cho cùng symbol/contract trong
     cooldown window, scanner không gửi event mới.
2. Zone-level cooldown:
   - Nếu cùng `zone_id + event_type` vừa gửi gần đây, scanner không gửi lại.

Mục tiêu là tránh tình trạng một lần giá vào vùng nhưng gửi nhiều nhận định liên
tục ở các POI khác nhau.

## Telegram

Manual report:

```text
/api/analyst/run -> send_telegram_analyst_report()
```

POI event:

```text
PoiScanner._send_telegram_event()
```

Event Telegram chỉ gửi khi:

- Event có response.
- Event không deduped.
- `provider_mode == real`.
- Có profile bật event AI.

## Latest Report Semantics

`GET /api/analyst/latest` hoạt động như sau:

1. Đọc manual report mới nhất từ `llm_analyst_reports`.
2. Đọc real POI event mới nhất từ `poi_events`.
3. Nếu POI event real mới hơn manual report, trả POI event dưới dạng report.
4. Nếu không, trả manual report.

Vì vậy nếu UI vẫn hiển thị nội dung cũ, cần phân biệt:

- Code mới đã chạy chưa.
- Latest report trong DB có phải report cũ trước khi fix hay không.
- Có cần tạo report mới bằng `/api/analyst/run` để latest được thay thế không.

## Data Contracts

### Manual Report

```json
{
  "bias": "bullish|bearish|range|unknown",
  "decision": "no_trade|wait_for_buy|wait_for_sell",
  "confidence": 0.0,
  "reason": ["..."],
  "invalidIf": "...",
  "nextConfirmation": "...",
  "riskState": "no_trade|wait",
  "allowedToAlert": false,
  "allowedToAutoTrade": false
}
```

### Event Report

```json
{
  "bias": "bullish|bearish|range|unknown",
  "decision": "no_trade|wait_for_buy|wait_for_sell",
  "confidence": 0.0,
  "eventType": "price_entered_poi|poi_invalidated",
  "activePoiSummary": "...",
  "structureRead": {
    "h1": "...",
    "m15": "...",
    "m5": "..."
  },
  "reason": ["..."],
  "invalidIf": "...",
  "nextConfirmation": "...",
  "riskState": "no_trade|wait",
  "allowedToAlert": false,
  "allowedToAutoTrade": false
}
```

## Tests

Focused analyst tests:

```powershell
backend\.venv\Scripts\python.exe -m pytest `
  backend\tests\unit\test_analyst_llm_client.py `
  backend\tests\unit\test_analyst_snapshot_builder.py `
  backend\tests\unit\test_analyst_event_provider.py `
  backend\tests\unit\test_analyst_poi_scanner.py `
  backend\tests\integration\test_rest_analyst.py -q
```

Rộng hơn:

```powershell
backend\.venv\Scripts\python.exe -m pytest `
  backend\tests\unit `
  backend\tests\integration\test_rest_analyst.py `
  backend\tests\smoke\test_app_skeleton.py `
  -q -k analyst
```

Các regression cần giữ:

- Manual snapshot không có `M1`.
- LLM schema không cho `buy_candidate/sell_candidate`.
- LLM schema không cho `riskState=candidate`.
- Event snapshot không có `m1Context`.
- Event snapshot không có `latest_m1_close` hoặc `manual_m1`.
- Text report bị sanitize nếu model trả đúng token `M1` hoặc `1m`.
- Cooldown symbol-level chặn nhiều event liên tiếp ở nhiều POI.

## Checklist Khi Phát Triển Tiếp

Khi sửa scanner:

- Giữ active event timeframe là M5 nếu chưa đổi chiến lược có chủ đích.
- Filter demand/supply trước khi gọi LLM.
- Không gửi toàn bộ danh sách POI cho LLM nếu chỉ cần một active POI.
- Nếu thêm event type mới, cập nhật:
  - `POI_EVENT_TYPES`
  - `EVENT_TYPES`
  - Event schema
  - Tests scanner/provider/routes.

Khi sửa prompt/schema LLM:

- Không mở lại `buy_candidate/sell_candidate` cho model nếu trader vẫn timing
  thủ công.
- Không đưa M1 vào payload như structure/CVD/zone.
- Giữ `allowedToAutoTrade` const false.
- Giữ sanitizer hoặc thay bằng validator mạnh hơn.

Khi sửa persistence:

- Không ghi analyst vào `app.sqlite`.
- Giữ `analyst.sqlite` độc lập.
- Cẩn thận SQLite writer concurrency, dùng `AnalystStore` methods.

Khi sửa frontend:

- `/api/analyst/latest` có thể trả manual report hoặc POI event report.
- UI nên hiển thị rõ đây là `wait` context, không phải entry signal.
- Nếu cần debug scanner, dùng `/api/analyst/poi-state` và
  `/api/analyst/poi-events`.

## Hướng Phát Triển Hợp Lý

Các bước nên làm tiếp theo theo thứ tự:

1. Cải thiện demand/supply quality filter:
   - Age của zone.
   - Width tối đa/tối thiểu.
   - Touch count.
   - Không chọn zone quá gần opposing zone.
   - Ưu tiên OB/FVG có displacement rõ.
2. Thêm scoring trước LLM:
   - HTF alignment.
   - PD zone.
   - Confluence.
   - CVD agreement.
   - Distance/touch state.
3. Lưu `qualityScore` cho từng POI trong `PoiZone.confluence` hoặc field mới.
4. Chỉ gọi LLM khi score vượt threshold.
5. Tách reason machine-readable và human-readable:
   - Machine: enum tags để frontend lọc.
   - Human: tiếng Việt ngắn cho Telegram/UI.
6. Thêm replay/test fixture từ cache thực tế để verify scanner không spam và
   không chọn sai POI.

## Troubleshooting

### UI báo `Analyst LLM is not configured`

Nguyên nhân:

- Backend process không có `NTTOTV_OPENAI_API_KEY`.
- Key nằm ở User env nhưng process start không load User env.

Kiểm tra:

```powershell
[Environment]::GetEnvironmentVariable('NTTOTV_OPENAI_API_KEY','User')
```

Restart backend với env được set trong process trước khi start.

### Vẫn thấy report nhắc M1

Khả năng:

- UI đang hiển thị report cũ trong `analyst.sqlite`.
- Backend chưa restart sau code mới.
- Report được tạo trước sanitizer.

Kiểm tra latest:

```powershell
$script = @'
import json, re, urllib.request
body = urllib.request.urlopen('http://127.0.0.1:8000/api/analyst/latest').read().decode()
print(bool(re.search(r'\b(?:m1|1m)\b', json.dumps(json.loads(body), ensure_ascii=False), re.I)))
'@
$script | python -
```

Nếu latest cũ, tạo report mới bằng `/api/analyst/run` hoặc chờ event mới.

### Scanner gửi quá nhiều report

Kiểm tra:

- `NTTOTV_ANALYST_EVENT_COOLDOWN_S` có đúng `1800` không.
- `poi_events.provider_mode` có phải `real` không.
- Symbol-level cooldown có bị bypass do mode mock không.
- Có nhiều backend process cùng chạy không.

### Không có POI event

Kiểm tra:

- `NTTOTV_ANALYST_ENABLED=1`.
- Backend runtime có `PoiScanner`.
- `/api/analyst/poi-state` có zones không.
- Giá đã vào M5 POI chưa.
- POI có `biasAligned=true` không.
- H1/M15 preferred side có neutral/conflict không.

## File Map Nhanh

```text
backend/app/analyst/
  confluence.py        Cross-timeframe POI confluence scoring.
  cvd_state.py         Compact CVD state từ volume delta.
  event_provider.py    Mock/LLM provider cho POI events.
  llm_client.py        Manual OpenAI structured output client.
  poi_models.py        PoiZone/PoiEvent dataclasses.
  poi_scanner.py       Background M5 POI event scanner.
  poi_zones.py         Deterministic POI construction.
  routes.py            REST API cho analyst.
  scheduler.py         Manual run helper và scheduler cũ.
  schemas.py           MarketStateSnapshot/AnalystReport dataclasses.
  smc_state.py         SMC state và zones cho snapshot.
  smc_structure.py     Confirmed-swing structure maps.
  snapshot_builder.py  Manual H1/M15/M5 snapshot builder.
  store.py             analyst.sqlite store.
```

## Nguyên Tắc Thiết Kế Hiện Tại

Option AI nên là lớp context và filter, không phải entry engine.

Scanner chịu trách nhiệm chọn đúng một M5 POI đáng quan tâm. LLM chịu trách nhiệm
diễn giải ngắn gọn context đã được lọc. Trader chịu trách nhiệm timing thủ công.
Nếu sau này muốn tự động hóa thêm, nên thêm một module riêng cho execution/risk
và giữ analyst không trực tiếp phát lệnh.
