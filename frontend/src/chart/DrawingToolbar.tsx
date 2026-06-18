/**
 * DrawingToolbar — TradingView-style vertical toolbar on the left of the chart.
 *
 * Renders SVG icon buttons for each drawing tool and a "Delete All" trash
 * button at the bottom. Mirrors the left toolbar layout from TradingView
 * (see the screenshot in the user's request).
 */

import { useState } from "react";

import type { DrawingToolType, FixedRangeProfileMode } from "./drawings/types";
import { DRAWING_TOOLS } from "./drawings/types";

export interface DrawingToolbarProps {
  /** Optional class name for desktop/mobile layout variants. */
  className?: string;
  /** Currently active tool, or null if none. */
  activeTool: DrawingToolType | null;
  /** Number of drawings on the chart (shows badge on trash if > 0). */
  drawingCount: number;
  /** Mode used for newly placed fixed range profile drawings. */
  fixedRangeProfileMode?: FixedRangeProfileMode;
  /** Called when a tool button is clicked. Same tool = deselect (null). */
  onToolSelect: (tool: DrawingToolType | null) => void;
  /** Called when the fixed range profile mode changes. */
  onFixedRangeProfileModeChange?: (mode: FixedRangeProfileMode) => void;
  /** Called when the delete-all button is clicked. */
  onDeleteAll: () => void;
}

export function DrawingToolbar({
  className,
  activeTool,
  drawingCount,
  fixedRangeProfileMode = "bidAsk",
  onToolSelect,
  onFixedRangeProfileModeChange = () => {},
  onDeleteAll,
}: DrawingToolbarProps) {
  const isMobile = className?.includes("drawing-toolbar-mobile") === true;
  const [mobileOpen, setMobileOpen] = useState(false);
  const classes = [
    "drawing-toolbar",
    className,
    isMobile ? (mobileOpen ? "is-open" : "is-collapsed") : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <aside className={classes} role="toolbar" aria-label="Drawing tools">
      {isMobile && (
        <button
          type="button"
          className="drawing-toolbar-toggle"
          aria-label={mobileOpen ? "Close drawing tools" : "Open drawing tools"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 17 L17 4" />
            <path d={mobileOpen ? "M8 8 L4 12 L8 16" : "M16 8 L20 12 L16 16"} />
          </svg>
        </button>
      )}
      <div className="drawing-toolbar-tools">
        {DRAWING_TOOLS.map((tool) => {
          const isActive = activeTool === tool.type;
          return (
            <button
              key={tool.type}
              type="button"
              className={`drawing-tool-btn${isActive ? " active" : ""}`}
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={isActive}
              onClick={() => onToolSelect(isActive ? null : tool.type)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={tool.icon} />
              </svg>
            </button>
          );
        })}
      </div>

      <div
        className="drawing-profile-mode"
        role="group"
        aria-label="Fixed range profile mode"
      >
        <button
          type="button"
          className={`drawing-profile-mode-btn${
            fixedRangeProfileMode === "bidAsk" ? " active" : ""
          }`}
          title="Bid/ask fixed profile"
          aria-label="Bid/ask fixed profile"
          aria-pressed={fixedRangeProfileMode === "bidAsk"}
          onClick={() => onFixedRangeProfileModeChange("bidAsk")}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 7 h7 M12 7 h7 M5 12 h10 M15 12 h4 M5 17 h5 M10 17 h9" />
          </svg>
        </button>
        <button
          type="button"
          className={`drawing-profile-mode-btn${
            fixedRangeProfileMode === "volume" ? " active" : ""
          }`}
          title="Volume fixed profile"
          aria-label="Volume fixed profile"
          aria-pressed={fixedRangeProfileMode === "volume"}
          onClick={() => onFixedRangeProfileModeChange("volume")}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 7 h14 M5 12 h10 M5 17 h6" />
          </svg>
        </button>
      </div>

      <div className="drawing-toolbar-separator" />

      <button
        type="button"
        className="drawing-tool-btn drawing-tool-delete"
        title={`Delete all drawings${drawingCount > 0 ? ` (${drawingCount})` : ""}`}
        aria-label={`Delete all drawings${drawingCount > 0 ? ` (${drawingCount})` : ""}`}
        disabled={drawingCount === 0}
        onClick={onDeleteAll}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        {drawingCount > 0 && (
          <span className="drawing-count-badge">{drawingCount}</span>
        )}
      </button>
    </aside>
  );
}
