import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const ICONS = {
  data: "M4 5h16v14H4zM4 9h16M8 5v14",
  settings: "M9 4h6l1 3 3 1 1 6-3 2-1 3H9l-1-3-3-2 1-6 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  refresh: "M20 10a8 8 0 1 0-1 7M20 4v6h-6",
};

export function OrderflowIcon({ name }: { name: keyof typeof ICONS }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name]} /></svg>;
}

export function OrderflowMenu({
  label, icon, iconOnly = false, children,
}: {
  label: string;
  icon: keyof typeof ICONS;
  iconOnly?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return <div className="orderflow-menu" ref={root} onKeyDown={(event) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button type="button" ref={trigger} title={label} aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <OrderflowIcon name={icon} />
      {!iconOnly && label}
    </button>
    {open && <div id={id} className="orderflow-popover" role="dialog" aria-label={label} onSubmit={() => setOpen(false)}>
      {children}
    </div>}
  </div>;
}
