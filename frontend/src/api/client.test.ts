import { describe, expect, it, vi } from "vitest";

import { ApiClient } from "./client";
import { DEFAULT_EMA_SETTINGS } from "../chart/IndicatorToggles";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("ApiClient auth, MT5, and user profile", () => {
  it("uses Exness execution routes and preserves large broker IDs", async () => {
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === "/api/execution") return jsonResponse({ enabled: true, mode: "exness", profiles: [] });
      if (String(url).endsWith("/status")) return jsonResponse({ connected: true, account: { accountId: "18446744073709551000" } });
      return jsonResponse({});
    });
    const api = new ApiClient({ fetchFn });
    await api.execution();
    await api.mt5Status();
    await api.closeMt5Position("18446744073709551001", .05);
    expect(fetchFn).toHaveBeenCalledWith("/api/execution/status", expect.anything());
    expect(fetchFn).toHaveBeenCalledWith("/api/execution/positions/18446744073709551001/close", expect.objectContaining({ method: "POST", body: JSON.stringify({ volumeLots: .05 }) }));
    expect(fetchFn.mock.calls.some(([url]) => String(url).includes("/mt5/"))).toBe(false);
  });
  it("keeps execution disabled when the relay capability cannot be loaded", async () => {
    const api = new ApiClient({ fetchFn: vi.fn(async () => jsonResponse({}, { status: 503 })) });
    await expect(api.execution()).resolves.toEqual({ enabled: false, profiles: [] });
  });

  it("loads the two allowed Windows execution profiles", async () => {
    const api = new ApiClient({ fetchFn: vi.fn(async () => jsonResponse({ enabled: true, profiles: ["hieu", "hai"] })) });
    await expect(api.execution()).resolves.toEqual({ enabled: true, profiles: ["hieu", "hai"] });
  });

  it("registers a user through /auth/register", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ user: { id: "user_1", username: "alice" } }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(api.register("alice", "pw", "join-9999")).resolves.toEqual({
      id: "user_1",
      username: "alice",
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          username: "alice",
          password: "pw",
          inviteCode: "join-9999",
        }),
      }),
    );
  });

  it("loads MT5 status and user default profile", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          connected: true,
          account: {
            accountId: "acct_1",
            login: 1,
            server: "Broker",
            tradeMode: "demo",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          profile: {
            id: "user_1",
            name: "alice",
            payload: { timeframe: "5m" },
            createdAt: 1,
            updatedAt: 2,
          },
        }),
      );
    const api = new ApiClient({ fetchFn });

    await expect(api.mt5Status()).resolves.toMatchObject({ connected: true });
    await expect(api.meProfile()).resolves.toMatchObject({
      id: "user_1",
      payload: { timeframe: "5m" },
    });
  });

  it("loads and controls MT5 broker open trades", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          positions: [
            {
              brokerPositionTicket: 7,
              side: "buy",
              volumeLots: 0.1,
              entryBroker: 2350.1,
              entryGcEstimate: 2374.1,
              updatedAt: 1,
            },
          ],
          orders: [
            {
              brokerOrderTicket: 8,
              side: "sell",
              kind: "limit",
              volumeLots: 0.2,
              entryBroker: 2360,
              entryGc: 2384,
              updatedAt: 2,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ position: { brokerPositionTicket: 7 } }))
      .mockResolvedValueOnce(jsonResponse({ brokerPositionTicket: 7, closed: true }))
      .mockResolvedValueOnce(jsonResponse({ order: { brokerOrderTicket: 8 } }))
      .mockResolvedValueOnce(jsonResponse({ brokerOrderTicket: 8, cancelled: true }));
    const api = new ApiClient({ fetchFn });

    await expect(api.mt5OpenTrades()).resolves.toMatchObject({
      positions: [{ brokerPositionTicket: 7 }],
      orders: [{ brokerOrderTicket: 8 }],
    });
    await api.patchMt5Position(7, { slGc: 2370, tpGc: null });
    await api.closeMt5Position(7);
    await api.patchMt5Order(8, { entryGc: 2384, slGc: 2388 });
    await api.cancelMt5Order(8);

    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "/api/execution/positions/7",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        body: JSON.stringify({ slGc: 2370, tpGc: null }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "/api/execution/positions/7/close",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "/api/execution/orders/8",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        body: JSON.stringify({ entryGc: 2384, slGc: 2388 }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      5,
      "/api/execution/orders/8",
      expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
    );
  });

  it("loads and toggles manual SuperTrend trailing", async () => {
    const trailing = {
      targetType: "order" as const,
      targetId: "ord_1",
      brokerPositionTicket: 7,
      side: "buy" as const,
      timeframe: "1m" as const,
      period: 10,
      multiplier: 3,
      atrMethod: "rma" as const,
      source: "hl2" as const,
      createdAt: 1,
      updatedAt: 1,
    };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ trailings: [trailing] }))
      .mockResolvedValueOnce(jsonResponse({ trailing }))
      .mockResolvedValueOnce(jsonResponse({ disabled: true }));
    const api = new ApiClient({ fetchFn });

    await expect(api.supertrendTrailings()).resolves.toEqual([trailing]);
    await expect(
      api.enableSupertrendTrailing("order", "ord_1", {
        timeframe: "1m",
        period: 10,
        multiplier: 3,
        atrMethod: "rma",
        source: "hl2",
      }),
    ).resolves.toEqual(trailing);
    await api.disableSupertrendTrailing("order", "ord_1");

    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "/api/supertrend-trailing/orders/ord_1",
      expect.objectContaining({ method: "PUT", credentials: "same-origin" }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "/api/supertrend-trailing/orders/ord_1",
      expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
    );
  });

  it("sends a partial app order close volume", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ order: { id: "ord_1", status: "filled", volumeLots: 0.05 } }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(api.closeOrder("ord_1", 0.05)).resolves.toMatchObject({
      id: "ord_1",
      volumeLots: 0.05,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orders/ord_1/close",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volumeLots: 0.05 }),
      }),
    );
  });

  it("saves the authenticated user's default profile", async () => {
    const profile = {
      version: 1,
      timeframe: "1m",
      chartBackgroundColor: "#101010",
      showFootprint: false,
      showBigTrades: true,
      ema: { ...DEFAULT_EMA_SETTINGS },
      smc: { enabled: false },
      footprintSettings: {},
      drawings: [],
    };
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        profile: {
          id: "user_1",
          name: "alice",
          payload: profile,
          createdAt: 1,
          updatedAt: 2,
        },
      }),
    );
    const api = new ApiClient({ fetchFn });

    await api.saveMeProfile({ name: "alice", payload: profile as never });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/me/profile",
      expect.objectContaining({
        method: "PUT",
        credentials: "same-origin",
        body: JSON.stringify({ name: "alice", payload: profile }),
      }),
    );
  });

  it("saves standalone liquidity chart state via /me/profile/liquidity-chart", async () => {
    const liquidityChart = {
      version: 1 as const,
      timeframe: "1m" as const,
      visibleBars: 240,
      offsetBars: 0,
      priceScale: 1,
      pricePanPx: 0,
      filters: { longTerm: true, relative: true, absolute: true },
      showVwap: true,
      showBigTrades: true,
      bigTradeSettings: {
        minVolume: 40,
        maxVisible: 250,
        soundEnabled: true,
        sessionMinVolumes: { asia: 40, eu: 60, us: 120 },
      },
    };
    const fetchFn = vi.fn(async () => jsonResponse({ liquidityChart }));
    const api = new ApiClient({ fetchFn });

    await expect(api.saveMeLiquidityChart(liquidityChart)).resolves.toEqual(
      liquidityChart,
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/me/profile/liquidity-chart",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        body: JSON.stringify({ liquidityChart }),
      }),
    );
  });

  it("fetches icebergs and si-stops snapshots", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ symbol: "GC", contract: "GC", icebergs: [] }))
      .mockResolvedValueOnce(jsonResponse({ symbol: "GC", contract: "GC", chains: [] }));
    const api = new ApiClient({ fetchFn });

    await api.getIcebergs({ symbol: "GC", contract: "GC", limit: 100 });
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "/api/orderflow/icebergs?symbol=GC&contract=GC&limit=100&min_volume=1",
      expect.objectContaining({ credentials: "same-origin" }),
    );

    await api.getSiStops({ symbol: "GC", contract: "GC", limit: 500 });
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "/api/orderflow/si-stops?symbol=GC&contract=GC&limit=500",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads footprint details with latest count", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        bars: [
          {
            time: 1000,
            rows: [{ price: 2400.1, bid: 2, ask: 5, imbalance: "ask" }],
            poc: 2400.1,
            barDelta: 3,
            buyPct: 0.7,
            sellPct: 0.3,
            unfinishedAuction: { high: false, low: false },
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(
      api.footprintDetails("GC", "GC", { count: 100 }),
    ).resolves.toMatchObject({ bars: [{ time: 1000, poc: 2400.1 }] });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/footprint?symbol=GC&contract=GC&count=100",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads footprint details from a session start", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        bars: [],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await api.footprintDetails("GC", "GC", { from: 1_000 });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/footprint?symbol=GC&contract=GC&from=1000",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("bounds chart footprint history at the visible end time", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ symbol: "GC", contract: "GC", tf: "1m", bars: [] }));
    const api = new ApiClient({ fetchFn });
    await api.footprintDetails("GC", "GC", { from: 1_000, to: 2_000 });
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/footprint?symbol=GC&contract=GC&from=1000&to=2000",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("can request cached big trades without a raw-tick rebuild", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        trades: [
          {
            tradeId: 7,
            time: 1_000,
            price: 2_400.1,
            volume: 12,
            side: "buy",
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(
      api.bigTrades("GC", "GC", 5_000, { from: 1_000, to: 2_000 }, true),
    ).resolves.toMatchObject([{ tradeId: 7, time: 1_000, side: "buy" }]);

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/big-trades?symbol=GC&contract=GC&limit=5000&from=1000&to=2000&cacheOnly=true",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads centered footprint history metadata", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        at: 2000,
        context: 3,
        targetFound: false,
        bars: [],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(
      api.footprintDetails("GC", "GC", { at: 2000, context: 3 }),
    ).resolves.toMatchObject({ at: 2000, context: 3, targetFound: false });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/footprint?symbol=GC&contract=GC&at=2000&context=3",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads a fixed-range delta profile through /orderflow/delta-profile", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        from: 1000,
        to: 2000,
        rowTicks: 1,
        valueAreaPct: 70,
        poc: 4514.1,
        vah: 4514.2,
        val: 4514.0,
        totalVolume: 10,
        totalDelta: 4,
        maxAbsDelta: 4,
        coveredBars: 2,
        source: "footprint_cache",
        rows: [
          {
            price: 4514.1,
            bidVolume: 3,
            askVolume: 7,
            totalVolume: 10,
            delta: 4,
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(
      api.deltaProfile({
        symbol: "GC",
        contract: "GC",
        from: 1000,
        to: 2000,
        rowTicks: 1,
        valueAreaPct: 70,
      }),
    ).resolves.toMatchObject({ totalDelta: 4, rows: [{ delta: 4 }] });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/delta-profile?symbol=GC&contract=GC&from=1000&to=2000&rowTicks=1&valueAreaPct=70",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("requests a fixed-range profile from minute bars", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        from: 1000,
        to: 2000,
        rowTicks: 1,
        valueAreaPct: 68,
        poc: 4514.1,
        vah: 4514.2,
        val: 4514.0,
        totalVolume: 10,
        totalDelta: 0,
        maxAbsDelta: 0,
        coveredBars: 2,
        source: "minute_bars",
        rows: [
          {
            price: 4514.1,
            bidVolume: 0,
            askVolume: 0,
            totalVolume: 10,
            delta: 0,
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await api.deltaProfile({
      symbol: "GC",
      contract: "GC",
      from: 1000,
      to: 2000,
      rowTicks: 1,
      valueAreaPct: 68,
      source: "minute_bars",
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/delta-profile?symbol=GC&contract=GC&from=1000&to=2000&rowTicks=1&valueAreaPct=68&source=minute_bars",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads confirmed FVG Signal Grader candle colors", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        signals: [
          {
            time: 1000,
            direction: 1,
            level: 5,
            pulse: 5,
            top: 2346.0,
            bottom: 2345.5,
            breakoutRatio: 1.8,
            phase: "confirmed",
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(api.fvgSignals("GC", "GC", 500)).resolves.toEqual([
      {
        type: "fvg_signal_update",
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        time: 1000,
        direction: 1,
        level: 5,
        pulse: 5,
        top: 2346.0,
        bottom: 2345.5,
        breakoutRatio: 1.8,
        phase: "confirmed",
      },
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/fvg-signals?symbol=GC&contract=GC&tf=1m&limit=500",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads TDU momentum and delta-divergence rows", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "GC",
        contract: "GC",
        tf: "5m",
        signals: [
          {
            time: 1000,
            momentumDirection: -1,
            momentumLevel: 3,
            deltaDivergence: 1,
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(api.tduSignals("GC", "GC", "5m", 500)).resolves.toEqual([
      {
        type: "tdu_signal_update",
        symbol: "GC",
        contract: "GC",
        tf: "5m",
        time: 1000,
        momentumDirection: -1,
        momentumLevel: 3,
        deltaDivergence: 1,
      },
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orderflow/tdu-signals?symbol=GC&contract=GC&tf=5m&limit=500",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads SMC AI baseline signals for a chart range", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        signals: [
          {
            id: "sig-1",
            time: 1000,
            price: 4510.1,
            side: "long",
            zoneType: "fvg",
            huntType: "sweep_low",
            confirmation: "outside_bar",
            outcome: "win",
            netR: 1.9,
            text: "AI L FVG",
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(
      api.smcAiBaselineSignals({
        symbol: "GC",
        contract: "GC",
        timeframe: "1m",
        from: 1000,
        to: 2000,
        limit: 250,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "sig-1", side: "long", zoneType: "fvg" }),
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/smc-ai/baseline-signals?symbol=GC&contract=GC&tf=1m&from=1000&to=2000&limit=250",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads historical mGann Break L/S alert markers", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        signals: [
          {
            id: "a_1:hist:1000:1",
            alertId: "a_1",
            time: 1000,
            price: 4510.1,
            direction: 1,
            text: "Break L",
          },
        ],
      }),
    );
    const api = new ApiClient({ fetchFn });

    await expect(
      api.mgannBigTradeSweepSignals({
        symbol: "GC",
        contract: "GC",
        timeframe: "1m",
        profileId: "hieu",
        from: 1000,
        to: 2000,
        limit: 250,
        settings: { requireBigTrade: true },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "a_1:hist:1000:1", text: "Break L" }),
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining(
        `settings=${encodeURIComponent(JSON.stringify({ requireBigTrade: true }))}`,
      ),
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("passes idempotencyKey in closeMt5Position, patchMt5Position, and cancelMt5Order", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/positions/123/close")) {
        return jsonResponse({ ok: true });
      }
      if (url.includes("/positions/123")) {
        return jsonResponse({ position: { ticket: 123, slGc: 2650.5, tpGc: 2660.0 } });
      }
      if (url.includes("/orders/456")) {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({});
    });
    const api = new ApiClient({ fetchFn });

    // closeMt5Position
    await api.closeMt5Position(123, 0.5, "close-123-key");
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/execution/positions/123/close",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ volumeLots: 0.5, idempotencyKey: "close-123-key" }),
      }),
    );

    // patchMt5Position
    await api.patchMt5Position(123, { slGc: 2650.5, tpGc: 2660.0, idempotencyKey: "edit-123-key" });
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/execution/positions/123",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ slGc: 2650.5, tpGc: 2660.0, idempotencyKey: "edit-123-key" }),
      }),
    );

    // cancelMt5Order
    await api.cancelMt5Order(456, "cancel-456-key");
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/execution/orders/456",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ idempotencyKey: "cancel-456-key" }),
      }),
    );
  });

  it("passes idempotencyKey in closeOrder, patchOrder, and cancelOrder", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/close")) {
        return jsonResponse({ order: { id: "o-1", status: "closed" } });
      }
      return jsonResponse({ order: { id: "o-1", status: "open" } });
    });
    const api = new ApiClient({ fetchFn });

    // closeOrder
    await api.closeOrder("o-1", 1.0, "close-o1-key");
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orders/o-1/close",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ volumeLots: 1.0, idempotencyKey: "close-o1-key" }),
      }),
    );

    // patchOrder
    await api.patchOrder("o-1", { slGc: 2640, idempotencyKey: "patch-o1-key" });
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orders/o-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ slGc: 2640, idempotencyKey: "patch-o1-key" }),
      }),
    );

    // cancelOrder
    await api.cancelOrder("o-1", "cancel-o1-key");
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/orders/o-1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ idempotencyKey: "cancel-o1-key" }),
      }),
    );
  });
});
