import { applyDrawingOperations, SYNC_PROTOCOL, validSyncChange } from "../chart/shared/sync";
import type { ChartSyncChange, ChartSyncConfig, ChartSyncConnection, SharedToolSelection, WidgetSyncHello, WidgetSyncUpdate } from "../chart/shared/sync";
import type { Timeframe } from "../socket/messages";
import { canLinkPanel, normalizePanelSync, normalizeSyncGroups, syncGroupKey } from "./syncSettings";
import type { WorkspacePanel, WorkspacePanelSync, WorkspaceSyncGroup } from "./types";

export interface SyncContext { workspaceId: string; symbol: string; contract: string; mode: "live" | "replay"; replayId?: string }
type Target = Pick<Window, "postMessage">;
const TIMEFRAMES: Record<Timeframe, true> = { "15s": true, "30s": true, "1m": true, "3m": true, "5m": true,
  "15m": true, "30m": true, "1h": true, "4h": true, "1D": true, "1W": true, "1M": true };
interface Member {
  widgetId: string;
  instanceId: string;
  epoch: string;
  sequence: number;
  preferences: WorkspacePanelSync;
  target?: Target;
  ready: boolean;
  timeframe?: Timeframe;
}
interface GroupRuntime { state: WorkspaceSyncGroup; drawingRevisions: Map<string, number>; viewportRevision: number; toolSelection?: SharedToolSelection }

/** One relay per workspace/user/instrument context. No browser storage or chart logical coordinates here. */
export class WorkspaceSyncRelay {
  private panels = new Map<string, WorkspacePanel>();
  private members = new Map<string, Member>();
  private groups = new Map<string, GroupRuntime>();
  private savedGroups: Record<string, WorkspaceSyncGroup>;
  private active = true;

  constructor(
    readonly context: SyncContext,
    readonly origin: string,
    panels: readonly WorkspacePanel[],
    savedGroups: unknown,
    private readonly persist: (groups: Record<string, WorkspaceSyncGroup>) => void,
    private readonly changed: () => void,
    private readonly id: () => string = () => crypto.randomUUID(),
  ) {
    this.savedGroups = normalizeSyncGroups(savedGroups);
    this.panels = new Map(panels.filter(canLinkPanel).map(panel => [panel.id, panel]));
  }

  configure(panels: readonly WorkspacePanel[]): void {
    this.panels = new Map(panels.filter(canLinkPanel).map(panel => [panel.id, panel]));
    for (const [widgetId, member] of this.members) {
      const panel = this.panels.get(widgetId);
      if (!panel) { this.clearTool(member); this.members.delete(widgetId); continue; }
      const preferences = normalizePanelSync(panel.sync);
      if (JSON.stringify(preferences) !== JSON.stringify(member.preferences)) {
        this.clearTool(member);
        member.preferences = preferences;
        member.epoch = this.id();
        member.sequence = 0;
        this.send(member);
      }
    }
    this.changed();
  }

  private group(member: Member): GroupRuntime | undefined {
    const groupId = member.preferences.groupId;
    if (!groupId) return undefined;
    const key = syncGroupKey({ ...this.context, groupId });
    let group = this.groups.get(key);
    if (!group) {
      const { symbol, contract, mode, replayId } = this.context;
      const state = this.savedGroups[key] ?? { symbol, contract, mode, ...(replayId ? { replayId } : {}), groupId, revision: 0, drawings: [] };
      group = { state, drawingRevisions: new Map(state.drawings.map(d => [d.id, state.revision])), viewportRevision: state.revision };
      this.groups.set(key, group);
    }
    return group;
  }

  private config(member: Member): ChartSyncConfig {
    const group = this.group(member);
    return {
      ...this.context, widgetId: member.widgetId, instanceId: member.instanceId, epoch: member.epoch,
      revision: group?.state.revision ?? 0, ...member.preferences,
      syncViewport: !!group && member.preferences.syncViewport,
      syncDrawings: !!group && member.preferences.syncDrawings,
      viewport: member.preferences.syncViewport ? group?.state.viewport : undefined,
      drawings: member.preferences.syncDrawings ? group?.state.drawings ?? [] : [],
      toolSelection: member.preferences.syncDrawings ? group?.toolSelection : undefined,
    };
  }

  private send(member: Member): void {
    if (this.active && member.target && member.ready) member.target.postMessage({ protocol: SYNC_PROTOCOL, type: "config", config: this.config(member) }, this.origin);
  }

  private broadcast(member: Member): void {
    for (const peer of this.members.values()) if (peer.preferences.groupId === member.preferences.groupId) this.send(peer);
  }

  private clearTool(member: Member): void {
    const group = this.group(member);
    if (!group?.toolSelection?.tool) return;
    group.toolSelection = { ...group.toolSelection, tool: null };
    this.broadcast(member);
    this.changed();
  }

  /** Registration binds the actual iframe window AND a parent-created mount token. */
  registerFrame(widgetId: string, instanceId: string, target: Target): () => void {
    // Child layout effects register before the parent's StrictMode resume effect.
    if (!this.panels.has(widgetId)) return () => {};
    const previous = this.members.get(widgetId);
    if (previous) this.clearTool(previous);
    const member: Member = { widgetId, instanceId, target, epoch: this.id(), sequence: 0,
      preferences: normalizePanelSync(this.panels.get(widgetId)?.sync), ready: false };
    this.members.set(widgetId, member);
    return () => {
      if (this.members.get(widgetId) === member) { this.clearTool(member); this.members.delete(widgetId); this.changed(); }
    };
  }

  frameLoaded(widgetId: string, instanceId: string): void {
    const member = this.members.get(widgetId);
    if (!this.active || !member?.target || member.instanceId !== instanceId) return;
    this.clearTool(member);
    member.epoch = this.id();
    member.sequence = 0;
    member.ready = true;
    this.send(member);
  }

  connection(widgetId: string): ChartSyncConnection | undefined {
    if (!this.active || !this.panels.has(widgetId)) return undefined;
    let member = this.members.get(widgetId);
    if (member?.target) return undefined;
    if (!member) {
      member = { widgetId, instanceId: this.id(), epoch: this.id(), sequence: 0,
        preferences: normalizePanelSync(this.panels.get(widgetId)?.sync), ready: true };
      const current = member;
      this.members.set(widgetId, current);
    }
    const config = this.config(member);
    const current = member;
    return { config, publish: change => {
      if (this.active && this.members.get(widgetId) === current && current.epoch === config.epoch) this.accept(current, change, config.revision);
    } };
  }

  receive(event: Pick<MessageEvent, "origin" | "source" | "data">): boolean {
    if (!this.active || event.origin !== this.origin || !event.source || !event.data || typeof event.data !== "object") return false;
    const data = event.data as WidgetSyncHello | WidgetSyncUpdate;
    if (data.protocol !== SYNC_PROTOCOL || typeof data.widgetId !== "string") return false;
    const member = this.members.get(data.widgetId);
    if (!member?.target || member.target !== event.source || data.instanceId !== member.instanceId ||
      data.symbol !== this.context.symbol || data.contract !== this.context.contract || data.mode !== this.context.mode ||
      data.replayId !== this.context.replayId || !Object.prototype.hasOwnProperty.call(TIMEFRAMES, data.timeframe)) return false;
    if (data.type === "hello") {
      // A document reload keeps contentWindow/mountId. Retire queued changes from
      // the previous document or timeframe before reinitializing canonical state.
      this.clearTool(member);
      member.epoch = this.id();
      member.sequence = 0;
      member.ready = true;
      member.timeframe = data.timeframe;
      this.send(member);
      return true;
    }
    if (data.type !== "update" || !member.ready || data.epoch !== member.epoch || data.timeframe !== member.timeframe ||
      !Number.isSafeInteger(data.sequence) || data.sequence <= member.sequence ||
      !Number.isSafeInteger(data.baseRevision) || data.baseRevision < 0 || !validSyncChange(data.change)) return false;
    member.sequence = data.sequence;
    return this.accept(member, data.change, data.baseRevision);
  }

  private accept(member: Member, change: ChartSyncChange, baseRevision: number): boolean {
    if (!validSyncChange(change)) return false;
    const group = this.group(member);
    if (!group || baseRevision > group.state.revision) { this.send(member); return false; }
    const viewport = member.preferences.syncViewport && change.viewport && baseRevision >= group.viewportRevision ? change.viewport : undefined;
    // Per-ID revisions (including deletion tombstones) prevent late updates from resurrecting drawings.
    const operations = member.preferences.syncDrawings ? (change.drawingOps ?? []).filter(op =>
      baseRevision >= (group.drawingRevisions.get(op.op === "delete" ? op.id : op.drawing.id) ?? 0)) : [];
    const drawings = applyDrawingOperations(group.state.drawings, operations);
    const viewportChanged = viewport && JSON.stringify(viewport) !== JSON.stringify(group.state.viewport);
    const drawingsChanged = JSON.stringify(drawings) !== JSON.stringify(group.state.drawings);
    const selection = member.preferences.syncDrawings ? change.toolSelection : undefined;
    const toolChanged = !!selection && (selection.tool !== null || selection.selectionId === group.toolSelection?.selectionId)
      && JSON.stringify(selection) !== JSON.stringify(group.toolSelection);
    if (drawings.length > 1000) { this.send(member); return false; }
    if (toolChanged) group.toolSelection = { ...selection! };
    if (!viewportChanged && !drawingsChanged) {
      if (toolChanged) { this.broadcast(member); this.changed(); }
      else this.send(member);
      return toolChanged;
    }
    const revision = group.state.revision + 1;
    if (!Number.isSafeInteger(revision)) return false;
    group.state = { ...group.state, revision, ...(viewportChanged ? { viewport } : {}), drawings };
    if (viewportChanged) group.viewportRevision = revision;
    for (const op of operations) group.drawingRevisions.set(op.op === "delete" ? op.id : op.drawing.id, revision);
    this.savedGroups = { ...this.savedGroups, [syncGroupKey(group.state)]: group.state };
    this.persist(this.savedGroups);
    this.broadcast(member);
    this.changed();
    return true;
  }

  dispose(): void {
    this.active = false;
    this.members.clear();
    this.groups.clear();
  }

  resume(): void { this.active = true; }
  suspend(): void { for (const member of this.members.values()) this.clearTool(member); this.active = false; }
}
