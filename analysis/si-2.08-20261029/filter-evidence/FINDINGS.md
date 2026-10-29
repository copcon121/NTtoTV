# SI On-Chart 2.08: static filter audit

Artifact: `C:\Bookmap\API\Layer1ApiModules\7.4.0.1---7.7.1.9999---2---stops-icebergs-on-chart---2.08.jar`.
SHA256: `317e2a8b45e3290e2d4fd41a371e06f08f71b9f3c2fc1072f91b3eb682a215ab`.
Comparison: Desktop `stops-icebergs-on-chart-1.05.jar`, SHA256
`173460b4764d1c99127107bf6bd817fbcbd2c72664a81120311dbc3aadcc0c8a`.

Read-only static analysis. CFR files are reconstructed Java, not original source.
All disassembly in this directory was produced with Bookmap's installed
`javap.exe -classpath <original jar> -p -c <class>`. No addon execution, settings
inspection, or runtime changes. Root's REA artifact inspection hit a case-only
class-path collision; this audit uses the static fallback and original classfile
bytecode. File paths below are relative to the repository root.

## Filter behavior and defaults

New source prefix: `analysis/si-2.08-20261029/decompiled/velox/indicators/sionchart/`.
Old source prefix: `analysis/ttw-hidden-orders-20261027/bookmap-si/decompiled/velox/indicators/sionchart/`.

- Individual iceberg threshold compares cumulative executed volume with
  `icebergsThreshold`. New `v.java:359-361`; old `t.java:327-329`.
  This is not a refill-count, order-count, duration, price-response, trend,
  or directional-imbalance condition. New `l.java:42-50` returns and increases
  cumulative execution; `a.java:23-33` snapshots that quantity for rendering.
- Active orders bypass that threshold unless `applyThresholdToActive` is true:
  new `v.java:235-238`, `:360`; old `t.java:207`, `:328`.
  Constructor defaults remain `showActive=true`, `applyThresholdToActive=false`.
- Event visibility selects DETECTION, TRADE, EXECUTION, CANCELLATION and ACTIVE.
  New `v.java:158-175`, `:359`; old `t.java:144-153`, `:327`.
  New `e.java:29-43` and old `d.java:28-42` both default detection/trade false,
  execution/cancellation/active true, total volume true, letters/event volume
  false, automatic threshold false.
- Visual aggregation merges same-side nearby icons in screen time/price space.
  New `v.java:365-386`, `c.java:60-114`; old `t.java:333-352`, `b.java:107-159`.
  These merge displayed event groups; they do not prove a common hidden parent.
  Price grouping depends on zoom, icon height and pixel/data scale
  (`v.java:209-212`, `:369`), not a fixed market support/resistance zone.
- Aggregate threshold is applied after aggregation: new `v.java:450-464`;
  old `t.java:404-413`. Individual filtered entries do not boost an already
  unfiltered aggregate (`c.java:62-73`; old `b.java:109-120`).
- Defaults in new `e.java:25-53` / old `d.java:24-51` are the same:
  individual and aggregate thresholds 0; aggregation enabled;
  price area multiplier 200 (20 icon heights), time area multiplier 10
  (1 icon width); filtered icons shown; filtered transparency 85.
  `getAlphaByTransparency()` computes int((100-transparency)*2.55), so default
  filtered alpha is 38/255 (about 15% opacity), not a detector-confidence score.
- `aggregateEC=true` combines the displayed executed volume of fully executed
  and partly executed/cancelled iceberg events. New `c.java:182-212`;
  old `b.java:227-257`. UI tooltip at new `a/c.java:249` confirms its meaning.
- Stops have a separate optional multi-price-level condition
  (`showOnlyStopsTBPL`, new `v.java:400`, old `t.java:366`). This does not filter
  iceberg direction or sideways-market quality.

## Automatic threshold is unchanged

New `m.java:559-615`; old `SitIndicator.java:727-783`:

1. Select orders whose FIRST event timestamp is at/after the window start and
   whose last event is EXECUTION or CANCELLATION, according to the corresponding
   enabled event visibility. Active-only orders are not sampled.
2. Let x be each selected order's cumulative executed volume. Compute mean(x)
   and population SD = sqrt(sum((x-mean)^2)/N).
3. Set threshold to int(mean + k*SD), capped to max(x). Empty selection sets 0.
4. Separate visual/alert multipliers may be used; calculations are shared when
   enabled together with matching intervals. See new `m.java:624-635` and old
   `SitIndicator.java:792-803`.

New `m.java:620` and old `SitIndicator.java:788` use 60,000,000,000 ns refresh
gating, i.e. about one minute unless forced. New `t.run()` bytecode offsets
15-26 proves window start = currentTime - icebergsSdInterval*60,000,000,000 ns.
Default interval is 60 MINUTES and k=1, not a 60-second sample window.

Original-bytecode corroboration:

- `m.javap.txt:1383` method `b(long,boolean,boolean)`: offsets 64-171 sample
  timestamp/type selection; 275-361 mean/population SD; 420-453 visual
  mean+k*SD, d2i and max cap; 459-490 empty reset.
- `old105-SitIndicator.javap.txt:2700`: the same method/formula has the same
  important bytecode offsets (sqrt at 361, multiplier at 428, d2i at 433).
- `t.javap.txt:21-38`: worker run() window conversion. `s.javap.txt` shows
  the shared visual+alert worker; `u.javap.txt` the separate alert worker.
- `e.javap.txt:167-253`: constructor defaults, including individual/aggregate
  0 at offsets 42/47, apply-active false110, auto false115, interval60 at131,
  k=1 at136, show-filtered true179, transparency85 at185.

## Concrete renderer changes versus 1.05

1. New ACTIVE rendering respects `icebergsShowHiddenIcons=false` after individual
   or aggregate filtering (`v.java:259-264`). Old `t.java:230-234` always added
   the active badge, even when its filtered flag was set. New original bytecode
   `v.javap.txt:895-914` (`a(Map)` offsets388-430) contains the flag check and
   skip. Old `old105-t.javap.txt:730-747` (`c()` offsets377-415) directly adds
   the icon with no such check. This is a filter-consistency fix, not regime
   recognition; it only matters when applying threshold to active orders and
   hiding filtered icons.
2. New historical grouping uses ABSOLUTE time distance (`v.java:369`), while
   old `t.java:337` used signed subtraction. New original bytecode
   `v.javap.txt:1417-1423` has lsub then Math.abs(long) at400; old
   `old105-t.javap.txt:1245-1250` has lsub358 directly followed by the comparison
   setup. This avoids order-sensitive temporal eligibility when iterating
   regrouped events. It is a visual aggregation improvement.
3. New aggregate active/stop weighted-price calculation guards total weight>0
   (`c.java:77-80`); old `b.java:123-125` divided directly. This is arithmetic
   robustness, not a trade-quality condition.

New settings also expose popup flags and aggregation-warning lines
(`e.java:45`, `:73`, `:84-85`), absent from the old settings class; these are
presentation/operational additions. Native detector/broadcast comparisons are
outside this branch's scope.

## Bounded conclusion and practical limits

No sideways/trend/VWAP-location/range-edge/absorption-quality condition was found
in the traced settings -> automatic threshold -> event/active/aggregate render
paths. The traced decisions consume order execution size, event/lifecycle type,
visibility flags, and screen-space coordinates. This conclusion is bounded to
these concrete paths, not a claim based solely on class/keyword searches or a
proof about every bundled dependency.

Automatic size threshold and per-order/aggregate filters can reduce visual
clutter; they do not establish that the surviving BID/ASK icebergs predict the
next price direction. Hiding cancelled events only changes lifecycle coverage,
and cannot substitute for price confirmation. All volume thresholds must be
evaluated causally: historical rendering checks the order's current/final
cumulative size even when drawing earlier events (`a.java:23-33`,
`v.java:354-361`), so scoring a past detection with its eventual volume introduces
lookahead. Defaults above are constructor defaults, not the user's saved runtime
settings. No GC effectiveness/replay test or settings change was performed.
