# Pine v4 Supertrend golden fixture

`pine_v4_supertrend_golden.json` is a language-neutral fixture for the exact
math in the supplied Pine v4 study. It is intentionally outside `frontend/`
and `backend/` so both implementations can consume the same oracle.

## Exact semantics

For bar `t`, with `source = hl2 = (high + low) / 2`:

```text
TR[t] = max(high-low, abs(high-close[t-1]), abs(low-close[t-1]))
basicLower[t] = source[t] - multiplier * ATR[t]   // Pine variable `up`
basicUpper[t] = source[t] + multiplier * ATR[t]   // Pine variable `dn`

previousLower = nz(finalLower[t-1], basicLower[t])
previousUpper = nz(finalUpper[t-1], basicUpper[t])

finalLower[t] = previous close > previousLower
                  ? max(basicLower[t], previousLower)
                  : basicLower[t]
finalUpper[t] = previous close < previousUpper
                  ? min(basicUpper[t], previousUpper)
                  : basicUpper[t]

trend starts at +1
down -> up only when close > previousUpper
up -> down only when close < previousLower
```

The comparisons are strict. Equality does not flip direction.

The two ATR modes deliberately differ at the dataset boundary:

- `wilderRma` models Pine v4 `atr(period)`: RMA with alpha `1/period`, seeded
  by an SMA, over `tr(true)`. The first bar therefore contributes `high-low`.
- `simpleSma` models `sma(tr, period)`: rolling SMA over the `tr` variable,
  equivalent to `tr(false)`. Its first value is `na`, and `sma` counts the
  latest `period` non-`na` values, so its warm-up finishes one bar later here.

Signal booleans represent whether an event fires. Pine's initial `na` boolean
condition is normalized to `false`. `changeSignal` is exactly
`buySignal || sellSignal` for this two-state trend.

Do not round internal values to display precision or GC tick size. Binary-float
consumers may compare numeric outputs with the fixture's declared `1e-12`
tolerance.

## Covered edge cases

- `60000`: Wilder ATR is ready while SMA ATR is still warming up.
- `120000`: RMA close equals the previous lower band; strict equality does not
  trigger a sell.
- `180000`: close is strictly below the previous lower band; both modes sell.
- `240000`: an upward gap produces `TR=4`; close equals the previous upper band,
  so neither mode buys.
- `300000`: close is strictly above the previous upper band; both modes buy.
- `360000`: a range shock separates RMA from SMA.
- `420000`: close equals SMA's previous lower band, so SMA does not sell, while
  the narrower RMA state does sell.
- `480000`: close moves strictly below SMA's previous lower band and SMA sells.
- `realtimeRollbackProbe`: two successive snapshots of the same live bar are
  each replayed from the last committed bar. The first shows a temporary RMA
  sell; the later recovery removes it. Chaining the second snapshot from the
  first would incorrectly latch the sell and fail this probe.

## Verification

The expected values were derived with exact decimal/rational arithmetic and
manually checked against the Pine recurrence. `verify_fixture.py` is a second,
isolated Decimal reference implementation; it imports no application code and
also asserts that every named edge case remains present.

Run from the repository root:

```powershell
backend\.venv\Scripts\python.exe test-fixtures\supertrend\verify_fixture.py
```

Expected output:

```text
OK: 9 closed bars x 2 ATR modes plus 2 independent realtime rollback snapshots
```
