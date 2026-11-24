import type { WorkspaceLayout } from "./types";

export const COMPACT_WORKSPACE_WIDTH = 700;
export const THREE_COLUMN_WIDTH = 1440;
export const RIGHT_DOCK_WIDTH = 360;
export const WORKSPACE_GAP = 5;
export const MIN_COLUMN_SHARE = 18;

export function contentColumnCount(width: number, panelCount: number, rightDock: boolean): number {
  if (width <= COMPACT_WORKSPACE_WIDTH || panelCount < 2) return 1;
  const contentWidth = width - (rightDock ? RIGHT_DOCK_WIDTH + WORKSPACE_GAP : 0);
  return Math.min(panelCount, contentWidth >= THREE_COLUMN_WIDTH ? 3 : 2);
}

export function normalizeThreeColumnSplits(value: WorkspaceLayout["threeColumnSplits"]): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) return [33, 67];
  const first = Math.max(MIN_COLUMN_SHARE, Math.min(100 - 2 * MIN_COLUMN_SHARE, Math.round(value[0])));
  const second = Math.max(first + MIN_COLUMN_SHARE, Math.min(100 - MIN_COLUMN_SHARE, Math.round(value[1])));
  return [first, second];
}

export function resizeThreeColumn(layout: WorkspaceLayout, divider: number, value: number): WorkspaceLayout {
  const splits = normalizeThreeColumnSplits(layout.threeColumnSplits);
  splits[divider] = divider === 0
    ? Math.max(MIN_COLUMN_SHARE, Math.min(splits[1] - MIN_COLUMN_SHARE, Math.round(value)))
    : Math.max(splits[0] + MIN_COLUMN_SHARE, Math.min(100 - MIN_COLUMN_SHARE, Math.round(value)));
  return { ...layout, threeColumnSplits: splits };
}
