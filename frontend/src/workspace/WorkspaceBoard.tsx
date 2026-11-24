import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import type { WorkspaceLayout, WorkspacePanel } from "./types";
import { COMPACT_WORKSPACE_WIDTH, contentColumnCount, MIN_COLUMN_SHARE, normalizeThreeColumnSplits, resizeThreeColumn, WORKSPACE_GAP } from "./layout";

type Axis = "columnSplit" | "firstRowSplit";
const clamp = (value: number) => Math.max(22, Math.min(78, Math.round(value)));

interface WorkspaceBoardProps {
  panels: readonly WorkspacePanel[];
  layout: WorkspaceLayout;
  selectedId?: string;
  fullscreenId?: string;
  compactTradingAccount?: boolean;
  onAccountSettings?: () => void;
  onSelect: (id: string) => void;
  onFullscreen: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: string, to: string) => void;
  onResize: (layout: WorkspaceLayout) => void;
  renderChartControls: (panel: WorkspacePanel) => ReactNode;
  renderLinkControls?: (panel: WorkspacePanel) => ReactNode;
  renderPanel: (panel: WorkspacePanel) => ReactNode;
}

export const PANEL_NAMES = {
  chart: "Chart",
  aiScan: "AI Scan",
  footprint: "Footprint",
  marketProfile: "Market Profile",
  liquidity: "Liquidity",
  alerts: "Alerts",
  tradingAccount: "Trading Account",
};

export function WorkspaceBoard({
  panels,
  layout,
  selectedId,
  fullscreenId,
  compactTradingAccount = false,
  onAccountSettings,
  onSelect,
  onFullscreen,
  onRemove,
  onMove,
  onResize,
  renderChartControls,
  renderLinkControls,
  renderPanel,
}: WorkspaceBoardProps) {
  const accountSettingsButton = onAccountSettings && (
    <button type="button" className="trading-account-settings" aria-label="Account settings" title="Account settings" onClick={onAccountSettings}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="m9 3-.6 2.4-2.1 1.2L4 6l-3 5 1.8 1.7v2.4L1 17l3 5 2.3-.6 2.1 1.2L9 25h6l.6-2.4 2.1-1.2L20 22l3-5-1.8-1.9v-2.4L23 11l-3-5-2.3.6-2.1-1.2L15 3Z" transform="translate(2 0) scale(.83)" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
  const board = useRef<HTMLDivElement>(null);
  const dragged = useRef<string>();
  const dockTarget = useRef<"bottom" | "right">();
  const pointerCleanup = useRef<() => void>();
  const [boardWidth, setBoardWidth] = useState(() => window.innerWidth);
  const [shortViewport, setShortViewport] = useState(() => window.innerHeight <= 500 && window.innerWidth <= 1000);
  const [draft, setDraft] = useState<WorkspaceLayout>();
  const [draggingId, setDraggingId] = useState<string>();
  const [dropTargetId, setDropTargetId] = useState<string>();
  const [dropDockPosition, setDropDockPosition] = useState<"bottom" | "right">();

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const measure = () => {
      setBoardWidth(element.getBoundingClientRect().width || window.innerWidth);
      setShortViewport(window.innerHeight <= 500 && window.innerWidth <= 1000);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      pointerCleanup.current?.();
    };
  }, []);

  const size = draft ?? layout;
  const contentPanels = panels.filter((panel) => panel.type !== "tradingAccount");
  const accountPanels = panels.filter((panel) => panel.type === "tradingAccount");
  const orderedPanels = [...contentPanels, ...accountPanels];
  const accountLocked = layout.tradingAccountLocked === true;
  const keepAccount = accountLocked && contentPanels.some(panel => panel.id === fullscreenId
    && ["chart", "footprint", "marketProfile", "liquidity"].includes(panel.type));
  const showAccount = !fullscreenId || keepAccount;
  const visibleContentCount = fullscreenId ? 1 : contentPanels.length;
  const hasDock = showAccount && contentPanels.length > 0 && accountPanels.length > 0;
  const compact = boardWidth <= COMPACT_WORKSPACE_WIDTH || shortViewport;
  const prefersRightDock = layout.tradingAccountPosition === "right";
  const isRightDock = hasDock && !compact && prefersRightDock;
  const columns = fullscreenId || compact ? 1 : contentColumnCount(boardWidth, contentPanels.length, isRightDock);
  const rows = Math.ceil(visibleContentCount / columns);
  const threeSplits = normalizeThreeColumnSplits(size.threeColumnSplits);

  const rowTracks = rows === 0 ? "" : rows === 1 ? "minmax(0, 1fr)" : rows === 2
    ? `minmax(0, ${size.firstRowSplit}fr) minmax(0, ${100 - size.firstRowSplit}fr)`
    : `minmax(180px, ${size.firstRowSplit}fr) repeat(${rows - 1}, minmax(180px, ${(100 - size.firstRowSplit) / (rows - 1)}fr))`;

  const accountTracks = showAccount && accountPanels.length ? `repeat(${accountPanels.length}, max-content)` : "";

  const columnShares = columns === 3 ? [threeSplits[0], threeSplits[1] - threeSplits[0], 100 - threeSplits[1]]
    : columns === 2 ? [size.columnSplit, 100 - size.columnSplit] : [1];
  const gridTemplateColumns = columnShares.map((share) => `minmax(0, ${share}fr)`).join(" ")
    + (isRightDock ? " minmax(280px, 360px)" : "");

  const gridTemplateRows = fullscreenId && !keepAccount
    ? "minmax(0, 1fr)"
    : isRightDock
      ? `${rowTracks}`.trim() || "minmax(0, 1fr)"
      : `${rowTracks} ${accountTracks}`.trim() || "minmax(0, 1fr)";

  const mobileContentTracks = visibleContentCount === 1
    ? "minmax(0, 1fr)"
    : visibleContentCount
      ? `repeat(${visibleContentCount}, minmax(260px, 1fr))`
      : "";

  const gridStyle = {
    "--column-split": size.columnSplit + "%",
    "--mobile-row-tracks": `${mobileContentTracks} ${accountTracks}`.trim(),
    gridTemplateColumns,
    gridTemplateRows,
  } as CSSProperties;

  const setDockTarget = (position?: "bottom" | "right") => {
    dockTarget.current = position;
    setDropDockPosition(position);
  };

  const isPanelMovable = (panel: WorkspacePanel) => {
    if (fullscreenId) return false;
    if (panel.type === "tradingAccount") return hasDock || panels.length > 1;
    return contentPanels.length > 1;
  };

  const startDrag = (panelId: string) => {
    dragged.current = panelId;
    setDraggingId(panelId);
  };

  const endDrag = (applyDrop = false, targetId?: string) => {
    const fromId = dragged.current ?? draggingId;
    if (applyDrop && fromId) {
      if (fromId === accountPanels[0]?.id && dockTarget.current) {
        onResize({ ...layout, tradingAccountPosition: dockTarget.current });
      } else if (targetId && targetId !== fromId && contentPanels.some((panel) => panel.id === targetId) && contentPanels.some((panel) => panel.id === fromId)) {
        onMove(fromId, targetId);
      }
    }
    pointerCleanup.current?.();
    pointerCleanup.current = undefined;
    dragged.current = undefined;
    setDraggingId(undefined);
    setDropTargetId(undefined);
    setDockTarget(undefined);
  };

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && (dragged.current || draggingId)) {
        endDrag(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draggingId]);

  const handleGripPointerDown = (panel: WorkspacePanel, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !isPanelMovable(panel)) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragActive = false;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragActive && Math.hypot(dx, dy) > 4) {
        dragActive = true;
        startDrag(panel.id);
      }
      if (dragActive) {
        if (panel.type === "tradingAccount") {
          const rect = board.current?.getBoundingClientRect();
          if (rect) {
            const relX = (e.clientX - rect.left) / rect.width;
            const relY = (e.clientY - rect.top) / rect.height;
            if (relX > 0.65) {
              setDockTarget("right");
              setDropTargetId(undefined);
              return;
            } else if (relY > 0.6) {
              setDockTarget("bottom");
              setDropTargetId(undefined);
              return;
            }
          }
          setDockTarget(undefined);
        }
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetPanel = el?.closest<HTMLElement>(".workspace-panel");
        const tid = targetPanel?.dataset.panelId;
        if (tid && tid !== panel.id) {
          setDropTargetId(tid);
        } else {
          setDropTargetId(undefined);
        }
      }
    };

    const handlePointerUp = (e: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (dragActive) {
        if (panel.type === "tradingAccount" && dockTarget.current) {
          endDrag(true);
        } else {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const targetPanel = el?.closest<HTMLElement>(".workspace-panel");
          const tid = targetPanel?.dataset.panelId ?? dropTargetId;
          endDrag(true, tid);
        }
      } else {
        endDrag(false);
      }
    };

    const handlePointerCancel = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      endDrag(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    pointerCleanup.current = () => {
      dragActive = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  };

  const handleGripKeyDown = (panel: WorkspacePanel, index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isPanelMovable(panel)) return;
    if (panel.type === "tradingAccount") {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onResize({ ...layout, tradingAccountPosition: "right" });
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        onResize({ ...layout, tradingAccountPosition: "bottom" });
      }
      return;
    }
    const offset = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1
      : event.key === "ArrowUp" ? -columns : event.key === "ArrowDown" ? columns : 0;
    if (offset && index + offset >= 0 && index + offset < contentPanels.length) {
      event.preventDefault();
      onMove(panel.id, contentPanels[index + offset].id);
    }
  };

  const updateSize = (event: PointerEvent<HTMLDivElement>, axis: Axis, columnDivider = 0) => {
    const rect = board.current?.getBoundingClientRect();
    const vertical = axis === "columnSplit";
    if (!rect) return layout;
    const contentHeight = hasDock && !isRightDock
      ? board.current?.querySelector<HTMLElement>(".is-trading-account")?.offsetTop ?? rect.height
      : rect.height;
    const dockLeft = isRightDock ? board.current?.querySelector<HTMLElement>(".is-trading-account")?.getBoundingClientRect().left : undefined;
    const contentWidth = (dockLeft === undefined ? rect.width - 6 : dockLeft - rect.left - 3 - WORKSPACE_GAP)
      - WORKSPACE_GAP * (columns - 1);
    const split = vertical ? (event.clientX - rect.left - 3 - columnDivider * WORKSPACE_GAP) / contentWidth
      : (event.clientY - rect.top) / contentHeight;
    if (vertical && columns === 3) return resizeThreeColumn(layout, columnDivider, 100 * split);
    return { ...layout, [axis]: clamp(100 * split) };
  };

  const divider = (axis: Axis, columnDivider = 0) => {
    const vertical = axis === "columnSplit";
    const position = vertical && columns === 3 ? threeSplits[columnDivider] : size[axis];
    const min = vertical && columns === 3 ? (columnDivider === 0 ? MIN_COLUMN_SHARE : threeSplits[0] + MIN_COLUMN_SHARE) : 22;
    const max = vertical && columns === 3 ? (columnDivider === 0 ? threeSplits[1] - MIN_COLUMN_SHARE : 100 - MIN_COLUMN_SHARE) : 78;
    return <div
      key={`${axis}-${columnDivider}`}
      className={`workspace-divider ${vertical ? "is-vertical" : "is-horizontal"}`}
      style={{ gridColumn: vertical ? `${columnDivider + 1} / ${columnDivider + 2}` : `1 / ${columns + 1}`, gridRow: vertical ? `1 / ${rows + 1}` : "1 / 2" }}
      role="separator"
      tabIndex={0}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={vertical ? columns === 3 ? `Resize columns ${columnDivider + 1} and ${columnDivider + 2}` : "Resize columns" : "Resize first row"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={position}
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setDraft(updateSize(event, axis, columnDivider));
      }}
      onPointerCancel={() => setDraft(undefined)}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        onResize(updateSize(event, axis, columnDivider));
        setDraft(undefined);
      }}
      onKeyDown={(event) => {
        const step = event.key === (vertical ? "ArrowLeft" : "ArrowUp") ? -5
          : event.key === (vertical ? "ArrowRight" : "ArrowDown") ? 5 : 0;
        if (!step) return;
        event.preventDefault();
        onResize(vertical && columns === 3 ? resizeThreeColumn(layout, columnDivider, position + step)
          : { ...layout, [axis]: clamp(position + step) });
      }}
    />;
  };

  const getPanelStyle = (panel: WorkspacePanel, index: number): CSSProperties | undefined => {
    if (panel.type === "tradingAccount") {
      if (hasDock) {
        if (isRightDock) {
          return {
            gridColumn: `${columns + 1} / ${columns + 2}`,
            gridRow: `1 / ${rows + 1}`,
          };
        }
        return { gridColumn: "1 / -1", gridRow: rows + 1 + accountPanels.indexOf(panel) };
      }
      return undefined;
    }
    if (fullscreenId) return { gridColumn: `1 / ${columns + 1}`, gridRow: 1 };
    const column = index % columns + 1;
    const span = index === contentPanels.length - 1 ? columns - column + 1 : 1;
    return { gridColumn: `${column} / span ${span}`, gridRow: Math.floor(index / columns) + 1 };
  };

  const isWide = (panel: WorkspacePanel, index: number) => {
    if (panel.type === "tradingAccount") return !isRightDock;
    return index === contentPanels.length - 1 && index % columns === 0;
  };

  return <div
    ref={board}
    data-content-columns={columns}
    data-compact={compact && (!fullscreenId || keepAccount) ? "true" : undefined}
    data-account-locked={accountLocked}
    className={`workspace-board ${fullscreenId || contentPanels.length < 2 ? "is-single" : ""}${rows > 2 ? " is-scrollable" : ""}${hasDock ? (isRightDock ? " has-right-dock" : " has-trading-account") : ""}${isRightDock && contentPanels.length < 2 ? " is-single-content" : ""}${draggingId ? " is-dragging-panel" : ""}`}
    style={gridStyle}
  >
    {panels.length === 0 && <div className="workspace-empty">Choose a panel from Add Widgets to start.</div>}
    {orderedPanels.map((panel, index) => {
      const movable = isPanelMovable(panel);
      return <section
        key={panel.id}
        id={"workspace-panel-" + panel.id}
        data-panel-id={panel.id}
        data-content-row={panel.type !== "tradingAccount" ? Math.floor(index / columns) + 1 : undefined}
        className={`workspace-panel${panel.type === "chart" ? " is-chart" : ""}${selectedId === panel.id ? " is-selected" : ""}${isWide(panel, index) ? " is-wide" : ""}${panel.type === "tradingAccount" ? ` is-trading-account${compactTradingAccount ? " is-compact-account" : ""}${isRightDock ? " is-right-dock" : " is-bottom-dock"}` : ""}${draggingId === panel.id ? " is-being-dragged" : ""}${dropTargetId === panel.id ? " is-drop-target" : ""}`}
        style={getPanelStyle(panel, index)}
        hidden={Boolean(fullscreenId && fullscreenId !== panel.id && !(panel.type === "tradingAccount" && keepAccount))}
        aria-label={PANEL_NAMES[panel.type]}
        onPointerDown={() => onSelect(panel.id)}
        onFocus={() => onSelect(panel.id)}
        onDragOver={(event) => {
          if (dragged.current || draggingId) {
            event.preventDefault();
            if (event.dataTransfer) {
              event.dataTransfer.dropEffect = "move";
            }
            const currentDragged = dragged.current ?? draggingId;
            if (currentDragged !== panel.id) {
              setDropTargetId(panel.id);
            }
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            if (dropTargetId === panel.id) {
              setDropTargetId(undefined);
            }
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const currentDragged = dragged.current ?? draggingId;
          if (currentDragged && currentDragged !== panel.id) {
            endDrag(true, panel.id);
          } else {
            endDrag(false);
          }
        }}
      >
        {!(panel.type === "tradingAccount" && compactTradingAccount) && <header className={panel.type === "chart" ? "workspace-panel-header workspace-chart-header" : "workspace-panel-header"}>
          <div className="workspace-panel-title-group">
            {movable && (
              <button
                type="button"
                className={`workspace-panel-grip${draggingId === panel.id ? " is-active" : ""}`}
                draggable={movable}
                aria-label={`Drag to move ${PANEL_NAMES[panel.type]} panel`}
                title={movable ? "Drag to move panel" : undefined}
                onPointerDown={(event) => handleGripPointerDown(panel, event)}
                onDragStart={(event) => {
                  startDrag(panel.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", panel.id);
                }}
                onDragEnd={() => endDrag(false)}
                onKeyDown={(event) => handleGripKeyDown(panel, index, event)}
              >
                <span aria-hidden="true">⠿</span>
              </button>
            )}
            {panel.type !== "chart" && <strong className="workspace-panel-title">{PANEL_NAMES[panel.type]}</strong>}
          </div>
          {panel.type === "chart" && renderChartControls(panel)}
          <div className="workspace-panel-actions">
            {renderLinkControls?.(panel)}
            {index > 0 && movable && panel.type !== "tradingAccount" && (
              <button
                type="button"
                title="Move panel earlier"
                aria-label="Move panel earlier"
                onClick={() => onMove(panel.id, orderedPanels[index - 1].id)}
              >‹</button>
            )}
            {panel.type === "tradingAccount" && accountSettingsButton}
            {panel.type === "tradingAccount" && hasDock && (
              <button
                type="button"
                className="workspace-dock-toggle"
                title={prefersRightDock ? "Dock to bottom" : "Dock to right"}
                aria-label={prefersRightDock ? "Dock to bottom" : "Dock to right"}
                onClick={() => onResize({ ...layout, tradingAccountPosition: prefersRightDock ? "bottom" : "right" })}
              >
                {prefersRightDock ? "⤓" : "⇥"}
              </button>
            )}
            {["chart", "footprint", "marketProfile", "liquidity"].includes(panel.type) && <button
              type="button"
              aria-label={`${fullscreenId === panel.id ? "Restore" : "Fullscreen"} ${panel.type === "chart" ? "chart" : PANEL_NAMES[panel.type]}`}
              aria-pressed={fullscreenId === panel.id}
              onClick={() => onFullscreen(panel.id)}
            >⛶</button>}
            {panel.type === "tradingAccount" && <button type="button" className="trading-account-lock"
              aria-label="Keep Trading Account visible when maximizing widgets" aria-pressed={accountLocked}
              title={accountLocked ? "Unlock Trading Account" : "Lock Trading Account"}
              onClick={() => onResize({ ...layout, tradingAccountLocked: !accountLocked })}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d={accountLocked ? "M8 10V7a4 4 0 0 1 8 0v3" : "M8 10V7a4 4 0 0 1 8 0"} />
              </svg>
            </button>}
            <button type="button" aria-label={`Remove ${PANEL_NAMES[panel.type]} panel`} onClick={() => onRemove(panel.id)}>×</button>
          </div>
        </header>}
        <div className="workspace-panel-body">
          {panel.type === "tradingAccount" && compactTradingAccount && (
            <div className="trading-account-compact-controls">
              {accountSettingsButton}
              {hasDock && (
                <button
                  type="button"
                  className="trading-account-dock-toggle"
                  title={prefersRightDock ? "Dock to bottom" : "Dock to right"}
                  aria-label={prefersRightDock ? "Dock to bottom" : "Dock to right"}
                  onClick={() => onResize({ ...layout, tradingAccountPosition: prefersRightDock ? "bottom" : "right" })}
                >
                  {prefersRightDock ? "⤓" : "⇥"}
                </button>
              )}
              <button type="button" className="trading-account-lock"
                aria-label="Keep Trading Account visible when maximizing widgets" aria-pressed={accountLocked}
                title={accountLocked ? "Unlock Trading Account" : "Lock Trading Account"}
                onClick={() => onResize({ ...layout, tradingAccountLocked: !accountLocked })}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d={accountLocked ? "M8 10V7a4 4 0 0 1 8 0v3" : "M8 10V7a4 4 0 0 1 8 0"} />
                </svg>
              </button>
              <button
                type="button"
                className="trading-account-close"
                aria-label="Remove Trading Account panel"
                onClick={() => onRemove(panel.id)}
              >×</button>
            </div>
          )}
          {renderPanel(panel)}
        </div>
      </section>;
    })}
    {!fullscreenId && columns > 1 && Array.from({ length: columns - 1 }, (_, index) => divider("columnSplit", index))}
    {!fullscreenId && rows > 1 && divider("firstRowSplit")}
    {draggingId === accountPanels[0]?.id && hasDock && (
      <div className="workspace-dock-overlay">
        <div
          className={`workspace-dock-target is-right-target${dropDockPosition === "right" ? " is-active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDockTarget("right"); }}
          onDrop={(e) => { e.preventDefault(); onResize({ ...layout, tradingAccountPosition: "right" }); endDrag(false); }}
        >
          <span>⇥ Dock to Right</span>
        </div>
        <div
          className={`workspace-dock-target is-bottom-target${dropDockPosition === "bottom" ? " is-active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDockTarget("bottom"); }}
          onDrop={(e) => { e.preventDefault(); onResize({ ...layout, tradingAccountPosition: "bottom" }); endDrag(false); }}
        >
          <span>⤓ Dock to Bottom</span>
        </div>
      </div>
    )}
  </div>;
}
