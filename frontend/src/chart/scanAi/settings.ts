import { useCallback, useEffect, useState } from "react";
import type { ScanAiDensity, ScanAiDepth, ScanAiGroup, ScanAiState, ScanAiStrength } from "./types";

export const SCAN_GROUPS: ScanAiGroup[] = ["levels", "lines", "fibonacci", "patterns", "elliott"];
export const SCAN_PATTERNS = ["double_top_bottom", "head_and_shoulders", "triangles_and_pennants", "elliott_waves"];
export const SCAN_SETTINGS_EVENT = "gc-scan-settings";
const PREFIX = "gc.scan-ai.settings.v2:";
export interface ScanSettings {
  depth: ScanAiDepth;
  density: ScanAiDensity;
  strength: ScanAiStrength;
  groups: ScanAiGroup[];
  state: ScanAiState | "auto";
  patterns: string[];
  targetsAndStop: boolean;
}
export const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  depth: "medium", density: "auto", strength: "moderate", groups: SCAN_GROUPS,
  state: "auto", patterns: SCAN_PATTERNS, targetsAndStop: false,
};
const STATES = ["auto", "waiting", "in_play", "tested", "played_out", "invalidated", "old"];
export function normalizeScanSettings(raw: Partial<ScanSettings> | null | undefined): ScanSettings {
  const r = raw ?? {};
  return {
    depth: ["short", "medium", "deep"].includes(r.depth ?? "") ? r.depth! : DEFAULT_SCAN_SETTINGS.depth,
    density: ["auto", "less", "normal", "more"].includes(r.density ?? "") ? r.density! : DEFAULT_SCAN_SETTINGS.density,
    strength: ["all", "moderate", "strong"].includes(r.strength ?? "") ? r.strength! : DEFAULT_SCAN_SETTINGS.strength,
    groups: Array.isArray(r.groups) ? SCAN_GROUPS.filter(g => r.groups!.includes(g)) : [...SCAN_GROUPS],
    state: STATES.includes(r.state ?? "") ? r.state! : "auto",
    patterns: Array.isArray(r.patterns) ? SCAN_PATTERNS.filter(p => r.patterns!.includes(p)) : [...SCAN_PATTERNS],
    targetsAndStop: typeof r.targetsAndStop === "boolean" ? r.targetsAndStop : false,
  };
}
export function scanSettingsScope(user: string | undefined, workspace: string | undefined, panel: string): string {
  return JSON.stringify([user ?? "local", workspace ?? "default", panel]);
}
export function loadScanSettings(scope = "default"): ScanSettings {
  try {
    const saved = localStorage.getItem(PREFIX + scope) ?? localStorage.getItem("gc.scan-ai.settings.v1:" + scope);
    return normalizeScanSettings(saved ? JSON.parse(saved) : undefined);
  } catch {
    return normalizeScanSettings(undefined);
  }
}
export function saveScanSettings(scope: string, raw: Partial<ScanSettings>): ScanSettings {
  const settings = normalizeScanSettings(raw);
  try { localStorage.setItem(PREFIX + scope, JSON.stringify(settings)); } catch { /* Private storage may be unavailable. */ }
  window.dispatchEvent(new CustomEvent(SCAN_SETTINGS_EVENT, { detail: { scope, settings } }));
  return settings;
}
export function useScanSettings(scope = "default") {
  const [settings, setSettings] = useState(() => loadScanSettings(scope));
  useEffect(() => {
    setSettings(loadScanSettings(scope));
    const sync = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.scope === scope || event.type === "storage") setSettings(loadScanSettings(scope));
    };
    window.addEventListener(SCAN_SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SCAN_SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [scope]);
  const update = useCallback((patch: Partial<ScanSettings>) => {
    const next = saveScanSettings(scope, { ...loadScanSettings(scope), ...patch });
    setSettings(next);
  }, [scope]);
  return [settings, update] as const;
}
