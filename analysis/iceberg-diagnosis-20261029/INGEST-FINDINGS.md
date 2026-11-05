# Rithmic ingest accounting audit

Read-only application/source and bounded raw-tick investigation on 2026-10-29.
No provider login, settings inspection, backend restart, application edit, or
runtime database write was performed by this audit worker. Raw shards were
opened with SQLite URI `mode=ro`. These findings are separate from the parent
worker's live diagnostics.

## Confirmed missing LastTrade guard

`backend/app/rithmic/protocol.py:decode_message` exposes `presenceBits` and
`clearBits`. The supplied RProtocolAPI.zip 0.90.0.0 `last_trade.proto` assigns
LAST_TRADE bit 1. `_normalize_trade` currently checks only price/positive size,
not those bits. It can therefore accept a payload retaining price/size while
the declared update is volume/VWAP or clearing the last trade.

When the presence mask is supplied, require LAST_TRADE. Reject clear bit 1.
Retain the existing legacy path for messages with no presence mask. This is
a schema-consistency correction; the captured evidence does not establish that
this missing guard caused today's change in iceberg outputs.

## Reproduced conditional double deduction

The current detector applies absolute CHANGE size immediately, then subtracts
every later-arriving matching trade. It does not retain the source nanoseconds
of the last MBO update. A deterministic in-memory reproduction:

1. Seed ASK order A, price 4040, displayed size 10, time 100.
2. Receive CHANGE size 6 with source/event time 110.
3. Receive the older trade of 4 against A, source/event time 109.
4. Receive another trade of 3, source/event time 111.

Current result: `overfill`, executedVolume 7, displayedSize 0, refillCount 0.
Under the hypothesized ordering, the size-6 update already incorporated the
first fill of 4. Actual remainder after the second fill is 3, so there is no
overfill. The same general race can falsely count a late positive CHANGE as
a refill after an execution has exhausted the current local remainder.

This proves vulnerability IF R|Protocol interleaves an absolute size change
before its older corresponding L1 execution. Stored raw ticks omit MBO, so
the live occurrence of that condition remains unverified.

Useful next diagnostic: per-order last MBO source nanoseconds, plus a tiny
bounded in-memory history of same-ID trade/MBO arrivals. On an overfill retain
arrival ordinal, source nanos, before/after remainder, price, size/volume,
presence/clear flags. Do not assume that equal timestamps establish trade-first
ordering, or globally reorder vendor events without evidence.

## Raw-tick checks

In Oct28 00:00-02:00 and 07:00-09:00 UTC, and Oct29 corresponding windows,
there were zero duplicate tuples of source nanos, price, volume, aggressor side,
passive ID and aggressor ID (37,660 observed rows total). SQL grouping found no
non-null passive ID switching between buy and sell in the Oct29 07:00-09:00
window. Missing IDs and unclassified sides exist; these must not confirm ICE.

L1 source timestamps were monotonic when ordered by recorded receipt time and
sequence in these additional bounded windows:

| Window (UTC) | Trades | Backward L1 timestamp |
| --- | ---: | ---: |
| Oct28 12:00-18:30 | 36,662 | 0 |
| Oct28 20:00-24:00 | 9,882 | 0 |
| Oct29 07:00-09:00 | 9,268 | 0 |

This tests L1 against L1 only. It neither proves cross-stream ordering nor
reconstructs MBO completeness.

## Limits of book-size and unknown-ID diagnostics

`RithmicBookState` does not apply L1 executions to its order map. Counts can
grow from orders exhausted by trades when no separate DELETE is delivered.
Consequently increasing book size and mismatch with a later authoritative
snapshot cannot, alone, prove transport loss. Unknown CHANGE/DELETE counts
are diagnostic evidence, not sufficient grounds to reverse NEW/DELETE enums.
The supplied proto mapping remains NEW=1, CHANGE=2, DELETE=3.

The detector also deliberately discards price-changing candidates and ignores
unknown replacements, while the generic book upserts full CHANGE rows. A
conservative coverage adaptation could seed a fresh, zero-execution baseline
from a complete previously unknown CHANGE or a reprice of an undetected
candidate. It must not revive a retired detection or carry executions over an
unproven identity boundary. A full SI movement port is a separate lifecycle
schema/rendering change, not a safe one-line removal of the price guard.

## Bookmap adapter boundary

The already saved `RithmicProvider.javap.txt` shows no TradeAggregator flush or
timestamp sort in the live `onDepthDataByOrder` N/C/D callback. `onTrade` calls
TradeAggregator separately. Native RAPI/DLL translation remains unexamined.

Image reconciliation is distinct: `onDepthDataByOrderImageEnd` and its helper
synthesize cancels for IDs absent from the new image and sends/replacements
for new/current IDs. Existing same-price identities receive size+1 then size
replacements. Therefore claims that Java never synthesizes MBO callbacks must
be scoped to the live callback, not the snapshot reconciliation path.
