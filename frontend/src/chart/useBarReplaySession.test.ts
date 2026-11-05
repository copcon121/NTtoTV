import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Timeframe } from "../socket/messages";
import { barDurationForTimeframe } from "./barCountdown";
import { replayBarsThrough } from "./barReplay";
import { useBarReplaySession } from "./useBarReplaySession";

afterEach(cleanup);

function dataset(timeframe: Timeframe) {
  const duration = barDurationForTimeframe(timeframe);
  return {
    id: "session",
    seriesKey: timeframe,
    barsTimeframe: timeframe,
    bars: Array.from({ length: Math.floor(1_800_000 / duration) }, (_, index) => ({
      time: index * duration, open: 1, high: 2, low: 0, close: 1, volume: 10,
    })),
  };
}

type Dataset = ReturnType<typeof dataset>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("replay across timeframes", () => {
  it("keeps the exact M1 clock across M5 and M1, then steps in the new interval", async () => {
    const load = vi.fn(async (_source: Dataset, timeframe: Timeframe) => dataset(timeframe));
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: Timeframe }) => useBarReplaySession<Dataset>(timeframe, timeframe, load),
      { initialProps: { timeframe: "1m" as Timeframe } },
    );
    act(() => result.current.start(dataset("1m"), 10)); // 11 minutes are known.
    expect(result.current.cursorIndex).toBe(10);
    rerender({ timeframe: "5m" });
    expect(result.current.active).toBe(true);
    expect(result.current.ready).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(result.current.cursorIndex).toBe(-1);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.cursorIndex).toBe(1); // Only 0..10m closed.
    expect(load).toHaveBeenCalledWith(expect.anything(), "5m", { from: 0, to: 1_799_999 });
    rerender({ timeframe: "1m" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.cursorIndex).toBe(10); // Preserve 11m, not rounded down to 10m.
    expect(load).toHaveBeenCalledTimes(1);
    rerender({ timeframe: "5m" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.step(1)); // Now advance to 15m.
    expect(result.current.cursorIndex).toBe(2);
    rerender({ timeframe: "1m" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.cursorIndex).toBe(14);
    act(() => result.current.step(-1));
    expect(result.current.cursorIndex).toBe(13);
  });

  it("keeps a snapshot stable while data loads and ignores a stale timeframe response", async () => {
    const pending = deferred<Dataset>();
    const load = vi.fn(() => pending.promise);
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: Timeframe }) => useBarReplaySession<Dataset>(timeframe, timeframe, load),
      { initialProps: { timeframe: "1m" as Timeframe } },
    );
    act(() => result.current.start(dataset("1m"), 10));
    rerender({ timeframe: "5m" });
    act(() => result.current.step(1)); // Pending controls/keyboard must not change the clock.
    rerender({ timeframe: "1m" });
    expect(result.current.cursorIndex).toBe(10);
    await act(async () => pending.resolve(dataset("5m")));
    expect(result.current.dataset?.seriesKey).toBe("1m");
    expect(result.current.cursorIndex).toBe(10);
  });

  it("does not restart replay after exiting with a load in flight", async () => {
    const pending = deferred<Dataset>();
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: Timeframe }) =>
        useBarReplaySession<Dataset>(timeframe, timeframe, () => pending.promise),
      { initialProps: { timeframe: "1m" as Timeframe } },
    );
    act(() => result.current.start(dataset("1m"), 10));
    rerender({ timeframe: "5m" });
    act(() => result.current.stop());
    await act(async () => pending.resolve(dataset("5m")));
    expect(result.current.active).toBe(false);
    expect(result.current.dataset).toBeUndefined();
  });

  it("stays in replay after a history failure and recovers by switching back", async () => {
    const load = vi.fn(async () => { throw new Error("History unavailable"); });
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: Timeframe }) => useBarReplaySession<Dataset>(timeframe, timeframe, load),
      { initialProps: { timeframe: "1m" as Timeframe } },
    );
    act(() => result.current.start(dataset("1m"), 10));
    rerender({ timeframe: "5m" });
    await waitFor(() => expect(result.current.error).toBe("History unavailable"));
    expect(result.current.active).toBe(true);
    expect(result.current.ready).toBe(false);
    expect(result.current.loading).toBe(false);
    rerender({ timeframe: "1m" });
    expect(result.current.ready).toBe(true);
    expect(result.current.cursorIndex).toBe(10);
    expect(result.current.error).toBeUndefined();
  });

  it("does not reveal a candle spanning beyond the frozen replay end", async () => {
    const load = vi.fn(async () => dataset("5m"));
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: Timeframe }) => useBarReplaySession<Dataset>(timeframe, timeframe, load),
      { initialProps: { timeframe: "1m" as Timeframe } },
    );
    const initial = dataset("1m");
    initial.bars = initial.bars.slice(0, 13); // Session ends at 13m.
    act(() => result.current.start(initial, 10));
    rerender({ timeframe: "5m" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.dataset?.bars).toHaveLength(2);
    expect(result.current.cursorIndex).toBe(1);
    act(() => result.current.step(1));
    expect(result.current.cursorIndex).toBe(1);
    rerender({ timeframe: "1m" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.cursorIndex).toBe(10); // Hitting Done must not rewind the clock.
  });

  it("supports a clock before the first closed candle of a larger timeframe", async () => {
    const load = vi.fn(async () => dataset("5m"));
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: Timeframe }) => useBarReplaySession<Dataset>(timeframe, timeframe, load),
      { initialProps: { timeframe: "1m" as Timeframe } },
    );
    act(() => result.current.start(dataset("1m"), 1));
    rerender({ timeframe: "5m" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.cursorIndex).toBe(-1);
    expect(replayBarsThrough(result.current.dataset!.bars, result.current.cursorIndex)).toEqual([]);
    act(() => result.current.step(-1));
    expect(result.current.cursorIndex).toBe(-1);
    act(() => result.current.step(1));
    expect(result.current.cursorIndex).toBe(0);
  });

  it("keeps replay locked when a timeframe has no history", async () => {
    const load = vi.fn(async () => ({ ...dataset("5m"), bars: [] }));
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: Timeframe }) => useBarReplaySession<Dataset>(timeframe, timeframe, load),
      { initialProps: { timeframe: "1m" as Timeframe } },
    );
    act(() => result.current.start(dataset("1m"), 10));
    rerender({ timeframe: "5m" });
    await waitFor(() => expect(result.current.error).toMatch(/No replay history/));
    expect(result.current.active).toBe(true);
    expect(result.current.ready).toBe(false);
  });
});
