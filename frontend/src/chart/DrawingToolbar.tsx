/**
 * DrawingToolbar — TradingView-style vertical toolbar on the left of the chart.
 *
 * Renders SVG icon buttons for each drawing tool, plus the indicator visibility
 * toggle, order-level visibility toggle, and a "Delete All" trash button at
 * the bottom. Mirrors the left toolbar layout from TradingView.
 */

import { useState } from "react";

import type { DrawingToolType } from "./drawings/types";
import { DRAWING_TOOLS } from "./drawings/types";

export interface DrawingToolbarProps {
  /** Optional class name for desktop/mobile layout variants. */
  className?: string;
  /** Currently active tool, or null if none. */
  activeTool: DrawingToolType | null;
  /** Number of drawings on the chart (shows badge on trash if > 0). */
  drawingCount: number;
  /** Called when a tool button is clicked. Same tool = deselect (null). */
  onToolSelect: (tool: DrawingToolType | null) => void;
  /** Called when the delete-all button is clicked. */
  onDeleteAll: () => void;
  /** Whether indicator overlays are currently visible. */
  indicatorsVisible?: boolean;
  /** Toggles the temporary visibility of indicator overlays. */
  onIndicatorsVisibleChange?: (visible: boolean) => void;
  /** Whether live ENTRY / SL / TP levels are currently visible. */
  orderLevelsVisible?: boolean;
  /** Toggles the temporary visibility of live ENTRY / SL / TP levels. */
  onOrderLevelsVisibleChange?: (visible: boolean) => void;
  /** Hide order-on-chart controls in a market-data-only deployment. */
  showOrderLevelsToggle?: boolean;
}

export function DrawingToolbar({
  className,
  activeTool,
  drawingCount,
  onToolSelect,
  onDeleteAll,
  indicatorsVisible = true,
  onIndicatorsVisibleChange = () => {},
  orderLevelsVisible = true,
  onOrderLevelsVisibleChange = () => {},
  showOrderLevelsToggle = true,
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

      <div className="drawing-toolbar-separator" />

      <div className="drawing-toolbar-bottom">
        {showOrderLevelsToggle && <button
          type="button"
          className={`drawing-tool-btn drawing-tool-order-levels${
            orderLevelsVisible ? "" : " is-hidden"
          }`}
          title={orderLevelsVisible ? "Hide order levels" : "Show order levels"}
          aria-label={
            orderLevelsVisible ? "Hide order levels" : "Show order levels"
          }
          aria-pressed={!orderLevelsVisible}
          onClick={() => onOrderLevelsVisibleChange(!orderLevelsVisible)}
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
            <path d="M3 7h18M3 12h18M3 17h18" />
            <path d="M7 5v4M12 10v4M17 15v4" />
            {!orderLevelsVisible && <path d="M4 4 20 20" />}
          </svg>
        </button>}

        <button
          type="button"
          className={`drawing-tool-btn drawing-tool-indicators${
            indicatorsVisible ? "" : " is-hidden"
          }`}
          title={indicatorsVisible ? "Hide all indicators" : "Restore indicators"}
          aria-label={indicatorsVisible ? "Hide all indicators" : "Restore indicators"}
          aria-pressed={!indicatorsVisible}
          onClick={() => onIndicatorsVisibleChange(!indicatorsVisible)}
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
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.5" />
            {!indicatorsVisible && <path d="M4 4 20 20" />}
          </svg>
        </button>

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
      </div>
    </aside>
  );
}
