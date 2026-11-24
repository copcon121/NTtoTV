import { useEffect, useRef, useState } from "react";

import type { ApiClient } from "../api/client";
import type { Timeframe } from "../socket/messages";
import { DEFAULT_THEME, normalizeTheme } from "./themes";
import { normalizeThreeColumnSplits } from "./layout";
import { normalizeWorkspaceSync } from "./syncSettings";
import type { Workspace, WorkspaceLayout, WorkspacePanel, WorkspacePayload, WorkspaceTemplate } from "./types";

const GUEST_STORAGE = "gc.workspace.guest.v1";
const ACTIVE_STORAGE = "gc.workspace.active.v1";
export const MAIN_CHART = "main-chart";
const DEFAULT_LAYOUT: WorkspaceLayout = { columnSplit: 50, firstRowSplit: 50, tradingAccountPosition: "bottom", tradingAccountLocked: false };
const MAX_WORKSPACES = 30;

export const TEMPLATE_NAMES: Record<WorkspaceTemplate, string> = {
  essentials: "Essentials",
  "order-flow": "Order Flow",
  "multi-timeframe": "Multi-timeframe",
  scratch: "Workspace",
};

export function chartPanel(id: string, timeframe: Timeframe): WorkspacePanel {
  return { id, type: "chart", timeframe };
}

function templatePayload(template: WorkspaceTemplate): WorkspacePayload {
  const main = chartPanel(MAIN_CHART, template === "multi-timeframe" ? "1D" : "1m");
  const panels: WorkspacePanel[] = {
    essentials: [main, { id: "aiScan", type: "aiScan" }],
    "order-flow": [main, { id: "footprint", type: "footprint" }, { id: "marketProfile", type: "marketProfile" }],
    "multi-timeframe": [main, chartPanel("hour", "1h"), chartPanel("five-minute", "5m"), chartPanel("minute", "1m")],
    scratch: [],
  }[template] as WorkspacePanel[];
  return { version: 1, template, panels, layout: DEFAULT_LAYOUT, theme: DEFAULT_THEME };
}

function initialWorkspace(background?: string): Workspace {
  return {
    id: "default",
    name: "GC Workspace",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      ...templatePayload("essentials"),
      panels: [chartPanel(MAIN_CHART, "1m")],
      useChartProfile: true,
      theme: background && background !== "#101010" && background !== DEFAULT_THEME.background
        ? normalizeTheme({ preset: "Custom", background })
        : DEFAULT_THEME,
    },
  };
}

function normalize(workspace: Workspace): Workspace {
  return {
    ...workspace,
    payload: {
      ...normalizeWorkspaceSync(workspace.payload),
      theme: normalizeTheme(workspace.payload.theme),
      layout: {
        ...DEFAULT_LAYOUT,
        ...workspace.payload.layout,
        threeColumnSplits: normalizeThreeColumnSplits(workspace.payload.layout?.threeColumnSplits),
        tradingAccountPosition: workspace.payload.layout?.tradingAccountPosition === "right" ? "right" : "bottom",
        tradingAccountLocked: workspace.payload.layout?.tradingAccountLocked === true,
      },
    },
  };
}

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function readGuest(): Workspace[] | undefined {
  try {
    const saved = readStorage(GUEST_STORAGE);
    return saved === null ? undefined : (JSON.parse(saved) as Workspace[]).map(normalize);
  } catch {
    return undefined;
  }
}

interface WorkspaceState {
  scope: string;
  workspaces: Workspace[];
  activeId: string;
}

export function useWorkspaces(api: ApiClient, userId: string | undefined, profileReady: boolean, background: string) {
  const scope = userId ?? "guest";
  const selectionKey = ACTIVE_STORAGE + "." + scope;
  const [state, setState] = useState<WorkspaceState>();
  const [error, setError] = useState("");
  const [requestPending, setRequestPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const current = useRef<WorkspaceState>();
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const queue = useRef(Promise.resolve());
  const dirty = useRef(new Map<string, Workspace>());
  const operationBusy = useRef(false);
  const belongsTo = (targetScope: string) => scopeRef.current === targetScope;

  function publish(next: WorkspaceState) {
    current.current = next;
    setState(next);
  }

  useEffect(() => {
    if (userId && !profileReady) return;
    let cancelled = false;
    setError("");
    setRequestPending(false);
    operationBusy.current = false;
    const load = async () => {
      const savedId = readStorage(selectionKey);
      let workspaces = userId ? await api.workspaces() : readGuest();
      if (cancelled || !belongsTo(scope)) return;
      if (workspaces === undefined || (userId && workspaces.length === 0 && savedId !== "")) {
        const initial = initialWorkspace(backgroundRef.current);
        workspaces = [userId ? await api.createWorkspace({ ...initial, bootstrap: true }) : initial];
      }
      if (cancelled || !belongsTo(scope)) return;
      workspaces = workspaces.map(normalize);
      const activeId = workspaces.find((item) => item.id === savedId)?.id ?? workspaces[0]?.id ?? "";
      publish({ scope, workspaces, activeId });
    };
    void load().catch((cause: unknown) => {
      if (!cancelled && belongsTo(scope)) setError(cause instanceof Error ? cause.message : "Workspace load failed");
    });
    return () => { cancelled = true; };
  }, [api, userId, scope, selectionKey, userId ? profileReady : true, retry]);

  const ready = state?.scope === scope;
  const workspaces = ready ? state.workspaces : [];
  const active = workspaces.find((item) => item.id === state?.activeId);

  function storeGuest(next: WorkspaceState) {
    setError(writeStorage(GUEST_STORAGE, JSON.stringify(next.workspaces)) ? "" : "Browser storage is unavailable.");
  }

  function select(id: string) {
    const snapshot = current.current;
    if (snapshot?.scope !== scope || !snapshot.workspaces.some((item) => item.id === id)) return;
    publish({ ...snapshot, activeId: id });
    writeStorage(selectionKey, id);
  }

  function flush(workspace: Workspace) {
    const key = scope + "/" + workspace.id;
    dirty.current.set(key, workspace);
    queue.current = queue.current.then(async () => {
      if (!belongsTo(scope) || dirty.current.get(key) !== workspace) return;
      try {
        await api.saveWorkspace(workspace.id, workspace);
        if (dirty.current.get(key) === workspace) dirty.current.delete(key);
        if (belongsTo(scope)) setError("");
      } catch (cause) {
        if (belongsTo(scope)) setError(cause instanceof Error ? cause.message : "Workspace save failed");
      }
    });
  }

  function updateWorkspace(id: string, transform: (workspace: Workspace) => Workspace) {
    const snapshot = current.current;
    if (snapshot?.scope !== scope) return;
    const previous = snapshot.workspaces.find((item) => item.id === id);
    if (!previous) return;
    const transformed = transform(previous);
    if (transformed === previous) return;
    const workspace = { ...transformed, updatedAt: Date.now() };
    const next = { ...snapshot, workspaces: snapshot.workspaces.map((item) => item.id === id ? workspace : item) };
    publish(next);
    if (userId) flush(workspace);
    else storeGuest(next);
  }

  function update(transform: (payload: WorkspacePayload) => WorkspacePayload, id = active?.id) {
    if (!id) return;
    updateWorkspace(id, (workspace) => {
      const payload = transform(workspace.payload);
      return payload === workspace.payload ? workspace : { ...workspace, payload };
    });
  }

  function rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateWorkspace(id, (workspace) => workspace.name === trimmed ? workspace : { ...workspace, name: trimmed });
  }

  async function changeList(action: (snapshot: WorkspaceState) => Promise<void>) {
    const snapshot = current.current;
    if (snapshot?.scope !== scope || operationBusy.current) return;
    operationBusy.current = true;
    setRequestPending(true);
    setError("");
    try {
      await action(snapshot);
    } catch (cause) {
      if (belongsTo(scope)) setError(cause instanceof Error ? cause.message : "Workspace update failed");
    } finally {
      if (belongsTo(scope)) {
        operationBusy.current = false;
        setRequestPending(false);
      }
    }
  }

  function create(template: WorkspaceTemplate) {
    return changeList(async (snapshot) => {
      if (snapshot.workspaces.length >= MAX_WORKSPACES) throw new Error("Workspace limit reached.");
      const baseName = TEMPLATE_NAMES[template];
      let name = baseName;
      for (let suffix = 2; snapshot.workspaces.some((item) => item.name === name); suffix++) name = baseName + " " + suffix;
      const input = { name, payload: templatePayload(template) };
      const now = Date.now();
      const workspace = userId ? await api.createWorkspace(input) : { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      const latest = current.current;
      if (!belongsTo(scope) || latest?.scope !== scope) return;
      const next = { ...latest, workspaces: [...latest.workspaces, workspace], activeId: workspace.id };
      publish(next);
      writeStorage(selectionKey, workspace.id);
      if (!userId) storeGuest(next);
    });
  }

  function remove(id: string) {
    return changeList(async (snapshot) => {
      if (!snapshot.workspaces.some((item) => item.id === id)) return;
      if (userId) {
        await queue.current;
        if (!belongsTo(scope)) return;
        await api.deleteWorkspace(id);
        dirty.current.delete(scope + "/" + id);
      }
      const latest = current.current;
      if (!belongsTo(scope) || latest?.scope !== scope) return;
      const remaining = latest.workspaces.filter((item) => item.id !== id);
      const activeId = latest.activeId === id ? remaining[0]?.id ?? "" : latest.activeId;
      const next = { scope, workspaces: remaining, activeId };
      publish(next);
      writeStorage(selectionKey, activeId);
      if (!userId) storeGuest(next);
    });
  }

  function retrySave() {
    if (!ready) setRetry((attempt) => attempt + 1);
    else if (!userId && state) storeGuest(state);
    else for (const workspace of workspaces) {
      if (dirty.current.has(scope + "/" + workspace.id)) flush(workspace);
    }
  }

  return { active, workspaces, ready, error, requestPending, select, update, create, rename, remove, retrySave };
}
