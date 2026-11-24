import { describe, expect, it } from "vitest";
import { contentColumnCount, normalizeThreeColumnSplits, resizeThreeColumn } from "./layout";

describe("workspace column sizing", () => {
  it("uses three content columns at wide and spanning widths, reserving the account dock", () => {
    expect(contentColumnCount(1920, 3, false)).toBe(3);
    expect(contentColumnCount(1920, 3, true)).toBe(3);
    expect(contentColumnCount(3840, 6, true)).toBe(3);
    expect(contentColumnCount(1600, 3, true)).toBe(2);
    expect(contentColumnCount(700, 3, false)).toBe(1);
    expect(contentColumnCount(3840, 2, false)).toBe(2);
  });

  it("bounds both dividers without collapsing a neighboring column or overwriting legacy sizing", () => {
    const layout = { columnSplit: 61, firstRowSplit: 43, tradingAccountPosition: "right" as const };
    const first = resizeThreeColumn(layout, 0, 100);
    expect(first.threeColumnSplits).toEqual([49, 67]);
    const second = resizeThreeColumn(first, 1, 0);
    expect(second.threeColumnSplits).toEqual([49, 67]);
    expect(second.columnSplit).toBe(61);
    expect(second.firstRowSplit).toBe(43);
    expect(second.tradingAccountPosition).toBe("right");
    expect(normalizeThreeColumnSplits([NaN, Infinity])).toEqual([33, 67]);
    expect(normalizeThreeColumnSplits([-10, 120])).toEqual([18, 82]);
  });
});
