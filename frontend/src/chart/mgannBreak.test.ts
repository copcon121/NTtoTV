import { describe, expect, it } from "vitest";

import {
  DEFAULT_MGANN_BREAK_SETTINGS,
  mgannBreakAlertParams,
  mgannBreakSettingsMatchParams,
  normalizeMgannBreakSettings,
} from "./mgannBreak";

describe("mGann Break settings", () => {
  it("normalizes missing, invalid, and legacy values", () => {
    expect(normalizeMgannBreakSettings()).toEqual(DEFAULT_MGANN_BREAK_SETTINGS);
    expect(
      normalizeMgannBreakSettings({
        swingSize: 2,
        minPivotCuts: 1,
        minSpreadTicks: -1,
      }),
    ).toEqual({
      ...DEFAULT_MGANN_BREAK_SETTINGS,
      swingSize: 5,
      minPivotCuts: 2,
    });
  });

  it("creates a complete repeatable M1 server-alert snapshot", () => {
    expect(
      mgannBreakAlertParams({
        requireBigTrade: true,
        volumeDeltaMultiplier: 3.5,
        filterLiquidity: true,
        minPivotCuts: 4,
      }),
    ).toEqual({
      ...DEFAULT_MGANN_BREAK_SETTINGS,
      requireBigTrade: true,
      volumeDeltaMultiplier: 3.5,
      filterLiquidity: true,
      minPivotCuts: 4,
      timeframe: "1m",
      repeat: true,
    });
  });

  it("matches alert params by detector settings and ignores alert metadata", () => {
    const params = mgannBreakAlertParams({ volumeDeltaMultiplier: 3 });
    expect(
      mgannBreakSettingsMatchParams(
        { volumeDeltaMultiplier: 3 },
        params,
      ),
    ).toBe(true);
    expect(
      mgannBreakSettingsMatchParams(
        { volumeDeltaMultiplier: 2 },
        params,
      ),
    ).toBe(false);
  });
});
