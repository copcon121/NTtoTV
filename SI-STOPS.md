# SI Stops on LQ

LQ uses an independently implemented SI 2.08 aggressive-chain mechanism over
the existing direct Rithmic connection. Bookmap supplies the inspected algorithm
reference, not runtime data. The signals infer stop-like aggressive chains;
there is no exchange flag confirming the purpose of each constituent order.

## Ordered state machine

The service seeds accepted MBO IDs after its initial image completes. Known
MBO send/replace/cancel callbacks reset the seed, complete a pending chain and
arm recognition. Unknown CHANGE/DELETE and duplicate NEW callbacks do not form
boundaries, following SI's accepted-ID wrapper. Effective changed MBP depth is
another completion/reset boundary, but does not rearm after cancellation.

The first positive trade after arming seeds its aggressor ID and is excluded
from stop quantity, as are repeats of that ID before activation. The first
different-ID trade starts the chain and is included. Subsequent same-side
executions accumulate, including repeated IDs and a return to the seed ID.
An opposite-side execution cancels the provisional chain. The seed's own side
does not restrict the first different-ID execution. There is no detector timer,
decayed-volume threshold or minimum price movement in this state machine.

Only completed chains are persisted and published. Canceled provisional chains
never leave permanent markers or alerts. The marker belongs to the last included
execution's candle and price; alert qualification uses the completed total.
VWAP, first price, completion time, execution count and distinct included
aggressor count remain separate compact fields. Through Price Levels (TBPL)
means at least two included executions and first price different from last price.

Documented input guards beyond the inspected SI implementation: missing/zero
aggressor IDs and unclassified same-contract executions discard pending state;
duplicate sequence numbers do not count again; backward trade time, stale
completion boundaries, gaps, clear-book events, resnapshot and disconnect cannot
complete a chain. Session identities are never joined. Accepted IDs and pending
distinct aggressors are bounded. Multipart MBP updates form a boundary when the
existing reducer publishes an effective changed atomic book update.

## Runtime and history

- Engine: `backend/app/engines/si_stops.py`.
- Service: `RithmicMarketDataService`, before candle/UI throttling.
- Stream: `/ws/chart`, subscribable event `si_stop`; coalesced by physical
  contract, session and chain ID, so separate chains cannot overwrite each other.
- Bootstrap: `GET /api/orderflow/si-stops?symbol=GC&contract=GC&limit=5000`.
  Optional `from`, `to`, `min_volume` filter compact completed history.
- Persistence: `si_stop_chains` in the existing liquidity WAL store; retention
  is 48 hours and client/backend memory each keep at most 5,000 latest chains.
- Health: `sources.rithmic.siStopsSessionId`, `siStopsSynchronized`,
  `siStopsTrackedOrders`, `siStopsPendingVolume`, `siStopsDiagnostics`.

No raw MBO/depth or per-chain execution list is persisted. Collection starts
with the updated live service; trade-only shards/minute backfill cannot recreate
missing historical MBO/MBP boundaries. Old MV Stop history is not relabeled.
Completed records survive reconnect/restart without being turned invalidated.

## LQ display and settings

SI Stops replace the old MV Stop marker/settings/sound path. The independent
Market Volume line, Volume Spike and Absorption calculations remain available.
Legacy Market Explorer `market_volume_stop` events are ignored by LQ; the older
backend API contract remains compatible for existing clients.

Settings live per profile at `liquidityChart.siStops`, with local fallback.
Old MV net-volume thresholds are not migrated into chain quantities. Initial
display defaults are enabled, minimum 50 contracts per chain, auto off, TBPL off, nearby same-side
aggregation on, aggregate minimum 0, hidden filtered markers. Buy defaults to
turquoise `#35d6b0`, sell to coral `#ff8a65`, matching LQ's directional keys.

The settings are one SI Stops group, with chain-filter and grouping/alert
sections. Settings version 2 upgrades the initial saved zero-minimum preset
(including Auto enabled) to fixed 50 once. Custom positive thresholds, grouping,
alerts and colors are preserved; subsequent version-2 edits remain user-controlled.

Auto samples all loaded completed chains in the prior 60 minutes (configurable),
independently of zoom or individual display filtering. Threshold is truncated
mean + k * population SD, capped at the largest sample, empty sample 0. k defaults to 1.
It refreshes once per minute and on configuration/bootstrap changes. Sample
counts expose the loaded coverage; older retained rows can be limited by the
5,000-row viewport/bootstrap cap.

Aggregation is visual only, with separate side/filter groups and quantity-
weighted anchors. Individually rejected chains cannot boost eligible aggregates.
The aggregate minimum is applied afterwards; filtered groups may be hidden or
faded. Neither zoom nor visual grouping changes detector identity or alerts.
For example, a marker with `50 contracts / 15 chains grouped / 33 trade prints`
has 50 included contracts across 15 inferred chains and 33 included trade
records. It is not a single 50-contract stop order or 33 distinct orders. The
per-chain minimum is applied before grouping, so a fixed 50 threshold rejects
those small chains even if they previously added up to a 50-contract marker.

Alerts use a separate executed-volume minimum 10 by default, optional separate
TBPL condition, sound off and popup off. They fire at most once per fresh
completed chain while the profile, websocket and Rithmic session are ready.
Bootstrap history, reconnects and threshold changes cannot re-alert old chains.
The existing saved `alertSounds.volumeStop` preset now speaks "SI Stops".

## Theme decision

The settings use the shared LQ dark/turquoise tokens in `frontend/src/styles.css`.
`AGENTS.md` records LQ as the reference for subsequent Chart/MP/FP theme work.
Indicator/directional colors retain their own meanings; primary controls use
`--gc-accent: #35d6b0` rather than separate page-specific blue/green palettes.
All LQ settings panels share the same surface and border, including ICE and
BigTrade. Their Buy/Sell chart colors are preserved. Every option has a `?`
explanation, including thresholds, units, grouping and independent alerts.
The shared tooltip opens on hover/focus/tap, dismisses on Escape or outside
interaction, and uses a viewport-clamped portal to avoid scroller clipping.

## Evidence and verification

The original-bytecode investigation and independent 10-case reconstruction are
in `analysis/iceberg-diagnosis-20261029/STOP-FINDINGS.md` and
`replay_si_stops.py`. Production tests cover seed exclusion, start inclusion,
completion/cancellation, rearming, accepted-ID boundaries, stream isolation,
resets, bounds, persistence/restart, history filters and websocket identity.
Frontend coverage includes alert deduplication, stale bootstrap races, history,
aggregation, settings persistence and legacy MV marker exclusion.

Matching live Rithmic callback ordering to Bookmap's native adapter still needs
matched-feed observation; static/replay parity is not a claim of identical live
addon output.

Validated and deployed on Windows/public LQ on 2026-10-29:

- Backend: 1,269 non-property tests and 33 property tests passed. Property tests
  used 100 examples and WindowsSelectorEventLoopPolicy to avoid the existing
  Proactor/to_thread teardown hang; production event-loop policy was unchanged.
- Frontend: all 765 tests passed; typecheck and production build passed.
- Built-frontend Chromium check: completed markers, volume filtering, legacy MV
  marker exclusion, profile save/reload, turquoise settings controls, and
  390-pixel mobile dialog passed without page errors. All API mutations and the
  websocket were mocked for this UI check. Reproduce with
  `node tools/verify-si-stops.cjs`; screenshots/results go to
  `_run_logs/ui-regression/`.
- Backend restarted through `scripts/Restart-Backend.ps1`. Live Rithmic reports
  connected and synchronized SI Stops, the REST endpoint returns completed
  real chains, and a read-only `/ws/chart` subscription received `si_stop`.
- `https://gcflowpy.xyz/lq` returned 200 and referenced the deployed
  `/assets/index-DEPxTPq0.js` bundle after the settings follow-up.
- Settings follow-up: 59 focused tests and typecheck/build passed. Built-LQ
  browser validation covered the saved version-1 zero/Auto preset upgrading to
  fixed 50, version-2 save/reload, one SI settings group, explicit tooltip units,
  help access for every settings control, a uniform panel palette and mobile
  tooltip bounds. No backend restart was needed for this frontend-only follow-up.
