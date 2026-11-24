import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import { useWorkspaces } from "./useWorkspaces";
import { WorkspaceSyncRelay } from "./syncRelay";

afterEach(() => localStorage.clear());

describe("workspace layout persistence", () => {
  it("reloads group preferences/UTC/manual create-update-delete while retaining independent drawings and layout", async () => {
    const api = { workspaces: vi.fn() } as unknown as ApiClient;
    const load = () => useWorkspaces(api, undefined, true, "#0b0f14");
    const first = renderHook(load);
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.update(payload => ({ ...payload, panels: [{ id: "main-chart", type: "chart", timeframe: "5m", drawings: [],
      sync: { groupId: "A", syncViewport: true, syncDrawings: true } }, { id: "mp", type: "marketProfile" }],
      layout: { columnSplit: 61, firstRowSplit: 43, threeColumnSplits: [28, 65], tradingAccountPosition: "right", tradingAccountLocked: false } })));
    const original = first.result.current.active!.payload;
    const relay = new WorkspaceSyncRelay({ workspaceId: first.result.current.active!.id, symbol: "GC", contract: "GC", mode: "live" }, window.location.origin,
      original.panels, original.syncGroups, syncGroups => first.result.current.update(payload => ({ ...payload, syncGroups })), () => {});
    const drawing = { id: "manual", tool: "vertical_line" as const, anchors: [{ utcMs: 1700000000000, price: 2300 }] };
    act(() => relay.connection("main-chart")!.publish({ drawingOps: [{ op: "upsert", drawing }] }));
    act(() => relay.connection("main-chart")!.publish({ viewport: { fromUtcMs: 1700000000000, toUtcMs: 1700000300000 },
      drawingOps: [{ op: "upsert", drawing: { ...drawing, anchors: [{ utcMs: 1700000060000, price: 2400 }] } }] }));
    act(() => relay.connection("main-chart")!.publish({ drawingOps: [{ op: "delete", id: "manual" }] }));
    const saved = first.result.current.active!.payload;
    expect(saved.panels).toEqual(original.panels);
    expect(saved.layout).toEqual(original.layout);
    first.unmount();
    const next = renderHook(load);
    await waitFor(() => expect(next.result.current.ready).toBe(true));
    expect(next.result.current.active!.payload).toEqual(saved);
    const group = Object.values(next.result.current.active!.payload.syncGroups!)[0];
    expect(group.revision).toBe(3);
    expect(group.drawings).toEqual([]);
    expect(group.viewport).toEqual({ fromUtcMs: 1700000000000, toUtcMs: 1700000300000 });
    expect(next.result.current.active!.payload.panels[1].sync).toBeUndefined();
  });
  it("keeps per-workspace panel order, both column sizes and dock preference after guest reload", async () => {
    const api = { workspaces: vi.fn() } as unknown as ApiClient;
    const load = () => useWorkspaces(api, undefined, true, "#0b0f14");
    const first = renderHook(load);
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.update((payload) => ({
      ...payload,
      panels: [{ id: "fp", type: "footprint" }, { id: "main-chart", type: "chart", timeframe: "5m" }, { id: "lq", type: "liquidity" }, { id: "account", type: "tradingAccount" }],
      layout: { columnSplit: 61, firstRowSplit: 43, threeColumnSplits: [28, 65], tradingAccountPosition: "right", tradingAccountSplit: 50, tradingAccountLocked: false },
    })));
    const saved = first.result.current.active!.payload;
    first.unmount();
    const reloaded = renderHook(load);
    await waitFor(() => expect(reloaded.result.current.ready).toBe(true));
    expect(reloaded.result.current.active!.payload).toEqual(saved);
    expect(api.workspaces).not.toHaveBeenCalled();
  });
});
