import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
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
  calculateRiskBasedLots,
  drawingVisibleOnTimeframe,
  hasLiveSupertrendTrailing,
  historyBackfillLimit,
  initialHistoryWindow,
  mergeVisibleDrawingState,
  mergeMt5AccountUpdate,
  mergeMt5OpenTradeProfitUpdates,
  persistActiveProfileId,
  persistProfileHotSnapshot,
  projectBrokerAnchoredOrders,
  readActiveProfileId,
  readProfileHotSnapshot,
  resolveEndpoints,
  seriesDataKey,
  supertrendTrailingActivationError,
  toAlertLines,
  toOrderControls,
  visibleDrawingsForTimeframe,
} from "./LiveApp";
import type { SupertrendTrailing } from "./api/client";
import type { TradingOrder, TradingPosition } from "./socket/messages";
import { useBrokerChartPositions } from "./orders/brokerChartLevels";
import {
  DEFAULT_EMA_SETTINGS,
  DEFAULT_FOOTPRINT_SETTINGS,
} from "./chart/IndicatorToggles";
import type { DrawingState } from "./chart/drawings/types";
import { DEFAULT_SMC_SETTINGS } from "./chart/smc";
import { DEFAULT_SUPERTREND_SETTINGS } from "./chart/supertrend";
import type { ChartProfilePayload } from "./profiles/types";
import type { Alert } from "./alerts/types";

afterEach(() => {
  cleanup();
});

describe("order stop and target money", () => {
  const symbol = {
    symbol: "XAUUSDm", digits: 2, tickSize: 0.01, pipValue: 1,
    minLot: 0.01, maxLot: 100, lotStep: 0.01, stopsLevel: 0.1,
  };
  const order: TradingOrder = {
    id: "ord_1", userId: "u1", accountId: "a1", source: "market_bar",
    symbolInternal: "GC", contractInternal: "GC", symbolBroker: "XAUUSDm",
    side: "sell", kind: "market", volumeLots: 0.1, gcAnchored: true,
    takeProfit1rEnabled: false, autoSupertrendAfter1rEnabled: false,
    status: "filled", idempotencyKey: "test", version: 1,
    fillPriceGcEstimate: 3925, fillPriceBroker: 3900,
    slGc: 3918.7, slBroker: 3896, tpGc: 3910, tpBroker: 3887.3,
    brokerPositionTicket: 7, createdAt: 1, updatedAt: 1,
  };
  const position: TradingPosition = {
    brokerPositionTicket: 7, side: "sell", volumeLots: 0.05,
    entryBroker: 3900, entryGcEstimate: 3922.7,
    slGc: 3918.7, slBroker: 3896, tpGc: 3910, tpBroker: 3887.3,
    profit: 106.1, updatedAt: 1,
  };

  it("uses broker fill and exit prices with the remaining position volume", () => {
    const controls = toOrderControls(
      [order], 3904.8, symbol, { positions: [position], orders: [] },
      new Set(), new Set(),
    );
    expect(controls.find((c) => c.level === "entry")?.pnlValue).toBe(106.1);
    expect(controls.find((c) => c.level === "sl")?.pnlValue).toBeCloseTo(20);
    expect(controls.find((c) => c.level === "tp")?.pnlValue).toBeCloseTo(63.5);
  });

  it("keeps a profitable stop positive and a losing stop negative for both sides", () => {
    for (const side of ["buy", "sell"] as const) {
      const direction = side === "buy" ? 1 : -1;
      const controls = toOrderControls(
        [{ ...order, side, slBroker: 3900 + direction * 2 }],
        undefined, symbol, { positions: [], orders: [] }, new Set(), new Set(),
      );
      expect(controls.find((c) => c.level === "sl")?.pnlValue).toBeCloseTo(20);
      const losing = toOrderControls(
        [{ ...order, side, slBroker: 3900 - direction * 2 }],
        undefined, symbol, { positions: [], orders: [] }, new Set(), new Set(),
      );
      expect(losing.find((c) => c.level === "sl")?.pnlValue).toBeCloseTo(-20);
    }
  });

  it("does not show old stop money while a new broker stop is unconfirmed", () => {
    const controls = toOrderControls(
      [{ ...order, slGc: 3917, slBroker: undefined }], undefined, symbol,
      { positions: [position], orders: [] }, new Set(), new Set(),
    );
    const stop = controls.find((c) => c.level === "sl");
    expect(stop?.price).toBe(3917);
    expect(stop?.pnlValue).toBeUndefined();
    expect(stop?.pnlText).toBeUndefined();
  });

  it("keeps broker projections and pending edits consistent with stop money", () => {
    const brokerPosition = { ...position, slBroker: 3897, tpBroker: 3888 };
    const projected = projectBrokerAnchoredOrders([order], [brokerPosition]);
    const controls = toOrderControls(projected, undefined, symbol,
      { positions: [brokerPosition], orders: [] }, new Set(), new Set());
    expect(controls.find((c) => c.level === "sl")?.pnlValue).toBeCloseTo(15);
    expect(controls.find((c) => c.level === "tp")?.pnlValue).toBeCloseTo(60);

    const pending = projectBrokerAnchoredOrders([order], [brokerPosition],
      new Map([[order.id, { slGc: 3917 }]]));
    const pendingControls = toOrderControls(pending, undefined, symbol,
      { positions: [brokerPosition], orders: [] }, new Set(), new Set());
    expect(pendingControls.find((c) => c.level === "sl")?.price).toBe(3917);
    expect(pendingControls.find((c) => c.level === "sl")?.pnlValue).toBeUndefined();
    expect(pendingControls.find((c) => c.level === "tp")?.pnlValue).toBeCloseTo(60);
  });

  it("uses unrounded broker prices for manual MT5 positions and pending orders", () => {
    const controls = toOrderControls([], undefined, symbol, {
      positions: [{ ...position, slBroker: 3896.047 }],
      orders: [{
        brokerOrderTicket: 8, symbolBroker: "XAUUSDm", side: "buy", kind: "limit",
        volumeLots: 0.1, entryBroker: 3900.03, entryGc: 3922.7,
        slBroker: 3897.01, slGc: 3919.7, updatedAt: 1,
      }],
    }, new Set(), new Set());
    expect(controls.find((c) => c.orderId === "mt5pos:7" && c.level === "sl")?.pnlValue)
      .toBeCloseTo(19.765);
    expect(controls.find((c) => c.orderId === "mt5order:8" && c.level === "sl")?.pnlValue)
      .toBeCloseTo(-30.2);
  });
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

describe("MP alert chart lifecycle", () => {
  it("removes consumed and expired MP lines while retaining current and manual levels", () => {
    const managed: Alert = { id: "mp_active", symbol: "GC", type: "price_crosses_level",
      enabled: true, params: { source: "mp_plan", level: 4055.5, mpExpiresAt: 2000 } };
    const rows: Alert[] = [managed,
      { ...managed, id: "mp_fired", enabled: false, params: { ...managed.params, mpFiredAt: 900 } },
      { ...managed, id: "mp_deleted", enabled: false, params: { ...managed.params, mpDeletedAt: 900 } },
      { ...managed, id: "mp_expired", params: { ...managed.params, mpExpiresAt: 1000 } },
      { ...managed, id: "manual_disabled", enabled: false, params: { level: 4068 } },
    ];
    expect(toAlertLines(rows, 1000).map((line) => line.id)).toEqual(["mp_active", "manual_disabled"]);
    expect(toAlertLines(rows, 2000).map((line) => line.id)).toEqual(["manual_disabled"]);
  });
});

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

describe("broker-fixed market bracket display", () => {
  it("keeps chart levels after 50% close and receives TP edits from MT5", () => {
    const position: TradingPosition = {
      brokerPositionTicket: 7, side: "buy", symbolBroker: "XAUUSDm",
      volumeLots: 0.1, profit: 65.4, entryBroker: 3915, entryGcEstimate: 3940,
      slBroker: 3910.4, slGc: 3935.4, tpBroker: 3952.5, tpGc: 3977.5, updatedAt: 1,
    };
    const order = { id: "partial", source: "market_bar", kind: "market",
      gcAnchored: false, side: "buy", status: "filled", symbolInternal: "GC",
      volumeLots: 0.1, brokerPositionTicket: 7, fillPriceBroker: 3915,
      fillPriceGcEstimate: 3940, slBroker: 3910.4, slGc: 3935.4,
      tpBroker: 3952.5, tpGc: 3977.5 } as TradingOrder;
    const symbol = { symbol: "XAUUSDm", digits: 2, tickSize: 0.01, pipValue: 1,
      minLot: 0.01, maxLot: 100, lotStep: 0.01, stopsLevel: 0.1 };
    const { result, rerender } = renderHook(({ incoming, saved }) => {
      const positions = useBrokerChartPositions([incoming], [saved], "mock-account");
      return toOrderControls(projectBrokerAnchoredOrders([saved], positions),
        undefined, symbol, { positions, orders: [] }, new Set(), new Set());
    }, { initialProps: { incoming: position, saved: order } });
    const half = { ...position, volumeLots: 0.05, profit: 32.7,
      entryGcEstimate: 3929.4, slGc: 3924.8, tpGc: 3966.9, updatedAt: 2 };
    rerender({ incoming: half, saved: { ...order, volumeLots: 0.05 } });
    expect(result.current.find((c) => c.level === "entry")?.price).toBe(3940);
    expect(result.current.find((c) => c.level === "sl")?.price).toBe(3935.4);
    expect(result.current.find((c) => c.level === "tp")?.price).toBe(3977.5);
    expect(result.current.find((c) => c.level === "sl")?.pnlValue).toBeCloseTo(-23);
    expect(result.current.find((c) => c.level === "tp")?.pnlValue).toBeCloseTo(187.5);

    const moved = { ...half, tpBroker: 3942.5, tpGc: 3956.9, updatedAt: 3 };
    rerender({ incoming: moved, saved: { ...order, source: "chart_bracket", gcAnchored: true } });
    expect(result.current.find((c) => c.level === "entry")?.price).toBe(3940);
    expect(result.current.find((c) => c.level === "sl")?.price).toBe(3935.4);
    expect(result.current.find((c) => c.level === "tp")?.price).toBe(3956.9);
    expect(result.current.find((c) => c.level === "tp")?.pnlValue).toBeCloseTo(137.5);
  });

  it("keeps pending SL/TP edits above stale broker and profit snapshots", () => {
    const order = {
      id: "ord_drag", source: "market_bar", kind: "market", gcAnchored: false,
      brokerPositionTicket: 7, entryGc: 2360, slGc: 2357, tpGc: 2366,
    } as TradingOrder;
    const position = {
      brokerPositionTicket: 7, side: "buy" as const, volumeLots: 0.1,
      entryBroker: 2350, entryGcEstimate: 2365, slGc: 2362, tpGc: 2371,
      updatedAt: 1,
    };
    const edits = new Map([[order.id, { slGc: 2363, tpGc: 2375 }]]);
    const projected = projectBrokerAnchoredOrders([order], [position], edits)[0];
    expect(projected).toMatchObject({ entryGc: 2365, slGc: 2363, tpGc: 2375 });
    expect(projectBrokerAnchoredOrders([order], [
      { ...position, profit: 20, updatedAt: 2 },
    ], edits)[0]).toMatchObject({ slGc: 2363, tpGc: 2375 });
    expect(position.slGc).toBe(2362);
    expect(order.slGc).toBe(2357);
    // Removing a rejected edit restores the actual broker levels.
    expect(projectBrokerAnchoredOrders([order], [position])[0]).toMatchObject({
      slGc: 2362, tpGc: 2371,
    });
  });

  it("projects the actual MT5 position without changing stored order anchors", () => {
    const order = {
      id: "ord_fixed", source: "market_bar", kind: "market", gcAnchored: true,
      brokerPositionTicket: 7, entryGc: 2360, slGc: 2357, tpGc: 2366,
    } as TradingOrder;
    const position = {
      brokerPositionTicket: 7, side: "buy" as const, volumeLots: 0.1,
      entryBroker: 2350, entryGcEstimate: 2365, slGc: 2362, tpGc: 2371,
      updatedAt: 1,
    };
    expect(projectBrokerAnchoredOrders([order], [position])[0]).toMatchObject({
      entryGc: 2365, slGc: 2362, tpGc: 2371,
    });
    expect(order.slGc).toBe(2357);
    expect(projectBrokerAnchoredOrders([order], [])[0]).toBe(order);
    const chartOrder = { ...order, source: "chart_bracket" as const, kind: "limit" as const };
    expect(projectBrokerAnchoredOrders([chartOrder], [position])[0]).toBe(chartOrder);
  });
});

describe("chart history windows", () => {
  it("loads only the latest three calendar days for the initial M1 chart", () => {
    const now = Date.UTC(2026, 7, 19, 12);
    expect(initialHistoryWindow("1m", now)).toEqual({
      from: now - 3 * 24 * 60 * 60 * 1_000,
      to: now,
      limit: 3 * 24 * 60,
    });
  });

  it("backfills M1 one day at a time and preserves existing limits elsewhere", () => {
    expect(historyBackfillLimit("1m")).toBe(24 * 60);
    expect(initialHistoryWindow("5m", 123)).toEqual({ limit: 5_000 });
    expect(historyBackfillLimit("5m")).toBe(5_000);
  });
});

describe("chart focus layout", () => {
  it("adds the focus class only while chart focus mode is enabled", () => {
    expect(appShellClassName(false)).toBe("app-shell");
    expect(appShellClassName(true)).toBe("app-shell chart-focus");
  });
});

describe("SuperTrend trailing activation", () => {
  const settings = {
    ...DEFAULT_SUPERTREND_SETTINGS,
    enabled: true,
    period: 1,
    multiplier: 3,
  };
  const bullishBars = [
    {
      time: 60_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 10,
      closed: true,
    },
  ];

  it("allows BUY only while price is above the green line", () => {
    expect(
      supertrendTrailingActivationError("buy", 100, bullishBars, settings),
    ).toBeUndefined();
    expect(
      supertrendTrailingActivationError("sell", 100, bullishBars, settings),
    ).toContain("SELL");
  });

  it("allows SELL only while price is below the red line", () => {
    const bearishBars = [
      ...bullishBars,
      {
        time: 120_000,
        open: 100,
        high: 100,
        low: 89,
        close: 90,
        volume: 10,
        closed: true,
      },
    ];
    expect(
      supertrendTrailingActivationError("buy", 90, bearishBars, settings),
    ).toContain("BUY");
    expect(
      supertrendTrailingActivationError("sell", 90, bearishBars, settings),
    ).toBeUndefined();
  });

  it("tracks whether a trailing target still has an open position", () => {
    const trailing: SupertrendTrailing = {
      targetType: "order",
      targetId: "ord_1",
      brokerPositionTicket: 7,
      side: "buy",
      timeframe: "1m",
      period: 10,
      multiplier: 3,
      atrMethod: "rma",
      source: "hl2",
      createdAt: 1,
      updatedAt: 1,
    };
    const trailings = new Map([["app:ord_1", trailing]]);
    const position = {
      brokerPositionTicket: 7,
      side: "buy" as const,
      volumeLots: 0.1,
      entryBroker: 2350,
      updatedAt: 1,
    };

    expect(hasLiveSupertrendTrailing(trailings, [position])).toBe(true);
    expect(hasLiveSupertrendTrailing(trailings, [])).toBe(false);
    expect(
      hasLiveSupertrendTrailing(trailings, [
        { ...position, brokerPositionTicket: 8 },
      ]),
    ).toBe(false);
  });
});

describe("mobile chart limit order draft", () => {
  const settings = {
    volumeLots: 0.12,
    slDistanceGc: 3,
    tpDistanceGc: 6,
    takeProfit1rEnabled: true,
    autoSupertrendAfter1rEnabled: true,
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
      takeProfit1rEnabled: true,
      takeProfitR: 1,
      autoSupertrendAfter1rEnabled: true,
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
      takeProfit1rEnabled: true,
      takeProfitR: 1,
      autoSupertrendAfter1rEnabled: true,
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

  it("passes the custom partial take profit R to mobile limit orders", () => {
    const draft = buildChartLimitOrderDraft({
      entryPrice: 2360,
      referencePrice: 2370,
      settings: { ...settings, takeProfitR: 1.5 },
    });
    expect(draft?.takeProfitR).toBe(1.5);
  });

  it("sizes a chart bracket from the target risk and floors to the broker lot step", () => {
    const symbol = {
      symbol: "GC",
      digits: 2,
      tickSize: 0.1,
      minLot: 0.01,
      maxLot: 100,
      lotStep: 0.01,
      stopsLevel: 0,
      pipValue: 1,
    };

    expect(
      calculateRiskBasedLots({
        riskAmount: 100,
        entryGc: 2360,
        stopGc: 2357,
        symbol,
      }),
    ).toBe(3.33);

    expect(
      buildChartLimitOrderDraft({
        entryPrice: 2360.04,
        referencePrice: 2370.02,
        settings: {
          ...settings,
          sizingMode: "risk",
          riskAmount: 100,
        },
        symbol,
      })?.volumeLots,
    ).toBe(3.33);
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
        takeProfit1rEnabled: true,
        autoSupertrendAfter1rEnabled: true,
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

  it("enables BigTrade overlays only on the lowest intraday frames", () => {
    expect(bigTradesEnabledForTimeframe("15s")).toBe(true);
    expect(bigTradesEnabledForTimeframe("1m")).toBe(true);
    expect(bigTradesEnabledForTimeframe("5m")).toBe(false);
    expect(bigTradesEnabledForTimeframe("1D")).toBe(false);
  });

  it("keeps timeframe-scoped socket events separate from global events", () => {
    expect(TIMEFRAME_SUBSCRIBED_EVENTS).toEqual([
      "bar_update",
      "volume_delta_update",
      "fvg_signal_update",
      "tdu_signal_update",
    ]);
    expect(GLOBAL_SUBSCRIBED_EVENTS).toEqual([
      "quote_update",
      "market_data_status",
      "alert_event",
      "order_update",
      "account_update",
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
    expect(drawingVisibleOnTimeframe(m5Drawing, "15s")).toBe(true);
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
