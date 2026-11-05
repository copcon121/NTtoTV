# Direct Rithmic native icebergs

Native iceberg detection uses the existing Rithmic Ticker Plant session and its
MBO + L1 trades. Bookmap configuration and addon code are not involved.

The independently implemented detector follows the native mechanism observed
in Stops & Icebergs On-Chart: a known passive order executes beyond its tracked
visible remainder, or the same order ID replenishes after executions consume
that remainder. Partial-fill size increases alone do not confirm an iceberg.
TTW's volume/development presentation informed the compact lifecycle display.
The artifact comparison is in `analysis/ttw-hidden-orders-20261027/FINDINGS.md`.

## Data flow

`RithmicMarketDataService` feeds ordered live trades/MBO updates into
`NativeIcebergDetector` before aggregate chart processing. A successful MBO
snapshot seeds current visible orders without reconstructing prior executions.
Detection waits for synchronization. Sequence gaps, reconnects and invalid data
invalidate affected state; different order IDs and connection generations are
never joined. Raw depth remains in memory.

Compact states reach `Pipeline.on_rithmic_icebergs`, then `/ws/chart` as
`iceberg_update`. This Rithmic-specific channel is independent of candle-source
arbitration and publishes only the real contract matching the chart. Bookmap
can continue supplying candles while direct Rithmic supplies iceberg signals.

The chart uses the logical `contract=GC`; `sourceContract` identifies the real
futures expiry. Keys include source contract, session generation and order ID.
Registry throttling coalesces each order to its latest state, retaining its
accumulated execution quantity.

## Quantities and lifecycle

- `side=buy` means the passive BID order; `sell` means passive ASK.
- `executedVolume` counts observed passive matches since the visible order was
  tracked, including matches before detection. Initial aggressive executions
  before that ID rests are excluded; quantity need not equal an addon's total
  that carries those earlier executions. It does not estimate hidden reserves.
- `displayedSize` is the nonnegative tracked visible remainder.
- `refillCount` counts observed replenishments after a depleted tranche.
- A complete same-side reprice of an undetected visible order starts a fresh
  baseline at its new price with zero accumulated execution/refills. This keeps
  ordinary moving orders trackable without carrying old-price fills into a new
  detection. An already detected ICE that changes price still ends as invalidated
  at its original price; later unknown CHANGE rows cannot revive it. This differs
  from SI's full movement lifecycle, which requires a richer history model.
- Status is `active`, `executed`, `canceled`, or `invalidated`. Removal with no
  positive remainder is classified as executed; removal with remainder is
  classified as canceled. Neither reveals the size of an unseen reserve.
- A later regular Rithmic trade strictly below a BID iceberg or above an ASK
  iceberg invalidates that old resting identity, even if its delete event was
  not observed. Its trace ends at that trade; its marker and observed execution
  total remain historical. Trades at the same price, OTC prints, other
  contracts, and stale execution timestamps cannot trigger this check. A price
  crossing does not add executed volume or claim that the hidden reserve was
  fully filled. Only detected orders are inspected on this path.

The standalone `/lq` page exposes the Iceberg toggle and ICE min executed-volume
filter in its toolbar. Icebergs start enabled there; these preferences persist
with the liquidity profile. The price pane shows each observed order lifetime,
and the legend reports direct Rithmic synchronization. The main chart has no
iceberg indicator or subscription.

The `/lq` presentation follows SI's compact icon-and-total design: small iceberg
glyphs, white executed quantity, 17-pixel dark rounded badges and thin order traces.
Badges stay on the center of their detection candle as the chart scrolls or
zooms, including after the order ends. Overfill detections with zero observed
refills use the same placement as refill detections. Orders detected outside
the viewport keep their intersecting traces without a badge pinned to an edge.
BID badges sit above their price;
ASK badges sit below it. Nearby same-price/same-side icons combine displayed
quantities within the same candle, while detection states and order IDs remain separate. Hovering a
badge reveals side, status, order count and refills. BID uses a teal upward
triangle, while ASK uses a coral downward triangle; order traces and legend use
the same side colors. The glyph is drawn locally
with canvas; addon bitmap assets are not bundled into the application.

## Bootstrap and limits

`GET /api/orderflow/icebergs?symbol=GC&contract=GC&limit=500&min_volume=1`
returns latest compact states plus `sessionId`, `sourceContract`, `connected`,
and `synchronized`. Optional `from`/`to` parameters select overlapping lifecycle
times. The endpoint reports `historyMode=persistent` and `retentionHours=48`
when the runtime liquidity store is available.

The backend memory and browser each retain at most 5,000 detected order states.
Compact lifecycles persist in the liquidity store for 48 hours and are restored
after a backend restart as historical traces. Old-session active orders are
invalidated until fresh MBO establishes a new identity. Reconnecting browsers
reload saved states; MBO snapshots restore the current book, not missing past executions.
Orders first observed in a snapshot therefore have only post-snapshot execution
volume. The detector bounds current candidates at 100,000 and reports dropped
candidate counts in market-data diagnostics.

Synthetic iceberg grouping and stop-chain inference are not enabled. Missing
IDs, unknown orders, side/price inconsistencies and feeds without synchronized
MBO cannot produce a valid native confirmation. The detector's replay tests
establish the selected mechanics; live GC feed sequencing and detection quality
still need observation against the exchange stream. No automatic trading action
is connected to these events.

## Verification

Focused backend coverage includes detector lifecycle, partial resizes,
overfills, duplicate sequences, missing IDs, snapshots/gaps/reconnects,
source/contract isolation, REST bootstrap, bounded history and websocket
coalescing. Frontend tests cover stale bootstrap responses and session changes.

After changes, run the backend tests and frontend typecheck/tests/build. The
public domain serves `frontend/dist`; restart the backend through
`scripts/Restart-Backend.ps1` when activating the new processor.

Activation verified on 2026-10-27: backend full suite 1,161 passed, frontend
full suite 658 passed, production build passed. Backend and public iceberg API
returned 200; the public page references `/assets/index-pt9UUJzK.js`. Direct
Rithmic MBO and the detector synchronized for `GC 12-26`, tracking about 2,900
visible orders with zero capacity drops. One detected native lifecycle was
observed in the live API. This confirms runtime wiring, not signal accuracy.

The subsequent UI correction places Iceberg exclusively on `/lq` and removes
main-chart controls, subscriptions and rendering. Targeted frontend tests and
the production build passed; `/lq` serves `/assets/index-zXh1wAjw.js`.

The SI-inspired compact renderer was subsequently built and verified on `/lq`
as `/assets/index-BNnplWmt.js`; targeted canvas/layout tests passed. A requested
headless-browser verification attempt was blocked by tool policy; no screenshot
or browser visual verification is claimed.
