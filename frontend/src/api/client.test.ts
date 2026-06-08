import { describe, expect, it, vi } from "vitest";

import { ApiClient } from "./client";

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

  it("saves the authenticated user's default profile", async () => {
    const profile = {
      version: 1,
      timeframe: "1m",
      chartBackgroundColor: "#101010",
      showFootprint: false,
      showBigTrades: true,
      ema: { enabled: false, period: 200, color: "#2962ff" },
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
});
