# Bookmap Market Data Shadow

This bridge is independent from the in-progress Stops/Icebergs bridge. It does
not POST to the backend and does not write to the production chart cache.

## Data captured

The add-on listens to Bookmap `TimeListener` and `TradeDataListener` callbacks.
Each finalized UTC minute is exported as one JSONL row with the same core input
shape as `/api/nt/native-bar`:

- OHLCV
- buy/sell volume and delta metrics
- bid/ask executed volume at every traded price
- Bookmap execution-chain and order-id coverage diagnostics

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
bookmap-bridge\build\market-data\NTtoTV-Bookmap-Market-Data-Shadow.jar
```

Load that JAR through Bookmap's add-on manager and attach
`NTtoTV Bookmap Market Data Shadow` to `GCQ6.COMEX@RITHMIC`. This does not
replace or modify the SI add-on.

## Export location

Default:

```text
_run_logs\bookmap-market-data\GCQ6_COMEX_RITHMIC-v2-YYYY-MM-DD.jsonl
```

The `v2` suffix keeps display-price exports separate from the initial diagnostic
file, which contained Bookmap's raw pip-level prices.

Optional Bookmap JVM environment/system properties:

- `NTTOTV_BOOKMAP_MARKET_EXPORT_DIR`: override export directory.
- `NTTOTV_BOOKMAP_SYMBOL`: logical symbol, default `GC`.
- `NTTOTV_BOOKMAP_CONTRACT`: logical cache contract, default `GC`.
- `NTTOTV_BOOKMAP_MARKET_INCLUDE_HISTORICAL=1`: include historical/replay data.
  Leave unset for the live shadow comparison.

## Compare with NT native

After at least several complete one-minute bars:

```powershell
backend\.venv\Scripts\python.exe scripts\compare_bookmap_nt_footprint.py `
  --jsonl _run_logs\bookmap-market-data\GCQ6_COMEX_RITHMIC-v2-2026-07-22.jsonl `
  --db backend\data\app.sqlite `
  --symbol GC --contract GC --tf 1m --tick-size 0.1
```

The comparison is read-only. It checks OHLCV, buy/sell/delta fields and every
bid/ask ladder cell. Use `--report-json <path>` for a machine-readable report.
