import { describe, expect, it, vi } from "vitest";
import { SYNC_PROTOCOL, type ChartSyncConfig, type SharedDrawing, type WidgetSyncUpdate } from "../chart/shared/sync";
import { WorkspaceSyncRelay } from "./syncRelay";
import { syncGroupKey } from "./syncSettings";
import type { WorkspacePanel, WorkspacePanelSync } from "./types";

const context = { workspaceId: "w", symbol: "GC", contract: "GC", mode: "live" as const };
const origin = "https://example.test";
const linked: WorkspacePanelSync = { groupId: "A", syncViewport: true, syncDrawings: true };
const panel = (id: string, sync = linked): WorkspacePanel => ({ id, type: "chart", timeframe: "1m", sync });
const drawing = (id: string, price = 2300): SharedDrawing => ({ id, tool: "trendline", anchors: [{ utcMs: 1700000000000, price }, { utcMs: 1700000060000, price: price + 1 }] });
function fixture(panels = [panel("fp"), panel("mp"), panel("lq", { ...linked, groupId: "B" })], saved?: unknown) {
  let n = 0;
  const persist = vi.fn();
  const changed = vi.fn();
  const relay = new WorkspaceSyncRelay(context, origin, panels, saved, persist, changed, () => `id-${++n}`);
  const frame = (id: string, mountId = id) => {
    const target = { postMessage: vi.fn() };
    const remove = relay.registerFrame(id, mountId, target);
    const receive = (data: unknown, overrides = {}) => relay.receive({ data, origin, source: target as unknown as Window, ...overrides });
    const hello = { protocol: SYNC_PROTOCOL, type: "hello", widgetId: id, instanceId: mountId, ...context, timeframe: "1m" };
    receive(hello);
    const config = () => target.postMessage.mock.calls.slice(-1)[0]?.[0].config as ChartSyncConfig;
    const update = (change: WidgetSyncUpdate["change"], overrides = {}) => receive({ protocol: SYNC_PROTOCOL, type: "update", widgetId: id,
      instanceId: mountId, epoch: config().epoch, baseRevision: config().revision, sequence: target.postMessage.mock.calls.length,
      ...context, timeframe: "1m", change, ...overrides });
    return { target, remove, receive, hello, config, update };
  };
  return { relay, persist, changed, frame };
}

describe("workspace group relay", () => {
  it("cancels the departed group without cancelling an unrelated destination tool", () => {
    const f = fixture(); const fp = f.frame("fp"); const mp = f.frame("mp"); const lq = f.frame("lq");
    const a = { selectionId: "a", tool: "trendline" as const };
    const b = { selectionId: "b", tool: "rectangle" as const };
    fp.update({ toolSelection: a }); lq.update({ toolSelection: b });
    f.relay.configure([panel("fp", { ...linked, groupId: "B" }), panel("mp"), panel("lq", { ...linked, groupId: "B" })]);
    expect(mp.config().toolSelection).toEqual({ ...a, tool: null });
    expect(fp.config().toolSelection).toEqual(b);
    expect(lq.config().toolSelection).toEqual(b);
    expect(f.persist).not.toHaveBeenCalled();
  });
  it("ACKs transient tools to sender and peers without revision or persistence; stale cancel preserves newer intent", () => {
    const f = fixture(); const fp = f.frame("fp"); const mp = f.frame("mp"); const lq = f.frame("lq");
    const first = { selectionId: "first", tool: "trendline" as const };
    const next = { selectionId: "next", tool: "rectangle" as const };
    expect(fp.update({ toolSelection: first })).toBe(true);
    expect(fp.config().toolSelection).toEqual(first);
    expect(mp.config().toolSelection).toEqual(first);
    expect(lq.config().toolSelection).toBeUndefined();
    expect(mp.update({ toolSelection: next })).toBe(true);
    expect(fp.update({ toolSelection: { ...first, tool: null } })).toBe(false);
    expect(fp.config().toolSelection).toEqual(next);
    expect(fp.update({ drawingOps: [] })).toBe(false);
    expect(fp.config().toolSelection).toEqual(next);
    expect(mp.update({ toolSelection: { ...next, tool: null } })).toBe(true);
    expect(fp.config().toolSelection).toEqual({ ...next, tool: null });
    expect(fp.config().revision).toBe(0);
    expect(f.persist).not.toHaveBeenCalled();
    expect(fp.update({ toolSelection: first })).toBe(true);
    expect(fp.update({ drawingOps: [{ op: "upsert", drawing: drawing("saved") }] })).toBe(true);
    const saved = f.persist.mock.calls[f.persist.mock.calls.length - 1][0];
    expect(JSON.stringify(saved)).not.toContain("selectionId");
    expect(fixture(undefined, saved).frame("fp").config().toolSelection).toBeUndefined();
  });

  it("clears tool intent on reload, preferences, remount and suspension; rejects stale identity and disabled tools", () => {
    const f = fixture(); const fp = f.frame("fp"); const mp = f.frame("mp");
    const selection = { selectionId: "place", tool: "trendline" as const };
    fp.update({ toolSelection: selection }); const epoch = fp.config().epoch;
    fp.receive(fp.hello);
    expect(mp.config().toolSelection).toEqual({ ...selection, tool: null });
    expect(fp.update({ toolSelection: selection }, { epoch, sequence: 100 })).toBe(false);
    expect(fp.update({ toolSelection: { ...selection, tool: "order_bracket" } } as never)).toBe(false);
    expect(fp.update({ toolSelection: { ...selection, selectionId: "x".repeat(161) } })).toBe(false);
    fp.update({ toolSelection: selection });
    f.relay.configure([panel("fp", { ...linked, syncDrawings: false }), panel("mp")]);
    expect(mp.config().toolSelection?.tool).toBeNull();
    expect(fp.update({ toolSelection: selection })).toBe(false);
    mp.update({ toolSelection: selection });
    f.relay.frameLoaded("mp", "mp");
    expect(mp.config().toolSelection?.tool).toBeNull();
    mp.update({ toolSelection: selection }); mp.remove();
    expect(f.frame("mp", "new").config().toolSelection?.tool).toBeNull();
    const main = f.relay.connection("fp")!;
    expect(main).toBeUndefined(); // Registered frames cannot become in-process sources.
    expect(f.persist).not.toHaveBeenCalled();
  });

  it("relays in-process Main tools and clears pending selection on suspend or group change", () => {
    const f = fixture([panel("main"), panel("mp")]); const mp = f.frame("mp");
    f.relay.connection("main")!.publish({ toolSelection: { selectionId: "main-tool", tool: "vertical_line" } });
    expect(mp.config().toolSelection?.tool).toBe("vertical_line");
    f.relay.suspend(); f.relay.resume();
    expect(mp.config().toolSelection?.tool).toBeNull();
    f.relay.connection("main")!.publish({ toolSelection: { selectionId: "main-next", tool: "horizontal_ray" } });
    f.relay.configure([panel("main", { ...linked, groupId: "B" }), panel("mp")]);
    expect(mp.config().toolSelection?.tool).toBeNull();
    expect(f.persist).not.toHaveBeenCalled();
  });
  it("binds exact origin, registered frame, mount, symbol, mode and epoch", () => {
    const f = fixture(); const fp = f.frame("fp");
    const viewport = { fromUtcMs: 1700000000000, toUtcMs: 1700000300000 };
    expect(fp.receive(fp.hello, { origin: "https://evil.test" })).toBe(false);
    expect(fp.receive(fp.hello, { source: {} })).toBe(false);
    expect(fp.receive({ ...fp.hello, instanceId: "old" })).toBe(false);
    expect(fp.update({ viewport }, { symbol: "SI" })).toBe(false);
    expect(fp.update({ viewport }, { mode: "replay" })).toBe(false);
    expect(fp.update({ viewport }, { replayId: "other" })).toBe(false);
    expect(fp.update({ viewport }, { epoch: "old" })).toBe(false);
    expect(f.persist).not.toHaveBeenCalled();
    expect(fp.update({ viewport })).toBe(true);
    expect(fp.config().revision).toBe(1);
    expect(fp.target.postMessage.mock.calls.slice(-1)[0]?.[1]).toBe(origin);
  });

  it("relays one canonical UTC range across timeframes, ACKs sender, isolates groups and suppresses echoes", () => {
    const f = fixture(); const fp = f.frame("fp"); const mp = f.frame("mp"); const lq = f.frame("lq");
    const viewport = { fromUtcMs: 1700000000000, toUtcMs: 1700000300000 };
    fp.receive({ ...fp.hello, timeframe: "30s" });
    mp.receive({ ...mp.hello, timeframe: "1D" });
    expect(fp.update({ viewport }, { timeframe: "30s", sequence: 7 })).toBe(true);
    expect(fp.config().viewport).toEqual(viewport);
    expect(mp.config().viewport).toEqual(viewport);
    expect(lq.target.postMessage).toHaveBeenCalledTimes(1);
    expect(fp.update({ viewport }, { sequence: 7 })).toBe(false);
    expect(mp.update({ viewport }, { timeframe: "1D" })).toBe(false);
    expect(f.persist).toHaveBeenCalledTimes(1);
    expect(fp.update({ viewport: { ...viewport, toUtcMs: viewport.toUtcMs + 60000 } }, { baseRevision: 0, sequence: 8 })).toBe(false);
    expect(fp.config().viewport).toEqual(viewport);
  });

  it("merges concurrent different IDs and prevents stale overwrite/deletion resurrection", () => {
    const f = fixture(); const fp = f.frame("fp"); const mp = f.frame("mp");
    expect(fp.update({ drawingOps: [{ op: "upsert", drawing: drawing("one") }] }, { sequence: 1 })).toBe(true);
    expect(mp.update({ drawingOps: [{ op: "upsert", drawing: drawing("two") }] }, { baseRevision: 0, sequence: 1 })).toBe(true);
    expect(mp.config().drawings.map(d => d.id)).toEqual(["one", "two"]);
    expect(mp.update({ drawingOps: [{ op: "upsert", drawing: drawing("one", 999) }] }, { baseRevision: 0, sequence: 2 })).toBe(false);
    expect(fp.update({ drawingOps: [{ op: "upsert", drawing: drawing("one", 2400) }] }, { sequence: 2 })).toBe(true);
    expect(mp.config().drawings[0].anchors[0].price).toBe(2400);
    expect(fp.update({ drawingOps: [{ op: "delete", id: "one" }] }, { sequence: 3 })).toBe(true);
    expect(mp.update({ drawingOps: [{ op: "upsert", drawing: drawing("one") }] }, { baseRevision: 2, sequence: 3 })).toBe(false);
    expect(mp.config().drawings.map(d => d.id)).toEqual(["two"]);
  });

  it("retires a same-window document and old timeframe/group queued changes", () => {
    const f = fixture(); const fp = f.frame("fp");
    fp.update({ drawingOps: [{ op: "upsert", drawing: drawing("saved") }] });
    const oldEpoch = fp.config().epoch;
    expect(fp.receive(fp.hello)).toBe(true); // Same contentWindow and URL mountId after document reload.
    expect(fp.config().epoch).not.toBe(oldEpoch);
    expect(fp.config().drawings).toEqual([drawing("saved")]);
    expect(fp.update({ drawingOps: [{ op: "delete", id: "saved" }] }, { epoch: oldEpoch, sequence: 100 })).toBe(false);
    const beforeTimeframe = fp.config().epoch;
    expect(fp.receive({ ...fp.hello, timeframe: "5m" })).toBe(true);
    expect(fp.config().epoch).not.toBe(beforeTimeframe);
    expect(fp.update({ viewport: { fromUtcMs: 1, toUtcMs: 2 } }, { epoch: beforeTimeframe })).toBe(false);
    expect(fp.update({ viewport: { fromUtcMs: 1, toUtcMs: 2 } })).toBe(false);
    expect(fp.update({ viewport: { fromUtcMs: 1, toUtcMs: 2 } }, { timeframe: "5m" })).toBe(true);
    expect(fp.receive({ ...fp.hello, timeframe: "bogus" })).toBe(false);
    const beforeGroup = fp.config().epoch;
    f.relay.configure([panel("fp", { ...linked, groupId: "B" })]);
    expect(fp.update({ drawingOps: [{ op: "delete", id: "saved" }] }, { epoch: beforeGroup, timeframe: "5m" })).toBe(false);
    expect(fp.config()).toMatchObject({ groupId: "B", drawings: [] });
  });

  it("replays saved shared layer on reload/remount without local drawing or layout writes", () => {
    const local = { id: "local", tool: "rectangle" as const, anchors: [] };
    const panels = [{ ...panel("fp"), drawings: [local] }, panel("mp")];
    const f = fixture(panels); const fp = f.frame("fp");
    fp.update({ viewport: { fromUtcMs: 1000, toUtcMs: 5000 }, drawingOps: [{ op: "upsert", drawing: drawing("shared") }] });
    const saved = f.persist.mock.calls.slice(-1)[0]![0];
    const oldEpoch = fp.config().epoch;
    f.relay.frameLoaded("fp", "fp");
    expect(fp.config().epoch).not.toBe(oldEpoch);
    expect(fp.update({ drawingOps: [{ op: "delete", id: "shared" }] }, { epoch: oldEpoch })).toBe(false);
    fp.remove(); const remount = f.frame("fp", "new-mount");
    expect(fp.receive(fp.hello)).toBe(false);
    expect(remount.config().drawings).toEqual([drawing("shared")]);
    const reloaded = fixture(panels, saved); const next = reloaded.frame("mp");
    expect(next.config().viewport).toEqual({ fromUtcMs: 1000, toUtcMs: 5000 });
    expect(next.config().drawings).toEqual([drawing("shared")]);
    expect(panels[0].drawings).toEqual([local]);
    expect(Object.keys(saved[syncGroupKey({ ...context, groupId: "A" })])).not.toContain("panels");
  });

  it("unlink/flags changes revoke old epoch and keep local layer; removal and suspension reject updates", () => {
    const f = fixture(); const fp = f.frame("fp"); const oldEpoch = fp.config().epoch;
    f.relay.configure([panel("fp", { ...linked, groupId: null })]);
    expect(fp.config()).toMatchObject({ groupId: null, syncViewport: false, syncDrawings: false, drawings: [] });
    expect(fp.update({ viewport: { fromUtcMs: 1, toUtcMs: 2 } }, { epoch: oldEpoch })).toBe(false);
    f.relay.configure([panel("fp", { ...linked, syncDrawings: false })]);
    expect(fp.update({ drawingOps: [{ op: "upsert", drawing: drawing("one") }] })).toBe(false);
    f.relay.suspend();
    expect(fp.receive(fp.hello)).toBe(false);
    f.relay.resume();
    f.relay.configure([]);
    expect(fp.receive(fp.hello)).toBe(false);
    expect(f.relay.connection("fp")).toBeUndefined();
  });

  it("rejects unsupported/trading/invalid data and future revisions", () => {
    const f = fixture(); const fp = f.frame("fp");
    expect(fp.update({ drawingOps: [{ op: "upsert", drawing: { ...drawing("order"), tool: "order_bracket" } }] } as never)).toBe(false);
    expect(fp.update({ viewport: { fromUtcMs: Number.NaN, toUtcMs: 5 } })).toBe(false);
    expect(fp.update({ viewport: { fromUtcMs: 1, toUtcMs: 2 } }, { baseRevision: 99 })).toBe(false);
    expect(f.persist).not.toHaveBeenCalled();
  });

  it("connects main/mini in process with the same canonical state and invalidates old preferences", () => {
    const f = fixture([panel("main"), panel("mini")]);
    const main = f.relay.connection("main")!;
    main.publish({ drawingOps: [{ op: "upsert", drawing: drawing("line") }] });
    expect(f.relay.connection("mini")!.config!.drawings).toEqual([drawing("line")]);
    f.relay.configure([panel("main", { ...linked, groupId: "B" }), panel("mini")]);
    main.publish({ drawingOps: [{ op: "delete", id: "line" }] });
    expect(f.relay.connection("mini")!.config!.drawings).toEqual([drawing("line")]);
    expect(f.relay.connection("main")!.config!.drawings).toEqual([]);
  });
});
