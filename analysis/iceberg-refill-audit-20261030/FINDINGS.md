# ICE refill audit against the original SI 2.08 detector

Date: 2026-10-30, fixed UTC+7. Scope: Windows NTtoTV, installed SI 2.08,
local read-only market-data queries, and controlled offline detector execution.
No production application source, connector configuration, credentials,
historical market-data rows, or running services were changed. Oracle was not
accessed. The files in this directory are investigation artifacts.

## Conclusion

The user's observation is confirmed for the previous US session. The Python
implementation is NOT behaviorally equivalent to SI 2.08. A newly verified
missing confirmation gate allows Python to emit a zero-refill overfill on an
input sequence for which the original detector emits no ICE. Existing
differences in price-movement/lifecycle accounting also remain.

This establishes a concrete port mismatch. It does NOT establish that this
gate caused all the zero-refill ICE recorded yesterday. Historical MBO was not
retained, so that session cannot be reconstructed from trade shards and compact
final ICE states alone. The live identity-continuity diagnostics are concerning
and require a separate feed-level investigation.

## Original artifact and evidence boundary

Installed JAR:
`C:/Bookmap/API/Layer1ApiModules/7.4.0.1---7.7.1.9999---2---stops-icebergs-on-chart---2.08.jar`

SHA-256:
`317e2a8b45e3290e2d4fd41a371e06f08f71b9f3c2fc1072f91b3eb682a215ab`

The digest was rechecked before replay. This matches the artifact identified
in `../si-2.08-20261029/inventory/identity.json`. Previous REA archive inspection
failed on the Windows case-only class-name collision; no successful REA archive
graph or Evidence ID is claimed for this JAR. The existing saved REA result was
reused rather than repeating the unsupported extraction.

Supplementary original-byte inspection used Bookmap's existing `javap -p -c`
against this exact JAR. The new harness calls the ORIGINAL compiled detector
`com.bookmap.a.a.a.a`, not the CFR reconstruction. It starts no Bookmap addon
entrypoint, provider, licensing flow, or network connection. This is controlled
execution of a detector class, not a live Bookmap/GC feed comparison.

## Confirmed history

All windows below use detectedTime and fixed UTC+7. Quantities and refill counts
are the latest retained per-order state, not values available at initial alert
time. Snapshot capture: approximately 05:41 on Oct 30.

| Detection window | ICE | Refill = 0 | Refill > 0 |
| --- | ---: | ---: | ---: |
| Oct 29, 00:00-03:00 | 57 | 4 | 53 |
| Oct 29, 03:00-24:00 | 61 | 61 | 0 |
| Oct 29, 19:00-Oct 30, 04:00 | 15 | 15 | 0 |

All 61 post-03:00 detections and all 15 previous-US-session detections have
`detectionReason=overfill`. This is independent of the display minimum: the
post-03:00 window has 47 ICE at volume >=5 and 31 at >=10, all zero refill.
The US window has seven at >=5 and three at >=10, all zero refill.

The retained snapshot contains 330 orders: 95 zero-refill and 235 nonzero.
Thus this is a sharp change after the overnight session, not a counter which
has always been absent. The time windows do not identify an exact causal
deployment or first missing MBO event.

The read-only DB audit and public REST histogram agree. Serialization and
display retain the engine's counter:

- `backend/app/models/icebergs.py:67,90`: explicit refillCount round trip.
- `backend/app/storage/liquidity_store.py:376-420`: complete latest payload.
- `backend/app/pipeline.py:757-838`: publication/snapshot retain quantities.
- `frontend/src/orderflow/nativeIcebergs.ts:61-122`: sequence/session handling
  preserves counts, including when retiring a previous session's active trace.
- `frontend/src/liquidity/icebergs.ts:192`: tooltip sums actual refillCount.

No tooltip or persistence reset was found. REST can retire stale-session active
states for presentation; this changes status/endTime, not refillCount.

## New finding: missing SI confirmation gate

Original detector `com.bookmap.a.a.a.a.onTrade`:

1. Processes positive trades only when its flag `b` is true (offsets 0-8).
2. A first aggressor ID seeds an internal chain; a different aggressor ID starts
   a chain and records the current aggressor side.
3. An opposite-side trade during that active chain cancels it and sets `b=false`
   (offsets 68-95). That SAME trade still reaches passive remainder deduction
   at offset 185; subsequent trades are skipped.
4. MBO send/replace/cancel calls `a(true)`, ending/resetting the chain and
   setting `b=true`. Depth calls `a(false)`, resetting the chain without
   rearming a false flag.

This is not just an SI Stops display option. `SitIndicator` always registers
this detector in its MBO and trade listener lists (`SitIndicator.java:76-77`).
The option `x` controls stop callbacks/additional listeners/depth subscription;
it does not remove the detector's internal trade gate.

Python `NativeIcebergDetector.on_trade` has synchronization/source/sequence
checks, but no equivalent internal chain gate. Its positive known trades
continue subtracting from the candidate remainder.

Controlled counterexample, no intervening MBO after the initial advertisement:

| Step | Input | Original candidate remainder/action | Python |
| --- | --- | --- | --- |
| 1 | NEW resting ASK A, size 10 | 10, armed | 10 |
| 2 | BUY 4 against A, aggressor X | 6; seed chain | 6 |
| 3 | BUY 3 against A, aggressor Y | 3; chain starts | 3 |
| 4 | SELL 1 against other order B | gate becomes false | A stays 3 |
| 5 | BUY 4 against A, aggressor W | skipped; no ICE | overfill ICE, refill 0 |

This exact difference was reproduced against the installed compiled SI class.
A second replay adds an unrelated NEW at step 6: original rearms and first
confirms A at step 7; Python already confirmed at step 5.

Important implementation boundary for a later repair: SI separately updates
the execution totals of already-detected orders through `h -> g -> l`, BEFORE
the core detector callback. Those listeners remain active when `b=false`.
Gating the entire Python on_trade method would incorrectly discard executed
volume. Confirmation tracking and detected-order lifecycle must be separated.
Likewise the cancelling trade itself must still be processed; looking only at
the stop engine's post-trade armed state would skip it incorrectly.

## Other confirmed differences and timing limitations

- Same-ID reprice: original retains identity and can confirm when the previous
  tranche is exhausted, even if the replacement changes price. Python resets
  an undetected candidate at its new price and invalidates a detected ICE.
  Actual-JAR replay: original confirms at step 3; Python does not confirm.
- Traded-through ICE: Python retires its single-price identity on a crossing
  trade; SI's original detector/lifecycle does not implement that retirement
  in the traced paths. Python consequently stops its subsequent refill totals.
  This is a documented conservative modeling choice, not full SI movement
  accounting. It cannot alone explain the loss that began before this guard
  was introduced on Oct 29.
- The two familiar native triggers themselves match on ordered, same-price
  input: negative displayed remainder after a trade; or zero remainder before
  a positive replacement. Normal refill replay produces refillCount=2.
- SI's public IcebergEvent exposes executed sizes, not refillCount. The LQ
  refill counter is an independently derived observation of positive known
  replacements after execution exhaustion. Overfill can legitimately have 0.
- Both original SI and Python can misclassify deliberately misordered input:
  size 10 -> absolute CHANGE 6 -> older trade 4 -> trade 3 produces overfill.
  Under the tested hypothesis that CHANGE already incorporates the older
  fill, this double-deducts it. A stale positive CHANGE after newer exhaustion
  can also produce a false refill. These tests prove dependency on normalized
  input semantics/order; they do not prove actual occurrence in yesterday's
  direct R|Protocol stream. Copying the missing SI gate does not reconcile
  absolute MBO sizes with out-of-order executions.

## Current live diagnostics and mapping review

At the saved capture, Rithmic reports ICE synchronized and dropped orders 0,
but no MBO sequence is supplied (`mboLastSequence=null`). Initial image
completion therefore does not prove continuing completeness.

- trade_known=2744; trade_unknown=57337: about 95.4% of trades have no tracked
  passive ID in the detector.
- change_known=3555; change_unknown=35928: about 91.0% of CHANGE rows reference
  an untracked identity. Such rows cannot increase the current refill counter.
- candidate_repriced=3033; removed_trade_side_price=443.
- detected_overfill=23; no detected_refill counter.
- Last observed overfill: displayed remainder 2, trade volume 4, last MBO
  advertisement approximately 703 seconds before that trade. No matching late
  reduction was observed for this context.

These are diagnostic ratios, not a direct measurement of packet loss. Reasons
can include tracking coverage, lifecycle choices, missing transitions, or
provider semantics. An old advertisement can also remain valid for a resting
order; its age alone does not prove a false iceberg.

RProtocol enum/field checks against the supplied 0.90.0.0 schema found no
mapping discrepancy: NEW=1/CHANGE=2/DELETE=3, passive ID149238, aggressor ID154641,
size64=159009. Current frames have approximately one order row per message.
Routing sends all accepted actions to the detector; no selective CHANGE filter
or candle-source arbitration drop was found. Raw R|Protocol semantics must
still be distinguished from Bookmap's native RAPI/provider callback contract.

## Reproduction and validation

From repository root:

```powershell
backend/.venv/Scripts/python.exe analysis/iceberg-refill-audit-20261030/replay_original_si.py
backend/.venv/Scripts/python.exe analysis/iceberg-refill-audit-20261030/capture_summary.py
```

- 13 finite controlled sequences executed successfully against the original
  JAR and current Python detector, with explicit assertions of matches AND
  expected mismatches. This is not a claim of complete SI equivalence.
- Focused existing native ICE, Rithmic ICE and protocol suite: 74 passed.
  These tests validate current implemented behavior; they do not establish
  vendor-feed continuity or correct historical alerts.
- `replay-results.json`: synthetic input sequences and original/Python results.
- `runtime-summary.json`: bounded history aggregates and selected diagnostics;
  excludes settings/credentials/raw MBO.

## Remaining work boundary

The confirmation-gate mismatch, reprice difference, history counts, and
counter-preservation questions are answered. The exact cause of every
post-03:00 zero-refill detection remains unresolved. A production repair should
first reproduce SI candidate-gate versus lifecycle behavior in separate tests,
then verify direct-feed identity continuity with a bounded in-memory event
context or controlled matched-provider replay. Do not fabricate historical
refills or declare all overfill ICE false from this audit.
