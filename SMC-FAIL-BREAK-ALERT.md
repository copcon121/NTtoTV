# External Fail Break Retest

Create in Alerts -> External Fail Break Retest. This notification rule runs
in the backend on active-source M1 bars/trades and does not place orders.

Short sequence (Long is the inverse):

1. A closed M1 candle produces an external bullish BOS or CHoCH at L.
2. Record the highest outside excursion A. A later M1 close returns fully
   inside the original pivot's upper-wick zone: reclaim.
3. An Internal-5 mGann wave leads from outside the edge to an inside pivot B.
4. Track the return from B through any number of alternating child waves.
   Intermediate rebounds need not touch the edge. A deeper inside low updates
   B without resetting the setup.
5. When an upward child wave actually tests the pivot wick zone, alert once.
   Enable Require live mGann PB to require PB/[PB] on that current testing
   wave. A PB from an earlier rebound does not qualify a later return.

Retest geometry comes from the broken pivot candle: its upper wick
[max(open, close), high] for Short, lower wick [low, min(open, close)] for
Long. There is no fixed displacement distance or fixed tick tolerance. Saved
legacy tick-distance parameters are ignored and omitted from the API shape.

A level sweep can remain a valid retest. Breaking the frozen outside A
extreme cancels the setup, including intrabar. The configurable expiry
(default 120 closed M1 bars from the break) is a safety limit, not a condition
that a return must finish within two or three child waves.

Live evaluation requires current price in the zone. An earlier wick in the
forming candle cannot fire while current price is away. Closed-bar evaluation
can catch a retest missed by intrabar updates, but M1 OHLCV replay cannot
reconstruct the exact sequence of historical ticks.

The chart profile's external SMC swing length is used by default. Saving a
changed SMC swing length reseeds dependent alerts without emitting historical
notifications. If a profile has no SMC length, the alert's saved length is the
fallback (50 by default). Repeated alerts allow new external setups, and each
setup fires once.

PB uses the existing raw mGann wave price/length and volume/delta comparisons,
independent of the chart's optional EMA/ADX Smart Filter. Developing PB fires
without right-side pivot confirmation or candle close and can change as the
wave evolves. Missing delta never establishes the delta branch; the volume
branch remains usable. No fixed delta sign is required for the inward wave.

SMC settings -> HH / HL / LL / LH toggles swing labels independently of
BOS/CHoCH, liquidity, zones and swing calculations. M3/M5 and higher
timeframes use the complete loaded chart history for SMC; truncating them to
a day could lose older structure while leaving PD visible. M1 and faster
timeframes retain the bounded computation window.
