import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** A viewport-clamped hint that also works inside the scrolling settings dialog. */
export function SettingHelp({ label, text }: { label: string; text: string }) {
  const tooltipId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useLayoutEffect(() => {
    if (!open || !button.current || !tooltip.current) return;
    const anchor = button.current.getBoundingClientRect();
    const size = tooltip.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - size.width - 8));
    const below = anchor.bottom + 8;
    const top = below + size.height <= window.innerHeight - 8
      ? below : Math.max(8, anchor.top - size.height - 8);
    setPosition({ left, top });
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return <span className="liquidity-setting-help">
    <button ref={button} type="button" className="liquidity-setting-help-button"
      aria-label={`Help for ${label}`} aria-describedby={open ? tooltipId : undefined}
      aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpen(true); }}
      onPointerLeave={() => { if (document.activeElement !== button.current) setOpen(false); }}
      onClick={() => setOpen(true)}>?</button>
    {open && createPortal(<span ref={tooltip} id={tooltipId} className="liquidity-setting-tooltip"
      role="tooltip" style={position}>{text}</span>, document.body)}
  </span>;
}

export function SettingFieldLabel({ label, help, htmlFor }: {
  label: string; help: string; htmlFor: string;
}) {
  return <span className="liquidity-settings-label-with-help">
    <label htmlFor={htmlFor}>{label}</label>
    <SettingHelp label={label} text={help} />
  </span>;
}
