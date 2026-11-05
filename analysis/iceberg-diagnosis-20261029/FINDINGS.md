# LQ iceberg investigation and SI Stops review

Date: 2026-10-29, fixed UTC+7. Scope is the Windows direct Rithmic runtime.
Bookmap SI 2.08 is an algorithm reference, not the LQ data source. No Oracle
Admin settings, credentials, database rows, or connector settings were changed.

## What is confirmed

The displayed change is present in the compact API data, not just a tooltip.
A read-only capture at approximately 17:20 UTC+7 gave:

| Detection window, UTC+7 | Orders | Orders with refills | Latest statuses |
| --- | ---: | ---: | --- |
| Oct 28 19:00 to Oct 29 03:00 | 206 | 185 | 157 executed, 22 canceled, 27 invalidated |
| Oct 29 from 03:00 to capture | 39 | 0 | 37 invalidated, 1 executed, 1 active |

All 39 later orders were overfill detections. An observed zero refill count
is valid for an overfill; it is not by itself proof of a false detection.
These are latest observed states, not a reconstruction of state at alert time.

The morning SI port changed frontend filtering/aggregation. It did not switch
the backend to Bookmap events or change the two native confirmation conditions.
The separate 09:07 native-engine edit added trade-through invalidation: a later
trade below a BID iceberg or above an ASK iceberg ends its tracked identity
as invalidated, retaining observed quantity. A saved 09:13 repair also shortened
some retired traces to their first recorded crossing. This explains a concrete
new route to invalidated states, but cannot explain refills disappearing earlier.

SI 2.08 and our detector differed in lifecycle accounting: SI keeps a known order
through price moves; our detector discarded every price-changing candidate and
ignored later replacement IDs. This permanently lost ordinary moving candidates.
The repair starts a fresh baseline for a complete same-side reprice ONLY while
the order is undetected. Accumulated execution/refills reset to zero at the new
price. Already detected ICE still ends at its original price and cannot revive
through unknown CHANGE rows. This fixes tracking coverage without pretending
the single-price compact model implements SI's full movement history.

## Ingest defect repaired

Rithmic LastTrade carries executions and statistics. The normalizer previously
accepted any positive price/size even when presenceBits excluded LAST_TRADE,
or clearBits cleared it. It now rejects those frames before raw recording,
chart aggregation and iceberg execution accounting. Frames without a presence
mask retain compatibility; actual trade bit 1 can coexist with other flags.

Regression tests cover cached execution fields on volume/VWAP/clear frames and
preserve valid trade IDs/quantity. This is a real missing guard, but it has NOT
been established as the cause of the entire zero-refill period. Bounded stored
trade checks found no exact duplicate execution tuples.

Regression tests also cover repeated undetected reprices, fresh post-move refill
accounting, detected-ICE history preservation, and rejection of incomplete or
side-changing reprices. The latest focused engine/ingest/channel run passed84.

## What remains unproven

The current detector requires ordered trade/MBO input. A replay demonstrates a
false overfill if an absolute size reduction arrives before its older matching
trade: initial size10; MBO size6; older trade4; trade3. The current remainder
becomes negative after only7 observed executions, because4 was subtracted twice.
Stored raw ticks lack MBO events, so this condition cannot be proved or repaired
historically from existing shards. Source-nanosecond timing counters and one
compact latest overfill context were added for continued live verification.
No global timestamp sorting, refill fabrication, or terminal-state relabeling
was applied without evidence.

Unknown CHANGE/DELETE and growing book counts alone do not prove a damaged
Rithmic stream: the generic MBO book does not apply L1 executions. A one-time
read-only comparison with another authoritative snapshot showed disagreement,
but swapping NEW/DELETE did not resolve it. The supplied proto mapping was kept.
The temporary snapshot audit and raw update samples were removed from runtime.
Only compact diagnostic counters/latest contexts remain; raw MBO is not persisted.

## SI Stops

See [STOP-FINDINGS.md](STOP-FINDINGS.md) for original-bytecode evidence, causal
examples, input availability, filtering and a concrete replacement contract.

SI Stops infers same-side aggressive chains from aggressor-ID changes between
accepted depth/MBO boundaries. It is not the current decayed net-volume MV Stop.
The seed trade is excluded, the first different-ID trade starts accumulation,
same-side continuation adds quantity, a depth/MBO boundary completes the chain,
and opposite-side continuation cancels it. Persisting/alerting only completed
chains avoids retaining provisional live events canceled later.

Current Rithmic L1 supplies the needed IDs/side/source nanoseconds. Correct
accepted MBO/MBP boundaries are also required. Trade-only shards cannot recreate
historical SI Stops. The review proposes replacing only MV Stop markers/alerts,
preserving the independent MV line, Volume Spike and Absorption. No LQ stop UI
replacement or frontend deployment was made by this investigation.

## Supporting evidence

- [ADAPTER-FINDINGS.md](ADAPTER-FINDINGS.md): installed Bookmap adapter identity,
  REA evidence and live callback versus image reconciliation boundaries.
- [INGEST-FINDINGS.md](INGEST-FINDINGS.md): protocol/normalizer review, bounded
  raw-trade checks, and the conditional ordering replay.
- [STOP-FINDINGS.md](STOP-FINDINGS.md): SI stop-chain implementation and proposed
  compact model/settings for LQ integration.

The iceberg root cause is not claimed resolved. Live cross-stream ordering and
tracking coverage require further observation with the new diagnostics.

## Validation

- Focused engine, Rithmic normalizer/runtime/protocol and persistent ICE channel:
  84 passed after the final diagnostic correlation adjustments.
- Broader backend unit/integration run (`-m "not property"`): 1,244 passed,
  33 property tests deselected. One existing Starlette/httpx deprecation warning.
- Property suite: 33 passed with `GC_PBT_EXAMPLES=100`. The standard Windows
  Proactor runner stalled during `asyncio.run` executor shutdown in the existing
  tick-recording ordering property; using `WindowsSelectorEventLoopPolicy` in
  the test process completed it and the whole property suite. Production event
  loop configuration was not changed. Reproduce from `backend` with:

  ```powershell
  $env:GC_PBT_EXAMPLES = '100'
  .venv\Scripts\python.exe -c "import asyncio,pytest; asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy()); raise SystemExit(pytest.main(['-m','property','-q']))"
  ```

- Live backend health and public `/lq`: HTTP200; direct Rithmic connected and
  MBO/native ICE synchronized. The new reprice path was observed live through
  `candidate_repriced` counters. No return of positive refill counts is claimed.
- Standalone SI Stops reconstruction: 10 causal examples passed. This validates
  the independent reference model against the traced branches, not live addon
  output or an already integrated LQ replacement.
