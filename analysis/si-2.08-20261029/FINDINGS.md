# SI On-Chart 2.08 versus the current GC iceberg implementation

Analysis date: 2026-10-29, fixed UTC+7. Scope: the newly loaded local JAR,
previously analyzed SI 1.05/1.17, current application source, and a saved
read-only sample from the previous US display session. No application source,
addon settings, runtime configuration, or market data was changed in this
investigation.

The new build has useful filtering, rendering and integration improvements.
Its native confirmation conditions are still the overfill/depleted-tranche
replacement mechanism already used here. No dedicated sideways-market quality
filter was found in the traced detector/settings/threshold/render paths.
Reducing the application's clutter requires an attention/context layer as well
as size filtering; the detected passive side alone does not predict direction.

## Target identity and evidence boundary

- Loaded artifact: `C:\Bookmap\API\Layer1ApiModules\7.4.0.1---7.7.1.9999---2---stops-icebergs-on-chart---2.08.jar`.
- SHA-256: `317e2a8b45e3290e2d4fd41a371e06f08f71b9f3c2fc1072f91b3eb682a215ab`.
- Bookmap log: `C:\Bookmap\Logs\log_20261028_213006_263-common.txt`.
  Lines 752-753 identify download version 2.08; 755 unloads Desktop SI 1.05;
  758-760 identify the new download and the exact loaded artifact/entrypoint.
- The observed catchup alias in that log is AAPL@DXFEED. Loading the addon is
  established; successful GC MBO operation or an apples-to-apples live GC
  comparison is not established by those log lines.
- REA `open_binary` identified the original ZIP/JAR and the digest above.
  `inspect_artifact` failed on the case-only `B.class` / `b.class` collision on
  Windows. The full tool responses are saved in `rea-open.json` and
  `rea-artifact.json`. There is no successful REA archive graph or Evidence ID
  for the subsequent algorithm conclusions. The REA target was closed.
- Supplemental inspection read ZIP members without executing the addon and
  used existing CFR 0.152 plus Bookmap's `javap.exe -p -c` against ORIGINAL JAR
  bytes. CFR MD5 matched `8a85ada8cec494121246805a5562b82b`.
  Reconstructed Java is not original source; important branches were checked
  against saved bytecode. Case-sensitive class names must be taken from the
  JAR/disassembly, because CFR renames conflicts for Windows output.

## Native detection and accounting

`decompiled/velox/indicators/sionchart/SitIndicator.java:81-93` wires
`com.bookmap.a.a.a.a` as its native detector. That detector:

1. Tracks a displayed remainder by order ID on MBO send.
2. On a positive trade, subtracts the execution against the passive order ID;
   confirms once if the remainder becomes strictly negative.
3. On replace, confirms an undetected order if the old remainder equals zero.
4. Removes that detector identity on cancel.

Source: `decompiled/com/bookmap/a/a/a/a.java:42-98`.
Original-bytecode evidence: `native-detector.javap.txt`, onTrade offsets
185-267 (subtraction at 241, negative check at 246, callback at 267), replace
offsets 20-55 (zero check at 33, callback at 47).

The fundamental two native confirmation conditions match the SI 1.05/1.17
mechanism previously studied and our independently written detector. Zero
observed refills remain valid when confirmation was an overfill. There is no
reason to suppress all such orders to solve two-sided sideways activity.

The 2.08 detector also gates processing after MBO initialization and resets
stop-chain state after depth/MBO events; the stop-chain side-consistency guard
already appeared in the previously inspected 1.17. This is not a market-regime
filter. Our current detector instead has explicit synchronization/session,
side/price, sequence, contract and traded-through-identity safeguards.

Accounting remains distinct from detection. `l.java:31-58` retains accumulated
execution at detection and later trades; `b/n.java:44-69` tracks movement and
terminal execution/cancellation. Our implementation deliberately invalidates
an order that changes side/price rather than reconstructing its moved path.
Consequently the totals/lifecycles must be compared under matched feed,
starting snapshot and accounting semantics; static similarity is not evidence
of identical live outputs or better GC detection accuracy.

The JAR additionally packages a separate 50-ms cancel/new matching helper
(`com/bookmap/a/a/a/b.java`). The traced SI On-Chart entrypoint instantiates
the native `a` detector, not this helper. Its presence alone is not evidence
that synthetic iceberg joining is enabled in the user's SI instance.

## Filters: useful, but most already existed in 1.05

See `filter-evidence/FINDINGS.md` and its old/new original-classfile disassembly.

| Capability | SI 2.08 | Current GC application |
| --- | --- | --- |
| Individual executed-volume minimum | Yes | Fixed UTC+7 session minimum; source defaults US 10, other 5 |
| Adaptive size threshold | Yes; already in 1.05 | Not implemented |
| Separate threshold after visual aggregation | Yes; already in 1.05 | Not implemented |
| Filter active ICE by size | Optional | Applied by the same session volume filter |
| Select detection/trade/executed/canceled/active event visibility | Yes | Latest compact per-order state and detection-candle badge |
| Nearby screen-space price/time aggregation | Yes | Same price, side and detection candle, with compatible status |
| Dedicated trend/range/VWAP/price-rejection quality gate | Not found in traced paths | Not implemented |

Adaptive size is `int(mean + k * population_SD)`, capped at the largest sampled
order. The default sample interval is 60 MINUTES and k=1; recalculation is about
once per minute or when forced. Samples are completed execution/cancellation
orders selected by the enabled event types; active-only orders are excluded.
An empty sample resets the threshold to zero. This formula is unchanged from
the old 1.05 implementation, not a new 2.08 regime classifier.

Important constructor defaults in 2.08 are individual/aggregate thresholds 0,
automatic threshold off, show active on, apply-threshold-to-active off, and
show-filtered-icons on at 85% transparency. Thus merely installing 2.08 does
not activate a strong noise filter. These are shipped defaults, NOT a reading
of the user's saved runtime settings. SI's faded filtered icons also have a
different meaning from our 40%-opacity invalidated historical ICE badges.

Concrete rendering improvements versus 1.05:

- Filtered ACTIVE badges now honor the hide-filtered-icons setting. New
  `v.java:259-264`, original bytecode offsets 388-430; old `t.java:230-234`
  added the faded active badge without that skip.
- Historical grouping now checks absolute time distance. New `v.java:369`,
  `Math.abs(long)` at bytecode offset 400; old `t.java:337` used signed distance.
- Weighted aggregation guards zero total weight. These are display/arithmetic
  corrections, not a prediction that a remaining ICE will hold a price level.

## A substantive new integration path

Unlike the empty live emitter found in the previously inspected 1.17,
2.08 has a concrete typed broadcasting path:

`l` / `b.n` event creation -> `m.a(j)` ->
`BroadcastingApiFacade.sendEvent(alias,event)` ->
`LiveEventListener.giveEvent(wrappedEvent)`.

Evidence: `l.java:36-39,53-57`, `b/n.java:48-52,64-68`, `m.java:741-742`,
`broadcast/BroadcastingApiFacade.java:77-96`; original `broadcast.javap.txt:114-138`
contains the listener invocation at offset 57. Alias registration includes
event types, settings, a size filter and a data-structure/snapshot interface.
`broadcasting/implementations/ThresholdFilter.java:27-31` filters by total size.

This gives a more concrete future route to compare/consume Bookmap SI events
than the old stub. It still depends on provider availability, supported feed
and the addon's normal access checks. No subscriber was attached, no access
checks were bypassed, and no live event export on GC was verified here.
It is not an HTTP/websocket endpoint that the frontend can simply call.

## What the previous US-session sample shows

Window: 2026-10-28 19:00 to 2026-10-29 04:00, fixed UTC+7.
Reproducible inputs, audit and limitations are in `session-audit/README.md`.
There are 207 recorded detections in that window; the response was not capped.

| Final observed executed quantity | Orders | Passive BID | Passive ASK |
| --- | ---: | ---: | ---: |
| >=5 | 93 | 46 | 47 |
| >=10 | 48 | 23 | 25 |
| >=15 | 19 | 7 | 12 |
| >=20 | 10 | 2 | 8 |

At >=10, only 2/48 have zero observed refills. Requiring one refill leaves
46/48; requiring two leaves 41/48. These restrictions do not explain or solve
the observed two-sided clutter. There were 19 side changes across 47 adjacent
detections, with a maximum of 8 orders in a 10-minute window.

Using only the 21 consecutive completed M1 closes BEFORE each detection,
the exploratory efficiency ratio `abs(last-first)/sum(abs(close changes))`
had median 0.193. Thirty of these 48 detections had ER <=0.25. This is consistent
with testing a range-context attention layer, not evidence of a profitable
cutoff. A high-volume surviving ASK is not automatically a short signal.

Two material limits:

- This is an incomplete observed session: 61 M1 buckets are missing from
  01:44 through 02:44. Rithmic also returned no minute/profile/tick history
  for checked portions of that gap in the preceding investigation.
- Quantities, refills and terminal durations above are latest/final states.
  They were not necessarily available at the initial detection. The SI
  historical renderer itself uses current/final per-order quantity for earlier
  event filtering (`a.java:23-33`, `v.java:354-361`). A cleaner retrospective
  screenshot or this count table is NOT an alert replay or performance test.

## Recommended next prototype and validation

Keep native confirmation and all zero-refill overfills intact. Add an optional
focused DISPLAY/ALERT view over the retained observations:

1. Adaptive size filtering from previously completed orders, with explicit
   sample readiness and a minimum sample count. Keep the session minimum as
   a floor; label stale/missing sample coverage. Applying this consistently to
   active ICE and truly hiding filtered markers reduces clutter without
   changing the detector.
2. Aggregate nearby same-side detections into attention regions, with visible
   count and executed quantity. Preserve separate order IDs and separate
   BID/ASK totals. Do not invent a common hidden parent order from proximity.
3. Recognize low directional efficiency and two-sided activity from already
   completed candles/events. In that context, emphasize ICE at the previously
   established range edges and deemphasize the range center. The 20-change ER
   and 0.20/0.25 cutoffs are hypotheses to test, not tuned defaults to deploy.
4. Separate an ICE observation from a price-response alert. For example,
   a passive BID at a lower range boundary can remain pending until an observed
   rejection/hold response; a traded-through BID has different context. Any
   confirmation must be explicitly later than detection, with its own alert
   timestamp and latency. Evaluate both reversals and continuations.

Start with adaptive display filtering and aggregation; a sideways-context mode
addresses the specific problem that size filtering alone does not solve.
Demanding many refills, simply hiding cancellation, or filtering by eventual
lifespan is not an established substitute.

For a causal comparison, capture compact updates at the moment an order first
qualifies, its THEN-known executed quantity/refills, prior closed-candle
regime/range/VWAP context, feed readiness/gap flags, and later price response.
Full raw MBO need not be persisted. Compare multiple sessions using detection
retention, alert count/side alternation, delay and missed consequential events;
use held-out sessions before choosing defaults. The existing final-state
snapshot alone cannot recreate those crossing timestamps.

## External primary references

- Bookmap production/alpha distinction and SI filters:
  https://bookmap.com/knowledgebase/docs/Addons-Stops-And-Icebergs-On-Chart-Indicator
- CFR author documentation: https://www.benf.org/other/cfr/index.html

The Bookmap page also documents alpha combined SI for Bookmap 7.9. Its Smart
mode must not be attributed to this specific production 2.08 JAR.

## Checklist outcome

- Exact newly loaded version and artifact: answered.
- Native mechanism versus old builds/current detector: answered statically.
- Filter behavior, defaults and concrete renderer changes: answered statically.
- Working-shaped broadcast code versus old stub: answered statically;
  live availability and GC export remain unverified.
- Cause of our missing context filter and observed two-sided clutter: described
  with reproducible partial-session data.
- Better trading results from a specific sideways filter: unresolved; requires
  prospective or faithful event replay across more sessions.
