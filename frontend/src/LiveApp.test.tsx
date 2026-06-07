import { describe, expect, it } from "vitest";

import {
  CHART_CONTRACT,
  FOOTPRINT_SUBSCRIBED_EVENTS,
  GLOBAL_SUBSCRIBED_EVENTS,
  TIMEFRAME_SUBSCRIBED_EVENTS,
  persistActiveProfileId,
  readActiveProfileId,
  resolveEndpoints,
  seriesDataKey,
} from "./LiveApp";

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
