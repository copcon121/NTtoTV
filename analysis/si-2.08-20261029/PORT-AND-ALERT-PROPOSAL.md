# SI 2.08 filtering port and price-confirmation proposal

## Implemented on /lq

The native Rithmic detector remains the source. This ports the inspected SI
filter/render behavior; it does not subscribe to the unverified SI GC broadcast.
Evidence: `filter-evidence/FINDINGS.md` and the original-bytecode references there.

- Auto is enabled by default, including profiles created before this setting.
  An explicitly saved manual preference survives subsequent reloads.
- Sample the full loaded compact order book, independent of the viewport and
  individual volume filter. Select executed/canceled orders whose detection time
  is within the preceding 60 minutes and whose terminal time is not in the future.
  Visibility switches for executed/canceled also select those sample categories.
  Exclude active and invalidated states. Refresh on bootstrap/synchronization,
  settings changes and once per minute.
- Threshold = truncate(mean + k * population SD), capped to the largest sample;
  default k=1, empty sample=0. The UI exposes the threshold and sample count.
- Manual mode retains detection-session UTC+7 minimums: US 19:00-04:00 = 10,
  other hours = 5. Auto replaces these minimums rather than adding a 10/5 floor.
- Filter each order on cumulative executed quantity. Zero-refill overfill orders
  remain valid. Apply-to-active is configurable and enabled by default here.
- Group nearby same-side icons using absolute screen-space time/price distances,
  volume-weighted anchors and a zero-weight guard. SI area defaults are retained:
  time=10 (one icon width), price=200 (20 icon heights). Active and historical
  invalidated states stay distinct. Executed/canceled totals may combine.
- Individually rejected orders stay separate from eligible groups. Apply group
  minimum volume afterwards. Filtered icons/traces are either hidden consistently
  (our default) or faded (15% opacity default). Lifecycle opacity remains separate.
- Preserve detection-candle anchoring by snapping the group's weighted detection
  time to a candle center. Preserve each order's original price/time lifetime
  trace and price-through invalidation. Visual groups never merge order IDs.
- Profiles/local fallback persist the settings. No backend restart is required.
- Existing audio means "ICE volume reached", once per live order. Auto refreshes
  preserve notification history, so threshold changes do not re-arm old orders.

Adaptations: the compact model stores latest order states, not SI's full D/T/E/C
event stream. `detectedTime` represents its first ICE event, not first MBO sighting.
This does not add fabricated historical detection/trade icons. Loaded history is
bounded to the existing 48-hour/5,000-order compact snapshot. Auto reflects the
observed book, including any data gaps; it cannot reconstruct absent MBO.
Historical icons use the current threshold/latest order totals as presentation,
not a causal backtest. Grouping is display-only and changes with zoom.
No sideways/trend filter is introduced.

## Proposed next step: a separate price-confirmed alert

Keep the native ICE marker and the existing volume notification as observations.
Add an independent, initially disabled "ICE price confirmation" alert. It should
not depend on screen-space groups, faded icons or chart zoom, and must not place
orders. Its input must be fresh chronological exchange trades plus native order
updates; M1 OHLC alone cannot establish the sequence of touch, rejection and hold.

State machine:

1. **Pending**: on the first live crossing of the individual threshold, capture
   source/session/order ID, side, level, threshold, current executed quantity and
   arming timestamp. Freeze these values for this candidate. Evaluate only prices
   received after that timestamp; do not inspect later final ICE volume.
2. **Testing**: require a subsequent trade at the ICE level (within configured
   touch tolerance). For BID, watch for a move above the level; ASK is mirrored.
3. **Confirmed**: price moves at least R ticks away on the defending side, then
   stays on that side of the level for H seconds with fresh trade evidence.
   Any return to the test area resets the hold timer. Emit a separate sound and
   confirmation marker at the actual confirmation time, with the ICE level linked.
4. **Invalidated**: an actual trade through the defending level beyond the
   configured breach tolerance cancels the pending candidate immediately.
   Refill/move/source invalidation also cancels it; never extend a breached level.
5. **Expired**: no confirmed reaction before the timeout; keep the observation
   marker and remain silent. A data gap/disconnect, source switch or session change
   cancels pending candidates rather than counting missing time as a successful hold.

Concrete replay starting point, to be evaluated rather than treated as proven:
R=3 ticks, H=3 seconds, touch tolerance=0 ticks, breach=1 tick, timeout=45 seconds.
Require at least two chronological trades spanning the hold period and no stale
trade interval beyond a configurable freshness limit. Use exchange timestamps;
reordered/duplicate transport messages must not advance the state machine.

Deduplicate per order first. If nearby same-side candidates overlap, coalesce
notifications using a fixed tick/time definition, never screen pixels. The alert
payload should retain all contributing order IDs and distinguish observation,
price confirmation, invalidation and expiry. Ended-by-execution ICE can still be
tested as a historical defended level; canceled/invalidated candidates cannot.

Evaluate on recorded native/trade streams without lookahead: count observations,
confirmations, breaches, timeouts, alert latency and subsequent adverse/favorable
excursion separately by session. Include the noisy US session and transport gaps.
Minute history cannot validate this design because it lacks historical MBO and
intrabar event ordering. This proposal does not implement a sideways filter or
claim that a confirmed alert establishes a profitable entry.
