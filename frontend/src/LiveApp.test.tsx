import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BIG_TRADE_SUBSCRIBED_EVENTS,
  CHART_CONTRACT,
  ChartContextMenu,
  FOOTPRINT_SUBSCRIBED_EVENTS,
  GLOBAL_SUBSCRIBED_EVENTS,
  TIMEFRAME_SUBSCRIBED_EVENTS,
  appShellClassName,
  bigTradesEnabledForTimeframe,
  buildChartLimitOrderDraft,
  mergeMt5AccountUpdate,
  mergeMt5OpenTradeProfitUpdates,
  persistActiveProfileId,
  persistProfileHotSnapshot,
  readActiveProfileId,
  readProfileHotSnapshot,
  resolveEndpoints,
  seriesDataKey,
} from "./LiveApp";
import {
  DEFAULT_EMA_SETTINGS,
  DEFAULT_FOOTPRINT_SETTINGS,
} from "./chart/IndicatorToggles";
import { DEFAULT_SMC_SETTINGS } from "./chart/smc";
import type { ChartProfilePayload } from "./profiles/types";

afterEach(() => {
  cleanup();
});

const profilePayload: ChartProfilePayload = {
  version: 1,
  timeframe: "5m",
  chartBackgroundColor: "#101010",
  showFootprint: false,
  showBigTrades: true,
  ema: { ...DEFAULT_EMA_SETTINGS },
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

describe("chart focus layout", () => {
  it("adds the focus class only while chart focus mode is enabled", () => {
    expect(appShellClassName(false)).toBe("app-shell");
    expect(appShellClassName(true)).toBe("app-shell chart-focus");
  });
});

describe("mobile chart limit order draft", () => {
  const settings = {
    volumeLots: 0.12,
    slDistanceGc: 3,
    tpDistanceGc: 6,
  };

  it("builds a buy limit bracket below the reference price", () => {
    expect(
      buildChartLimitOrderDraft({
        entryPrice: 2360.04,
        referencePrice: 2370.02,
        settings,
      }),
    ).toEqual({
      source: "chart_bracket",
      side: "buy",
      kind: "limit",
      volumeLots: 0.12,
      entryGc: 2360,
      referenceGc: 2370,
      slGc: 2357,
      tpGc: 2366,
      gcAnchored: true,
    });
  });

  it("builds a sell limit bracket above the reference price", () => {
    expect(
      buildChartLimitOrderDraft({
        entryPrice: 2380.04,
        referencePrice: 2370.02,
        settings,
      }),
    ).toEqual({
      source: "chart_bracket",
      side: "sell",
      kind: "limit",
      volumeLots: 0.12,
      entryGc: 2380,
      referenceGc: 2370,
      slGc: 2383,
      tpGc: 2374,
      gcAnchored: true,
    });
  });

  it("does not create a limit draft at the rounded reference price", () => {
    expect(
      buildChartLimitOrderDraft({
        entryPrice: 2370.04,
        referencePrice: 2370.02,
        settings,
      }),
    ).toBeUndefined();
  });
});

describe("ChartContextMenu", () => {
  it("keeps add alert and adds the limit order action", () => {
    const draft = buildChartLimitOrderDraft({
      entryPrice: 2360.04,
      referencePrice: 2370.02,
      settings: {
        volumeLots: 0.12,
        slDistanceGc: 3,
        tpDistanceGc: 6,
      },
    });
    expect(draft).toBeDefined();
    const onClose = vi.fn();
    const onAddAlert = vi.fn();
    const onPlaceLimitOrder = vi.fn();

    render(
      <ChartContextMenu
        menu={{ price: 2360.04, x: 12, y: 24, referencePrice: 2370.02 }}
        limitDraft={draft}
        onClose={onClose}
        onAddAlert={onAddAlert}
        onPlaceLimitOrder={onPlaceLimitOrder}
      />,
    );

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Add alert at 2360.0" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Place BUY LIMIT at 2360.0" }),
    );

    expect(onAddAlert).toHaveBeenCalledWith(2360.04);
    expect(onPlaceLimitOrder).toHaveBeenCalledWith(draft);
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

  it("enables BigTrade overlays only on 1m", () => {
    expect(bigTradesEnabledForTimeframe("1m")).toBe(true);
    expect(bigTradesEnabledForTimeframe("5m")).toBe(false);
    expect(bigTradesEnabledForTimeframe("1D")).toBe(false);
  });

  it("keeps timeframe-scoped socket events separate from global events", () => {
    expect(TIMEFRAME_SUBSCRIBED_EVENTS).toEqual([
      "bar_update",
      "volume_delta_update",
      "fvg_signal_update",
    ]);
    expect(GLOBAL_SUBSCRIBED_EVENTS).toEqual([
      "quote_update",
      "alert_event",
      "order_update",
      "position_update",
      "account_update",
      "basis_update",
      "risk_update",
      "status",
    ]);
    expect(BIG_TRADE_SUBSCRIBED_EVENTS).toEqual(["big_trade"]);
    expect(FOOTPRINT_SUBSCRIBED_EVENTS).toEqual(["footprint_update"]);
  });
});

describe("MT5 account updates", () => {
  it("merges websocket account updates into the connected MT5 account", () => {
    expect(
      mergeMt5AccountUpdate(
        {
          accountId: "acct_1",
          login: 257101455,
          server: "Broker",
          symbolBroker: "XAUUSDm",
          tradeMode: "live",
          currency: "USD",
          balance: 358.9,
          equity: 358.9,
          freeMargin: 100,
        },
        {
          accountId: "acct_1",
          tradeMode: "live",
          balance: 401.25,
          equity: 401.25,
          freeMargin: 155.5,
          updatedAt: 10,
        },
      ),
    ).toMatchObject({
      accountId: "acct_1",
      login: 257101455,
      server: "Broker",
      symbolBroker: "XAUUSDm",
      balance: 401.25,
      equity: 401.25,
      freeMargin: 155.5,
    });
  });

  it("ignores websocket account updates for a different account", () => {
    const current = {
      accountId: "acct_1",
      login: 257101455,
      server: "Broker",
      tradeMode: "live",
    };

    expect(
      mergeMt5AccountUpdate(current, {
        accountId: "acct_2",
        tradeMode: "live",
        balance: 1,
        equity: 1,
        freeMargin: 1,
        updatedAt: 10,
      }),
    ).toBe(current);
  });

  it("merges websocket position profit updates into open trades", () => {
    const current = {
      positions: [
        {
          brokerPositionTicket: 101,
          side: "buy" as const,
          volumeLots: 0.1,
          entryBroker: 2350,
          profit: 1.2,
          updatedAt: 1,
        },
        {
          brokerPositionTicket: 202,
          side: "sell" as const,
          volumeLots: 0.1,
          entryBroker: 2360,
          profit: -2,
          updatedAt: 1,
        },
      ],
      orders: [],
    };

    expect(
      mergeMt5OpenTradeProfitUpdates(current, [
        { brokerPositionTicket: 101, profit: 4.5, updatedAt: 20 },
      ]),
    ).toEqual({
      positions: [
        {
          brokerPositionTicket: 101,
          side: "buy",
          volumeLots: 0.1,
          entryBroker: 2350,
          profit: 4.5,
          updatedAt: 20,
        },
      ],
      orders: [],
    });
  });
});
