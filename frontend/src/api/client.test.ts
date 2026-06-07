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
});
