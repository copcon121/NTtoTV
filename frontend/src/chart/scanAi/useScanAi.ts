import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DrawingState } from "../drawings/types";
import type { Timeframe } from "../../socket/messages";
import type { ScanAiGroup, ScanAiResponse, ScanAiSuggestion } from "./types";
import { scanDrawing } from "../../workspace/scanDrawing";
import { alreadyDrawn, prepareSuggestions, similarScanGeometry } from "./geometry";
import { useScanSettings } from "./settings";

export interface UseScanAiOptions {
  symbol: string;
  contract: string;
  timeframe: Timeframe;
  settingsScope?: string;
  existingDrawings?: readonly DrawingState[];
  onAddDrawings: (drawings: DrawingState[]) => void;
}
export function suggestionToDrawingState(sug: ScanAiSuggestion, timeframe: Timeframe): DrawingState {
  return scanDrawing(sug, timeframe, sug.group === "levels" ? "#22c55e" : "#38bdf8");
}
export function useScanAi({ symbol, contract, timeframe, settingsScope, existingDrawings = [], onAddDrawings }: UseScanAiOptions) {
  const [settings, updateSettings] = useScanSettings(settingsScope);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ScanAiSuggestion[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const accepted = useRef<ScanAiSuggestion[]>([]);
  const sequence = useRef(0);
  const controller = useRef<AbortController>();
  const selectedGroups = useMemo(() => new Set(settings.groups), [settings.groups]);
  const runScan = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const requestId = ++sequence.current;
    setLoading(true); setError(null); setSuggestions([]); setFocusedId(null);
    try {
      const resp = await fetch("/api/ai-scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, contract, timeframe, ...settings,
          states: settings.state === "auto" ? ["waiting", "in_play", "tested"] : [settings.state] }),
        signal: abort.signal,
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status} ${resp.statusText}`);
      const data: ScanAiResponse = await resp.json();
      if (sequence.current !== requestId || abort.signal.aborted) return;
      setSuggestions(prepareSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []));
    } catch (err: any) {
      if (sequence.current === requestId && !abort.signal.aborted) setError(err?.message ?? "Failed to scan chart");
    } finally {
      if (sequence.current === requestId) setLoading(false);
    }
  }, [symbol, contract, timeframe, settings]);
  useEffect(() => {
    if (isOpen) void runScan();
    else setLoading(false);
    return () => { ++sequence.current; controller.current?.abort(); };
  }, [isOpen, runScan]);
  useEffect(() => {
    accepted.current = []; setAddedIds(new Set()); setSuggestions([]);
  }, [settingsScope, symbol, contract, timeframe]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "q") { e.preventDefault(); setIsOpen(p => !p); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const hasAdded = (s: ScanAiSuggestion) => accepted.current.some(a => similarScanGeometry(s, a))

    || alreadyDrawn(s, existingDrawings, timeframe);
  const addSuggestion = (s: ScanAiSuggestion) => {
    if (hasAdded(s)) return;
    accepted.current.push(s);
    onAddDrawings([suggestionToDrawingState(s, timeframe)]);
    setAddedIds(prev => new Set(prev).add(s.id));
  };
  const addAllSuggestions = () => {
    const remaining = suggestions.filter(s => !hasAdded(s));
    if (!remaining.length) return;
    accepted.current.push(...remaining);
    onAddDrawings(remaining.map(s => suggestionToDrawingState(s, timeframe)));
    setAddedIds(prev => new Set([...prev, ...remaining.map(s => s.id)]));
  };
  const toggleGroup = (group: ScanAiGroup) => updateSettings({ groups: settings.groups.includes(group)
    ? settings.groups.filter(g => g !== group) : [...settings.groups, group] });
  return {
    isOpen, setIsOpen, loading, error, ...settings, selectedGroups,
    setDepth: (depth: typeof settings.depth) => updateSettings({ depth }),
    setDensity: (density: typeof settings.density) => updateSettings({ density }),
    setStrength: (strength: typeof settings.strength) => updateSettings({ strength }),
    setTargetsAndStop: (targetsAndStop: boolean) => updateSettings({ targetsAndStop }),
    setPatterns: (patterns: string[]) => updateSettings({ patterns }),
    toggleGroup, suggestions, draftSuggestions: suggestions.filter(s => !hasAdded(s)),
    addedIds: new Set([...addedIds, ...suggestions.filter(hasAdded).map(s => s.id)]),
    focusedId, setFocusedId, runScan, addSuggestion, addAllSuggestions,
  };
}
