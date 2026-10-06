import { describe, expect, it } from "vitest";

import { type Bar } from "../cache/types";
import { type GcPushMomentumPoint } from "./gcPushMomentum";
import {
  buildGcPushMomentumDivergences,
  buildGcPushMomentumEarlyDivergences,
} from "./gcPushMomentumDivergence";

function barsFromExtremes(values: readonly number[], kind: "high" | "low"): Bar[] {
  return values.map((value, index) => {
    const low = kind === "high" ? value - 1 : value;
    const high = kind === "high" ? value : value + 1;
    return {
      time: index * 60_000,
      open: (high + low) / 2,
      high,
      low,
      close: (high + low) / 2,
      volume: 100,
      closed: true,
    };
  });
}

function pointsFor(
  bars: readonly Bar[],
  smoothedPush: readonly number[],
): GcPushMomentumPoint[] {
  return bars.map((bar, index) => ({
    time: bar.time,
    push: smoothedPush[index],
    smoothedPush: smoothedPush[index],
    signal: 0,
    histogram: smoothedPush[index],
    histogramChange:
      index === 0 ? 0 : smoothedPush[index] - smoothedPush[index - 1],
    acceleration: 0,
    efficiency: 1,
    strong: false,
    flowState: "neutral",
    absorptionCandidate: false,
  }));
}

function closedTimes(bars: readonly Bar[], through = bars.length - 1): Set<number> {
  return new Set(bars.slice(0, through + 1).map((bar) => bar.time));
}

function earlyDivergenceBars(direction: 1 | -1): Bar[] {
  const bars = new Array(24).fill(undefined).map((_, index): Bar => ({
    time: index * 60_000,
    open: 102,
    high: 105,
    low: 100,
    close: 102,
    volume: 100,
    closed: true,
  }));
  if (direction === -1) {
    bars[6] = { ...bars[6], open: 106, high: 110, low: 104, close: 108 };
    bars[12] = { ...bars[12], open: 99, high: 101, low: 95, close: 98 };
    bars[18] = { ...bars[18], open: 108, high: 114, low: 105, close: 112 };
    bars[19] = { ...bars[19], high: 108, low: 101, close: 104 };
    bars[20] = { ...bars[20], high: 107, low: 98, close: 100 };
    bars[21] = { ...bars[21], high: 100, low: 93, close: 94 };
  } else {
    for (let index = 0; index < bars.length; index += 1) {
      bars[index] = { ...bars[index], open: 97, high: 100, low: 95, close: 97 };
    }
    bars[6] = { ...bars[6], open: 94, high: 96, low: 90, close: 92 };
    bars[12] = { ...bars[12], open: 101, high: 105, low: 99, close: 103 };
    bars[18] = { ...bars[18], open: 91, high: 94, low: 86, close: 88 };
    bars[19] = { ...bars[19], high: 99, low: 92, close: 96 };
    bars[20] = { ...bars[20], high: 102, low: 93, close: 100 };
    bars[21] = { ...bars[21], high: 108, low: 100, close: 106 };
  }
  return bars;
}

function earlyPushValues(direction: 1 | -1): number[] {
  const values = new Array(24).fill(0);
  values[6] = direction === -1 ? 6 : -6;
  values[18] = direction === -1 ? 3 : -3;
  return values;
}

describe("GC Push Momentum divergence", () => {
  it("detects confirmed three-pivot bearish divergence", () => {
    const bars = barsFromExtremes(
      [9, 10, 11, 12, 11, 10, 12, 14, 12, 11, 14, 16, 14, 13],
      "high",
    );
    const points = pointsFor(
      bars,
      [0, 0, 1, 6, 1, 0, 1, 4, 1, 0, 1, 2, 1, 0],
    );

    const result = buildGcPushMomentumDivergences(
      bars,
      points,
      closedTimes(bars),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      direction: -1,
      confirmedAt: bars[13].time,
      pricePivots: [
        expect.objectContaining({ time: bars[3].time, price: 12, pushValue: 6 }),
        expect.objectContaining({ time: bars[7].time, price: 14, pushValue: 4 }),
        expect.objectContaining({ time: bars[11].time, price: 16, pushValue: 2 }),
      ],
    });
  });

  it("detects confirmed three-pivot bullish divergence", () => {
    const bars = barsFromExtremes(
      [11, 10, 9, 8, 9, 10, 8, 6, 8, 9, 6, 4, 6, 7],
      "low",
    );
    const points = pointsFor(
      bars,
      [0, 0, -1, -6, -1, 0, -1, -4, -1, 0, -1, -2, -1, 0],
    );

    const result = buildGcPushMomentumDivergences(
      bars,
      points,
      closedTimes(bars),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      direction: 1,
      confirmedAt: bars[13].time,
      pricePivots: [
        expect.objectContaining({ time: bars[3].time, price: 8, pushValue: -6 }),
        expect.objectContaining({ time: bars[7].time, price: 6, pushValue: -4 }),
        expect.objectContaining({ time: bars[11].time, price: 4, pushValue: -2 }),
      ],
    });
  });

  it("waits for every right-side confirmation bar to close", () => {
    const bars = barsFromExtremes(
      [9, 10, 11, 12, 11, 10, 12, 14, 12, 11, 14, 16, 14, 13],
      "high",
    );
    const points = pointsFor(
      bars,
      [0, 0, 1, 6, 1, 0, 1, 4, 1, 0, 1, 2, 1, 0],
    );

    expect(
      buildGcPushMomentumDivergences(
        bars,
        points,
        closedTimes(bars, 12),
      ),
    ).toEqual([]);
    expect(
      buildGcPushMomentumDivergences(
        bars,
        points,
        closedTimes(bars, 13),
      ),
    ).toHaveLength(1);
  });

  it("rejects higher price highs when Push also makes higher highs", () => {
    const bars = barsFromExtremes(
      [9, 10, 11, 12, 11, 10, 12, 14, 12, 11, 14, 16, 14, 13],
      "high",
    );
    const points = pointsFor(
      bars,
      [0, 0, 1, 2, 1, 0, 1, 4, 1, 0, 1, 6, 1, 0],
    );

    expect(
      buildGcPushMomentumDivergences(bars, points, closedTimes(bars)),
    ).toEqual([]);
  });

  it("confirms Bear Div 2 after an ATR-qualified break of the Swing-5 low", () => {
    const bars = earlyDivergenceBars(-1);
    const points = pointsFor(bars, earlyPushValues(-1));

    expect(
      buildGcPushMomentumEarlyDivergences(
        bars,
        points,
        closedTimes(bars, 20),
      ),
    ).toEqual([]);

    const result = buildGcPushMomentumEarlyDivergences(
      bars,
      points,
      closedTimes(bars),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      direction: -1,
      confirmedAt: bars[21].time,
      confirmationPrice: 93,
      confirmationSwing: { index: 12, kind: "low", price: 95 },
      breakByWick: false,
      pricePivots: [
        expect.objectContaining({ index: 6, price: 110, pushValue: 6 }),
        expect.objectContaining({ index: 18, price: 114, pushValue: 3 }),
      ],
    });
  });

  it("allows a lower second price high when Push also weakens", () => {
    const bars = earlyDivergenceBars(-1);
    bars[18] = { ...bars[18], open: 107, high: 109, low: 105, close: 108 };
    const points = pointsFor(bars, earlyPushValues(-1));

    const result = buildGcPushMomentumEarlyDivergences(
      bars,
      points,
      closedTimes(bars),
    );

    expect(result).toHaveLength(1);
    expect(result[0].pricePivots.map((pivot) => pivot.price)).toEqual([110, 109]);
  });

  it("rejects a second price high that misses the first by too much", () => {
    const bars = earlyDivergenceBars(-1);
    bars[18] = { ...bars[18], open: 106, high: 106.5, low: 104, close: 105.5 };
    bars[19] = { ...bars[19], high: 105.8 };
    bars[20] = { ...bars[20], high: 105.6 };
    const points = pointsFor(bars, earlyPushValues(-1));

    expect(
      buildGcPushMomentumEarlyDivergences(bars, points, closedTimes(bars)),
    ).toEqual([]);
    expect(
      buildGcPushMomentumEarlyDivergences(
        bars,
        points,
        closedTimes(bars),
        { maxPriceMissAtr: 1 },
      ),
    ).toHaveLength(1);
  });

  it("keeps a structurally confirmed Div 2 even when its slopes are shallow", () => {
    const bars = earlyDivergenceBars(-1);
    bars[18] = { ...bars[18], high: 110.1 };
    const push = earlyPushValues(-1);
    push[18] = 5.9;
    const points = pointsFor(bars, push);

    expect(
      buildGcPushMomentumEarlyDivergences(bars, points, closedTimes(bars)),
    ).toHaveLength(1);
  });

  it("keeps confirmed Div 2 signals beyond the previous 260-bar display window", () => {
    const seed = earlyDivergenceBars(-1);
    const bars = seed.concat(
      new Array(300).fill(undefined).map((_, offset): Bar => ({
        time: (seed.length + offset) * 60_000,
        open: 92,
        high: 94,
        low: 90,
        close: 92,
        volume: 100,
        closed: true,
      })),
    );
    const push = earlyPushValues(-1).concat(new Array(300).fill(0));

    expect(
      buildGcPushMomentumEarlyDivergences(
        bars,
        pointsFor(bars, push),
        closedTimes(bars),
      ),
    ).toHaveLength(1);
  });

  it("confirms Bear Div 2 from a wick through Swing-5", () => {
    const bars = earlyDivergenceBars(-1);
    bars[21] = { ...bars[21], close: 96 };
    const points = pointsFor(bars, earlyPushValues(-1));

    const result = buildGcPushMomentumEarlyDivergences(
      bars,
      points,
      closedTimes(bars),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      confirmedAt: bars[21].time,
      confirmationPrice: 93,
      breakByWick: true,
    });
  });

  it("can confirm immediately from the still-open last bar", () => {
    const bars = earlyDivergenceBars(-1).slice(0, 22);
    bars[21] = { ...bars[21], close: 96 };
    const points = pointsFor(bars, earlyPushValues(-1).slice(0, 22));

    const result = buildGcPushMomentumEarlyDivergences(
      bars,
      points,
      closedTimes(bars, 20),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      confirmedAt: bars[21].time,
      breakByWick: true,
    });
  });

  it("rejects a Swing-5 break without the required displacement", () => {
    const bars = earlyDivergenceBars(-1);
    const points = pointsFor(bars, earlyPushValues(-1));

    expect(
      buildGcPushMomentumEarlyDivergences(
        bars,
        points,
        closedTimes(bars),
        { minDisplacementAtr: 100 },
      ),
    ).toEqual([]);
  });

  it("does not backpaint a break that happened before the second pivot was known", () => {
    const bars = earlyDivergenceBars(-1);
    bars[19] = { ...bars[19], low: 93, close: 94 };
    bars[21] = { ...bars[21], low: 96, close: 98 };
    const points = pointsFor(bars, earlyPushValues(-1));

    expect(
      buildGcPushMomentumEarlyDivergences(bars, points, closedTimes(bars)),
    ).toEqual([]);
  });

  it("confirms Bull Div 2 only after a close above the intervening Swing-5 high", () => {
    const bars = earlyDivergenceBars(1);
    const points = pointsFor(bars, earlyPushValues(1));

    const result = buildGcPushMomentumEarlyDivergences(
      bars,
      points,
      closedTimes(bars),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      direction: 1,
      confirmedAt: bars[21].time,
      confirmationPrice: 108,
      confirmationSwing: { index: 12, kind: "high", price: 105 },
      pricePivots: [
        expect.objectContaining({ index: 6, price: 90, pushValue: -6 }),
        expect.objectContaining({ index: 18, price: 86, pushValue: -3 }),
      ],
    });
  });
});
