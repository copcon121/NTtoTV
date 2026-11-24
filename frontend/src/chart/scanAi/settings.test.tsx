import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadScanSettings, normalizeScanSettings, saveScanSettings, useScanSettings } from "./settings";
import { alreadyDrawn, prepareSuggestions, scanDrawingId } from "./geometry";
import { scanDrawing } from "../../workspace/scanDrawing";
import { useScanAi } from "./useScanAi";
import type { ScanAiSuggestion } from "./types";
const suggestion: ScanAiSuggestion = {
  id: "line-a", group: "lines", type: "support_trendline", state: "waiting", strength: "strong", score: 90,
  drawingTool: "trendline", anchors: [{time: 1700000000, price: 100}, {time: 1700003600, price: 160}],
};
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe("saved scan preferences", () => {
  it("migrates smc-only to empty and stores settings without transient results", () => {
    expect(normalizeScanSettings({ groups: ["smc"] as any }).groups).toEqual([]);
    saveScanSettings("one", { groups: [], strength: "strong", ...{ suggestions: [suggestion], active: true } });
    expect(loadScanSettings("one").groups).toEqual([]);
    expect(JSON.stringify(loadScanSettings("one"))).not.toContain("suggestions");
    expect(loadScanSettings("two").groups).not.toEqual([]);
  });
  it("syncs chart/widget instances and survives remount", () => {
    const a = renderHook(() => useScanSettings("shared"));
    const b = renderHook(() => useScanSettings("shared"));
    act(() => a.result.current[1]({ strength: "strong", patterns: [] }));
    expect(b.result.current[0].strength).toBe("strong");
    a.unmount(); b.unmount();
    const c = renderHook(() => useScanSettings("shared"));
    expect(c.result.current[0].patterns).toEqual([]);
  });
});
describe("scan geometry", () => {
  it("dedupes overlapping lines with changed IDs and rejects invalid or SMC geometry", () => {
    const shifted = { ...suggestion, id: "line-b", anchors: suggestion.anchors.map(a => ({time:a.time+60, price:a.price+1})) };
    expect(prepareSuggestions([suggestion, shifted, {...suggestion, group:"smc"},
      {...suggestion, anchors:[{time:NaN,price:100}]}])).toHaveLength(1);
    const drawing = scanDrawing(suggestion, "1m", "#35d6b0");
    expect(alreadyDrawn(shifted, [drawing], "1m")).toBe(true);
    expect(scanDrawing(suggestion, "1m", "#fff").id).toBe(drawing.id);
    expect(scanDrawingId(suggestion, "5m")).not.toBe(scanDrawingId(suggestion, "1m"));
  });
  it("rejects stale fetch responses after settings change and close", async () => {
    const pending: ((response: Response) => void)[] = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => pending.push(resolve))));
    const hook = renderHook(() => useScanAi({ symbol:"GC",contract:"GC",timeframe:"1m",onAddDrawings:vi.fn() }));
    act(() => hook.result.current.setIsOpen(true));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => hook.result.current.setStrength("strong"));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1](Response.json({suggestions:[suggestion]})));
    await waitFor(() => expect(hook.result.current.suggestions).toHaveLength(1));
    await act(async () => pending[0](Response.json({suggestions:[{...suggestion, id:"obsolete"}]})));
    expect(hook.result.current.suggestions[0].id).toBe("line-a");
    act(() => { void hook.result.current.runScan(); hook.result.current.setIsOpen(false); });
    await act(async () => pending[2](Response.json({suggestions:[{...suggestion,id:"closed"}]})));
    expect(hook.result.current.suggestions).toEqual([]);
    hook.unmount(); vi.unstubAllGlobals();
  });
});
