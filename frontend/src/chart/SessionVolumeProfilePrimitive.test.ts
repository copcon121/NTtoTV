import { describe, expect, it } from "vitest";

import { selectVisibleProfilePoints } from "./SessionVolumeProfilePrimitive";

const points = Array.from({ length: 10 }, (_, index) => ({
  time: index * 100,
  price: 2_000 + index,
}));

describe("selectVisibleProfilePoints", () => {
  it("keeps the neighbouring points at both viewport edges", () => {
    expect(
      selectVisibleProfilePoints(points, { from: 250, to: 650 }, 100).map(
        (point) => point.time,
      ),
    ).toEqual([200, 300, 400, 500, 600, 700]);
  });

  it("caps a long path while preserving its endpoints", () => {
    const selected = selectVisibleProfilePoints(points, null, 4);

    expect(selected).toHaveLength(4);
    expect(selected[0]).toBe(points[0]);
    expect(selected[selected.length - 1]).toBe(points[points.length - 1]);
  });

  it("keeps the nearest edge point when the viewport is outside the path", () => {
    expect(
      selectVisibleProfilePoints(points, { from: 2_000, to: 3_000 }, 100),
    ).toEqual([points[points.length - 1]]);
  });
});
