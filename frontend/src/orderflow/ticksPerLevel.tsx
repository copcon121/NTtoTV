import { useId, useState } from "react";
import { SettingFieldLabel } from "../liquidity/SettingHelp";

export const MIN_TICKS_PER_LEVEL = 1;
export const MAX_TICKS_PER_LEVEL = 100;

export function validTicksPerLevel(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_TICKS_PER_LEVEL && value <= MAX_TICKS_PER_LEVEL;
}

export function ticksPreferenceKey(page: "fp" | "mp", symbol: string, search = window.location.search): string {
  const widgetId = new URLSearchParams(search).get("widgetId") || "standalone";
  return `gcflow:ticks-per-level:v1:${page}:${encodeURIComponent(symbol)}:${encodeURIComponent(widgetId)}`;
}

export function useTicksPerLevel(page: "fp" | "mp", symbol: string, fallback: number) {
  const key = ticksPreferenceKey(page, symbol);
  const read = () => {
    try {
      const saved = Number(window.localStorage.getItem(key));
      return validTicksPerLevel(saved) ? saved : fallback;
    } catch { return fallback; }
  };
  const [preference, setPreference] = useState(() => ({ key, ticks: read() }));
  const ticks = preference.key === key ? preference.ticks : read();
  // Switch contexts before children render without writing the previous preference.
  if (preference.key !== key) setPreference({ key, ticks });
  const commit = (next: number) => {
    if (!validTicksPerLevel(next)) return;
    setPreference({ key, ticks: next });
    try { window.localStorage.setItem(key, String(next)); } catch { /* Session preference still works. */ }
  };
  return [ticks, commit] as const;
}

export function TicksPerLevelSetting({ value, onChange, contextKey }: {
  value: number; onChange: (value: number) => void; contextKey?: string;
}) {
  const id = useId();
  const [edit, setEdit] = useState<{ contextKey?: string; draft?: string }>({ contextKey });
  const draft = edit.contextKey === contextKey ? edit.draft : undefined;
  if (edit.contextKey !== contextKey) setEdit({ contextKey });
  const setDraft = (next?: string) => setEdit({ contextKey, draft: next });
  const commit = () => {
    const next = Number(draft ?? value);
    if (validTicksPerLevel(next)) onChange(next);
    setDraft(undefined);
  };
  return <div className="orderflow-ticks-setting">
    <SettingFieldLabel label="Ticks per level" htmlFor={id}
      help="Number of instrument ticks combined into one price level (whole numbers 1–100). GC: 1 tick = 0.1 price points; 2 = 0.2; 5 = 0.5. Levels align to instrument ticks and sum Bid/Ask, preserving volume and Delta without changing raw data. Số tick gộp vào một mức giá (1–100, số nguyên). GC: 1 tick = 0,1 điểm; 2 = 0,2; 5 = 0,5. Căn theo tick của sản phẩm, cộng Bid/Ask và giữ nguyên khối lượng, Delta, dữ liệu gốc." />
    <input id={id} type="number" min={MIN_TICKS_PER_LEVEL} max={MAX_TICKS_PER_LEVEL} step={1}
      value={draft ?? String(value)} onChange={event => setDraft(event.currentTarget.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); commit(); }
        if (event.key === "Escape") { event.preventDefault(); setDraft(undefined); }
      }} />
    <small>{(value * 0.1).toFixed(1)} price points per level</small>
  </div>;
}
