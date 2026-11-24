import type { DrawingState } from "../chart/drawings/types";
import type { Timeframe } from "../socket/messages";
import type { SharedDrawing, UtcViewport } from "../chart/shared/sync";

export type WorkspaceSyncGroupId = "A" | "B" | "C" | "D";
export interface WorkspacePanelSync {
  groupId: WorkspaceSyncGroupId | null;
  syncViewport: boolean;
  syncDrawings: boolean;
}
/** Separate from each panel's local drawings and the selected chart profile. */
export interface WorkspaceSyncGroup {
  groupId: WorkspaceSyncGroupId;
  symbol: string;
  contract: string;
  mode: "live" | "replay";
  replayId?: string;
  revision: number;
  viewport?: UtcViewport;
  drawings: SharedDrawing[];
}

export type WorkspacePanelType = "chart" | "footprint" | "marketProfile" | "liquidity" | "aiScan" | "alerts" | "tradingAccount";
export type WorkspaceTemplate = "essentials" | "order-flow" | "multi-timeframe" | "scratch";

export interface WorkspacePanel {
  id: string;
  type: WorkspacePanelType;
  timeframe?: Timeframe;
  drawings?: DrawingState[];
  sync?: WorkspacePanelSync;
}

export interface WorkspaceTheme {
  preset: string;
  background: string;
  text: string;
  rise: string;
  fall: string;
  buy: string;
  sell: string;
  accent: string;
}

export interface WorkspaceLayout {
  columnSplit: number;
  /** Divider positions (%) for the wide three-column layout, independent of the two-column split. */
  threeColumnSplits?: [number, number];
  firstRowSplit: number;
  tradingAccountSplit?: number;
  tradingAccountPosition?: "bottom" | "right";
  /** Keep the mounted account visible when a chart widget is maximized. */
  tradingAccountLocked?: boolean;
}

export interface WorkspacePayload {
  version: 1;
  template: WorkspaceTemplate;
  panels: WorkspacePanel[];
  layout: WorkspaceLayout;
  theme: WorkspaceTheme;
  useChartProfile?: boolean;
  tradingAccountInitialized?: boolean;
  syncGroups?: Record<string, WorkspaceSyncGroup>;
}

export interface Workspace {
  id: string;
  name: string;
  payload: WorkspacePayload;
  createdAt: number;
  updatedAt: number;
}
