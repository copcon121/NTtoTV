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
      "/api/mt5/positions/7",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        body: JSON.stringify({ slGc: 2370, tpGc: null }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "/api/mt5/positions/7/close",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "/api/mt5/orders/8",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        body: JSON.stringify({ entryGc: 2384, slGc: 2388 }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      5,
      "/api/mt5/orders/8",
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
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "a_1:hist:1000:1", text: "Break L" }),
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/signals/mgann-break-ls?symbol=GC&contract=GC&tf=1m&profileId=hieu&from=1000&to=2000&limit=250",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads latest analyst report and triggers a manual analyst run", async () => {
    const report = {
      reportId: "r-1",
      snapshotId: "s-1",
      symbol: "GC",
      contract: "GC",
      createdAt: 1,
      bias: "bullish",
      decision: "buy_candidate",
      confidence: 0.68,
      reason: ["H1 bullish"],
      invalidIf: "M5 close below support",
      nextConfirmation: "M1 positive CVD flip",
      riskState: "candidate",
      allowedToAlert: true,
      allowedToAutoTrade: false,
    };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ report }))
      .mockResolvedValueOnce(
        jsonResponse({
          snapshot: { snapshotId: "s-2" },
          report,
          llmEnabled: true,
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          available: false,
          enabled: false,
          reason: "30-minute auto analyst has been replaced by event-driven POI scanner",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          available: false,
          enabled: false,
          reason: "30-minute auto analyst has been replaced by event-driven POI scanner",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          available: true,
          enabled: false,
          profileId: "desk",
          providerMode: "real",
          llmEnabled: true,
          reason: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          available: true,
          enabled: true,
          profileId: "desk",
          providerMode: "real",
          llmEnabled: true,
          reason: null,
        }),
      );
    const api = new ApiClient({ fetchFn });

    await expect(api.analystLatest("GC", "GC")).resolves.toMatchObject({
      decision: "buy_candidate",
    });
    await expect(api.runAnalyst("GC", "GC", "desk")).resolves.toMatchObject({
      report: { reportId: "r-1" },
      llmEnabled: true,
    });
    await expect(api.analystAutoSend()).resolves.toMatchObject({
      available: false,
      enabled: false,
    });
    await expect(api.setAnalystAutoSend(false)).resolves.toMatchObject({
      available: false,
      enabled: false,
    });
    await expect(api.analystEventAi("desk")).resolves.toMatchObject({
      available: true,
      enabled: false,
      profileId: "desk",
    });
    await expect(api.setAnalystEventAi(true, "desk")).resolves.toMatchObject({
      enabled: true,
      providerMode: "real",
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "/api/analyst/latest?symbol=GC&contract=GC",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "/api/analyst/run?symbol=GC&contract=GC&profileId=desk",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "/api/analyst/auto-send",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "/api/analyst/auto-send",
      expect.objectContaining({
        method: "PUT",
        credentials: "same-origin",
        body: JSON.stringify({ enabled: false }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      5,
      "/api/analyst/event-ai?profileId=desk",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      6,
      "/api/analyst/event-ai?profileId=desk",
      expect.objectContaining({
        method: "PUT",
        credentials: "same-origin",
        body: JSON.stringify({ enabled: true }),
      }),
    );
  });
});
