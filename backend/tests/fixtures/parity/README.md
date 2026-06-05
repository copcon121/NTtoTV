# Reference-Indicator Parity Fixtures

These JSON fixtures pair a **recorded (or spec-derived) input event stream** with
the **oracle output** that the reference NinjaTrader indicator produces for that
*exact* stream. They are the oracle for the parity property tests
(Properties 28, 29, 30 / tasks 19.2-19.4) and are loaded by
`tests/parity/fixtures_loader.py` and replayed by
`tests/parity/replay_harness.py`.

Parity holds **only for identical replay streams**: the same ordered events,
the same bid/ask snapshot state at each trade, and the same Canonical_Timestamp
precision (integer milliseconds since the Unix epoch, UTC). Parity is **not**
asserted for live streams. (Requirements 13.8, 14.9, 15.6; design "Parity scope
note".)

## ⚠️ Spec-derived, not captured

The fixtures in this directory are **spec-derived**: their `expected` outputs
were computed **by hand from the documented reference-indicator rules** in
`design.md` (VolumeDelta classification, Footprint ladder/metrics, BigTrade
merge/filter), **not** by running our own engines. That is deliberate —
generating expected output by running the engine under test would be circular
and prove nothing. Each fixture carries `"source": "spec-derived"`.

When real recorded NinjaTrader captures of **MyVolumeDelta**, **MzFootprintClone**,
and **BigTradeIndicator** become available, drop them in here with
`"source": "recorded"` and the same schema; the harness and parity tests pick
them up automatically.

## Fixture format (schemaVersion 1)

```jsonc
{
  "schemaVersion": 1,
  "engine": "volume_delta",        // "volume_delta" | "footprint" | "big_trade"
  "source": "spec-derived",        // "spec-derived" | "recorded"
  "description": "human-readable summary of what this stream exercises",
  "symbol": "GC",
  "contract": "GC 08-26",
  "config": { /* engine config shared by the engine under test and the oracle */ },

  // The recorded event stream, in strict replay order. Each event is either a
  // quote (updates the running bid/ask snapshot) or a trade. A trade is
  // classified against its OWN "bid"/"ask" when present, otherwise against the
  // most recent quote's snapshot. Times are Canonical_Timestamps (ms UTC).
  "events": [
    { "type": "quote", "time": 1000, "bid": 100.0, "ask": 100.2, "bidSize": 10, "askSize": 12 },
    { "type": "trade", "time": 1500, "price": 100.2, "volume": 3 },
    { "type": "trade", "time": 2000, "price": 100.1, "volume": 2, "bid": 100.0, "ask": 100.1 }
  ],

  // The reference-indicator oracle output for the stream above. Its shape is
  // engine-specific (see below).
  "expected": { /* engine-specific */ }
}
```

### Snapshot state (how a trade gets its bid/ask)

The replay driver keeps a **running quote snapshot**. A `quote` event replaces
it. When a `trade` event is replayed:

- if the trade carries its own `bid`/`ask`, those are used (the trade's tagged
  snapshot wins), and
- otherwise the running snapshot from the most recent `quote` is attached.

This reproduces how NinjaTrader evaluates each trade against the prevailing
bid/ask. `symbol`, `contract`, and a per-channel monotonic `sequence` are
assigned by the driver from the fixture's top-level fields and event order, so
ordering is fully deterministic.

### `expected` by engine

**`volume_delta`** — `expected.bars` is the list of per-bar final states, one
per timeframe bucket, in bucket-time order. Each bar matches the
`volume_delta_update` wire shape:

```jsonc
{ "time": 0, "volume": 12, "buyVolume": 8, "sellVolume": 4,
  "delta": 4, "deltaHigh": 6, "deltaLow": 1, "openDelta": 3, "closeDelta": 4 }
```

**`footprint`** — `expected.bars` is the list of per-M1-bar footprint outputs:

```jsonc
{ "time": 0,
  "rows": [ { "price": 100.0, "bid": 8, "ask": 4, "imbalance": null }, ... ],
  "poc": 100.1, "barDelta": 58, "buyPct": 0.845..., "sellPct": 0.154...,
  "stackedImbalance": [ { "side": "ask", "from": 100.1, "to": 100.3 } ],
  "unfinishedAuction": { "high": false, "low": true } }
```

`rows` are listed in ascending price order. Float metrics (`buyPct`,
`sellPct`, prices) are compared with a tolerance by the parity tests.

**`big_trade`** — `expected.markers` is the list of emitted markers (after the
`(canonical_ts_ms, side)` merge and the volume filter), sorted by `(time,
side)`:

```jsonc
{ "time": 5000, "price": 100.2, "volume": 35, "side": "buy" }
```

Groups whose merged volume falls below `MinVolume` produce no marker.

## Imbalance convention used by the footprint fixture

The footprint fixture's imbalances follow the design's diagonal rule: a level's
`ask` volume is compared against the **next-lower** level's `bid` volume, and
the ask side is imbalanced when it exceeds that opposing diagonal volume by
`ImbalancePercent` (100% -> at least 2x) **and** the dominant volume is at least
`ImbalanceMinVolume` (10). The fixture is constructed with clear-cut ratios
(e.g. 30 vs 8, 25 vs 3) so the determination is unambiguous regardless of the
exact `>`/`>=` edge handling the engine ultimately uses.
