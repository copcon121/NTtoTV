# Volume Delta / Footprint: Bookmap primary + NT fallback

## Mục tiêu đã chốt

- Bookmap là nguồn realtime ưu tiên cho OHLCV, BigTrade, Volume Delta và
  Footprint.
- Volume Delta và Footprint được tích lũy từ từng trade Bookmap theo aggressor
  side; frontend nhận update intrabar qua websocket throttle hiện có.
- Bar snapshot Bookmap 1m mang đầy đủ delta và ladder để reconcile chính xác khi
  đóng phút, reconnect hoặc phát hiện thiếu tick.
- NinjaTrader luôn giữ kết nối làm fallback tự động. Chỉ nguồn active được phép
  ghi các cache key dùng chung, nên NT và Bookmap không còn đè dữ liệu nhau.
- FVG grader vẫn dùng footprint finalized từ NT native; việc đổi nguồn trong tài
  liệu này chỉ áp dụng cho OHLCV, BigTrade, Volume Delta và Footprint.
- History thiếu vẫn sửa bằng workflow NT export hiện tại (`Import-NtGap` hoặc
  Last-only import). Import ghi cache trực tiếp và không chịu live-source gate.
  Last-only import tiếp tục chỉ dựng bars + Volume Delta, không dựng footprint.

## Luồng dữ liệu

```text
Bookmap trade
  -> raw tick source=bookmap
  -> source-scoped bars / VolumeDelta / Footprint / BigTrade
  -> persist + broadcast nếu Bookmap active

Bookmap full M1 snapshot
  -> replace M1 delta + footprint ladder atomically
  -> rebuild/seed higher-timeframe delta
  -> repair reconnect hoặc trade-sequence gap

NT trade/native bar
  -> raw tick + warm fallback state
  -> persist + broadcast order flow chỉ khi NT active

NT export file
  -> importer hiện có
  -> chart cache contract=GC, độc lập với source realtime
```

## Arbitration và tính toàn vẹn

- Production dùng `NTTOTV_MARKET_DATA_PREFERRED_SOURCE=bookmap`.
- Bookmap stale hoặc ladder chưa sẵn sàng sẽ chuyển sang NT nếu NT còn healthy.
- Khi Bookmap hồi phục, cơ chế minimum-hold/recovery hysteresis hiện có mới cho
  phép chuyển lại, tránh rung nguồn.
- Kết nối Bookmap mới phải nhận full order-flow snapshot trước khi đủ điều kiện
  làm primary.
- Trade sequence gap khóa Bookmap order flow cho tới full snapshot kế tiếp;
  heartbeat sequence gap chỉ là metric và không làm mất quyền nguồn.
- Snapshot capture/enqueue và trade accumulate/enqueue dùng cùng một lock trong
  bridge để snapshot cũ không thể ghi đè một trade mới hơn khi reconnect.
- Full footprint snapshot xóa level cũ và upsert level mới trong cùng transaction.

## Bridge và triển khai

Bridge gửi trong mọi bar frame:

```text
buyVolume, sellVolume, delta, deltaHigh, deltaLow,
openDelta, closeDelta, rows[{price,bid,ask}]
```

Biến cấu hình:

- `NTTOTV_BOOKMAP_SOURCE_CONTRACT=GC 12-26`: contract thật gửi vào live backend.
- `NTTOTV_BOOKMAP_SYMBOL=GC`: logical symbol.
- `NTTOTV_BOOKMAP_CONTRACT=GC`: logical contract cho JSONL export.
- Không bật `NTTOTV_BOOKMAP_MARKET_INCLUDE_HISTORICAL` trong production; history
  thiếu dùng NT import như hiện tại.

Build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\Build-BookmapMarketDataBridge.ps1
```

Nếu JAR đang bị Bookmap khóa, build side-by-side:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\Build-BookmapMarketDataBridge.ps1 `
  -OutputJar NTtoTV-Bookmap-Market-Data-Live-next.jar
```

Sau đó unload JAR cũ, load JAR mới và attach vào `GCZ6.COMEX@RITHMIC`.

## Tiêu chí nghiệm thu

- Bookmap active: mỗi trade làm thay đổi live Volume Delta/Footprint đúng side;
  NT realtime/native không ghi đè cache order flow.
- Bookmap stale: NT fallback tiếp quản và native delta/footprint được chấp nhận.
- Bookmap reconnect/gap: chỉ recover sau full snapshot; M1 ladder được replace và
  delta các timeframe lớn được reconcile.
- REST cache miss rebuild dùng raw source active: Bookmap dùng explicit side, NT
  giữ prevailing-quote classification.
- NT export import vẫn chạy nguyên workflow và ghi `contract=GC`.
