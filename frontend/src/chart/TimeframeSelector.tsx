import { useEffect, useId, useRef, useState } from "react";
import type { Timeframe } from "../socket/messages";

const TIMEFRAME_GROUPS = [
  { label: "Seconds", options: ["15s", "30s"] },
  { label: "Minutes", options: ["1m", "3m", "5m", "15m", "30m"] },
  { label: "Hours", options: ["1h", "4h"] },
  { label: "Days", options: ["1D", "1W", "1M"] },
] as const;

const LABELS: Record<Timeframe, string> = {
  "15s": "15 Seconds",
  "30s": "30 Seconds",
  "1m": "1 Minute",
  "3m": "3 Minutes",
  "5m": "5 Minutes",
  "15m": "15 Minutes",
  "30m": "30 Minutes",
  "1h": "1 Hour",
  "4h": "4 Hours",
  "1D": "1 Day",
  "1W": "1 Week",
  "1M": "1 Month",
};

export const TIMEFRAMES: readonly Timeframe[] = [
  "15s", "1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M",
];

const FAVORITES_KEY = "gc-chart-platform.favorite-timeframes";

function loadFavorites(): Timeframe[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    if (Array.isArray(saved)) {
      return Object.keys(LABELS).filter((tf): tf is Timeframe => saved.includes(tf));
    }
  } catch {
    // The menu still works when browser storage is unavailable.
  }
  return [];
}

export interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
  timeframes?: readonly Timeframe[];
}

export function TimeframeSelector({
  value,
  onChange,
  timeframes = TIMEFRAMES,
}: TimeframeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const selectTimeframe = (tf: Timeframe) => {
    if (tf !== value) onChange(tf);
    setOpen(false);
    trigger.current?.focus();
  };

  const toggleFavorite = (tf: Timeframe) => {
    const next = favorites.includes(tf)
      ? favorites.filter((item) => item !== tf)
      : [...favorites, tf];
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // Favorites remain available for this session.
    }
  };

  const pinned = timeframes.filter((tf) => favorites.includes(tf));

  return (
    <div
      className="timeframe-selector"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={`Timeframe selector, ${LABELS[value]}`}
        className="timeframe-trigger"
        onClick={() => setOpen(!open)}
        ref={trigger}
        type="button"
      >
        <span>{value}</span>
        <span aria-hidden="true" className="timeframe-chevron" />
      </button>
      <div id={id} className="timeframe-menu" hidden={!open} role="group" aria-label="Timeframes">
        {TIMEFRAME_GROUPS.map(({ label, options }) => {
          const items = options.filter((tf) => timeframes.includes(tf));
          if (items.length === 0) return null;
          const expanded = !collapsed.has(label);
          const groupId = `${id}-${label.toLowerCase()}`;
          return (
            <div className="timeframe-group" key={label}>
              <button
                aria-controls={groupId}
                aria-expanded={expanded}
                className="timeframe-group-trigger"
                onClick={() => {
                  const next = new Set(collapsed);
                  if (expanded) next.add(label);
                  else next.delete(label);
                  setCollapsed(next);
                }}
                type="button"
              >
                {label}
                <span aria-hidden="true" className="timeframe-chevron" />
              </button>
              <div id={groupId} hidden={!expanded}>
                {items.map((tf) => (
                  <div className="timeframe-menu-row" key={tf}>
                    <button
                      aria-pressed={tf === value}
                      className="timeframe-option"
                      onClick={() => selectTimeframe(tf)}
                      type="button"
                    >
                      {LABELS[tf]}
                      {tf === value && <span aria-hidden="true" className="timeframe-check" />}
                    </button>
                    <button
                      aria-label={`Pin ${LABELS[tf]}`}
                      aria-pressed={favorites.includes(tf)}
                      className="timeframe-pin"
                      onClick={() => toggleFavorite(tf)}
                      type="button"
                    >
                      <span aria-hidden="true">{favorites.includes(tf) ? "\u2605" : "\u2606"}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {pinned.length > 0 && (
        <div className="timeframe-favorites" role="group" aria-label="Pinned timeframes">
          {pinned.map((tf) => (
            <button
              aria-label={LABELS[tf]}
              aria-pressed={tf === value}
              key={tf}
              onClick={() => selectTimeframe(tf)}
              type="button"
            >
              {tf}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
