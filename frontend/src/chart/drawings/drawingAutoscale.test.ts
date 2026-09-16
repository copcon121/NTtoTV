import type { UTCTimestamp } from "lightweight-charts";
import { describe, expect, it } from "vitest";

import { BrushPrimitive } from "./BrushPrimitive";
import { PathPrimitive } from "./PathPrimitive";
import { TrendLinePrimitive } from "./TrendLinePrimitive";

const distantAnchors = [
  { time: 1 as UTCTimestamp, price: 4_700, logical: 0 },
  { time: 2 as UTCTimestamp, price: 4_705, logical: 1 },
];

describe("drawing autoscale isolation", () => {
  it.each([
    ["trend line", new TrendLinePrimitive("trend", distantAnchors)],
    ["path", new PathPrimitive("path", distantAnchors)],
    ["brush", new BrushPrimitive("brush", distantAnchors)],
  ])("does not let a distant %s collapse the candle scale", (_name, drawing) => {
    expect(drawing.autoscaleInfo()).toBeNull();
  });
});
