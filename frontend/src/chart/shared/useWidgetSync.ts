import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Timeframe } from "../../socket/messages";
import { SYNC_PROTOCOL, validSyncChange, validSyncConfig, type ChartSyncConfig, type ChartSyncConnection, type ChartSyncChange, type WidgetSyncHello, type WidgetSyncUpdate } from "./sync";

export interface WidgetChartContext { symbol: string; contract: string; timeframe: Timeframe; mode?: "live" | "replay"; replayId?: string }
export function useWidgetSync(context: WidgetChartContext): ChartSyncConnection {
  const identity = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    return { widgetId: query.get("widgetId"), instanceId: query.get("mountId") || crypto.randomUUID() };
  }, []);
  const [config, setConfig] = useState<ChartSyncConfig>();
  const current = useRef<ChartSyncConfig>();
  const sequence = useRef(0);
  const retiredEpochs = useRef(new Set<string>());
  const mode = context.mode ?? "live";
  const active = config?.symbol === context.symbol && config.contract === context.contract && config.mode === mode && config.replayId === context.replayId ? config : undefined;
  current.current = active;
  useEffect(() => {
    if (!identity.widgetId || window.parent === window) return;
    current.current = undefined;
    setConfig(undefined);
    const hello: WidgetSyncHello = { protocol: SYNC_PROTOCOL, type: "hello", widgetId: identity.widgetId, instanceId: identity.instanceId,
      symbol: context.symbol, contract: context.contract, timeframe: context.timeframe, mode, replayId: context.replayId };
    let disposed = false;
    const announce = () => { if (!disposed && !current.current) window.parent.postMessage(hello, window.location.origin); };
    const receive = (event: MessageEvent) => {
      if (disposed || event.origin !== window.location.origin || event.source !== window.parent || event.data?.protocol !== SYNC_PROTOCOL || event.data?.type !== "config" || !validSyncConfig(event.data.config)) return;
      const next = event.data.config;
      if (next.widgetId !== identity.widgetId || next.instanceId !== identity.instanceId || next.symbol !== context.symbol || next.contract !== context.contract || next.mode !== mode || next.replayId !== context.replayId) return;
      const prior = current.current;
      if (retiredEpochs.current.has(next.epoch) || (prior && prior.epoch === next.epoch && prior.revision > next.revision)) return;
      if (prior && prior.epoch !== next.epoch) retiredEpochs.current.add(prior.epoch);
      current.current = next;
      setConfig(next);
    };
    window.addEventListener("message", receive);
    announce();
    const retry = window.setInterval(announce, 500);
    return () => { disposed = true; if (current.current) retiredEpochs.current.add(current.current.epoch); current.current = undefined; window.clearInterval(retry); window.removeEventListener("message", receive); };
  }, [identity, context.symbol, context.contract, context.timeframe, mode, context.replayId]);
  const publish = useCallback((change: ChartSyncChange) => {
    const c = current.current;
    if (!identity.widgetId || !c?.groupId || !validSyncChange(change)) return;
    const accepted = { viewport: c.syncViewport ? change.viewport : undefined, drawingOps: c.syncDrawings ? change.drawingOps : undefined,
      toolSelection: c.syncDrawings ? change.toolSelection : undefined };
    if (!validSyncChange(accepted)) return;
    const update: WidgetSyncUpdate = { protocol: SYNC_PROTOCOL, type: "update", widgetId: identity.widgetId, instanceId: identity.instanceId, epoch: c.epoch,
      baseRevision: c.revision, sequence: ++sequence.current, symbol: context.symbol, contract: context.contract, timeframe: context.timeframe, mode, replayId: context.replayId, change: accepted };
    window.parent.postMessage(update, window.location.origin);
  }, [identity, context.symbol, context.contract, context.timeframe, mode, context.replayId]);
  return useMemo(() => ({ config: active, publish }), [active, publish]);
}
