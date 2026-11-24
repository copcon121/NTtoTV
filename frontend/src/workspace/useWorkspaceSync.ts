import { useLayoutEffect, useMemo, useReducer, useRef } from "react";
import type { WorkspacePayload, WorkspaceSyncGroup } from "./types";
import { WorkspaceSyncRelay, type SyncContext } from "./syncRelay";

const EMPTY_PANELS: WorkspacePayload["panels"] = [];
export function useWorkspaceSync(
  scope: string,
  context: SyncContext,
  payload: WorkspacePayload | undefined,
  update: (transform: (payload: WorkspacePayload) => WorkspacePayload, workspaceId?: string) => void,
  suspendedWidgetIds: readonly string[] = [],
) {
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);
  const current = useRef({ scope, context, update });
  current.current = { scope, context, update };
  const key = JSON.stringify([scope, context.workspaceId, context.symbol, context.contract, context.mode, context.replayId]);
  const suspendedKey = JSON.stringify(suspendedWidgetIds);
  const panels = useMemo(() => (payload?.panels ?? EMPTY_PANELS).filter(panel => !suspendedWidgetIds.includes(panel.id)),
    [payload?.panels, suspendedKey]);
  const { relay, flush } = useMemo(() => {
    let pending: Record<string, WorkspaceSyncGroup> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      const groups = pending;
      pending = undefined;
      if (!groups || current.current.scope !== scope) return;
      // Flush the old workspace on a switch, but never write into a different user's scope.
      current.current.update(saved => ({ ...saved, syncGroups: { ...saved.syncGroups, ...groups } }), context.workspaceId);
    };
    const relay = new WorkspaceSyncRelay(context, window.location.origin, panels, payload?.syncGroups, groups => {
      if (JSON.stringify([current.current.scope, current.current.context.workspaceId, current.current.context.symbol,
        current.current.context.contract, current.current.context.mode, current.current.context.replayId]) !== key) return;
      // Merge only this instrument/mode context; other saved group histories may have changed since mount.
      pending = Object.fromEntries(Object.entries(groups).filter(([, group]) => group.symbol === context.symbol &&
        group.contract === context.contract && group.mode === context.mode && group.replayId === context.replayId));
      if (timer === undefined) timer = setTimeout(flush, 250);
    }, refresh);
    return { relay, flush };
  }, [key, payload !== undefined]);

  useLayoutEffect(() => {
    relay.resume();
    window.addEventListener("pagehide", flush);
    return () => { relay.suspend(); window.removeEventListener("pagehide", flush); flush(); };
  }, [relay, flush]);
  useLayoutEffect(() => {
    relay.configure(panels);
  }, [relay, panels]);
  useLayoutEffect(() => {
    const receive = (event: MessageEvent) => { relay.receive(event); };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); };
  }, [relay]);
  // Suspend in cleanup so detached connections cannot publish; StrictMode may resume the same relay.
  return relay;
}
