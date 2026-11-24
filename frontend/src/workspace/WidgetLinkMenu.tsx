import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizePanelSync, SYNC_GROUPS } from "./syncSettings";
import type { WorkspacePanelSync } from "./types";

export function WidgetLinkMenu({ name, value, onChange, paused }: {
  name: string; value?: WorkspacePanelSync; onChange: (value: WorkspacePanelSync) => void; paused?: boolean;
}) {
  const sync = normalizePanelSync(value);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = button.current?.getBoundingClientRect();
      const panel = popover.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      setPosition({
        left: Math.max(left + 12, Math.min(anchor.right - panel.width, left + width - panel.width - 12)),
        top: Math.max(top + 12, Math.min(anchor.bottom + 6, top + height - panel.height - 12)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    popover.current?.querySelector<HTMLSelectElement>("select")?.focus();
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!popover.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); button.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <>
    <button ref={button} type="button" className="workspace-link-button" aria-label={`Link ${name}`}
      title={sync.groupId ? `Linked to group ${sync.groupId}` : "Link widgets"} aria-expanded={open} aria-haspopup="dialog"
      aria-controls={open ? id : undefined} data-linked={!!sync.groupId} onClick={() => setOpen(!open)}>
      {sync.groupId ? `Link ${sync.groupId}` : "Link"}
    </button>
    {open && createPortal(<div ref={popover} id={id} role="dialog" aria-label={`Link ${name}`} className="workspace-link-popover"
      style={{ top: position.top, left: position.left }}>
      <div className="workspace-link-heading"><strong>Link widgets</strong><button type="button" aria-label="Close link settings"
        onClick={() => { setOpen(false); button.current?.focus(); }}>Close</button></div>
      <label>Group<select value={sync.groupId ?? ""} onChange={event => onChange({ ...sync, groupId: event.target.value ? event.target.value as WorkspacePanelSync["groupId"] : null })}>
        <option value="">Independent</option>{SYNC_GROUPS.map(group => <option key={group} value={group}>Group {group}</option>)}
      </select></label>
      <label><input type="checkbox" checked={sync.syncViewport} disabled={!sync.groupId}
        onChange={event => onChange({ ...sync, syncViewport: event.target.checked })} />Sync time / viewport</label>
      <label><input type="checkbox" checked={sync.syncDrawings} disabled={!sync.groupId}
        onChange={event => onChange({ ...sync, syncDrawings: event.target.checked })} />Sync manual drawings</label>
      <p>Group widgets share the same UTC time range across timeframes. Drawings: trend lines, rectangles, horizontal rays and vertical lines.</p>
      <p>Your existing drawings stay independent. While drawing sync is on, supported new drawings selected with Draw Tool in Chart, FP, MP and LQ join the group.</p>
      {paused && <p role="status">Link paused during replay. Live widgets keep their own group connection.</p>}
    </div>, document.body)}
  </>;
}
