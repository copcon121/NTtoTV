# NT_AddOn — GC Chart Platform NinjaTrader 8 Bridge

C# AddOn that subscribes to GC Level 1 trade/quote data in NinjaTrader 8 and
forwards it to the Backend over `ws://127.0.0.1:<port>/ws/nt`.

This directory was scaffolded by task **1.3** of the `gc-chart-platform` spec.
It contains the project skeleton, the configuration model, and the
property-test project. Data-capture, queue, worker, and reconnect logic are
implemented by later tasks (4.x).

## Layout

```
nt-addon/
  NtAddOn.sln
  src/
    NtAddOn.Core/            netstandard2.0 — platform-agnostic, fully testable
      Configuration/         AddOnConfig (candidate list, host/port, queue
                             capacity, critical-overload threshold, compression,
                             manual override)
      Streaming/             StreamId, Channel, ConnectionStatus
    NtAddOn.NinjaTrader/     net48 — the ONLY project that references NinjaTrader
      NinjaTrader/           NinjaTrader-coupled sources (excluded when the SDK
                             is absent)
      AddOnInfo.cs           platform-agnostic host metadata (always compiles)
  tests/
    NtAddOn.Tests/           net48 — xUnit + FsCheck property tests
  config.sample.json         example configuration
```

## Why the split?

NinjaTrader 8 assemblies (`NinjaTrader.Core`, `NinjaTrader.Custom`) are not
redistributable and are unavailable in CI or on dev machines without
NinjaTrader installed. To keep everything except the thin NinjaTrader adapter
buildable and testable everywhere:

- **`NtAddOn.Core`** holds the config model and domain types with **no**
  NinjaTrader dependency. It is the unit/property-test target.
- **`NtAddOn.NinjaTrader`** isolates the NinjaTrader dependency. When the SDK is
  not found, its NinjaTrader-coupled sources are excluded from the build and a
  warning is emitted, so the solution still restores and the testable code still
  compiles.

## Deployment decision

The AddOn is intended to be deployed as compiled DLLs built from this solution,
then copied into NinjaTrader 8's `bin/Custom` area. It is not intended to be
pasted/imported as NinjaScript source. Because of that, the codebase can keep the
current SDK-style project layout and modern C# syntax; no C# 5 source rewrite is
needed for the MVP.

## Configuration model (`AddOnConfig`)

| Field | Requirement | Notes |
| --- | --- | --- |
| `CandidateContracts` | 1.5 | GC contracts subscribed on start; non-empty, no duplicates |
| `BackendHost` / `BackendPort` / `BackendPath` | 1.4 | builds `ws://host:port/ws/nt` |
| `QueueCapacity` | 2.4–2.6 | fixed Bounded_Queue capacity |
| `CriticalOverloadThreshold` | 2.6 | in `(0, QueueCapacity]`; trades may drop at/above |
| `CompressionEnabled` | 2.2 | worker-side compression toggle |
| `ManualContractOverride` | 10.4 | optional; must be a candidate; disables auto-resolution |

## Building

Requires the .NET SDK (>= 7) and, to build the NinjaTrader project, a local
NinjaTrader 8 install.

```powershell
# Core + tests (no NinjaTrader needed):
dotnet build src/NtAddOn.Core/NtAddOn.Core.csproj
dotnet test  tests/NtAddOn.Tests/NtAddOn.Tests.csproj

# Full solution incl. the NinjaTrader AddOn (point at your install):
dotnet build NtAddOn.sln -p:NinjaTraderBinDir="$env:USERPROFILE\Documents\NinjaTrader 8\bin"
```

## Tests

Property-based tests use **FsCheck** (xUnit runner) at **>= 100 iterations**,
tagged `Feature: gc-chart-platform, Property {n}`. The numbered correctness
properties (1, 3, 4, …) are implemented in their own later tasks; this scaffold
includes a harness smoke test plus example/edge unit tests for the config model.
