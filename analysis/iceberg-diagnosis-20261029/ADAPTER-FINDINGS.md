# Bookmap Rithmic MBO adapter comparison

Read-only static inspection on 2026-10-29 (UTC+7). No provider login, live
Bookmap settings access, or application source modification was performed.

## Artifact and evidence

- Installed artifact: `C:/Program Files/Bookmap/lib/rithmic-adapter.jar`.
- SHA-256: `770422570ea4fe3b1866c3da2a78a2f02452060c443b70bbfe775c17b1ecaa26`.
- REA archive inventory Evidence:
  `ev_dbac75f91c017382b5c47fd1a4e26bc9ba4f3b9cd8d414f1ca87ded0db967aba`.
- Underlying inventory Evidence:
  `ev_9a024460e38da1d7e05a411938c07d2590e6cc79cf8c05eccdbf52a8aefe7d31`.
- Archive manifest:
  `agm_e5353efa2ced6ac28f9f859048c57e7e0229f21812a82cb77d488ef2997255b3`.
- The JAR contains `rithmic/windows/RithmicAdapter.dll` plus Java wrappers.
  It uses the native Rithmic adapter, not the application's R|Protocol codec.
- Original classfile disassembly is saved in `RithmicProvider.javap.txt`.
  CFR reconstruction is supplementary, not original Java source.

## Observed Java callback behavior

`velox.api.layer1.providers.RithmicProvider.onDepthDataByOrder`:

- Original `N` (or empty event type) invokes `onMboSend` with the original
  order ID, side, rounded price/pips, and size. Bytecode offsets 380-450.
- `C` invokes `onMboReplace` with the same ID, new price and size.
  Bytecode offsets 468-534.
- `D` invokes `onMboCancel` with the same ID. Bytecode offsets 552-608.
- The Java callback does not suppress execution-related size changes, remap
  `NEW` to `CHANGE`, or synthesize cancellation upon trade exhaustion.
- Image assembly is separate and holds the current order map until image end.
- `onTrade`, offsets 102-120, passes the original order-ID strings into
  `TradeAggregator` without numeric conversion.

These observations establish only Java-side behavior. The underlying native
DLL's translation/reordering of upstream Rithmic events was not decompiled;
the Java callback is not proof of raw R|Protocol message semantics.

## Relevant difference from the current independent detector

The previously inspected SI 2.08 detector
`analysis/si-2.08-20261029/decompiled/com/bookmap/a/a/a/a.java` retains an
identity across `replace(id, newPrice, size)`. It confirms an undetected order
when the old visible remainder is zero, then replaces the remainder with size.
Its tracker does not reject a changed price. SI's lifecycle implementation
`velox/indicators/sionchart/b/n.java:44` records a MOVEMENT and moves the same
identity between price maps; `l.java:46` also handles execution at a changed
price. Our detector intentionally invalidates on a price/side mismatch and
does not seed unknown replacements. This is a real accounting difference,
but it does not establish the cause of today's sudden loss of refill events.

## Application R|Protocol codec review

The supplied `RProtocolAPI.zip` 0.90.0.0 `depth_by_order.proto` agrees with
`protocol.py:_dbo_rows`: update_type field 110121 is NEW=1, CHANGE=2,
DELETE=3; side=153612; price=154405; size64=159009 (legacy154406); ID=149238.
The parser handles packed/unpacked numeric fields and preserves repeated
field order. No evident field-number or enum error was found for complete
one-order rows. Snapshot field numbers also agree. No handwritten DBO sample
consumer or DBO section in the supplied 21-page Reference Guide was found.

The request builder agrees with the supplied subscription proto. CodeGraph
shows no history-worker MBO subscription caller; history uses its own plant.
The service currently does not filter incoming instrument/exchange fields.
An initial completed snapshot with no sequence numbers cannot prove ongoing
MBO completeness. Unexpected NEW/DELETE identity relationships require actual
wire evidence or a shadow comparison against authoritative later snapshots.

No production enum mapping or native-confirmation rule should be changed from
the static findings alone.
