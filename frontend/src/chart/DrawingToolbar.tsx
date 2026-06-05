/**
 * DrawingToolbar — TradingView-style vertical toolbar on the left of the chart.
 *
 * Renders SVG icon buttons for each drawing tool and a "Delete All" trash
 * button at the bottom. Mirrors the left toolbar layout from TradingView
 * (see the screenshot in the user's request).
 */

import type { DrawingToolType } from "./drawings/types";
import { DRAWING_TOOLS } from "./drawings/types";

export interface DrawingToolbarProps {
  /** Currently active tool, or null if none. */
  activeTool: DrawingToolType | null;
  /** Number of drawings on the chart (shows badge on trash if > 0). */
  drawingCount: number;
  /** Called when a tool button is clicked. Same tool = deselect (null). */
  onToolSelect: (tool: DrawingToolType | null) => void;
  /** Called when the delete-all button is clicked. */
  onDeleteAll: () => void;
}

export function DrawingToolbar({
  activeTool,
  drawingCount,
  onToolSelect,
  onDeleteAll,
}: DrawingToolbarProps) {
  return (
    <aside className="drawing-toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="drawing-toolbar-tools">
        {DRAWING_TOOLS.map((tool) => {
          const isActive = activeTool === tool.type;
          return (
            <button
              key={tool.type}
              type="button"
              className={`drawing-tool-btn${isActive ? " active" : ""}`}
              title={tool.label}
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

      <button
        type="button"
        className="drawing-tool-btn drawing-tool-delete"
        title={`Delete all drawings${drawingCount > 0 ? ` (${drawingCount})` : ""}`}
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
