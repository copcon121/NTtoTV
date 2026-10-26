# OF7 reconstruction for footprint ML research

## Scope and status

The first implementation is an offline, portable Python calculation core in
`backend/app/orderflow7/`. It implements the 29 detector families / 33 feature
IDs described by `OrderFlowsTrader7_Full_Signal_Logic.md` at the repository root.
It is not yet a replacement for the live footprint page or a trained model.
The subsequent source audit and original-DLL BarData replay are documented in
`OF7-VALIDATION.md`. See `OF7-SIGNAL-GROUPS.md` for corrected interpretations.
Live ingestion, chart cache, trading controls, services and Oracle remain outside
this research core. A read-only NinjaTrader export probe is maintained separately.

Reference identity was rechecked with static REA metadata inspection:

- Assembly: `OrderFlowsTrader`, version `7.0.1.0`, 883200 bytes.
- SHA-256: `d47bbcfad05978a3864297e6a569f99be736984ac474c58ab31065e4a4f07cce`.
- Evidence: `ev_aaa553c2d02b36f872aa5335e74100abe844ad1cfc8341f60f1e8d03cf0c8cad`.
- The existing report also records managed CIL evidence
  `ev_70cc7129c505c96a252e398eef3ec74730e748e8b0ef6f92e6344577be79f87d`.

Detector rules follow exact CIL/decompiled methods and the corrected report.
Hand-calculated detector tests are not a live chart oracle. The streaming ladder
is additionally tested against controlled original-DLL AddTick output after
every tick in five fixtures. The subsequent native audit compared 293 closed
bars and 19338 series values/validities with zero mismatches, including all
33 triggered feature IDs in the explicit sensitivity configuration. This is
bounded validation, not a claim about every parameter or intrabar sequence.

## Components

| File | Responsibility |
|---|---|
| `config.py` | All calculation parameters, 33 feature IDs, presets, config hash |
| `models.py` | Bid/Ask/Between cells, OHLC bar, calculated frame, signals, snapshot |
| `engine.py` | POC, side POCs, Value Area, diagonal imbalance, intrabar replacements, continuous measurements |
| `signals.py` | Detector conditions and zones, canonical direction and original DLL series |
| `stream.py` | Tick-ordered POC/VA and Bid/Ask/Between, including original state quirks |
| `research.py` | Explicit corrections beside original signals, policy versioned |
| `groups.py` | Six mechanistic groups covering exactly 33 IDs, overlapping descriptive tags |
| `unfinished.py` | Separate closed-bar base-level lifecycle; strict cross, independent of display toggle |
| `replay.py` | Offline JSONL replay and reproducible feature export |

No third-party ML or dataframe dependency is required by this core.

## Parameters

`OF7Config()` matches the report's enabled defaults: three Prominent POC
levels, Delta Divergence, Stacked Imbalance, both Ratio outputs, Value Area,
and Engulfing Value Area. `OF7Config.research()` enables all 33 feature IDs;
it does not change thresholds. Full parameter defaults are authoritative in
`config.py` and can be printed with `--show-config`.

| Calculation | Default |
|---|---|
| GC tick size | 0.1 |
| Value Area | 70% |
| Diagonal imbalance ratio / minimum volume | 400% = 4x / 10 |
| Global swing setting / actual older-bar window / enabled filters | 5 / 6 bars / none |
| Prominent POC lookbacks | 0, 0, 3 |
| Prominent POC distance settings | 1, 2, 3 (effective extreme distances 0, 1, 2 ticks) |
| Prominent POC cell-delta checks | false, false, false |
| Passive traders in control | false |
| Tails HH/LL / engulfing-VA filter | false / false |
| Delta Divergence daily high/low only | true |
| Price Action Divergence daily high/low only | false |
| Exhaustion Prints maximum size | 9 |
| Imbalance Reversal minimum volume | 10 |
| Market Sweep cluster / maximum volume | 3 cells / 5 |
| Market Weakness sequence | 3 bars |
| Orderflows Sequencing cluster | 5 cells |
| Thin Prints maximum volume / multiple threshold | 1 / 3 |
| Ratio defense / exhaustion bounds | strictly below 0.69 / strictly above 30 |
| Multiple Imbalances minimum count | 3 |
| Inverse / Stacked Imbalance clusters | 2 / 3 cells |
| Open POC lookback | 5 bars |
| Delta Breakout acceleration | 200 |
| Resting Liquidity volume | 200 |
| Vertical Liquidity cluster / volume | 3 cells / 250 |

The multiple-Thin-Print threshold is retained as configuration metadata; the
core emits the individual prints and does not render a bar outline. Colors,
opacity, arrow spacing, zone size, and zone lifetime belong to a later UI/zone
state layer and are not claimed as reconstructed here. Ratio still emits a
signal despite its original default display zone size being zero.

## Input contract and replay

Prices in `OF7Cell`, `OF7Bar`, signal levels and zones are INTEGER TICK INDICES.
For GC, 3000.1 is tick index 30001. `price_to_ticks()` validates an exact grid.
Time and `observed_at` are integer UTC milliseconds. `time` is the bar start;
`observed_at` is when the snapshot became available. A closed bar cannot be
observed before `time + timeframe_ms`. Default timeframe is 60000 ms.

Each JSONL line is a complete ladder snapshot; `test-fixtures/of7/snapshots.jsonl`
contains synthetic examples, including an intrabar revision and close. Input
must explicitly identify `source`, the REAL `source_contract`, `session_id`,
`is_closed`, and `between_known`. Chart symbol remains logically GC elsewhere.
Supply sorted unique cells and a consistent OHLC range. Missing price cells
are not fabricated as zero-volume trades. An actual diagonal neighbor is needed
for imbalance. Derive the session ID from the reference NinjaTrader trading-day
template; the existing CT 17:00 calendar is a candidate that still needs parity
checks against that template.

From `backend` in PowerShell:

```powershell
.venv\Scripts\python.exe -m app.orderflow7.replay --preset research --show-config
.venv\Scripts\python.exe -m app.orderflow7.replay ..\test-fixtures\of7\snapshots.jsonl "$env:TEMP\of7-example.jsonl" --preset research
.venv\Scripts\python.exe -m pytest tests/unit/test_of7_engine.py tests/unit/test_of7_signals.py -q
```

The output file must not exist. Optional `--config path.json` accepts parameter
overrides such as `{"imbalance_in_percent":300,"minimal_imbalance_volume":20}`.
Use a new output filename on every run. Failed replay retains a partial output
for diagnosis; treat any nonzero process exit as an incomplete dataset.

For Linux use the equivalent environment Python command. The core uses standard
Python and has no NinjaTrader, Windows, x86, GPU, or broker dependency.

One engine handles one source, real contract, timeframe and configuration.
Feed repeated live snapshots, an explicit final snapshot, then the next bar.
Closed bars are immutable; corrected history requires a fresh replay. Source
switches, rollover, and timeframe changes require a fresh segment. Overlapping
bars are rejected; time gaps and incomplete warmup are flagged. The engine
retains bounded lookback and full accumulated session extrema.

Exports include the ladder, frame levels, numeric measurements, signals,
`observed_at`, `config_hash`, reference DLL hash, source identity, provisional
state and quality warnings. Raw ratio is preserved even when no Ratio signal
fires. Disabled features have null counts; enabled inactive features have zero
counts. Counts represent output occurrences (Value Area emits two fixed levels),
not trade recommendations. Incomplete warmup and incomplete history can also
produce zero counts; consumers must inspect quality flags before using them.

## Direction and known parity gaps

`side` follows the zone direction. `original_series` preserves the DLL's names:
Tails is inverted; bearish Sequencing and Zero Print write to a Buy series.
Warnings identify those cases. Value Area Low/High are fixed levels, including
neutral doji output, and are not independent directional signals. Multiple
Imbalances emits a single observation instead of duplicate renderer zones.
The shared Inverse/Stacked filter suppression and Vertical Liquidity lookback
block are retained from the report.

Snapshot schema v2 retains original `signals` and separate `analysis_signals`
using research policy `of7-corrections-v1`. The latter repairs asymmetric A/D
Buy, excludes zero-denominator Defense and wrong-direction Stacked outputs,
separates shared Inverse/Stacked filters, and repairs Vertical swing filtering.
These corrections are design choices, not claims about original DLL behavior.

Validation boundaries before accepting data as OF7-equivalent:

1. `OF7StreamLadder` preserves prior POC on final ties, side-specific neighbor
   sums, sparse-key VA traversal, upper-first expansion ties and incremental
   shrink. All five controlled original-DLL fixtures match after every tick.
   An aggregate snapshot alone cannot recover these path-dependent states;
   `build_frame()` remains an explicitly approximate fallback.
2. Streaming preserves the DLL Bid-POC update quirk. Aggregate snapshots use a
   deterministic side maximum and export a warning. To retain streaming levels,
   call `engine.update(bar, observed_at=..., calculated_frame=ladder.frame(bar))`.
3. Source audit resolved startup gates, offset direction, sparse reads, cluster
   endings and exact two-price Zero Print zones. Native closed-series comparison
   now covers all 33 IDs across the audited configurations; additional directions,
   settings and intrabar timing remain distinct checks. Preserve reference_bar_index and
   reference_current_bar_index when importing NinjaTrader historical results.
4. Trading-day extrema at startup cannot be known from a partial session. The
   export always warns that session-start coverage is unverified. Feed the full
   session before relying on daily-high/low filters.
5. The streaming class accepts effective preprocessed ticks and implements
   Bid/Ask/Between including locked quotes. The surrounding NT processor's
   chart-volume reconciliation, up/down-tick mode, filters/grouping and renderer
   zone lifecycle are not attached to live ingestion. Match those inputs first.
6. `between_known=false` is explicitly approximate. Unknown prior Between
   propagates a lookback quality warning. Old chart ladders cannot recover it.
7. Ordered streams retain observed input volume separately from classified
   Bid/Ask/Between. Missing/crossed quotes remain unclassified, with explicit
   volume and quality flags. Reference bar-index gaps require a new engine so
   missing bars cannot silently become a previous-bar comparison.
8. Base Unfinished Business is exported separately from the 33 feature IDs.
   Closed bars finalize earlier levels only on strict crossings, then create
   the new extreme level. Native stored state matched all 58 captured-origin
   levels. Renderer visibility and levels predating the capture are excluded.

## Existing data and SMC implications

Both current Windows and Oracle chart footprints store only Bid/Ask. Existing
inside-spread unknown-side trades contribute no side volume. The existing MZ
engine also uses different imbalance-percent semantics and a different POC tie.
Its ready-made POC/VA/imbalance flags must not be reused as OF7 calculations.

The chart cache has no complete source/session/finality/version provenance and
is unsuitable as the sole ML ground truth. Raw ticks retain source and side
metadata and can underpin a later separate capture/replay path. Minute history
ladder recovery can reconstruct final bars but cannot recover intrabar signal
appearance, disappearance, or historical observation times.

External BOS/CHoCH already exists in `backend/app/engines/smc_external.py` and
uses closed-bar close-through. Pivots become confirmed later than their own
timestamp: the ML trigger must use event availability time, not backdate to the
pivot. Future labels must be separate from observation features. The next ML
design discussion should specify event windows, continuation/rejection/unclear
outcomes, first-passage ordering, transaction costs, and chronological testing
with overlapping-window separation. Auto-entry remains a later execution layer.

## Windows versus Oracle: measured assessment

Read-only checks on 2026-10-25 found:

| Host | Observed resources | Suitable role now |
|---|---|---|
| Windows | 4 logical CPUs, about 8 GiB RAM, virtual/basic display, no CUDA GPU evidenced | OF7/NinjaTrader reference replay and development; existing MT5 execution |
| Oracle | aarch64, 1 CPU, 5903 MiB RAM, about 5270 MiB available; 86 GiB disk free; load 0.00 at sample | Rithmic collection and light inference after readiness/retention validation |

Oracle nttotv, Caddy and sample-app services were active. This was not a market
data readiness or latency test. No Admin/config/credential/environment reads
were performed. Resources and load are a point-in-time observation, not a
training benchmark. The Oracle source currently defaults raw retention to two
days; runtime settings were not read. Review storage/retention before collecting
a training corpus. Windows runtime is documented with 90-day raw retention.

Start validation on Windows, where the reference DLL and NinjaTrader already
exist. Keep training out of the live backend process. Oracle's one CPU is a
constraint for large training/search workloads; lightweight models may be
trained in an isolated process with resource limits after benchmarking, or on
a separate larger machine. Port the same validated Python core to Oracle later
to keep feature semantics identical during collection and inference.

Primary supporting references:

- OF7 vendor guide: https://www.oft7.com/version7/OFT7UserGuide.pdf
- Oracle ARM compute: https://docs.oracle.com/en-us/iaas/Content/Compute/References/arm.htm
- Chronological validation: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html
