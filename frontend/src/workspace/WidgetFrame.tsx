import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import type { WorkspaceTheme } from "./types";
import type { WorkspaceSyncRelay } from "./syncRelay";

export function WidgetFrame({ path, name, theme, widgetId, relay, onActivate }: {
  path: string; name: string; theme: WorkspaceTheme; widgetId: string; relay: WorkspaceSyncRelay;
  onActivate?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const activate = useRef(onActivate);
  activate.current = onActivate;
  const mountId = useMemo(() => crypto.randomUUID(), [relay, widgetId, path]);
  const query = new URLSearchParams({ widget: "1", widgetId, mountId, symbol: relay.context.symbol,
    contract: relay.context.contract, mode: relay.context.mode });
  if (relay.context.replayId) query.set("replayId", relay.context.replayId);
  useLayoutEffect(() => {
    const target = frame.current?.contentWindow;
    return target ? relay.registerFrame(widgetId, mountId, target) : undefined;
  }, [relay, widgetId, mountId]);
  useLayoutEffect(() => {
    const element = frame.current;
    return element ? watchWidgetActivation(element, window.location.origin, widgetId, mountId,
      () => activate.current?.()) : undefined;
  }, [relay, widgetId, mountId]);
  const updateTheme = () => frame.current?.contentWindow?.postMessage({ type: "workspace-theme", theme }, window.location.origin);
  useEffect(updateTheme, [theme]);

  return <iframe ref={frame} className="workspace-frame" src={path + "?" + query.toString()} title={name} onLoad={() => {
    updateTheme();
    relay.frameLoaded(widgetId, mountId);
  }} />;
}

// Pointer/focus events do not bubble out of an iframe. Only observe its current,
// same-origin document with the identity assigned to this registered mount.
export function watchWidgetActivation(frame: HTMLIFrameElement, origin: string, widgetId: string,
  mountId: string, activate: () => void): () => void {
  let detach = () => {};
  let disposed = false;
  const matches = (document: Document) => {
    try {
      const url = new URL(document.location.href);
      return url.origin === origin && url.searchParams.get("widgetId") === widgetId
        && url.searchParams.get("mountId") === mountId;
    } catch { return false; }
  };
  const attach = () => {
    detach();
    if (disposed) return;
    try {
      const source = frame.contentWindow;
      const document = frame.contentDocument;
      if (!source || !document || !matches(document)) return;
      const handle = () => {
        try {
          if (!disposed && frame.contentWindow === source && frame.contentDocument === document
            && matches(document)) activate();
        } catch { /* A frame may navigate across origins between events. */ }
      };
      document.addEventListener("pointerdown", handle, true);
      document.addEventListener("focusin", handle, true);
      detach = () => {
        document.removeEventListener("pointerdown", handle, true);
        document.removeEventListener("focusin", handle, true);
      };
    } catch { /* An untrusted or cross-origin document cannot activate a widget. */ }
  };
  frame.addEventListener("load", attach);
  attach();
  return () => { disposed = true; frame.removeEventListener("load", attach); detach(); };
}
