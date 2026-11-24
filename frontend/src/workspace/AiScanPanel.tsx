import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiClient, Instrument } from "../api/client";
import type { DrawingState } from "../chart/drawings/types";
import { ScanAiDrawer } from "../chart/scanAi/ScanAiDrawer";
import type { ScanAiGroup, ScanAiSuggestion } from "../chart/scanAi/types";
import { useScanSettings } from "../chart/scanAi/settings";
import { alreadyDrawn, prepareSuggestions, similarScanGeometry } from "../chart/scanAi/geometry";

export interface AiScanPanelProps {
  api: ApiClient; instrument: Instrument; endTime?: number; onUndo: () => void;
  timeframe: string; contract: string; settingsScope?: string;
  existingDrawings?: readonly DrawingState[];
  onPreview: (candidate: any | undefined) => void;
  onAdd: (candidate: any) => void;
  onAddAll: (candidates: readonly any[]) => void;
  onClose: () => void;
}
export function AiScanPanel({
  api, instrument, timeframe, contract, endTime, settingsScope,
  existingDrawings = [], onPreview, onAdd, onAddAll, onClose,
}: AiScanPanelProps) {
  const [settings, updateSettings] = useScanSettings(settingsScope);
  const [suggestions, setSuggestions] = useState<ScanAiSuggestion[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const accepted = useRef<ScanAiSuggestion[]>([]);
  const preview = useRef(onPreview); preview.current = onPreview;
  const selectedGroups = useMemo(() => new Set(settings.groups), [settings.groups]);

  const runScan = useCallback(async () => {
    const requestId = ++sequence.current;
    setLoading(true); setError(null); setSuggestions([]); setFocusedId(null);
    preview.current(undefined);
    try {
      const res: any = await api.aiScan({
        instrumentId: instrument.id, symbol: instrument.symbol, contract, timeframe, ...settings,
        states: settings.state === "auto" ? ["waiting", "in_play", "tested"] : [settings.state], endTime,
      });
      if (sequence.current !== requestId) return;
      const raw = Array.isArray(res?.suggestions) ? res.suggestions : (res?.candidates ?? []).map((c: any) => ({
        ...c, group: c.type.startsWith("fibonacci") ? "fibonacci" : c.type === "elliott_wave" ? "elliott" : "lines",
        label: c.label, description: c.explanation, state: "waiting", strength: "moderate",
        score: Math.round(c.score * 100),
        drawingTool: c.drawingTool ?? (c.type.startsWith("fibonacci") ? "fib_retracement" : c.type === "elliott_wave" ? "path" : "trendline"),
        anchors: (c.anchors ?? []).map((a: any) => ({ time: Math.round(a.time > 1e11 ? a.time / 1000 : a.time), price: a.price })),
      }));
      setSuggestions(prepareSuggestions(raw));
    } catch (cause) {
      if (sequence.current === requestId) setError(cause instanceof Error ? cause.message : "Scan failed");
    } finally {
      if (sequence.current === requestId) setLoading(false);
    }
  }, [api, instrument.id, instrument.symbol, contract, timeframe, settings, endTime]);
  useEffect(() => {
    void runScan();
    return () => { ++sequence.current; preview.current(undefined); };
  }, [runScan]);
  useEffect(() => {
    accepted.current = []; setAddedIds(new Set());
  }, [settingsScope, instrument.id, contract, timeframe]);
  const hasAdded = (s: ScanAiSuggestion) => accepted.current.some(a => similarScanGeometry(a, s))
    || alreadyDrawn(s, existingDrawings, timeframe);
  const toggleGroup = (group: ScanAiGroup) => updateSettings({
    groups: settings.groups.includes(group) ? settings.groups.filter(g => g !== group) : [...settings.groups, group],
  });
  const handleFocus = (id: string | null) => {
    setFocusedId(id); preview.current(suggestions.find(s => s.id === id));
  };
  const handleAdd = (s: ScanAiSuggestion) => {
    if (hasAdded(s) || loading) return;
    accepted.current.push(s); onAdd(s);
    setAddedIds(prev => new Set(prev).add(s.id)); setFocusedId(null); preview.current(undefined);
  };
  const handleAddAll = () => {
    const remaining = suggestions.filter(s => !hasAdded(s));
    if (!remaining.length || loading) return;
    accepted.current.push(...remaining); onAddAll(remaining);
    setAddedIds(prev => new Set([...prev, ...remaining.map(s => s.id)]));
    setFocusedId(null); preview.current(undefined);
  };
  return <ScanAiDrawer
    open loading={loading} error={error}
    depth={settings.depth} onDepthChange={depth => updateSettings({ depth })}
    density={settings.density} onDensityChange={density => updateSettings({ density })}
    strength={settings.strength} onStrengthChange={strength => updateSettings({ strength })}
    selectedGroups={selectedGroups} onToggleGroup={toggleGroup}
    patterns={settings.patterns} onPatternsChange={patterns => updateSettings({ patterns })}
    targetsAndStop={settings.targetsAndStop} onTargetsAndStopChange={targetsAndStop => updateSettings({ targetsAndStop })}
    suggestions={suggestions}
    addedIds={new Set([...addedIds, ...suggestions.filter(hasAdded).map(s => s.id)])}
    focusedId={focusedId} onFocusSuggestion={handleFocus}
    onAddSuggestion={handleAdd} onAddAllSuggestions={handleAddAll}
    onRefresh={runScan} onClose={() => { ++sequence.current; preview.current(undefined); onClose(); }}
  />;
}
