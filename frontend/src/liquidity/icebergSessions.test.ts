import { describe, expect, it } from "vitest";
import {
  DEFAULT_ICEBERG_SESSION_MIN_VOLUMES, icebergMatchesSessionVolume,
  icebergMinVolumeForTime, normalizeIcebergSessionMinVolumes,
} from "./icebergSessions";

describe("iceberg session volume filters in UTC+7", () => {
  it.each([
    ["2026-10-28T11:59:59.999Z", 5], // 18:59:59.999
    ["2026-10-28T12:00:00.000Z", 10], // 19:00
    ["2026-10-28T16:59:59.999Z", 10], // 23:59:59.999
    ["2026-10-28T17:00:00.000Z", 10], // 00:00 next day
    ["2026-10-28T20:59:59.999Z", 10], // 03:59:59.999 next day
    ["2026-10-28T21:00:00.000Z", 5], // 04:00 next day
    ["2026-11-04T12:00:00.000Z", 10], // Unchanged across US daylight saving time.
    ["2026-11-04T21:00:00.000Z", 5],
  ])("uses the correct threshold at %s", (time, expected) => {
    expect(icebergMinVolumeForTime(Date.parse(time), DEFAULT_ICEBERG_SESSION_MIN_VOLUMES)).toBe(expected);
  });

  it("applies custom thresholds to each iceberg's detection time, including historical rows", () => {
    const settings = { us: 20, other: 7 };
    const us = { detectedTime: Date.parse("2026-10-28T12:00:00Z"), executedVolume: 19 };
    expect(icebergMatchesSessionVolume(us, settings)).toBe(false);
    expect(icebergMatchesSessionVolume({ ...us, executedVolume: 20 }, settings)).toBe(true);
    const other = { ...us, detectedTime: Date.parse("2026-10-28T11:59:59Z"),
      time: Date.parse("2026-10-28T12:01:00Z"), executedVolume: 7 };
    expect(icebergMatchesSessionVolume(other, settings)).toBe(true);
    expect(icebergMatchesSessionVolume({ ...other, executedVolume: 6 }, settings)).toBe(false);
  });

  it("defaults to 10/5, preserves independent values, and bounds invalid settings", () => {
    expect(normalizeIcebergSessionMinVolumes(undefined)).toEqual({ us: 10, other: 5 });
    expect(normalizeIcebergSessionMinVolumes({ us: 25, other: 8 })).toEqual({ us: 25, other: 8 });
    expect(normalizeIcebergSessionMinVolumes({ us: -2, other: 2_000_000 }))
      .toEqual({ us: 1, other: 1_000_000 });
    expect(normalizeIcebergSessionMinVolumes({ us: Number.NaN, other: 6.6 }))
      .toEqual({ us: 10, other: 7 });
  });
});
