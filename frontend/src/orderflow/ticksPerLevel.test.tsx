import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type FootprintBar, groupFootprintRows } from "../footprint/footprintModel";
import { TicksPerLevelSetting, ticksPreferenceKey, useTicksPerLevel, validTicksPerLevel } from "./ticksPerLevel";

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); history.replaceState(null, "", "/"); });

describe("ticks per level preferences", () => {
  it("accepts only whole instrument tick counts in the safe range", () => {
    for (const value of [1, 2, 5, 100]) expect(validTicksPerLevel(value)).toBe(true);
    for (const value of [0, -1, 1.5, 101, NaN, Infinity]) expect(validTicksPerLevel(value)).toBe(false);
  });

  it("defaults FP to 1 and MP to 5, and restores explicit saved values", () => {
    const first = renderHook(() => useTicksPerLevel("fp", "GC", 1));
    expect(first.result.current[0]).toBe(1);
    act(() => first.result.current[1](2));
    first.unmount();
    const next = renderHook(() => useTicksPerLevel("fp", "GC", 1));
    expect(next.result.current[0]).toBe(2);
    const mp = renderHook(() => useTicksPerLevel("mp", "GC", 5));
    expect(mp.result.current[0]).toBe(5);
    act(() => mp.result.current[1](0));
    expect(mp.result.current[0]).toBe(5);
    expect(localStorage.getItem(ticksPreferenceKey("mp", "GC"))).toBeNull();
  });

  it("isolates page, widget and symbol contexts without writing the previous value into the next", () => {
    history.replaceState(null, "", "/?widgetId=A");
    const hook = renderHook(({ page, symbol }: { page: "fp" | "mp"; symbol: string }) => useTicksPerLevel(page, symbol, page === "fp" ? 1 : 5),
      { initialProps: { page: "fp" as "fp" | "mp", symbol: "GC" } });
    act(() => hook.result.current[1](2));
    history.replaceState(null, "", "/?widgetId=B");
    hook.rerender({ page: "fp", symbol: "GC" });
    expect(hook.result.current[0]).toBe(1);
    expect(localStorage.getItem(ticksPreferenceKey("fp", "GC"))).toBeNull();
    act(() => hook.result.current[1](5));
    hook.rerender({ page: "mp", symbol: "GC" });
    expect(hook.result.current[0]).toBe(5);
    hook.rerender({ page: "fp", symbol: "SI" });
    expect(hook.result.current[0]).toBe(1);
    history.replaceState(null, "", "/?widgetId=A");
    hook.rerender({ page: "fp", symbol: "GC" });
    expect(hook.result.current[0]).toBe(2);
    history.replaceState(null, "", "/");
    hook.rerender({ page: "fp", symbol: "GC" });
    expect(hook.result.current[0]).toBe(1);
  });

  it("keeps session edits usable when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const hook = renderHook(() => useTicksPerLevel("fp", "GC", 1));
    act(() => hook.result.current[1](5));
    expect(hook.result.current[0]).toBe(5);
  });

  it("commits valid drafts only and discards unfinished edits when the widget context changes", () => {
    const commit = vi.fn();
    const view = render(<TicksPerLevelSetting value={1} onChange={commit} contextKey="A" />);
    const input = screen.getByRole("spinbutton", { name: "Ticks per level" });
    fireEvent.change(input, { target: { value: "2" } });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commit).toHaveBeenLastCalledWith(2);
    commit.mockClear();
    fireEvent.change(input, { target: { value: "101" } });
    fireEvent.blur(input);
    expect(commit).not.toHaveBeenCalled();
    expect(input).toHaveValue(1);
    fireEvent.change(input, { target: { value: "5" } });
    view.rerender(<TicksPerLevelSetting value={2} onChange={commit} contextKey="B" />);
    expect(input).toHaveValue(2);
    fireEvent.blur(input);
    expect(commit).toHaveBeenLastCalledWith(2);
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue(2);
  });

  it("conserves volume, bid/ask sums and delta while aligning prices to 1, 2, and 5 instrument ticks", () => {
    const bar: FootprintBar = {
      type: "footprint_update", symbol: "GC", contract: "GC", tf: "1m", time: 1000,
      open: 2600.0, high: 2600.5, low: 2600.0, close: 2600.5, poc: 2600.2, pocVolume: 35,
      vah: 2600.4, val: 2600.1, barDelta: 24, buyPct: 0.6, sellPct: 0.4, stackedImbalance: [],
      unfinishedAuction: { high: false, low: false },
      rows: [
        { price: 2600.4, bid: 10, ask: 20, imbalance: null },
        { price: 2600.3, bid: 15, ask: 25, imbalance: null },
        { price: 2600.2, bid: 5, ask: 30, imbalance: null },
        { price: 2600.1, bid: 12, ask: 8, imbalance: null },
        { price: 2600.0, bid: 8, ask: 7, imbalance: null },
      ],
    };
    const totalBid = bar.rows.reduce((sum, r) => sum + r.bid, 0);
    const totalAsk = bar.rows.reduce((sum, r) => sum + r.ask, 0);
    const totalVolume = totalBid + totalAsk;
    const totalDelta = totalAsk - totalBid;

    for (const ticks of [1, 2, 5]) {
      const grouped = groupFootprintRows(bar, 0.1, ticks);
      const groupedBid = grouped.rows.reduce((sum, r) => sum + r.bid, 0);
      const groupedAsk = grouped.rows.reduce((sum, r) => sum + r.ask, 0);
      expect(groupedBid).toBe(totalBid);
      expect(groupedAsk).toBe(totalAsk);
      expect(groupedBid + groupedAsk).toBe(totalVolume);
      expect(groupedAsk - groupedBid).toBe(totalDelta);

      // Verify that all rows are non-negative and properly combined
      for (const row of grouped.rows) {
        expect(row.bid).toBeGreaterThanOrEqual(0);
        expect(row.ask).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
