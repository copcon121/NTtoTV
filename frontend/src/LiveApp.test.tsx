import { describe, expect, it } from "vitest";

import {
  CHART_CONTRACT,
  FOOTPRINT_SUBSCRIBED_EVENTS,
  GLOBAL_SUBSCRIBED_EVENTS,
  TIMEFRAME_SUBSCRIBED_EVENTS,
  persistActiveProfileId,
  persistProfileHotSnapshot,
  readActiveProfileId,
  readProfileHotSnapshot,
  resolveEndpoints,
  seriesDataKey,
} from "./LiveApp";
import { DEFAULT_FOOTPRINT_SETTINGS } from "./chart/IndicatorToggles";
import { DEFAULT_SMC_SETTINGS } from "./chart/smc";
import type { ChartProfilePayload } from "./profiles/types";

const profilePayload: ChartProfilePayload = {
  version: 1,
  timeframe: "5m",
  chartBackgroundColor: "#101010",
  showFootprint: false,
  showBigTrades: true,
  ema: { enabled: false, period: 200, color: "#2962ff" },
  smc: DEFAULT_SMC_SETTINGS,
  footprintSettings: DEFAULT_FOOTPRINT_SETTINGS,
  drawings: [],
};

describe("resolveEndpoints", () => {
  it("keeps the chart WebSocket on the Vite dev origin", () => {
    expect(
      resolveEndpoints({
        protocol: "http:",
        host: "103.47.226.34:5173",
      }),
    ).toEqual({
      api: "/api",
      ws: "ws://103.47.226.34:5173/ws/chart",
    });
  });

  it("uses wss on an https origin", () => {
    expect(
      resolveEndpoints({
        protocol: "https:",
        host: "charts.example.test",
      }).ws,
    ).toBe("wss://charts.example.test/ws/chart");
  });
});

describe("active profile persistence", () => {
  it("falls back to default when no browser profile has been saved", () => {
    expect(readActiveProfileId({ getItem: () => null })).toBe("default");
  });

  it("round-trips the selected profile id", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };

    persistActiveProfileId(" 111 ", storage);

    expect(readActiveProfileId(storage)).toBe("111");
  });

  it("keeps working when browser storage is restricted", () => {
    expect(
      readActiveProfileId({
        getItem: () => {
          throw new Error("storage denied");
        },
      }),
    ).toBe("default");

    expect(() =>
      persistActiveProfileId("111", {
        setItem: () => {
          throw new Error("storage denied");
        },
      }),
    ).not.toThrow();
  });
});

describe("hot profile snapshots", () => {
  it("round-trips a recent profile snapshot", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };

    persistProfileHotSnapshot("user_1", "profile_1", profilePayload, storage, 1_000);

    expect(readProfileHotSnapshot("user_1", storage, 2_000)).toEqual({
      version: 1,
      userId: "user_1",
      profileId: "profile_1",
      savedAt: 1_000,
      payload: profilePayload,
    });
  });

  it("keeps snapshots isolated by user", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };

    persistProfileHotSnapshot("user_1", "profile_1", profilePayload, storage, 1_000);

    expect(readProfileHotSnapshot("user_2", storage, 2_000)).toBeUndefined();
  });

  it("ignores stale snapshots", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };

    persistProfileHotSnapshot("user_1", "profile_1", profilePayload, storage, 1_000);

    expect(
      readProfileHotSnapshot("user_1", storage, 24 * 60 * 60 * 1_000 + 1_001),
    ).toBeUndefined();
  });
});

describe("live chart series identity", () => {
  it("uses the stable GC chart contract instead of a month contract", () => {
    expect(CHART_CONTRACT).toBe("GC");
  });

  it("uses different data keys for different timeframes", () => {
    expect(seriesDataKey("GC", "GC 08-26", "1m")).not.toBe(
      seriesDataKey("GC", "GC 08-26", "5m"),
    );
  });

  it("keeps timeframe-scoped socket events separate from global events", () => {
    expect(TIMEFRAME_SUBSCRIBED_EVENTS).toEqual([
      "bar_update",
      "volume_delta_update",
    ]);
    expect(GLOBAL_SUBSCRIBED_EVENTS).toEqual([
      "quote_update",
      "big_trade",
      "alert_event",
      "order_update",
      "position_update",
      "account_update",
      "basis_update",
      "risk_update",
      "status",
    ]);
    expect(FOOTPRINT_SUBSCRIBED_EVENTS).toEqual(["footprint_update"]);
  });
});
