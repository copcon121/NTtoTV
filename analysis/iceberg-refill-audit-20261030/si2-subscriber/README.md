# SI 2 diagnostic subscriber

## V2 cross-classloader correction

Use the immutable `NTtoTV-SI2-Diagnostic-Capture-v2.jar`, distinct class
`Si2DiagnosticCaptureV2` and display name `NTtoTV SI2 Diagnostic Capture V2`.
The original V1 JAR is unchanged. V2 is prepared here; this build does not load
it into Bookmap.

V1 connected normally and received a snapshot, but native SI DTOs from the
provider's separate classloader failed its local `instanceof EventInterface`.
V2 accepts only the exact shipped `IcebergEvent`/`StopEvent` public DTO names,
reads only their known public zero-argument getters with `Class.getMethod`,
checks return signatures, and copies values into a local event DTO. It never
uses private fields, `getDeclaredMethod`, `getDeclaredField`, `setAccessible`,
or overrides any provider authorization/version checks.

V2 requests a **90-minute** retained-event snapshot so the already-seen early
ICE remain in the interval. The capture-start JSON records `lookbackMinutes:90`.
The 50,000-record, 5,000-queued-line, and two-hour limits remain.

`build_v2.py` compiles and runs `Si2CrossLoaderTest`. That test loads the
ORIGINAL SI JAR under an isolated URLClassLoader with the platform classloader
as parent, verifies the old `instanceof` failure, verifies field conversion and
JSON output, confirms STOP events are ignored, and rejects unrelated objects.
Its output is saved at `build-v2/cross-loader-test.txt`.

The details below describe the original V1 design; its 30-minute interval is
superseded by the V2 90-minute interval.

This normal Bookmap addon consumes the installed SI 2.08 public broadcasting
API. It is separate from the disabled NTtoTV Bookmap market-data bridge.

## Scope

- Attach only to `GCZ6.COMEX@RITHMIC`.
- No market-data listeners/subscriptions (`@NoAutosubscription`), network code,
  trading calls, settings writes, private-field reflection, process attach,
  provider startup, or application restarts.
- Connect only to the online/available SI provider
  `velox.indicators.sionchart.SitIndicator` if its published broadcasting
  authorization is true. Normal library connection/version checks remain.
- Ask that provider for the preceding 30 minutes of already-retained SI
  events, then receive live SI events. Snapshot requests are once per generator
  per connection, not raw trade or MBO requests.
- Write compact ICE event records only, plus small lifecycle/error records,
  below `analysis/iceberg-refill-audit-20261030/bookmap-si-capture/`.
- Bound output to 50,000 records and two hours; the callback queue holds at most
  5,000 compact lines. Queue overflow is reported in the closing record.

The diagnostic consumer does not change SI's availability/license state, call
the provider's `setAvailable`, manufacture a license expiry, disable version
checking, alter provider filters/settings, or read private tracker fields. If
the provider is not available or authorized, output remains a status record.

## Build

From repository root:

```powershell
backend/.venv/Scripts/python.exe analysis/iceberg-refill-audit-20261030/si2-subscriber/build.py
```

The build uses installed Bookmap Java 17 and API JARs and the verified installed
SI 2.08 JAR. It packages the unmodified broadcasting runtime, SI public event
DTOs and their local runtime dependencies. It does NOT package the SI
indicator/algorithm or original native detector. This artifact is for local
diagnosis on this user's installed application; it is not a published release.

`NTtoTV-SI2-Diagnostic-Capture.jar` is ready for review. Build success plus an
offline record-format check does not establish that Bookmap loaded it or that
the provider permits a live subscription. Optional `org.dom4j` XML serializer
and JBoss VFS references are absent from the installed classpath; those are
also optional dependency branches in the original library. The ordinary
archive scanner and JSONL capture do not request those features.

## Normal load boundary

Parent agent/user must coordinate loading through Bookmap's normal addon UI.
Select the prepared JAR and attach `NTtoTV SI2 Diagnostic Capture` to the GCZ6
Rithmic chart. This does not connect to `/ws/bookmap` or reopen BM/NT as an
NTtoTV source. No code in this directory deploys or loads the addon.

Expected output records:

1. `capture_start`: alias, tick size, bounded capture settings.
2. `status` and `connection`: provider discovery and normal connection result.
3. `snapshot`: interval and provider's returned event count.
4. `iceberg_event`: original order ID, event type, nanosecond time, exact price
   level plus converted GC price, passive side, event size and running total.
5. `capture_end`: written count and queue overflow.

History and live can overlap. The `capture` field preserves provenance; compare
events using order ID, event type, time, price, event size and total size before
summing volumes. SI `eventSize` and `totalSize` are distinct; neither is a
refill counter. `MOVEMENT` events permit checking whether the LQ port lost the
same ID on a price change.

Stop the diagnostic addon in Bookmap after the comparison. The source isolation
mode in NTtoTV remains Rithmic-only throughout.
