# Bookmap Stops & Icebergs On-Chart: local static analysis

Analysis date: 2026-10-27 (Asia/Bangkok). Scope: local installed/loaded JARs,
passive process/window metadata, and narrowly selected technical log lines.
No runtime settings, licenses, credentials, or application files were changed.

## Identity and runtime evidence

The running Bookmap process was PID 11164, executable
`C:\Program Files\Bookmap\Bookmap.exe`.

Current log `C:\Bookmap\Logs\log_20261026_213006_331-common.txt`:

- Line 734: loads `C:\Users\Administrator\Desktop\stops-icebergs-on-chart-1.05.jar`,
  class `velox.indicators.sionchart.SitIndicator`, `addToLayers: true`,
  2026-10-27 13:16:51 UTC (20:16:51 Bangkok).
- Line 735: strategies dialog reports the module `true`.
- Lines 738-744: historical/catchup stream for
  `custom.velox.indicators.sionchart.SitIndicator#AAPL@DXFEED`.

Live window titles observed earlier were `AAPL        Bookmap` and
`Configure add-ons (AAPL@DXFEED)`. This establishes the addon was enabled on
AAPL; it does not establish that GC was open or that the feed supplied usable
MBO identifiers. A module-enabled log is not evidence of successful detections.

Artifact SHA256:

| Local JAR | SHA256 | Role |
| --- | --- | --- |
| `stops-icebergs-on-chart-1.05.jar` | `173460b4764d1c99127107bf6bd817fbcbd2c72664a81120311dbc3aadcc0c8a` | Actually loaded |
| `stops-icebergs-on-chart-1.17.jar` | `6e09b1935e5f5a66aa4b28f2a45fc867e0b9b3c6a2184ca5be13ced4e4f7eb20` | Available comparison; not established as loaded |

## Method and evidence boundary

The root investigation owns the REA session. This independent branch used
execution-free ZIP reads, CFR 0.152 decompilation, and JDK `javap -p -c -s`.
Decompiled source is reconstructed pseudocode, not original source. CFR renames
case-conflicting classes (for example `B` becomes `b_0`) on this Windows host.
Critical detector conditions and the 1.17 broadcast limitation were checked
against bytecode. There are no REA Evidence IDs for these supplemental shell
observations; their authority is the identified JAR bytes and saved disassembly.

## Observed detection pipeline in active 1.05

`decompiled/velox/indicators/sionchart/SitIndicator.java:157`:

1. Checks compatible Bookmap version, then queries
   `TargetedRequestHelper.getSupportedFeaturesForAlias(...).mbo` (line 162).
2. If unavailable, shows `No MBO data` and the instruction to disable data
   aggregation (lines 167-171).
3. Registers MBO, trade, time, and historical listeners (lines 180-192).
4. Listener order is all-order accounting, detected-iceberg accounting,
   detector callbacks, then stop-chain accounting (lines 184-188).

This is a local detector, not merely a consumer of provider iceberg events.
It consumes MBO order identities and execution order, rather than an explicit
`isIceberg` or `isStop` field supplied by an exchange.

### Iceberg condition

`decompiled/a/a/b/a/a/a.java` is the core detector:

- `send(orderId, side, price, displayedSize)`, line 61: stores a fresh visible
  remainder and clears its one-time detected flag.
- `onTrade`, line 37: for a positive-size trade, finds the tracked passive
  order by `TradeInfo.passiveOrderId` and subtracts executed quantity.
- Line 48: calls the iceberg callback once when this remainder becomes
  **strictly negative**, meaning the same order ID executed more than its
  most recently advertised visible quantity.
- `replace`, line 66: also calls the iceberg callback when an undetected
  order's preceding remainder equals **zero**, then adopts the replacement
  size. This recognizes replenishment under the same ID after its displayed
  tranche has been exhausted.
- `cancel`, line 76: removes the order from the detector's active map.
- Missing/empty trade IDs normalize to string `0`; such normalization cannot
  reconstruct the missing per-order information.

Bytecode confirmation: `detector.javap.txt`, `onTrade` offsets 99-188,
particularly subtraction at 152-157 and callback at 171-188; `replace`
offsets 19-55, zero check at 27-32 and callback at 42-47.

Illustrative trace inferred directly from these conditions: an order advertises
10, executions consume 6 then 4, then a replacement for that same ID triggers
detection. Alternatively, executions consume 11 before a replacement, so the
remainder becomes -1 and detection occurs on that trade.

These observations support detection of same-ID replenishment/native-style
icebergs. The bounded detector contains no mechanism to link a sequence of
different order IDs into one synthetic iceberg and no predictor of the entire
unexecuted hidden reserve.

### Quantity and lifecycle

- `decompiled/velox/indicators/sionchart/g.java:19`: all-order trade accounting
  visits both aggressor and passive IDs when present.
- `.../h.java:41`: detection clones the current order accounting into the
  detected map, retaining executed volume from before detection.
- `.../l.java:27`: emits DETECTED with accumulated execution quantity.
- `.../l.java:42`: trades accumulate `o += size`, subtract the visible remainder,
  and append TRADE events. `a()` returns accumulated executed quantity (line 38).
- `.../a/n.java:41`: price changes append MOVED; nonzero replacements reset
  tracked displayed size/remainder.
- `.../a/n.java:57`: an order removal appends EXECUTED when remainder <= 0,
  otherwise CANCELED, and marks it inactive.

The displayed accumulated quantity is executed volume associated with the
identified order. It is not proof of its original full hidden size. CANCELED is
a classification derived from residual tracked quantity when MBO removal arrives.

### Stop-chain condition

- `decompiled/a/a/b/a/a/a.java:37`: remembers the first aggressor ID after the
  latest MBO send/replace/cancel. A later positive trade with a different
  aggressor ID starts a chain (`Consumer<Boolean>` receives true).
- The same class's `a()` at line 54 closes a started chain. Every MBO
  send/replace/cancel invokes this reset before its own update.
- `decompiled/velox/indicators/sionchart/b_0.java:61` (original class `B`):
  while that chain is active, appends STOP trades and aggregates executed size.
  The trigger trade is included because detector callback runs before this
  listener; the preceding first aggressor's trades are not retroactively added.
- `.../c_0.java:31`: accumulates chain quantity. `b()` at line 49 computes
  volume-weighted execution price. `c()` at line 64 tests whether the first
  and last trade prices differ.

Thus the stop label is inferred from matching-engine event sequencing. It is
not proof that every labeled aggressor was originally a stop order. Correct
unaggregated ordering and IDs are essential; bars, delta, or ordinary L2 level
totals are insufficient to reproduce this algorithm exactly.

### Filters and thresholds are downstream

- `decompiled/velox/indicators/sionchart/t.java:207`: active-iceberg threshold
  is optional (`applyThresholdToActive`).
- `.../t.java:242` and `:328`: executed/canceled iceberg display obeys the
  iceberg execution-volume threshold.
- `.../t.java:366`: stop display filters chain volume and the optional condition
  that the chain's first/last prices differ (`showOnlyStopsTBPL`).
- Nearby time/price icons may be visually aggregated; this does not discover
  a hidden parent order.
- `.../SitIndicator.java:727`: automatic iceberg threshold uses recent completed
  executed/canceled tracked orders, then `mean + multiplier * populationStdDev`,
  integer conversion, capped at sample maximum (lines 733-764). Empty samples
  reset the threshold to zero. Stop thresholds follow the same formula
  (lines 647-680). Refresh checks use a 60-second interval.

## Presentation follow-up for /lq

The active 1.05 rendering source was inspected separately for the user's
request to simplify presentation:

- `decompiled/velox/indicators/sionchart/d.java:20`: icon height defaults to 17.
  `showTotals=true`, `showLetters=false`, `showActive=true`; detection/trade
  event icons are disabled by default while execution/cancellation are shown.
- `.../SitIndicator.java:127`: iceberg BID and ASK both default to RGB 0,153,255.
- `.../t.java:433`: composes an iceberg icon and white quantity on a dark
  rounded background, scaled to the configured icon height.
- `.../t.java:201`: active icons use a canvas to the right of the timeline.
  Historical lifecycle segments and nearby visual aggregation are separate
  from detector identity/accounting.
- `.../b.java:178`: text generation includes totals and optional event letters.

The /lq implementation adopts compact blue glyph + numeric-total badges,
right-aligned active badges, thin order traces and hover details. Its own
canvas glyph replaces the addon bitmap; it does not bundle the inspected PNG.
Visual aggregation is restricted to nearby orders at the same price/side;
the underlying native detector and order states are unchanged.

Rendering unit tests and the production build passed. Browser screenshot
launch was blocked by tool policy, so no browser visual capture is claimed.

## Comparison with local 1.17

`v1.17-decompiled/velox/indicators/sionchart/SitIndicator.java:209` only admits
aliases ending `@RITHMIC` or `@Copy`, then checks `.mbo` at line 217. It registers
aggregate-depth notifications in addition to MBO/trades (lines 240-248).

Its core `v1.17-decompiled/a/a/b/a/a/a.java:41` retains the same negative-remainder
and zero-remainder replacement iceberg conditions. Changes observed:

- Detection starts only after a depth/MBO event has enabled the detector.
- `onDepth` also resets/ends the current chain (line 94).
- An opposite aggressor side during an already-started stop chain emits CANCEL
  and suppresses detection until the next depth event (lines 44-49).
- `.../e_0.java:146` discards the inconsistent chain and warns that stops and
  icebergs detection may be inaccurate.
- `.../SitIndicator.java:974` reacts to Bookmap's overload aggregation
  notification with a warning that aggregation may cause wrong detections.

### Broadcast caveat for future integration

Active 1.05 has no `broadcast` or `broadcasting` API members in its 112-entry
JAR inventory. Local 1.17 includes serializable Event/Snapshot/Subscribe classes,
but their presence is not evidence of a working stream in this particular file.

- `v1.17-decompiled/.../broadcast/Event.java:9` defines order ID, event type,
  nanosecond time carrier, integer price, event size, side, total executed size,
  and optional alias.
- `v1.17-decompiled/.../SitIndicator.java:992` contains a snapshot builder.
- Its live emitter `SitIndicator.a(k)` at line 1034 has no dispatch body.
  `v1.17-SitIndicator.javap.txt:3878` confirms it merely checks a subscriber list
  then returns at bytecode offset 12; no Consumer.accept is called.
- A bounded full decompile search found SubscribeMessage declarations but no
  inbound SubscribeMessage handler; `onUserMessage` only handles the aggregation
  notification described above.

Consequently, neither the active 1.05 nor the inspected local 1.17 establishes
a functioning supported event-export integration. Existing extracted 1.18 files
elsewhere in the project have not been equated with these JARs or analyzed in
this branch. A later official build with a working broadcast contract could be
a different integration option and must be verified against that exact build.

## Suitability inferences for GC integration

1. A separate GC MBO processor with stable passive/aggressor IDs and faithful
   order/trade sequencing can implement the observed mechanics independently.
2. Current normalized L1 trades, bars, delta, footprint, or aggregated L2 alone
   cannot reproduce same-ID iceberg detection or matching-sequence stop chains.
3. Compact detected events and lifecycle summaries can be stored/exported without
   keeping raw full-depth frames. They should retain source, contract, side,
   order identity (or stable internal key), confidence/method, execution quantity,
   and event time so reconnects and feed switches can be handled.
4. Label stop chains as inferred; label accumulated iceberg quantity as executed
   or minimum known quantity. Do not present an unknown hidden reserve as known.
5. Retain an independent price/volume heuristic for feeds without MBO only under
   a clearly separate confidence level; it does not recreate this detector.

These are design inferences, not changes made to the GC project. Runtime feed
quality, entitlement, actual GC MBO support, and live false-positive/negative
rates remain unverified.
