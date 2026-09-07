import { describe, expect, it } from "vitest";

import type { Bar } from "../cache/types";
import {
  barReplayDelayMs,
  findReplayBarIndex,
  replayBarsThrough,
  replayCursorBeforeSelection,
  timedMapThrough,
  timedValuesBefore,
} from "./barReplay";

const bars: readonly Bar[] = [
  { time: 1_000, open: 1, high: 2, low: 0, close: 1, volume: 10 },
  { time: 2_000, open: 2, high: 3, low: 1, close: 2, volume: 20 },
  { time: 3_000, open: 3, high: 4, low: 2, close: 3, volume: 30 },
];

describe("bar replay helpers", () => {
  it("starts immediately before the selected candle", () => {
    const selected = findReplayBarIndex(bars, 2_000);
    expect(selected).toBe(1);
    expect(replayCursorBeforeSelection(selected)).toBe(0);
    expect(replayBarsThrough(bars, 0)).toEqual([bars[0]]);
  });

  it("selects the nearest loaded candle for an in-between timestamp", () => {
    expect(findReplayBarIndex(bars, 2_400)).toBe(1);
    expect(findReplayBarIndex(bars, 2_600)).toBe(2);
  });

  it("filters server overlays without leaking future data", () => {
    expect(
      timedValuesBefore(
        [
          { time: 1_500, id: "shown" },
          { time: 2_000, id: "hidden" },
        ],
        2_000,
      ),
    ).toEqual([{ time: 1_500, id: "shown" }]);
    expect(
      [...timedMapThrough(new Map([[1_000, "shown"], [2_000, "hidden"]]), 1_000)],
    ).toEqual([[1_000, "shown"]]);
  });

  it("maps speed multipliers to deterministic playback delays", () => {
    expect(barReplayDelayMs(0.5)).toBe(2_000);
    expect(barReplayDelayMs(1)).toBe(1_000);
    expect(barReplayDelayMs(5)).toBe(200);
    expect(barReplayDelayMs(10)).toBe(100);
    expect(barReplayDelayMs(20)).toBe(50);
  });
});
