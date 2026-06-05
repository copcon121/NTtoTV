# Implementation Plan: GC Chart Platform

## Overview

This plan converts the design into incremental, code-only steps across three tiers: the NinjaTrader 8 C# **NT_AddOn**, the Python **FastAPI Backend**, and the Vite + React + TypeScript **Frontend**. Work proceeds in the priority order set by the requirements and design — core chart first, then order-flow indicators (VolumeDelta, Footprint, BigTrade), then alerts — and ends by wiring the full ingest → engines → registry → frontend pipeline together so no code is left orphaned.

Property-based tests (one per design property, Properties 1–31) use Hypothesis (Python), fast-check (TypeScript), and FsCheck/CsCheck (C#) at >= 100 iterations each, and are tagged `Feature: gc-chart-platform, Property {n}`. Test sub-tasks are marked optional with `*`.

## Tasks

- [x] 1. Set up project structure and tooling for all three tiers
  - [x] 1.1 Scaffold the Python Backend project
    - Create the FastAPI app skeleton, package layout (`ingest`, `storage`, `engines`, `registry`, `rest`, `models`), entrypoint, and dependency manifest (FastAPI, uvicorn, websockets)
    - Add the Hypothesis test framework and a `tests/` layout with a property-test tag convention
    - _Requirements: 4.1, 5.1_
  - [x] 1.2 Scaffold the Frontend project
    - Initialize Vite + React + TypeScript, install Lightweight Charts and fast-check, and create the module folder layout (`chart`, `socket`, `cache`, `footprint`, `alerts`, `status`)
    - Add a test runner configured for fast-check property tests
    - _Requirements: 19.1, 19.2_
  - [x] 1.3 Scaffold the NT_AddOn project
    - Create the NinjaTrader 8 C# AddOn project skeleton with the configuration model (candidate contract list, backend host/port, queue capacity, critical-overload threshold, compression flag, manual override)
    - Add the FsCheck/CsCheck property-test project
    - _Requirements: 1.5_

- [x] 2. Implement canonical data models and WebSocket message schemas
  - [x] 2.1 Implement Backend canonical models and timestamp helpers
    - Define `NormalizedTrade`, `NormalizedQuote`, `Side`, and the `Canonical_Timestamp` helpers (ms-since-epoch UTC conversions and comparisons)
    - _Requirements: 1.1, 1.2_
  - [x]* 2.2 Write unit tests for canonical models and timestamp helpers
    - Cover ms/UTC conversions, boundary values, and equality used by merge/parity logic
    - _Requirements: 1.1, 1.2_
  - [x] 2.3 Implement WebSocket message schema definitions
    - Define typed serializers/deserializers for all `/ws/nt` and `/ws/chart` message types (trade, quote, status, control, subscribe/unsubscribe, pong, bar_update, quote_update, volume_delta_update, footprint_update, big_trade, alert_event, ping)
    - _Requirements: 1.1, 1.2, 5.2_
  - [x]* 2.4 Write unit tests for event-type schema serialization
    - Round-trip each `/ws/chart` event type and the `/ws/nt` data/control/status messages against the documented JSON shapes
    - _Requirements: 5.2_

- [x] 3. Implement the SQLite storage layer (Tick_Store + Cache_Store)
  - [x] 3.1 Implement Cache_Store schema and WAL connection management
    - Create `data/app.sqlite` with the `metadata`, `stream_gaps`, `bars`, `orderflow_volume_delta`, `footprint_bars`, `footprint_levels`, `big_trades`, `alerts`, and `alert_events` tables; enable WAL; provide a single-writer abstraction with busy_timeout retry
    - _Requirements: 7.3, 8.1_
  - [x] 3.2 Implement Tick_Store day-sharded writer and shard-path resolution
    - Create per-contract day shards at `data/ticks/GC/<contract>/YYYY-MM-DD.sqlite` (sanitized contract dir) with `ticks` and `quotes` tables in WAL mode; implement `record_trade`, `record_quote`, `read_range`, and the pure `shard_path(contract, day)` function
    - _Requirements: 7.1, 7.2, 7.3, 8.5_
  - [x]* 3.3 Write property test for Tick_Store shard path
    - **Property 11: Tick_Store shard path is a pure function of contract and UTC day**
    - **Validates: Requirements 7.1**
  - [x] 3.4 Implement shard retention purge
    - Implement `purge_expired` to delete shard files older than 90 days (whole-file delete, idempotent, never today's shard) and log each removal
    - _Requirements: 7.4, 7.5_
  - [x]* 3.5 Write property test for shard retention
    - **Property 12: Shard retention keeps shards within 90 days and deletes older ones**
    - **Validates: Requirements 7.4, 7.5**
  - [x] 3.6 Implement keyed upsert for bars and order-flow summaries
    - Implement last-write-wins upserts keyed by `(symbol, contract, timeframe, time)` for bars and order-flow tables, plus keyed range reads
    - _Requirements: 8.2, 8.3, 8.4_
  - [x]* 3.7 Write property test for keyed upserts
    - **Property 13: Bars and order-flow upserts are keyed and last-write-wins**
    - **Validates: Requirements 8.2**
  - [x]* 3.8 Write smoke tests for storage setup
    - Assert tick shards contain `ticks` and `quotes` tables, WAL is enabled on both databases, and the Cache_Store contains all expected tables
    - _Requirements: 7.2, 7.3, 8.1_

- [x] 4. Implement the NT_AddOn data-capture pipeline
  - [x] 4.1 Implement market-data normalization and contract tagging
    - Normalize Level 1 trade and quote callbacks into the trade/quote message shapes, tagging each event with its originating Candidate_Contract; keep the callback to normalize + enqueue only (no IO/serialization)
    - _Requirements: 1.1, 1.2, 1.6, 2.1, 2.3_
  - [x]* 4.2 Write property test for contract tagging
    - **Property 2: Forwarded events are tagged with their originating contract**
    - **Validates: Requirements 1.6**
  - [x] 4.3 Implement per-stream monotonic sequence assignment
    - Assign monotonically increasing sequences per Stream `(symbol, contract, channel)`, independent across streams
    - _Requirements: 1.3_
  - [x]* 4.4 Write property test for sequence assignment
    - **Property 1: Per-stream sequence assignment is strictly monotonic**
    - **Validates: Requirements 1.3**
  - [x] 4.5 Implement the Bounded_Queue
    - Implement the fixed-capacity thread-safe queue: retain trades below the critical-overload threshold, coalesce latest-quote-wins at capacity, and log every dropped trade (stream, sequence, timestamp)
    - _Requirements: 2.4, 2.5, 2.6_
  - [x]* 4.6 Write property test for the Bounded_Queue
    - **Property 3: Bounded_Queue retains trades under threshold, coalesces quotes at capacity, and logs trade drops**
    - **Validates: Requirements 2.4, 2.5, 2.6**
  - [x] 4.7 Implement the background sender worker
    - Implement the consumer worker that dequeues, serializes, optionally compresses, and transmits over the WebSocket client to `ws://127.0.0.1:<port>/ws/nt`, off the NinjaTrader UI/Dispatcher threads, with fault-tolerant catch/log
    - _Requirements: 1.4, 2.2_
  - [x] 4.8 Implement the reconnect loop with Fibonacci backoff
    - Implement reconnect using Fibonacci delays (1s,1s,2s,3s,5s,8s,…) with randomized jitter, capped at 60s, cancellation-aware
    - _Requirements: 3.1, 3.2, 3.3_
  - [x]* 4.9 Write property test for reconnect backoff
    - **Property 4: Reconnect backoff is Fibonacci-based, jittered within bounds, and capped at 60s**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [x] 4.10 Implement control-command handling and status emission
    - On start subscribe to all Candidate_Contracts; handle subscribe/unsubscribe Control_Commands to adjust Level 1 subscriptions; emit connected/degraded/disconnected status events
    - _Requirements: 1.5, 1.7, 1.8, 3.4, 20.1_

- [x] 5. Checkpoint - data-capture and storage foundations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Backend ingestion and sequence validation
  - [x] 6.1 Implement the `/ws/nt` ingestion endpoint
    - Accept the NT_AddOn connection, receive trade/quote/status/heartbeat frames, and provide an outbound `send_control` channel; refresh `last_seen` on every received frame
    - _Requirements: 4.1, 4.7_
  - [x] 6.2 Implement the sequence validator
    - Implement per-Stream dedup (discard already-processed), out-of-order discard, accept-and-advance on highest+1, and gap detection (record one Stream_Gap with gap_from/gap_to/missing, mark non-contiguous, advance highest) writing to the `stream_gaps` table and `metadata`
    - _Requirements: 1.3, 4.2, 4.3, 4.4_
  - [x]* 6.3 Write property test for the sequence validator
    - **Property 5: Sequence validator deduplicates, drops out-of-order, and detects gaps**
    - **Validates: Requirements 1.3, 4.2, 4.3, 4.4**
  - [x] 6.4 Wire raw tick recording before throttling
    - Record every accepted trade to the Tick_Store (and quotes) immediately on ingestion, before any UI throttling, and emit a degraded status to subscribed clients on gap detection
    - _Requirements: 4.4, 4.5_
  - [x]* 6.5 Write property test for tick recording ordering
    - **Property 6: Every accepted trade is recorded before throttling**
    - **Validates: Requirements 4.5**
  - [x] 6.6 Implement the NT connection liveness watchdog
    - Implement the 15s status-timeout watchdog on `/ws/nt`: when no data/status/heartbeat arrives within 15s, emit one `disconnected` status to subscribed clients and release the connection resources
    - _Requirements: 4.7, 4.8, 20.2_
  - [x]* 6.7 Write property test for the connection watchdog
    - **Property 31: NT_AddOn connection times out as disconnected after 15s of silence**
    - **Validates: Requirements 4.7, 4.8**

- [x] 7. Implement the Bar_Aggregator
  - [x] 7.1 Implement OHLCV bucketization and bar updates
    - Aggregate Active_Contract trades into bars for 1m,3m,5m,15m,30m,1h,4h,1D; floor intraday TFs to interval multiples and 1D to the UTC calendar day from the Canonical_Timestamp; update the current bar per TF and produce bar_update outputs (with `closed` flag)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x]* 7.2 Write property test for OHLCV aggregation invariants
    - **Property 14: OHLCV bars satisfy aggregation invariants and correct bucketization**
    - **Validates: Requirements 9.1, 9.4, 9.5**
  - [x]* 7.3 Write property test for timeframe roll-up consistency
    - **Property 15: Coarser timeframes are consistent roll-ups of finer ones**
    - **Validates: Requirements 9.2**

- [x] 8. Implement the WebSocket_Registry and streaming
  - [x] 8.1 Implement client registration and subscription management
    - Register `/ws/chart` clients, track per-client `(symbol, event_types)` subscriptions, and handle subscribe/unsubscribe requests
    - _Requirements: 5.1, 5.4, 5.5_
  - [x]* 8.2 Write property test for subscription round-trip
    - **Property 8: Clients receive only their subscribed event types (subscribe/unsubscribe round-trip)**
    - **Validates: Requirements 5.1, 5.4, 5.5**
  - [x] 8.3 Implement the throttled coalescing flush loop
    - Coalesce queued outbound events by `(type, symbol, key)` and flush every 100–125ms against an injectable clock, emitting only the latest state per key
    - _Requirements: 5.2, 5.3_
  - [x]* 8.4 Write property test for throttling and coalescing
    - **Property 9: UI streaming and footprint redraws are throttled within 100–125ms with coalescing**
    - **Validates: Requirements 5.3, 14.8**
  - [x] 8.5 Implement heartbeat and per-client broadcast isolation
    - Send ping every 30s, close clients with no pong within 60s, and wrap each client send in try/except so one failure removes only that client and never aborts the broadcast
    - _Requirements: 6.1, 6.3, 6.4_
  - [x]* 8.6 Write property test for broadcast isolation
    - **Property 10: Broadcast failures are isolated per client**
    - **Validates: Requirements 6.4**

- [x] 9. Implement the Contract_Resolver and control plane
  - [x] 9.1 Implement contract resolution scoring and override
    - Score candidates over a recent window from trade volume + quote activity, select the Active_Contract with the documented tie-break, honor manual override (disabling auto), never synthesize a continuous contract, and compute the needed-contract set
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x]* 9.2 Write property test for contract resolution
    - **Property 21: Contract resolution selects a real candidate, honoring override**
    - **Validates: Requirements 10.2, 10.4, 10.5**
  - [x] 9.3 Wire needed-contract changes to Control_Commands
    - Emit exactly one subscribe per added contract and one unsubscribe per removed contract over `/ws/nt`, and no commands when the set is unchanged; broadcast Active_Contract/status changes to clients
    - _Requirements: 1.7, 1.8, 4.6, 20.1_
  - [x]* 9.4 Write property test for control-command emission
    - **Property 7: Control_Commands equal the change in the needed-contract set**
    - **Validates: Requirements 4.6, 1.7, 1.8**

- [x] 10. Implement the core REST API (symbols, contracts, history)
  - [x] 10.1 Implement symbols/contracts/active endpoints and error envelope
    - Implement `GET /api/symbols`, `GET /api/contracts`, `POST /api/contracts/active`, and the shared error envelope with status/code/field mapping (400/404/409/422/500)
    - _Requirements: 18.1, 18.2, 18.3, 18.12_
  - [x] 10.2 Implement the history endpoint
    - Implement `GET /api/history` reading the most recent up-to-5,000 precomputed bars (`source:"cache"`) with the optional `contract` defaulting to the Active_Contract, and the rebuild path from Tick_Store (`source:"rebuild"`)
    - _Requirements: 11.4, 11.5, 18.4_
  - [x]* 10.3 Write property test for history cache cap
    - **Property 23: History cache returns the most recent bars up to the 5,000 cap**
    - **Validates: Requirements 11.4**
  - [x]* 10.4 Write property test for unknown-identifier error responses
    - **Property 27: Unknown identifiers produce a descriptive error response**
    - **Validates: Requirements 18.12**

- [x] 11. Checkpoint - backend core pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement the Frontend core chart
  - [x] 12.1 Implement the ChartSocket client
    - Connect to `/ws/chart`, send subscribe/unsubscribe, and respond to ping with pong
    - _Requirements: 5.4, 5.5, 6.2, 11.2_
  - [x] 12.2 Implement the HistoryLoader and MemoryCache
    - Fetch initial REST history then subscribe to realtime updates; store per-`(symbol, contract, timeframe)` bars with covered range for immediate render and <300ms switches
    - _Requirements: 11.1, 11.2, 12.1, 12.2_
  - [x] 12.3 Implement the ChartContainer and incremental series reducer
    - Render candle + volume series with Lightweight Charts; apply bar_update via incremental `update()` (append new bars in time order, overwrite in-progress bar by time key) with no full-data replacement; avoid repaints when inputs are unchanged
    - _Requirements: 11.3, 12.4, 19.1, 19.2_
  - [x]* 12.4 Write property test for incremental bar merge
    - **Property 22: Incremental bar updates merge without full replacement**
    - **Validates: Requirements 11.3**
  - [x] 12.5 Implement the RangePatcher
    - Compute missing sub-ranges for a requested range, background-fetch and patch them, producing a sorted, duplicate-free, gap-free series over the union of coverage and request
    - _Requirements: 12.3_
  - [x]* 12.6 Write property test for missing-range patching
    - **Property 24: Missing-range patching yields a contiguous, duplicate-free series**
    - **Validates: Requirements 12.3**
  - [x] 12.7 Implement layout chrome and status/crosshair UI
    - Implement Toolbar, TimeframeSelector, SymbolContractLabel (GC + resolved contract), CrosshairBox OHLCV readout, and the connected/degraded/disconnected StatusIndicator
    - _Requirements: 10.1, 10.3, 19.1, 19.5, 20.3_

- [x] 13. Checkpoint - core chart end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement the VolumeDelta indicator
  - [x] 14.1 Implement the VolumeDelta_Engine
    - Classify trades by the ordered rule set (bid/ask lean → uptick/downtick fallback → last-side reuse) and compute per-bar volume, buyVolume, sellVolume, delta, deltaHigh, deltaLow, openDelta, closeDelta; support Delta and CumulativeDelta modes with min_trade_size=0 default
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_
  - [x]* 14.2 Write property test for VolumeDelta classification
    - **Property 16: VolumeDelta classification conforms to the ordered rule set**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5**
  - [x]* 14.3 Write property test for VolumeDelta per-bar metrics
    - **Property 17: VolumeDelta per-bar metrics are conserved (including cumulative mode)**
    - **Validates: Requirements 13.1, 13.7**
  - [x] 14.4 Wire VolumeDelta REST, streaming, and Frontend rendering
    - Persist per-bar summaries, serve `GET /api/orderflow/volume-delta` (optional contract defaulting to Active_Contract), emit volume_delta_update, and render the VolumeDelta series in the Frontend IndicatorLayer
    - _Requirements: 5.2, 18.5, 19.2_

- [x] 15. Implement the Footprint indicator
  - [x] 15.1 Implement the Footprint_Engine
    - Build the M1 bid-by-ask ladder per price level and compute POC, bar delta, buy%/sell%, per-level imbalance (ImbalancePercent=100, ImbalanceMinVolume=10), Stacked_Imbalance (>=2 consecutive same-side), and unfinished auction, with defaults GroupTicksPerLevel=0, DeltaCalculationMode=BidAsk, TradeVolumeFilter=0
    - _Requirements: 14.1, 14.3, 14.4, 14.5, 14.10_
  - [x]* 15.2 Write property test for the Footprint ladder and metrics
    - **Property 18: Footprint ladder is conserved and its metrics follow their definitions**
    - **Validates: Requirements 14.3, 14.4, 14.10**
  - [x] 15.3 Wire Footprint REST and streaming
    - Persist footprint bars/levels, serve `GET /api/orderflow/footprint` (optional contract defaulting to Active_Contract, count default 3), and emit footprint_update
    - _Requirements: 5.2, 18.6_
  - [x] 15.4 Implement the FootprintCanvas layer
    - Render the last 3 live M1 footprint bars on a separate `<canvas>` synced to the chart scales; redraw only on data/price-scale/layout change and retain otherwise; throttle redraws to 100–125ms
    - _Requirements: 14.2, 14.6, 14.7, 14.8, 19.4_
  - [x]* 15.5 Write property test for footprint display selection
    - **Property 19: Footprint display selects exactly the last 3 M1 bars**
    - **Validates: Requirements 14.2**

- [x] 16. Implement the BigTrade indicator
  - [x] 16.1 Implement the BigTrade_Engine
    - Reconstruct the tape in simple mode, merge trades sharing `(canonical_ts_ms, side)` (sum volume, last price), and apply the volume filter (VolumeFilterEnable=true, MinVolume=30, MaxVolume=-1)
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  - [x]* 16.2 Write property test for BigTrade merge and filter
    - **Property 20: BigTrade merge is deterministic and the volume filter governs emission**
    - **Validates: Requirements 15.2, 15.4**
  - [x] 16.3 Wire BigTrade REST, streaming, and Frontend rendering
    - Persist big trades, serve `GET /api/big-trades` (optional contract defaulting to Active_Contract), emit big_trade, and draw bubbles sized to the visible max volume with a volume label
    - _Requirements: 5.2, 15.5, 18.7_

- [x] 17. Checkpoint - order-flow indicators
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Implement Alerts
  - [x] 18.1 Implement alert CRUD and persistence
    - Implement `GET/POST /api/alerts`, `PATCH /api/alerts/{id}`, `DELETE /api/alerts/{id}` persisting to the Cache_Store, supporting all six alert types and enable/disable
    - _Requirements: 16.1, 16.2, 16.3, 18.8, 18.9, 18.10, 18.11_
  - [x]* 18.2 Write property test for alert CRUD round-trip
    - **Property 25: Alert CRUD round-trips through the Cache_Store**
    - **Validates: Requirements 16.2, 16.3, 18.10**
  - [x] 18.3 Implement the Alert_Engine evaluation
    - Evaluate enabled alerts server-side with correct price sources (last trade price for crosses; closed-bar close for bar-close types), fire-once + re-arm state, emit alert_event, and persist alert-event records
    - _Requirements: 16.4, 16.6, 16.7, 17.1, 17.2, 17.3, 17.5, 17.6, 17.7, 17.8_
  - [x]* 18.4 Write property test for alert evaluation semantics
    - **Property 26: Alert evaluation respects enablement, condition semantics, price source, and fire-once + re-arm**
    - **Validates: Requirements 16.4, 16.6, 16.7, 17.1, 17.2, 17.3, 17.5, 17.6, 17.7, 17.8**
  - [x] 18.5 Implement the Frontend AlertPanel
    - Render alert lines and enable/disable/delete controls; on alert_event show a toast, play a sound, and append to the event log
    - _Requirements: 16.5, 17.4_

- [x] 19. Implement reference-indicator parity
  - [x] 19.1 Implement the replay harness and fixtures loader
    - Build a deterministic replay driver that feeds recorded event streams (identical ordering, bid/ask snapshot state, ms-precision timestamps) into the engines and loads paired reference-output fixtures as oracles
    - _Requirements: 13.8, 14.9, 15.6_
  - [x]* 19.2 Write property test for VolumeDelta parity
    - **Property 28: VolumeDelta parity with MyVolumeDelta under identical replay**
    - **Validates: Requirements 13.8**
  - [x]* 19.3 Write property test for Footprint parity
    - **Property 29: Footprint parity with MzFootprintClone under identical replay**
    - **Validates: Requirements 14.9**
  - [x]* 19.4 Write property test for BigTrade parity
    - **Property 30: BigTrade parity with BigTradeIndicator under identical replay**
    - **Validates: Requirements 15.6**

- [x] 20. Integration and final wiring
  - [x] 20.1 Wire the full ingest → engines → registry → frontend pipeline
    - Connect the `/ws/nt` validator to the Tick_Store, Bar_Aggregator, order-flow engines, Contract_Resolver, and Alert_Engine; route all engine outputs through the WebSocket_Registry to `/ws/chart`; forward NT status events to clients
    - _Requirements: 4.4, 9.3, 20.1, 20.2, 20.3_
  - [x]* 20.2 Write integration tests for transport wiring and control plane
    - Cover `/ws/nt` accept + receive, NT startup subscribing to all candidates, subscribe/unsubscribe Control_Commands changing NT subscriptions, rebuild reading from the Tick_Store, and status forwarding/disconnected emission
    - _Requirements: 1.4, 1.5, 1.7, 1.8, 4.1, 8.5, 20.1, 20.2_

- [x] 21. Final checkpoint - full pipeline
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific granular requirement clauses for traceability.
- Property-based tests implement Properties 1–31 from the design (one test per property), run at >= 100 iterations, and are tagged `Feature: gc-chart-platform, Property {n}`. Parity properties (28–30) run only against recorded replay fixtures, never live streams.
- Unit, integration, and smoke tests complement the property tests for normalization mapping, schema serialization, UI behaviors, routing, latency checks, and config defaults as described in the design Testing Strategy.
- Checkpoints (tasks 5, 11, 13, 17, 21) provide incremental validation points.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "4.1", "4.3", "4.5"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "3.2", "4.2", "4.4", "4.6", "4.7", "4.8", "4.10"] },
    { "id": 3, "tasks": ["2.4", "3.3", "3.4", "3.6", "4.9", "6.1", "7.1", "9.1"] },
    { "id": 4, "tasks": ["3.5", "3.7", "3.8", "6.2", "7.2", "7.3", "9.2", "10.1"] },
    { "id": 5, "tasks": ["6.3", "6.4", "8.1", "10.2", "12.1", "12.2"] },
    { "id": 6, "tasks": ["6.5", "6.6", "8.2", "8.3", "8.5", "10.3", "10.4", "12.3", "12.7"] },
    { "id": 7, "tasks": ["6.7", "8.4", "8.6", "9.3", "12.4", "12.5"] },
    { "id": 8, "tasks": ["9.4", "12.6", "14.1", "15.1", "16.1"] },
    { "id": 9, "tasks": ["14.2", "14.3", "15.2", "16.2"] },
    { "id": 10, "tasks": ["14.4", "15.3", "15.4", "16.3"] },
    { "id": 11, "tasks": ["15.5", "18.1"] },
    { "id": 12, "tasks": ["18.2", "18.3"] },
    { "id": 13, "tasks": ["18.4", "18.5", "19.1"] },
    { "id": 14, "tasks": ["19.2", "19.3", "19.4"] },
    { "id": 15, "tasks": ["20.1"] },
    { "id": 16, "tasks": ["20.2"] }
  ]
}
```
