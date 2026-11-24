import { describe, expect, it } from "vitest";
import { normalizePanelSync, normalizeSyncGroups, normalizeWorkspaceSync, syncGroupKey } from "./syncSettings";
import { DEFAULT_THEME } from "./themes";
import type { WorkspacePayload, WorkspaceSyncGroup } from "./types";

describe("workspace group migration", () => {
  it("preserves v1 positions, local drawings/profile setting and independent default without adding state", () => {
    const payload: WorkspacePayload = { version: 1, template: "scratch", useChartProfile: true, theme: DEFAULT_THEME,
      panels: [{ id: "main-chart", type: "chart", timeframe: "5m", drawings: [] }, { id: "fp", type: "footprint" }],
      layout: { columnSplit: 61, firstRowSplit: 43, threeColumnSplits: [28, 65], tradingAccountPosition: "right" } };
    expect(normalizeWorkspaceSync(payload)).toEqual(payload);
    expect(normalizePanelSync(undefined)).toEqual({ groupId: null, syncViewport: true, syncDrawings: false });
  });
  it("sanitizes only new preferences and group layer, excluding unsupported annotations", () => {
    expect(normalizePanelSync({ groupId: "unknown", syncViewport: "true", syncDrawings: true })).toEqual({ groupId: null, syncViewport: true, syncDrawings: true });
    const group: WorkspaceSyncGroup = { groupId: "B", symbol: "GC", contract: "GC", mode: "live", revision: 4,
      viewport: { fromUtcMs: 1000, toUtcMs: 2000 }, drawings: [{ id: "one", tool: "vertical_line", anchors: [{ utcMs: 1500, price: 2300 }] }] };
    const groups = normalizeSyncGroups({ arbitraryKey: { ...group, drawings: [...group.drawings, ...group.drawings,
      { id: "AI", tool: "order_bracket", anchors: [] }] }, bad: { groupId: "E" } });
    expect(groups).toEqual({ [syncGroupKey(group)]: group });
    expect(normalizeSyncGroups(null)).toEqual({});
  });
});
