import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_VOLUME_PROFILE_DAYS,
  DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS,
  DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  MAX_SESSION_VOLUME_PROFILE_DAYS,
  MAX_SESSION_VOLUME_PROFILE_ROW_TICKS,
  MAX_SESSION_VOLUME_PROFILE_WIDTH_PX,
  MIN_SESSION_VOLUME_PROFILE_DAYS,
  MIN_SESSION_VOLUME_PROFILE_ROW_TICKS,
  MIN_SESSION_VOLUME_PROFILE_WIDTH_PX,
  SESSION_VP_DAY_MS,
  computeSessionVolumeProfileFromMs,
  isTradingSessionStart,
  normalizeSessionVolumeProfileDays,
  normalizeSessionVolumeProfileRowTicks,
  normalizeSessionVolumeProfileWidth,
  sessionStartForUtc,
} from "./sessionVolumeProfileSettings";

describe("sessionVolumeProfileSettings", () => {
  describe("normalizeSessionVolumeProfileWidth", () => {
    it("returns default on non-finite values", () => {
      expect(normalizeSessionVolumeProfileWidth(undefined)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX);
      expect(normalizeSessionVolumeProfileWidth(null)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX);
      expect(normalizeSessionVolumeProfileWidth(NaN)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX);
      expect(normalizeSessionVolumeProfileWidth("abc")).toBe(DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX);
    });

    it("clamps width within min and max", () => {
      expect(normalizeSessionVolumeProfileWidth(10)).toBe(MIN_SESSION_VOLUME_PROFILE_WIDTH_PX);
      expect(normalizeSessionVolumeProfileWidth(300)).toBe(MAX_SESSION_VOLUME_PROFILE_WIDTH_PX);
      expect(normalizeSessionVolumeProfileWidth(80)).toBe(80);
    });
  });

  describe("normalizeSessionVolumeProfileRowTicks", () => {
    it("returns default rowTicks (2) on invalid inputs", () => {
      expect(normalizeSessionVolumeProfileRowTicks(undefined)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS);
      expect(normalizeSessionVolumeProfileRowTicks(null)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS);
      expect(normalizeSessionVolumeProfileRowTicks(NaN)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS);
      expect(normalizeSessionVolumeProfileRowTicks("invalid")).toBe(DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS);
    });

    it("clamps rowTicks within min (1) and max (100)", () => {
      expect(normalizeSessionVolumeProfileRowTicks(0)).toBe(MIN_SESSION_VOLUME_PROFILE_ROW_TICKS);
      expect(normalizeSessionVolumeProfileRowTicks(-5)).toBe(MIN_SESSION_VOLUME_PROFILE_ROW_TICKS);
      expect(normalizeSessionVolumeProfileRowTicks(200)).toBe(MAX_SESSION_VOLUME_PROFILE_ROW_TICKS);
      expect(normalizeSessionVolumeProfileRowTicks(1)).toBe(1);
      expect(normalizeSessionVolumeProfileRowTicks(2)).toBe(2);
      expect(normalizeSessionVolumeProfileRowTicks(10)).toBe(10);
    });

    it("rounds fractional tick counts", () => {
      expect(normalizeSessionVolumeProfileRowTicks(2.4)).toBe(2);
      expect(normalizeSessionVolumeProfileRowTicks(2.6)).toBe(3);
    });
  });

  describe("normalizeSessionVolumeProfileDays", () => {
    it("returns default days (1) on invalid inputs", () => {
      expect(normalizeSessionVolumeProfileDays(undefined)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_DAYS);
      expect(normalizeSessionVolumeProfileDays(null)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_DAYS);
      expect(normalizeSessionVolumeProfileDays(NaN)).toBe(DEFAULT_SESSION_VOLUME_PROFILE_DAYS);
      expect(normalizeSessionVolumeProfileDays("")).toBe(DEFAULT_SESSION_VOLUME_PROFILE_DAYS);
    });

    it("clamps days within min (1) and max (7)", () => {
      expect(normalizeSessionVolumeProfileDays(0)).toBe(MIN_SESSION_VOLUME_PROFILE_DAYS);
      expect(normalizeSessionVolumeProfileDays(-1)).toBe(MIN_SESSION_VOLUME_PROFILE_DAYS);
      expect(normalizeSessionVolumeProfileDays(10)).toBe(MAX_SESSION_VOLUME_PROFILE_DAYS);
      expect(normalizeSessionVolumeProfileDays(3)).toBe(3);
      expect(normalizeSessionVolumeProfileDays(7)).toBe(7);
    });

    it("rounds fractional days", () => {
      expect(normalizeSessionVolumeProfileDays(3.2)).toBe(3);
      expect(normalizeSessionVolumeProfileDays(3.8)).toBe(4);
    });
  });

  describe("session calendar calculations", () => {
    it("identifies weekday sessions as trading session starts and weekend as closures", () => {
      // 2026-03-02 Monday 05:00 UTC+7 = 2026-03-01 22:00 UTC
      const mondayStart = Date.UTC(2026, 2, 1, 22, 0, 0, 0);
      expect(isTradingSessionStart(mondayStart)).toBe(true);

      // Tuesday
      const tuesdayStart = mondayStart + SESSION_VP_DAY_MS;
      expect(isTradingSessionStart(tuesdayStart)).toBe(true);

      // Wednesday
      const wednesdayStart = mondayStart + 2 * SESSION_VP_DAY_MS;
      expect(isTradingSessionStart(wednesdayStart)).toBe(true);

      // Thursday
      const thursdayStart = mondayStart + 3 * SESSION_VP_DAY_MS;
      expect(isTradingSessionStart(thursdayStart)).toBe(true);

      // Friday 05:00 UTC+7 = Thursday 22:00 UTC
      const fridayStart = mondayStart + 4 * SESSION_VP_DAY_MS;
      expect(isTradingSessionStart(fridayStart)).toBe(true);

      // Saturday 05:00 UTC+7 = Friday 22:00 UTC (CME weekend closure)
      const saturdayStart = mondayStart + 5 * SESSION_VP_DAY_MS;
      expect(isTradingSessionStart(saturdayStart)).toBe(false);

      // Sunday 05:00 UTC+7 = Saturday 22:00 UTC (CME weekend closure)
      const sundayStart = mondayStart + 6 * SESSION_VP_DAY_MS;
      expect(isTradingSessionStart(sundayStart)).toBe(false);
    });

    it("computes session start from UTC time correctly", () => {
      // Wednesday 2026-03-04 14:00 UTC+7 (07:00 UTC)
      const wednesdayNoon = Date.UTC(2026, 2, 4, 7, 0, 0, 0);
      const expectedWedStart = Date.UTC(2026, 2, 3, 22, 0, 0, 0); // Wednesday 05:00 UTC+7
      expect(sessionStartForUtc(wednesdayNoon)).toBe(expectedWedStart);

      // Wednesday 2026-03-04 04:30 UTC+7 (before 05:00 open, belongs to Tuesday session)
      const wednesdayEarly = Date.UTC(2026, 2, 3, 21, 30, 0, 0);
      const expectedTueStart = Date.UTC(2026, 2, 2, 22, 0, 0, 0); // Tuesday 05:00 UTC+7
      expect(sessionStartForUtc(wednesdayEarly)).toBe(expectedTueStart);
    });

    it("computes multi-session fromMs correctly skipping weekend", () => {
      // Wednesday 2026-03-04 10:00 UTC+7
      const wednesdayMidday = Date.UTC(2026, 2, 4, 3, 0, 0, 0);
      const wedStart = Date.UTC(2026, 2, 3, 22, 0, 0, 0);
      const tueStart = Date.UTC(2026, 2, 2, 22, 0, 0, 0);
      const monStart = Date.UTC(2026, 2, 1, 22, 0, 0, 0);
      const friStart = Date.UTC(2026, 1, 26, 22, 0, 0, 0); // Friday of previous week (Thursday 22:00 UTC)
      const thuStart = Date.UTC(2026, 1, 25, 22, 0, 0, 0);

      // 1 day = current session (Wednesday)
      expect(computeSessionVolumeProfileFromMs(wednesdayMidday, 1)).toBe(wedStart);

      // 2 days = Tuesday
      expect(computeSessionVolumeProfileFromMs(wednesdayMidday, 2)).toBe(tueStart);

      // 3 days = Monday
      expect(computeSessionVolumeProfileFromMs(wednesdayMidday, 3)).toBe(monStart);

      // 4 days = Friday of previous week (skips weekend Sat & Sun)
      expect(computeSessionVolumeProfileFromMs(wednesdayMidday, 4)).toBe(friStart);

      // 5 days = Thursday of previous week
      expect(computeSessionVolumeProfileFromMs(wednesdayMidday, 5)).toBe(thuStart);
    });

    it("falls back to the latest completed trading session when accessed during weekend", () => {
      // Saturday 2026-03-07 14:00 UTC+7
      const saturdayMidday = Date.UTC(2026, 2, 7, 7, 0, 0, 0);
      const fridayStart = Date.UTC(2026, 2, 5, 22, 0, 0, 0); // Thursday 22:00 UTC (Friday session)
      const thursdayStart = Date.UTC(2026, 2, 4, 22, 0, 0, 0);

      // 1 day on Saturday = Friday session
      expect(computeSessionVolumeProfileFromMs(saturdayMidday, 1)).toBe(fridayStart);

      // 2 days on Saturday = Thursday session
      expect(computeSessionVolumeProfileFromMs(saturdayMidday, 2)).toBe(thursdayStart);
    });
  });
});
