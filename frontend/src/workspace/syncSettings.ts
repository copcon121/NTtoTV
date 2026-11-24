import { validSharedDrawing, validViewport } from "../chart/shared/sync";
import type { WorkspacePanel, WorkspacePanelSync, WorkspacePayload, WorkspaceSyncGroup, WorkspaceSyncGroupId } from "./types";

export const SYNC_GROUPS: readonly WorkspaceSyncGroupId[] = ["A", "B", "C", "D"];
export const INDEPENDENT_SYNC: WorkspacePanelSync = { groupId: null, syncViewport: true, syncDrawings: false };
export const canLinkPanel = (panel: WorkspacePanel) => ["chart", "footprint", "marketProfile", "liquidity"].includes(panel.type);
export function normalizePanelSync(value: unknown): WorkspacePanelSync {
  const sync = value as Partial<WorkspacePanelSync> | undefined;
  return {
    groupId: sync && SYNC_GROUPS.includes(sync.groupId as WorkspaceSyncGroupId) ? sync.groupId as WorkspaceSyncGroupId : null,
    syncViewport: typeof sync?.syncViewport === "boolean" ? sync.syncViewport : true,
    syncDrawings: typeof sync?.syncDrawings === "boolean" ? sync.syncDrawings : false,
  };
}
export function syncGroupKey(context: Pick<WorkspaceSyncGroup, "groupId" | "symbol" | "contract" | "mode" | "replayId">): string {
  return JSON.stringify([context.groupId, context.symbol, context.contract, context.mode, context.replayId ?? null]);
}
export function normalizeSyncGroups(value: unknown): Record<string, WorkspaceSyncGroup> {
  const groups: Record<string, WorkspaceSyncGroup> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return groups;
  // Bound imported payloads without discarding any unrelated workspace settings.
  for (const candidate of Object.values(value).slice(0, 100)) {
    const group = candidate as WorkspaceSyncGroup | undefined;
    if (!group || !SYNC_GROUPS.includes(group.groupId) || typeof group.symbol !== "string" || !group.symbol ||
      typeof group.contract !== "string" || !group.contract || !["live", "replay"].includes(group.mode) ||
      (group.replayId !== undefined && typeof group.replayId !== "string")) continue;
    const drawings = Array.isArray(group.drawings) ? group.drawings.filter(validSharedDrawing).slice(0, 1000) : [];
    groups[syncGroupKey(group)] = {
      groupId: group.groupId, symbol: group.symbol, contract: group.contract, mode: group.mode,
      ...(group.replayId === undefined ? {} : { replayId: group.replayId }),
      revision: Number.isSafeInteger(group.revision) && group.revision >= 0 ? group.revision : 0,
      ...(validViewport(group.viewport) ? { viewport: group.viewport } : {}),
      drawings: [...new Map(drawings.map(drawing => [drawing.id, drawing])).values()],
    };
  }
  return groups;
}
export function normalizeWorkspaceSync(payload: WorkspacePayload): WorkspacePayload {
  return {
    ...payload,
    panels: payload.panels.map(panel => panel.sync === undefined ? panel : {
      ...panel, sync: canLinkPanel(panel) ? normalizePanelSync(panel.sync) : { ...INDEPENDENT_SYNC },
    }),
    ...(payload.syncGroups === undefined ? {} : { syncGroups: normalizeSyncGroups(payload.syncGroups) }),
  };
}
