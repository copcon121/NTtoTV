# Chart performance audit - 2026-10-29

The main Chart renderer performed repeated indicator/history work for each
incoming bar and delta snapshot. LQ uses a separate canvas renderer. Both pages
receive the same active Rithmic source through `/ws/chart`.

## Observations

- Public site and local backend returned HTTP 200. Rithmic was connected,
  eligible and synchronized, with no queued input at the initial check.
- The initial source-latency sample was p50 157 ms, p95 973 ms and max 4154 ms.
  Rendering improvements do not remove upstream source/transport latency.
- A fresh anonymous public Chart session generated 13 long tasks totaling
  1032 ms during loading/observation. A separate LQ observation generated one
  72 ms long task. These sequential observations establish a rendering
  difference, not a controlled feed-latency comparison.
- The controlled probe isolated price/volume, TDU, XKontrol, GC Push Momentum,
  mGann, Wave Delta and their combination. GC Push Momentum dominated CPU time.

## Changes

- Keep every bar/closed-state/model update, but merge repeated paint requests
  for a bucket into one animation frame. Bar and delta snapshots share the
  same render pass. TDU and XKontrol history scans run once per pass.
- Coalesce forming-bar momentum work. Finalize pending momentum before a new
  bucket advances its bounded calculation window, preserving existing output.
- Skip unchanged momentum histogram/line updates. Historical corrections still
  rebuild the indicator when needed.
- Scan Swing-5 windows directly instead of allocating temporary arrays per bar.
  The pivot comparisons and confirmation rules remain the same.
- Recolor only candles whose mGann impulse color changed, replacing the normal
  500 ms full-candle `setData` path. History reindexing retains a bulk fallback.
- Track actual rendered timestamps so multiple queued new candles are appended
  in order. Preserve deferred painting while panning and cancel frames on disposal.

The audit also inspected the surrounding paths: EMA/Supertrend already advance
incrementally; SMC uses a worker and confirmed-bar requests; BigTrade/Footprint
React updates already use bounded batches. Their algorithms were not changed.

## Controlled browser stress test

Headless Chromium, 10,000 historical bars, 288 paired forming-bar/delta snapshots,
eight snapshots injected per frame for 36 frames. Same host, viewport and fixture.
Numbers include browser scheduling and canvas costs on this machine. They are
frame gaps, not exchange-to-screen latency or a guarantee of device frame rate.

| Enabled branch | Before p95 frame gap | After p95 frame gap |
| --- | ---: | ---: |
| Price/volume | 133.4 ms | 66.7 ms |
| TDU | 150.0 ms | 66.6 ms |
| XKontrol | 116.5 ms | 66.7 ms |
| GC Push Momentum | 466.6 ms | 50.1 ms |
| mGann | 150.1 ms | 50.1 ms |
| Wave Delta | 166.7 ms | 66.6 ms |
| Combined | 1216.6 ms | 83.4 ms |

Combined momentum calculations fell from 576 calls / 29,916.9 ms total to
18 calls / 217.7 ms total. TDU scans fell from 576 to 36. Normal mGann timer
updates no longer replaced the full candle series in this fixture.

Raw reports: `_run_logs/chart-performance/before.json` and `verified.json`.
Run `node tools/profile-chart.cjs <report-name>` to repeat the isolated probe.

## Correctness and public verification

- Full frontend suite: 82 files / 771 tests passed before the final boundary
  refinements. Final focused suite: 7 files / 132 tests passed, including five
  new rendering regression cases. Production TypeScript/Vite build passed.
- Real Chromium comparison with the saved pre-change adapter: identical candle,
  volume, delta, momentum, mGann and Wave Delta projections after forming-bar
  bursts, multiple new buckets, historical correction, unchanged-OHLCV close
  events and indicator disable/restore. No page errors.
- Repeat with `node tools/verify-chart-realtime.cjs <pre-change-adapter.ts>`.
  The local baseline snapshot is in `_run_logs/chart-performance/`.
- `https://gcflowpy.xyz/` returned 200 and referenced
  `/assets/index-CldEkXwZ.js`, matching the final local production build.
- A fresh public browser session loaded that bundle, received realtime M1 bars
  and delta, and produced no JavaScript page errors. Backend health remained OK.

The controlled fixture reproduces burst rendering, not an actual news-event
market session. The user's browser/profile and WAN path can have additional costs.
