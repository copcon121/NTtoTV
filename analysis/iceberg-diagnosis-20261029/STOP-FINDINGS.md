# SI 2.08 stops: exact mechanism and replacing the current MV Stop

Static inspection and a bounded read-only input-availability check on
2026-10-29, fixed UTC+7. No application code or runtime was changed for this
subtask. The mechanism is an inference from market-data event ordering, not
an exchange flag identifying every execution as a stop order.

## Artifact and verification boundary

Target:
`C:/Bookmap/API/Layer1ApiModules/7.4.0.1---7.7.1.9999---2---stops-icebergs-on-chart---2.08.jar`.
REA `open_binary` re-identified the same SHA-256 as the prior investigation:
`317e2a8b45e3290e2d4fd41a371e06f08f71b9f3c2fc1072f91b3eb682a215ab`.
The previous archive-inventory failure on Windows case-only class collisions
still applies; do not attribute the following algorithm findings to a
successful REA artifact graph. No native addon was executed.

Important branches were rechecked with Bookmap's existing `javap -p -c`
against ORIGINAL installed class bytes, saved here as:

- `si-stop-core-broadcast.javap.txt`: native detector `com.bookmap.a.a.a.a`,
  accepted-ID wrapper `velox.indicators.sionchart.b.p`, broadcast facade and
  historical data-structure wrapper.
- `si-stop-accounting.javap.txt`: original uppercase classes `E` and `G`,
  event `j`, `SitIndicator` listener wiring, and `StopEvent`.

The previously saved CFR files rename original `E` to `e_0` and `G` to `g_0`
because Windows filenames are case insensitive. Reconstructed Java is not
original source. Existing evidence under `analysis/si-2.08-20261029` remains
the source of the renderer/filter reconstruction.

## Listener order and accepted boundaries

`SitIndicator.java:72-84` and its original classfile method `a(b.s)` establish
trade listeners in this order: accumulated-order bookkeeping, iceberg
lifecycle bookkeeping, native detector, then stop accumulator `E`. Therefore
a START or CANCEL callback from the native detector changes accumulator state
BEFORE the current trade reaches `E.onTrade`.

MBO callbacks are wrapped by `b.p`: a new ID is forwarded only once; replace
is forwarded only for an existing ID; cancel only when removing an existing
ID. Unknown replacement/cancellation and duplicate new callbacks are dropped.
Both accepted MBO events and MBP depth callbacks are stop-chain boundaries.
An arbitrary raw R|Protocol message is not automatically an equivalent boundary.

The native detector receives all accepted MBO send/replace/cancel callbacks.
Its MBP `onDepth` is registered only when Stops are supported (`x`), as is the
stop accumulator. `x` excludes DXFEED/Cedro providers; this Rithmic target is
on the supported branch. Addon initialization also checks MBO availability.

## Native state machine

Source: `decompiled/com/bookmap/a/a/a/a.java:42-99`.
Original bytecode: `onTrade` offsets 0-180, `a(boolean)` offsets 0-43;
send/replace/cancel call `a(true)`, onDepth calls `a(false)`.

State is an armed flag plus an optional seed/active chain record:

1. Initially unarmed. Positive trades do not advance stop recognition.
2. Any accepted MBO send/replace/cancel ends an active chain if present,
   clears the seed/chain record, and sets armed=true.
3. The first positive trade while armed saves its normalized aggressor ID as
   the seed. Its volume is NOT a stop-chain execution.
4. Further trades with that same seed ID are also excluded until activation.
5. The first subsequent positive trade with a different aggressor ID sets
   active=true, remembers THIS trade's aggressor side, and emits START.
   The triggering trade IS included in the stop accumulator.
6. While active, every positive trade on the remembered side is included,
   regardless of whether its aggressor ID repeats, changes, or returns to the
   original seed ID. There is no continuing distinct-ID requirement.
7. While active, an opposite-side trade emits CANCEL, clears state and sets
   armed=false. That opposite trade is not included in the stop accumulator.
   Subsequent trades stay disabled until another accepted MBO callback.
8. Any MBP depth callback ends an active chain and clears its seed. It does
   NOT change the armed flag: it cannot rearm a detector disabled by CANCEL.

The seed trade's side is not saved or compared at activation. A BUY seed
followed by a different-ID SELL trade can therefore START a SELL chain. The
side-consistency guard applies only after activation.

Missing/empty IDs normalize to string `0` in the native detector. It does not
have a separate missing-ID rejection. This can make a known-to-missing ID
transition appear distinct; an independent strict missing-ID safety guard
would be an explicit adaptation rather than exact byte-for-byte semantics.

The core has NO elapsed-time window, minimum total volume, tick-distance
trigger, price monotonicity test, price-crossing condition, or execution-start/
execution-end flag test. Time callbacks update accounting time, not chain
expiry. Price/size filters and display aggregation occur later.

## Execution accounting, completion and alerts

`e_0.java:58-136` (original `E`) and `g_0.java:21-48` (original `G`):

- START creates an empty pending chain and enables accumulation.
- Each included execution creates a STOP event with the current provider
  timestamp, integer tick price, this trade's size, aggressor ID and side.
- Chain volume is the sum of included trade sizes, beginning at the triggering
  second-ID trade. The initiating seed executions are excluded.
- `j.f` is overwritten with the chain's cumulative volume after each addition.
- END disables accumulation and appends the chain to completed history. This
  is when the normal renderer/history can see it and alerts may fire.
- CANCEL disables accumulation and removes the pending chain from history;
  normally it has not yet been appended. SI also warns that MBO data is
  inconsistent. It does not retain this as an ordinary completed stop chain.
- A chain has no timeout completion. No future trade/time alone implicitly
  flushes it. A disconnect/gap policy is additional application behavior.
- The alert checks chain volume >= stop alert threshold, optional TBPL,
  enabled alert/popup/Telegram delivery, and current event time equal to the
  provider's current time (avoid replay/history alerts).
- Alert price is volume-weighted mean execution price. Alert side is aggressive
  BUY/SELL; it is NOT the passive BID/ASK side of an iceberg.
- TBPL means at least two INCLUDED executions and firstPrice != lastPrice.
  It is not a monotonic sweep or a configurable minimum range. It defaults off.

The completed chain's first/last execution timestamps, boundary completion
timestamp, and any later filtered-alert time should remain distinct. The
renderer uses the LAST included execution's time and price as its base icon
anchor; it does not anchor at the seed or at a candle's eventual extreme.

Original bytecode checked: `E.onTrade` offsets 86-127 (construct, accumulate,
broadcast), `E.b()` offsets 19-32 (retain), 76-166 (threshold/TBPL/realtime
alert), `E.c()` offsets 19-31 (remove); `G.a(j,boolean)` offsets 35-53 (total),
`G.a()` (VWAP), `G.b()` (first/last-price comparison).

## Broadcast is not the same thing as completed history

`E.onTrade -> m.a(j) -> BroadcastingApiFacade.sendEvent` emits every included
STOP execution immediately. `StopEvent` has orderId, time, price, size,
isBid, totalSize. For STOP:

- orderId is THIS execution's aggressor ID;
- size is THIS execution's size;
- totalSize is cumulative volume of the WHOLE current chain, not that ID's
  lifetime executed volume. Two different order IDs can carry successive
  cumulative totals for one chain.

There is no separate typed START/END/CANCEL or retraction in this StopEvent
interface. Live events already delivered before a later CANCEL are not
explicitly retracted. Historical `DataStructureInterfaceWrapper.getStops`
iterates only completed chains in `E.b`, so live and historical views can differ.
The threshold filter uses `getTotalSize >= stopsThreshold`.

For a durable LQ replacement, publishing completed chains and alerting only
at completion avoids making canceled provisional executions permanent. If
pending chains are exposed, give them an explicit provisional status and
terminal/invalidation update; do not present that as SI's original interface.

## Display and threshold layers

The stop renderer (`v.java:390-435`) filters each chain by its total and optional
TBPL, then optionally aggregates nearby same-side completed chains in screen
coordinates. `stopsAggThreshold` filters the visual aggregate separately.
Filtered icons can be hidden or faded. Aggregation does not make separate
chain identities one detected stop order. Optional displayed count is the
number of grouped CHAINS, not the number of distinct aggressor IDs.

Base marker is the chain's last execution. Group anchor uses chain-total
weighted price/time, with integer tick rounding in this implementation.
Display grouping depends on zoom/time and price area settings, not a physical
causal relationship. It must not drive detector state or alert deduplication.

Shipped defaults: individual/aggregate thresholds 0; auto off; stop alert
threshold 10 with alerts off; TBPL display/alert filters off; aggregation on;
icon height17 and filtered transparency85. These are source defaults, not
readings of the user's saved Bookmap settings.

Auto threshold samples completed chain totals in the preceding configured
interval (default60 minutes): truncate(mean + k * populationSD), capped at
largest sampled total, empty sample0; k defaults1. Display and alert auto
thresholds can be independent. This is a size filter, not stop confirmation.

## Causal trace examples (derived from static control flow)

`M` means an accepted MBO event; `D` means an MBP depth callback.
These examples were not executed against the licensed addon runtime.

| Ordered input | Result available at that point |
| --- | --- |
| M; A BUY5@100; A BUY3@100 | Seed A only, no stop volume |
| then B BUY2@100 | START; pending total2; first STOP live event total2 |
| then B BUY4@101; C BUY1@101 | Pending total7; live totals6 then7 |
| then D | Completed BUY chain7; base marker at C's timestamp/101; alert VWAP100.7142857 ticks if enabled and qualified |
| M; A BUY1; B BUY2; C SELL3 | Pending BUY2 is CANCELed; no completed chain; C excluded; rearm requires M |
| M; A BUY1; D; B BUY2 | D clears A; B becomes a new excluded seed; no chain |
| M; A BUY1; B SELL2; D | Completed SELL2; seed's BUY side does not block activation |
| M; A BUY1000; D | No stop chain despite high volume: aggressor ID never changed |
| M; A BUY1; B BUY1 at same price; D | Completed BUY1; valid without TBPL; hidden if TBPL-only enabled |
| M; A BUY1; long time-only gap; B BUY2 | START still possible if no MBO/MBP boundary intervened; no native timer cutoff |

The standalone `replay_si_stops.py` now makes these logical traces executable
as an independent reference processor. It also checks permissive null/empty
ID normalization, return to the original seed ID after START, round-trip
price endpoints for TBPL, positive-size gating, and all three accepted MBO
boundary actions. It uses no application imports, provider login, runtime
settings, databases, or network access. Completed summaries expose first/last
execution time, completion time/reason, last-price anchor, total volume and VWAP.
The accepted-MBO API deliberately expects upstream ID validation, separate from
the MBP depth API. Arithmetic models ordinary logical integer quantities; it
does not emulate Java integer overflow or licensed-addon runtime behavior.

Run from the repository root:

```powershell
backend\.venv\Scripts\python.exe analysis\iceberg-diagnosis-20261029\replay_si_stops.py
```

Verified output:

```text
SI Stops causal reference replay: 10 cases passed (independent model; addon not executed).
```

This verifies the causal model against the stated expectations, not against
captured Bookmap live events. It is preparation for a later LQ replacement;
no application integration or deployment is implied.

## Current MV Stop differs materially

Current source: `backend/app/engines/market_volume_stop.py`.

- `_DecayedVolume` accumulates separate aggressive buy/sell volume with
  exponential half-life (default60s). MV value is buy minus sell.
- Signal evaluation samples that net value every300ms.
- Immediate mode signals when magnitude exceeds side threshold; rearms below
  90% of threshold or on sign flip.
- Standard mode tracks a peak above threshold, signals after a 10% drop, and
  optionally suppresses repeated signals by pullback duration/tick distance.
  It anchors to the historical peak and labels detection at the later drop.
- Neither mode consumes aggressor IDs, accepted MBO events, or MBP boundaries.
  The old default levels500 therefore cannot be translated mechanically into
  a SI stop-chain executed-volume minimum.

The existing MV line, Volume Spike and Absorption are independent features of
the same combined engine. Replacing MV Stop markers does not inherently require
changing those calculations.

## Concrete replacement proposal for review (not implemented)

Replace only the MV Stop marker/alert/settings selection on LQ with a separate
SI-style stop-chain detector. Keep the Market Volume line, Volume Spike and
Absorption on their current calculation paths. Retire the old MV Stop markers
from the selected view; do not silently mix their history with chain detections.

The detector should be a small independent ordered-event processor owned by
the Rithmic service, alongside native ICE. Its inputs are synchronized accepted
MBO boundaries, effective MBP depth callbacks, positive classified trades,
and explicit reset/gap/disconnect events. Price/volume display filters should
not alter its core state transitions. The pipeline should persist/broadcast
compact completed chains, not raw depth or the full list of executions.

A stable compact chain record can use:

| Field | Meaning |
| --- | --- |
| id | sessionId + monotonic chain number; never timestamp alone |
| symbol / contract / sourceContract | GC / GC / actual expiry |
| source / method | rithmic / aggressor_chain (inferred mechanism) |
| sessionId / sequence | connector generation and monotonic update sequence |
| side | aggressive buy or sell |
| startTime | first included execution, which triggered START |
| endTime | last included execution; marker anchor time |
| completedTime | later MBO/MBP boundary that completed the chain |
| price / firstPrice / vwap | last, first and volume-weighted execution prices |
| executedVolume | total included execution quantity, excluding the seed |
| executionCount / aggressorCount | included executions / distinct included aggressor IDs; separate quantities |
| throughPriceLevels | at least2 included executions and firstPrice != lastPrice |
| status / endReason | completed+mbo/depth; reset/gap/disconnect invalidations are not ordinary completed stops |

Completed-only publication is the simplest default: one durable event and at
most one alert per chain. If showing live pending chains later becomes useful,
add explicit pending/completed/invalidated updates with the same chain ID and
sequence. Avoid deduplicating by aggressor ID because a single chain can span
several IDs and the same ID can occur in later chains. Store only compact
records with bounded retention consistent with the LQ history viewport.

Use a versioned `siStops` settings section, rather than interpreting existing
MV net-volume thresholds as stop quantities. A parity-oriented initial option
set is enabled; minimum executed volume0; aggregate minimum0; automatic size
threshold off; TBPL-only off; sound off; sound minimum10. These match inspected
SI source defaults, not tuned GC recommendations. Existing marker appearance
preferences can be retained separately from algorithm parameters. Optional
auto display/alert thresholds should remain separate and sample completed
chain totals using the inspected formula. Screen-space grouping is presentation
only; alert filtering and deduplication use physical completed chain identity.

The implementation review should explicitly choose whether to copy SI's
permissive missing-ID behavior or apply stricter input-quality guards. Document
any adaptation, preserve source/session isolation, and verify causal cases
above before changing the public LQ bundle. No UI/application integration,
configuration mutation, deploy or restart was performed in this analysis.

## Rithmic data readiness and remaining limits

`NormalizedTrade` already has side, aggressor_order_id, passive_order_id,
source_time_nanos and local ordered sequence. `RithmicMarketDataService`
normalizes Rithmic's aggressorExchangeOrderId/exchangeOrderId into these fields.
The Rithmic path leaves execution_start/end false; SI stop detection does not
require those flags, so they must not be invented as a replacement trigger.

A read-only sample of the last5min at epoch-ms1793268848421 contained163
Rithmic GC trades: aggressor ID163/163, side163/163, source nanos163/163,
passive ID162/163; execution_start/end true0; OTC true0. This establishes
current input availability, not end-to-end stop accuracy.

Implementing the independent detector is feasible with the existing direct
Rithmic service, but it must receive the ordered live stream BEFORE chart
throttling, with consistent symbol/contract and accepted MBO + MBP boundaries.
R|Protocol delivery can differ from Bookmap's native adapter callback order.
Unknown or inconsistent IDs, incomplete MBO, snapshots, reconnects and gaps
need explicit cancellation/readiness handling. Session/order identity must
never join across reconnects or expiries. Rejecting missing IDs/unknown side
and suppressing invalid snapshots is a documented safety adaptation.

Raw tick shards preserve trades and IDs, not the ordered raw MBO/MBP boundary
events required by this mechanism. Existing minute history repair also cannot
recreate them. Therefore old MV Stop markers or trade-only history cannot be
relabelled as historically reconstructed SI stops. Live shadow observation
against matched Bookmap feed/starting snapshot remains necessary to establish
equivalent detection and alert timing.
