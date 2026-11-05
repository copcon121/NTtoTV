import { describe, expect, it, vi } from "vitest";

import type { Mt5Status } from "../api/client";
import type { TradingOrder } from "../socket/messages";
import { createTradingStateRefresh } from "./tradingStateRefresh";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup() {
  const api = {
    orders: vi.fn(async (): Promise<TradingOrder[]> => []),
    mt5OpenTrades: vi.fn(async () => ({ positions: [], orders: [] })),
    mt5Status: vi.fn(async (): Promise<Mt5Status> => ({ connected: false, account: null })),
    supertrendTrailings: vi.fn(async () => []),
  };
  const updates = {
    orders: vi.fn(), openTrades: vi.fn(), status: vi.fn(), trailings: vi.fn(),
  };
  return { api, updates, refresh: createTradingStateRefresh(api, updates) };
}

describe("trading state refresh", () => {
  it("applies orders immediately and finishes without waiting for account status", async () => {
    const { api, updates, refresh } = setup();
    const status = deferred<Mt5Status>();
    const trades = deferred<{ positions: []; orders: [] }>();
    api.mt5Status.mockReturnValue(status.promise);
    api.mt5OpenTrades.mockReturnValue(trades.promise);
    const pending = refresh.refresh();
    await Promise.resolve();
    expect(updates.orders).toHaveBeenCalledWith([]);
    expect(updates.openTrades).not.toHaveBeenCalled();
    trades.resolve({ positions: [], orders: [] });
    await pending;
    expect(updates.status).not.toHaveBeenCalled();
    status.resolve({ connected: false, account: null });
    await Promise.resolve();
    expect(updates.status).toHaveBeenCalledOnce();
  });

  it("ignores a snapshot taken before a new order operation", async () => {
    const { api, updates, refresh } = setup();
    const orders = deferred<TradingOrder[]>();
    api.orders.mockReturnValue(orders.promise);
    const canApplyPoll = refresh.guard();
    const pending = refresh.refresh();
    refresh.invalidate();
    expect(canApplyPoll()).toBe(false);
    orders.resolve([]);
    await pending;
    expect(updates.orders).not.toHaveBeenCalled();
    expect(updates.openTrades).not.toHaveBeenCalled();
    expect(updates.status).not.toHaveBeenCalled();
  });

  it("keeps a newer refresh when an older request returns late", async () => {
    const { api, updates, refresh } = setup();
    const older = deferred<TradingOrder[]>();
    api.orders.mockReturnValueOnce(older.promise);
    const pending = refresh.refresh();
    await refresh.refresh();
    expect(updates.orders).toHaveBeenCalledOnce();
    older.resolve([]);
    await pending;
    expect(updates.orders).toHaveBeenCalledOnce();
  });

  it("preserves order edits that change while a refresh is pending", async () => {
    const { api, updates } = setup();
    const orders = deferred<TradingOrder[]>();
    api.orders.mockReturnValue(orders.promise);
    let editRevision = 0;
    const refresh = createTradingStateRefresh(api, {
      ...updates,
      guard: () => {
        const revision = editRevision;
        return () => revision === editRevision;
      },
    });
    const pending = refresh.refresh();
    editRevision += 1;
    orders.resolve([]);
    await pending;
    expect(updates.orders).not.toHaveBeenCalled();
    expect(updates.openTrades).not.toHaveBeenCalled();
  });

  it("still updates positions when another query fails", async () => {
    const { api, updates, refresh } = setup();
    api.orders.mockRejectedValue(new Error("MT5 unavailable"));
    api.mt5Status.mockRejectedValue(new Error("MT5 unavailable"));
    await refresh.refresh();
    expect(updates.openTrades).toHaveBeenCalledWith({ positions: [], orders: [] });
    expect(updates.orders).not.toHaveBeenCalled();
    expect(updates.status).not.toHaveBeenCalled();
  });
});
