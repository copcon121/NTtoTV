# Rithmic raw history and ML footprint archive

Windows backend raw retention is 90 UTC calendar days including today. The
runtime launcher pins `NTTOTV_TICK_RETENTION_DAYS=90`. Existing derived footprint
history remains persistent; no old footprint data is deleted by this change.

Validated initial GCZ6 capture (2026-10-24): 2026-07-27 00:00 UTC through
2026-10-24 10:00 UTC exclusive, all 2,146 requested hours complete. It contains
8,082,766 trades / 9,121,765 traded contracts, 89,065 M1 footprint bars and
176,344 30s bars, with 3,570,981 price cells. Unknown bid/ask classification is
283,806 contracts (3.1113%); retain the quality flags for ML.

Independent native Rithmic M1 trade counts and volume match on all 90 UTC days.
Raw SQL counts/volume, full gzip CRCs, footprint cell bid/ask sums and header
delta also pass. Local reports are under `_run_logs/rithmic-history/`:
`audit-20261024.json`, `provider-check-20261024.json`, and
`ladder-check-20261024.json`. At completion, raw SQLite uses about 2.478 GiB
and the valid compressed archives 0.114 GiB, excluding the shared chart cache.

Download the current physical source GCZ6 / GC 12-26:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Download-RithmicHistory.ps1 -Days 90
```

For high-volume downloads, the optional native protobuf decoder avoids decoding
millions of historical messages in Python. Install with
`backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-history.txt`.
The live connector retains its existing codec and dependency requirements.

Optional bounded retry through History Plant maintenance:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Download-RithmicHistory.ps1 -Days 90 -MaxRetries 288 -RetrySeconds 300
```

The wrapper reads the existing user's DPAPI credential without printing it or
passing secrets on the command line. Identity and system match the existing
Windows connector. A separate read-only HISTORY_PLANT session is used; downloaded
events never enter live arbitration, alerts, or trading. Only one downloader
can run for a symbol at a time (an OS file lock also covers retry waits).

## Storage and provenance

- `backend/data/ticks/GC/GC_12-26/YYYY-MM-DD.sqlite`: historical trades use
  `source=rithmic_history`, distinct from live `rithmic` and `nt`. Select exactly
  one source when training or rebuilding to avoid double-counting the same market.
- `backend/data/rithmic-history/GCZ6/<start>-<end>.jsonl.gz`: original one-trade
  replay values, bid/ask volumes, field-presence flags, microsecond END clock,
  replay sequence endpoints, and explicit unknown volume. Historical timestamps
  are the Rithmic data-bar clock, not fabricated exchange timestamps. Compressed
  raw hours follow the same 90-day retention policy as raw SQLite shards.
- `backend/data/rithmic-history/GCZ6/progress.json`: hour completion, counts,
  classification quality, process state, and retry status. `waiting_for_source`
  or `interrupted` means the range is NOT complete. Server code 14 is an error,
  never interpreted as an empty trading interval.
- `backend/data/app.sqlite`: full 30s and 1m footprint, OHLCV, and delta under the
  physical `contract=GC 12-26`. `footprint_history_quality` retains total,
  classified, and unknown volume per bar. The logical chart key `GC` receives
  only missing footprints whose existing OHLCV agrees, or entirely missing bars.
  Existing chart footprints and mismatching candles are preserved.

History Plant tick replay provides executed trades and bid/ask traded volumes.
It does NOT reconstruct historical BBO quotes, raw L2/MBO, order IDs, or OF7
indicator labels. Unknown volume is preserved and never guessed to be buy/sell.
Filter or explicitly model unknown-volume bars when creating an ML dataset.

For tick-sequence ML/replay, use the compressed archives in UTC-hour order and
their `ordinal` / `timeUs` fields. SQLite `sequence` is a synthetic identity,
not an exchange sequence or the capture ordering for same-clock prints. The
footprint materializer consumes the ordered archive, including genuine repeated
prints, rather than sorting these synthetic SQLite identifiers.

## Integrity and recovery

Each UTC hour is downloaded completely before atomic compressed-file publication.
Logical intervals include their final second; the wire `finish_index` is
exclusive and is sent as `end + 1`. This applies at EVERY recursive split,
preventing a missing final second in each subrequest. Capture version 3
invalidates older boundary-incomplete hours before considering coverage complete.
The Paper History Plant silently caps responses at 10,000 rows even if a larger
count was requested, and can still return success code 0. Replies reaching this
effective cap are recursively split into disjoint seconds; saturated single
seconds fail instead of silently truncating. Legacy capped hours are invalidated
and replayed, and their suspect files are kept as `.gz.incomplete` evidence outside
the normal ML archive glob. Only history-owned logical rows are refreshed.
A completed canonical hour has stable print ordinals, preserving identical real
prints. A verified hour atomically replaces only `source=rithmic_history` in raw
SQL, so retries and different replay ordering cannot retain an old capped prefix
as duplicate data. Live `nt` and `rithmic` sources are preserved. Only after
archive, raw SQL, and footprints are durable is its
manifest marked complete. Rerun the same command after interruption to resume.

The current open UTC hour is excluded and can be captured by a later run. Empty
weekend hours may be complete only after a successful end-of-response code 0.
Downloading pauses without deleting data if disk free space falls below 10 GiB.
No runtime SQLite file is copied while WAL is active.

Audit all completed hours against raw SQL counts/volume, footprint row counts,
per-timeframe classified/unknown volume, and optionally compressed-file CRC:

```powershell
backend\.venv\Scripts\python.exe backend\scripts\audit_rithmic_history.py --verify-archives
```

The auditor exits with code 2 if any requested hour is missing or integrity does
not match. `--allow-partial` permits checking completed hours during a download,
while still reporting missing coverage explicitly.

Validation:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/unit/test_rithmic_history.py tests/unit/test_rithmic_protocol.py tests/unit/test_rithmic_runtime.py tests/unit/test_tick_store.py tests/property/test_shard_retention_property.py
```
