# Bookmap Market Data Live Bridge

The bridge streams Bookmap trades, one-second heartbeats, and one-minute bar
snapshots to the loopback-only `/ws/bookmap` backend endpoint. The backend
production runtime selects Bookmap as the primary source for OHLCV, BigTrade,
Volume Delta, and Footprint. NinjaTrader remains connected and warm as the
automatic fallback.

## Data captured

The add-on listens to Bookmap `TimeListener` and `TradeDataListener` callbacks.
Each finalized UTC minute is exported as one JSONL row with the same core input
shape as `/api/nt/native-bar`:

- OHLCV
- buy/sell volume and delta metrics
- bid/ask executed volume at every traded price
- Bookmap execution-chain and order-id coverage diagnostics

Every Bookmap trade also carries its exchange aggressor side. The backend folds
those trades into Volume Delta and Footprint state tick by tick and broadcasts
intrabar updates through the normal UI throttle. Full current/closed bar frames
carry the complete delta snapshot and ladder, so reconnects and detected tick
gaps replace provisional state exactly.

Bookmap `TradeInfo.isBidAggressor=true` means the bid/buyer side aggressed and
is stored as footprint `ask` volume (a buy lifted the ask). `false` means the
ask/seller side aggressed and is stored as footprint `bid` volume.

The first bar after attach/realtime transition is marked `partialStart=true`.
The comparison script skips it by default. The open bar is discarded on unload
instead of being exported as a false finalized bar.

## Build

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Build-BookmapMarketDataBridge.ps1
```

Output:

```text
bookmap-bridge\build\market-data\NTtoTV-Bookmap-Market-Data-Live.jar
```

If Bookmap currently has that JAR loaded, Windows locks it. Build a side-by-side
replacement, unload the old add-on, then load the new JAR:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\Build-BookmapMarketDataBridge.ps1 `
  -OutputJar NTtoTV-Bookmap-Market-Data-Live-next.jar
```

Load that JAR through Bookmap's add-on manager and attach
`NTtoTV Bookmap Market Data Live` to `GCZ6.COMEX@RITHMIC`.

## Export location

Default:

```text
_run_logs\bookmap-market-data\GCZ6_COMEX_RITHMIC-v2-YYYY-MM-DD.jsonl
```

The `v2` suffix keeps display-price exports separate from the initial diagnostic
file, which contained Bookmap's raw pip-level prices.

Optional Bookmap JVM environment/system properties:

- `NTTOTV_BOOKMAP_MARKET_EXPORT_DIR`: override export directory.
- `NTTOTV_BOOKMAP_SYMBOL`: logical symbol, default `GC`.
- `NTTOTV_BOOKMAP_CONTRACT`: logical cache contract, default `GC`.
- `NTTOTV_BOOKMAP_SOURCE_CONTRACT`: real source contract sent to the live
  backend, default `GC 12-26`.
- `NTTOTV_BOOKMAP_MARKET_INCLUDE_HISTORICAL=1`: include historical/replay data.
  Leave unset in production. Missing history is repaired with the existing NT
  export import workflow instead of replaying historical Bookmap ticks as live.

The reconnect snapshot retains the current bar and the most recently closed
bar. An outage spanning more history than that is intentionally repaired by the
NT import workflow.

## Compare with NT native

After at least several complete one-minute bars:

```powershell
backend\.venv\Scripts\python.exe scripts\compare_bookmap_nt_footprint.py `
  --jsonl _run_logs\bookmap-market-data\GCZ6_COMEX_RITHMIC-v2-2026-07-22.jsonl `
  --db backend\data\app.sqlite `
  --symbol GC --contract GC --tf 1m --tick-size 0.1
```

The comparison is read-only. It checks OHLCV, buy/sell/delta fields and every
bid/ask ladder cell. Use `--report-json <path>` for a machine-readable report.
