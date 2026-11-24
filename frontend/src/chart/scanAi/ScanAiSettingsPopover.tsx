import React, { useEffect, useRef } from "react";
import type {
  ScanAiDensity,
  ScanAiDepth,
  ScanAiGroup,
  ScanAiStrength,
  ScanAiState,
} from "./types";

export interface ScanAiSettingsPopoverProps {
  groups: Set<ScanAiGroup>;
  strength: ScanAiStrength;
  density: ScanAiDensity;
  depth: ScanAiDepth;
  targetsAndStop: boolean;
  patterns?: string[];
  onPatternsChange?: (patterns: string[]) => void;
  state?: ScanAiState | "auto";
  onStateChange?: (state: ScanAiState | "auto") => void;
  onToggleGroup: (group: ScanAiGroup) => void;
  onChangeStrength: (s: ScanAiStrength) => void;
  onChangeDensity: (d: ScanAiDensity) => void;
  onChangeDepth: (d: ScanAiDepth) => void;
  onToggleTargetsAndStop: (v: boolean) => void;
  onRescan: () => void;
  onClose: () => void;
}

const GROUPS: { key: ScanAiGroup; label: string }[] = [
  { key: "levels", label: "Support / resistance" },
  { key: "lines", label: "Trendlines" },
  { key: "fibonacci", label: "Fibonacci retracements" },
  { key: "patterns", label: "Chart patterns" },
  { key: "elliott", label: "Elliott waves" },
];

export const ScanAiSettingsPopover: React.FC<ScanAiSettingsPopoverProps> = ({
  groups,
  strength,
  density,
  depth,
  targetsAndStop,
  patterns = [], onPatternsChange, state = "auto", onStateChange,
  onToggleGroup,
  onChangeStrength,
  onChangeDensity,
  onChangeDepth,
  onToggleTargetsAndStop,
  onRescan,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="workspace-scan-settings-popover"
      role="dialog"
      aria-label="AI Scan settings"
    >
      <div className="scan-settings-header">
        <span className="scan-settings-title">AI Scan settings</span>
        <button
          type="button"
          className="scan-settings-close"
          aria-label="Close settings"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="scan-settings-section">
        <span className="scan-settings-subtitle">Detection groups</span>
        <div className="scan-settings-checkboxes">
          {GROUPS.map((g) => (
            <label key={g.key} className="scan-settings-checkbox-label">
              <input
                type="checkbox"
                checked={groups.has(g.key)}
                onChange={() => onToggleGroup(g.key)}
              />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="scan-settings-row">
        <label className="scan-settings-field">
          <span className="scan-settings-label" title="Filter by technical quality before ranking and density limits.">Strength</span>
          <select
            value={strength}
            onChange={(e) => onChangeStrength(e.target.value as ScanAiStrength)}
          >
            <option value="all">All</option>
            <option value="moderate">Moderate or stronger</option>
            <option value="strong">Strong only</option>
          </select>
        </label>

        <label className="scan-settings-field">
          <span className="scan-settings-label" title="Maximum total suggestions: Less 4, Auto 6, Normal 8, More 12. Similar geometry is merged first.">Density</span>
          <select
            value={density}
            onChange={(e) => onChangeDensity(e.target.value as ScanAiDensity)}
          >
            <option value="auto">Auto (up to 6)</option>
            <option value="less">Less (up to 4)</option>
            <option value="normal">Normal</option>
            <option value="more">More (up to 12)</option>
          </select>
        </label>
      </div>

      <div className="scan-settings-row">
        <label className="scan-settings-field">
          <span className="scan-settings-label">Depth</span>
          <select
            value={depth}
            onChange={(e) => onChangeDepth(e.target.value as ScanAiDepth)}
          >
            <option value="short">Short (250 bars)</option>
            <option value="medium">Normal</option>
            <option value="deep">Deep (1000 bars)</option>
          </select>
        </label>

        <label className="scan-settings-switch-label">
          <input
            type="checkbox"
            checked={targetsAndStop}
            onChange={(e) => onToggleTargetsAndStop(e.target.checked)}
          />
          <span>Targets & stops (focused suggestion)</span>
        </label>
      </div>

      {onPatternsChange && <label className="scan-settings-switch-label" title="Ascending, descending and symmetrical triangles require 3 pivot touches on each converging boundary.">
        <input type="checkbox" checked={patterns.includes("triangles_and_pennants")}
          onChange={e => onPatternsChange(e.target.checked ? [...patterns, "triangles_and_pennants"] : patterns.filter(p => p !== "triangles_and_pennants"))} />
        <span>Triangle patterns</span>
      </label>}
      {onStateChange && <label className="scan-settings-field">
        <span className="scan-settings-label">State</span>
        <select value={state} onChange={e => onStateChange(e.target.value as ScanAiState | "auto")}>
          <option value="auto">Active structures</option>
          {(["waiting", "in_play", "tested", "played_out", "invalidated", "old"] as const).map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
        </select>
      </label>}
      <p className="scan-settings-label" role="status">Changes save automatically in this browser and update active scans. Selecting no groups hides all suggestions.</p>
      <div className="scan-settings-actions">
        <button
          type="button"
          className="scan-settings-rescan-btn"
          onClick={() => {
            onRescan();
            onClose();
          }}
        >
          Rescan
        </button>
      </div>
    </div>
  );
};
