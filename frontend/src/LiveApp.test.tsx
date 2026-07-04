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
  drawingVisibleOnTimeframe,
  mergeVisibleDrawingState,
  mergeMt5AccountUpdate,
  mergeMt5OpenTradeProfitUpdates,
  persistActiveProfileId,
  persistProfileHotSnapshot,
  readActiveProfileId,
  readProfileHotSnapshot,
  resolveEndpoints,
  seriesDataKey,
  visibleDrawingsForTimeframe,
} from "./LiveApp";
import {
  DEFAULT_EMA_SETTINGS,
  DEFAULT_FOOTPRINT_SETTINGS,
} from "./chart/IndicatorToggles";
import type { DrawingState } from "./chart/drawings/types";
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

  it("keeps the menu open on the synthetic release click after mobile long-press", () => {
    const openedAt = 10_000;
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(openedAt + 100);
    const onClose = vi.fn();
    const { container } = render(
      <ChartContextMenu
        menu={{
          price: 2360.04,
          x: 12,
          y: 24,
          openedAt,
          referencePrice: 2370.02,
        }}
        onClose={onClose}
        onAddAlert={vi.fn()}
        onPlaceLimitOrder={vi.fn()}
      />,
    );

    const backdrop = container.querySelector(".chart-menu-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).not.toHaveBeenCalled();

    now.mockReturnValue(openedAt + 700);
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
    now.mockRestore();
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

  it("shows drawings on their source timeframe and lower timeframes only", () => {
    const m5Drawing: DrawingState = {
      id: "m5",
      tool: "trendline",
      sourceTimeframe: "5m",
      anchors: [],
    };
    const m15Drawing: DrawingState = {
      id: "m15",
      tool: "trendline",
      sourceTimeframe: "15m",
      anchors: [],
    };
    const legacyDrawing: DrawingState = {
      id: "legacy",
      tool: "trendline",
      anchors: [],
    };

    expect(drawingVisibleOnTimeframe(m5Drawing, "5m")).toBe(true);
    expect(drawingVisibleOnTimeframe(m5Drawing, "15m")).toBe(false);
    expect(drawingVisibleOnTimeframe(m15Drawing, "5m")).toBe(true);
    expect(drawingVisibleOnTimeframe(m15Drawing, "15m")).toBe(true);
    expect(drawingVisibleOnTimeframe(legacyDrawing, "15m")).toBe(true);
    expect(
      visibleDrawingsForTimeframe([m5Drawing, m15Drawing, legacyDrawing], "15m")
        .map((drawing) => drawing.id),
    ).toEqual(["m15", "legacy"]);
  });

  it("merges visible drawing edits without dropping hidden timeframe drawings", () => {
    const previous: DrawingState[] = [
      {
        id: "m5",
        tool: "trendline",
        sourceTimeframe: "5m",
        anchors: [{ time: 100 as never, price: 10 }],
      },
      {
        id: "m15",
        tool: "horizontal_ray",
          sourceTimeframe: "15m",
          anchors: [{ time: 200 as never, price: 20 }],
      },
    ];

    const merged = mergeVisibleDrawingState(
      previous,
      [
        {
          id: "m15",
          tool: "horizontal_ray",
          anchors: [{ time: 200 as never, price: 25 }],
          options: { lineStyle: "dashed" },
        },
        {
          id: "new",
          tool: "rectangle",
          anchors: [{ time: 300 as never, price: 30 }],
        },
      ],
      "15m",
    );

    expect(merged.map((drawing) => drawing.id)).toEqual(["m5", "m15", "new"]);
    expect(merged[0].sourceTimeframe).toBe("5m");
    expect(merged[1].sourceTimeframe).toBe("15m");
    expect(merged[1].anchors[0].price).toBe(25);
    expect(merged[2].sourceTimeframe).toBe("15m");
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
