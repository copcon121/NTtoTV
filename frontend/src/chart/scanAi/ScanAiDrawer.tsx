import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import type {
  ScanAiDensity,
  ScanAiDepth,
  ScanAiGroup,
  ScanAiState,
  ScanAiStrength,
  ScanAiSuggestion,
} from "./types";

interface DrawerErrorBoundaryProps {
  children: ReactNode;
}

interface DrawerErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class DrawerErrorBoundary extends Component<
  DrawerErrorBoundaryProps,
  DrawerErrorBoundaryState
> {
  state: DrawerErrorBoundaryState = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error): DrawerErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message ?? "Display error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ScanAiDrawer error caught:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="scan-ai-error-box" style={{ margin: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>
            Could not display AI Scan suggestions
          </div>
          <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "8px" }}>
            {this.state.errorMessage}
          </div>
          <button
            type="button"
            className="scan-ai-seg-btn is-active"
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface ScanAiDrawerProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  depth: ScanAiDepth;
  onDepthChange: (depth: ScanAiDepth) => void;
  density: ScanAiDensity;
  onDensityChange: (density: ScanAiDensity) => void;
  strength: ScanAiStrength;
  onStrengthChange: (strength: ScanAiStrength) => void;
  selectedGroups: Set<ScanAiGroup>;
  onToggleGroup: (group: ScanAiGroup) => void;
  targetsAndStop: boolean;
  patterns?: string[];
  onPatternsChange?: (patterns: string[]) => void;
  onTargetsAndStopChange: (enabled: boolean) => void;
  suggestions: readonly ScanAiSuggestion[];
  addedIds: ReadonlySet<string>;
  focusedId: string | null;
  onFocusSuggestion: (id: string | null) => void;
  onAddSuggestion: (sug: ScanAiSuggestion) => void;
  onAddAllSuggestions: () => void;
  onRefresh: () => void;
  onClose: () => void;
}

const STATE_LABELS: Record<ScanAiState, { text: string; bg: string; color: string }> = {
  waiting: { text: "Waiting", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" },
  in_play: { text: "In Play", bg: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" },
  tested: { text: "Tested", bg: "rgba(53, 214, 176, 0.15)", color: "#35d6b0" },
  played_out: { text: "Played Out", bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
  invalidated: { text: "Invalidated", bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" },
  old: { text: "Old", bg: "rgba(158, 172, 187, 0.15)", color: "#9eacbb" },
};

const GROUP_ICONS: Record<ScanAiGroup, string> = {
  levels: "🎯",
  lines: "📈",
  fibonacci: "📐",
  patterns: "👑",
  elliott: "🌊",
};

export function ScanAiDrawer({
  open,
  loading,
  error,
  depth,
  onDepthChange,
  density,
  onDensityChange,
  strength,
  onStrengthChange,
  selectedGroups,
  onToggleGroup,
  targetsAndStop,
  patterns = [], onPatternsChange,
  onTargetsAndStopChange,
  suggestions,
  addedIds,
  focusedId,
  onFocusSuggestion,
  onAddSuggestion,
  onAddAllSuggestions,
  onRefresh,
  onClose,
}: ScanAiDrawerProps) {
  const [filterExpanded, setFilterExpanded] = useState(false);

  if (!open) return null;

  const unaddedCount = suggestions.filter((s) => !addedIds.has(s.id)).length;

  return (
    <aside className="scan-ai-drawer" aria-label="Scan AI Suggestions">
      <DrawerErrorBoundary>
        {/* Drawer Header */}
        <div className="scan-ai-header">
          <div className="scan-ai-title-wrap">
            <span className="scan-ai-icon-title">✨</span>
            <div>
              <h2 className="scan-ai-title">Scan AI</h2>
              <span className="scan-ai-subtitle">Suggestions on chart (deterministic)</span>
            </div>
          </div>
          <div className="scan-ai-header-actions">
            <button
              type="button"
              className="scan-ai-icon-btn"
              title="Refresh scan"
              disabled={loading}
              onClick={onRefresh}
            >
              {loading ? "⌛" : "🔄"}
            </button>
            <button
              type="button"
              className="scan-ai-icon-btn"
              title="Close scan"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter / Settings Toggle Header */}
        <div className="scan-ai-filter-bar">
          <button
            type="button"
            className="scan-ai-filter-toggle"
            onClick={() => setFilterExpanded((p) => !p)}
          >
            <span>Filters & depth {filterExpanded ? "▲" : "▼"}</span>
            <span className="scan-ai-density-pill">{density} · {depth}</span>
          </button>

          {filterExpanded && (
            <div className="scan-ai-filters-panel">
              {/* Density */}
              <div className="scan-ai-filter-row">
                <span className="scan-ai-filter-label">Density:</span>
                <div className="scan-ai-seg-group">
                  {(["auto", "less", "normal", "more"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`scan-ai-seg-btn${density === d ? " is-active" : ""}`}
                      onClick={() => onDensityChange(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Depth */}
              <div className="scan-ai-filter-row">
                <span className="scan-ai-filter-label">Depth:</span>
                <div className="scan-ai-seg-group">
                  {(["short", "medium", "deep"] as const).map((dp) => (
                    <button
                      key={dp}
                      type="button"
                      className={`scan-ai-seg-btn${depth === dp ? " is-active" : ""}`}
                      onClick={() => onDepthChange(dp)}
                    >
                      {dp === "short" ? "250 bars" : dp === "medium" ? "500 bars" : "1000 bars"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strength */}
              <div className="scan-ai-filter-row">
                <span className="scan-ai-filter-label">Strength:</span>
                <div className="scan-ai-seg-group">
                  {(["all", "moderate", "strong"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`scan-ai-seg-btn${strength === st ? " is-active" : ""}`}
                      onClick={() => onStrengthChange(st)}
                    >
                      {st === "moderate" ? "moderate+" : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Groups */}
              <div className="scan-ai-filter-row">
                <span className="scan-ai-filter-label">Groups:</span>
                <div className="scan-ai-chip-group">
                  {(["levels", "lines", "fibonacci", "patterns", "elliott"] as const).map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      className={`scan-ai-chip-btn${selectedGroups.has(grp) ? " is-checked" : ""}`}
                      onClick={() => onToggleGroup(grp)}
                    >
                      {GROUP_ICONS[grp]} {grp}
                    </button>
                  ))}
                </div>
              </div>

              {onPatternsChange && <label className="scan-ai-checkbox-label">
                <input type="checkbox" checked={patterns.includes("triangles_and_pennants")}
                  onChange={e => onPatternsChange(e.target.checked ? [...patterns, "triangles_and_pennants"] : patterns.filter(p => p !== "triangles_and_pennants"))} />
                <span>Triangle patterns</span>
              </label>}
              <p className="scan-ai-subtitle">Settings save automatically in this browser. Selecting no groups hides all suggestions.</p>
              {/* Targets & Stop switch */}
              <div className="scan-ai-filter-row">
                <label className="scan-ai-checkbox-label">
                  <input
                    type="checkbox"
                    checked={targetsAndStop}
                    onChange={(e) => onTargetsAndStopChange(e.target.checked)}
                  />
                  <span>Show targets (TP) and stops (SL) for the focused suggestion</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Accept All Toolbar */}
        <div className="scan-ai-bulk-bar">
          <span className="scan-ai-count-text">
            {loading ? "Scanning..." : `${suggestions.length} suggestions (${unaddedCount} not added)`}
          </span>
          <button
            type="button"
            className="scan-ai-accept-all-btn"
            disabled={unaddedCount === 0 || loading}
            onClick={onAddAllSuggestions}
          >
            ✓ Add all {unaddedCount > 0 ? `(${unaddedCount})` : ""}
          </button>
        </div>

        {/* Error / Loading notices */}
        {error && <div className="scan-ai-error-box">Error: {error}</div>}

        {/* Cards List */}
        <div className="scan-ai-card-list">
          {suggestions.length === 0 && !loading && (
            <div className="scan-ai-empty">
              No suggestions match the current filters. Try a different depth or density.
            </div>
          )}

          {suggestions.map((sug) => {
            const isAdded = addedIds.has(sug.id);
            const isFocused = focusedId === sug.id;
            const stateMeta = STATE_LABELS[sug.state] ?? STATE_LABELS.waiting;
            const itemLabel = sug.label ?? sug.name ?? sug.type ?? "Suggestion";

            return (
              <div
                key={sug.id}
                className={`scan-ai-card${isFocused ? " is-focused" : ""}${isAdded ? " is-added" : ""}`}
                onMouseEnter={() => onFocusSuggestion(sug.id)}
                onMouseLeave={() => onFocusSuggestion(null)}
              >
                <div className="scan-ai-card-top">
                  <span className="scan-ai-card-icon">{GROUP_ICONS[sug.group] ?? "📌"}</span>
                  <span className="scan-ai-card-label">{itemLabel}</span>
                  <span
                    className="scan-ai-state-badge"
                    style={{ backgroundColor: stateMeta.bg, color: stateMeta.color }}
                  >
                    {stateMeta.text}
                  </span>
                  <span className="scan-ai-score-badge">{Math.round(sug.score ?? 0)}</span>
                </div>

                {/* Metrics / anchors preview */}
                <div className="scan-ai-card-details">
                  {sug.metrics?.touches !== undefined && (
                    <span className="scan-ai-metric-item">
                      {sug.metrics.touches} touches
                      {sug.metrics.bounces ? `, ${sug.metrics.bounces} bounces` : ""}
                    </span>
                  )}
                  {sug.metrics?.pattern && (
                    <span className="scan-ai-metric-item">{sug.metrics.pattern}</span>
                  )}
                  {sug.metrics?.topPrice !== undefined && (
                    <span className="scan-ai-metric-item">
                      Zone: {sug.metrics.bottomPrice?.toFixed(1) ?? "?"} - {sug.metrics.topPrice?.toFixed(1) ?? "?"}
                    </span>
                  )}
                  {sug.target !== undefined && sug.target !== null && (
                    <span className="scan-ai-target-tag">TP: {sug.target.toFixed(1)}</span>
                  )}
                  {sug.stop !== undefined && sug.stop !== null && (
                    <span className="scan-ai-stop-tag">SL: {sug.stop.toFixed(1)}</span>
                  )}
                </div>

                {/* Action row */}
                <div className="scan-ai-card-bottom">
                  <span className="scan-ai-tool-tag">{sug.drawingTool}</span>
                  {isAdded ? (
                    <span className="scan-ai-added-badge">✓ Added to chart</span>
                  ) : (
                    <button
                      type="button"
                      className="scan-ai-add-btn"
                      onClick={() => onAddSuggestion(sug)}
                    >
                      + Add to chart
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DrawerErrorBoundary>
    </aside>
  );
}
