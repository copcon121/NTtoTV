import { useEffect, useRef, useState, type ReactNode } from "react";

import { ThemeSettings } from "./ThemeSettings";
import type { Workspace, WorkspacePanelType, WorkspaceTheme } from "./types";

export interface WorkspaceToolbarProps {
  workspaces: readonly Workspace[];
  activeWorkspaceId: string;
  theme: WorkspaceTheme;
  fullscreen: boolean;
  requestPending: boolean;
  hasActiveWorkspace: boolean;
  panelCount: number;
  chartCount: number;
  hasTradingAccount: boolean;
  accountControls: ReactNode;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onCreate: (template: Workspace["payload"]["template"]) => void;
  onAddPanel: (type: WorkspacePanelType) => void;
  onThemeChange: (theme: WorkspaceTheme) => void;
  onFullscreen: () => void;
}

const TEMPLATES: Array<{ id: Workspace["payload"]["template"]; label: string; detail: string }> = [
  { id: "essentials", label: "Essentials", detail: "Chart · AI Scan" },
  { id: "order-flow", label: "Order Flow", detail: "Chart · Footprint · Market Profile" },
  { id: "multi-timeframe", label: "Multi-timeframe", detail: "Chart 1D · 1H · 5m · 1m" },
  { id: "scratch", label: "Start from scratch", detail: "Choose your own panels" },
];

const WIDGETS: Array<{ id: WorkspacePanelType; label: string }> = [
  { id: "chart", label: "Chart" },
  { id: "aiScan", label: "AI Scan" },
  { id: "footprint", label: "Footprint" },
  { id: "marketProfile", label: "Market Profile" },
  { id: "liquidity", label: "Liquidity" },
  { id: "alerts", label: "Alerts" },
  { id: "tradingAccount", label: "Trading Account" },
];

const ICONS = {
  theme: "M12 3a9 9 0 1 0 0 18h1.2a1.7 1.7 0 0 0 1.3-2.8 1.7 1.7 0 0 1 1.3-2.7H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3ZM7.5 11h.01M10 7.5h.01M14 7.5h.01M17 10.5h.01",
  fullscreen: "M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5",
  restore: "M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5",
  rename: "m4 20 4.5-1 10-10a2.1 2.1 0 1 0-3-3l-10 10L4 20Zm9.8-12.2 3 3",
  delete: "M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
};

function WorkspaceIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

interface TabMenu {
  id: string;
  anchor: HTMLButtonElement;
  left: number;
  top: number;
  renaming: boolean;
}

export function WorkspaceToolbar({
  workspaces,
  activeWorkspaceId,
  theme,
  fullscreen,
  requestPending,
  hasActiveWorkspace,
  panelCount,
  chartCount,
  hasTradingAccount,
  accountControls,
  onRename,
  onRemove,
  onSelect,
  onCreate,
  onAddPanel,
  onThemeChange,
  onFullscreen,
}: WorkspaceToolbarProps) {
  const [menu, setMenu] = useState<"create" | "widgets" | "theme" | "workspaces" | "actions" | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const workspacePickerRef = useRef<HTMLButtonElement>(null);
  const tabPopupRef = useRef<HTMLDivElement>(null);
  const [tabMenu, setTabMenu] = useState<TabMenu>();
  const [name, setName] = useState("");
  const menuWorkspace = workspaces.find((workspace) => workspace.id === tabMenu?.id);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const mobileActionsOpen = menu === "actions" || menu === "widgets" || menu === "theme";
  const fullscreenLabel = fullscreen ? "Exit fullscreen" : "Fullscreen";

  useEffect(() => {
    if (!tabMenu) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !tabPopupRef.current?.contains(event.target)) setTabMenu(undefined);
    }
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [tabMenu]);

  function openTabMenu(id: string, anchor: HTMLButtonElement, renaming = false) {
    const toolbar = toolbarRef.current?.getBoundingClientRect();
    if (!toolbar) return;
    const tab = anchor.getBoundingClientRect();
    setMenu(null);
    if (renaming) setName(workspaces.find((workspace) => workspace.id === id)?.name ?? "");
    setTabMenu({ id, anchor, left: Math.max(4, tab.left - toolbar.left), top: tab.bottom - toolbar.top + 6, renaming });
  }

  function closeTabMenu() {
    tabMenu?.anchor.focus();
    setTabMenu(undefined);
  }

  function removeWorkspace(workspace: Workspace) {
    if (window.confirm(`Delete "${workspace.name}"?`)) onRemove(workspace.id);
    setMenu(null);
    closeTabMenu();
  }

  return (
    <div ref={toolbarRef} className="workspace-toolbar" onKeyDown={(event) => {
      if (event.key === "Escape") {
        setMenu(null);
        if (tabMenu) closeTabMenu();
      }
    }}>
      <div className="workspace-switcher" role="tablist" aria-label="Workspaces">
        {workspaces.map((workspace) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspaceId === workspace.id}
            aria-haspopup="menu"
            aria-expanded={tabMenu?.id === workspace.id && !tabMenu.renaming}
            className={activeWorkspaceId === workspace.id ? "is-active" : ""}
            key={workspace.id}
            onClick={() => onSelect(workspace.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              openTabMenu(workspace.id, event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                event.preventDefault();
                openTabMenu(workspace.id, event.currentTarget);
              }
            }}
          >
            {workspace.name}
          </button>
        ))}
        <button type="button" aria-label="Create workspace" disabled={requestPending} onClick={() => setMenu(menu === "create" ? null : "create")}>＋</button>
      </div>
      <div className="workspace-mobile-switcher">
        <button
          ref={workspacePickerRef}
          type="button"
          aria-label="Select workspace"
          aria-haspopup="dialog"
          aria-expanded={menu === "workspaces"}
          aria-controls="workspace-mobile-picker"
          onClick={() => setMenu(menu === "workspaces" ? null : "workspaces")}
        >
          <span>{activeWorkspace?.name ?? "Workspaces"}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
      <button
        type="button"
        className="workspace-mobile-actions-toggle workspace-icon-button"
        aria-label="Workspace actions"
        aria-expanded={mobileActionsOpen}
        aria-controls="workspace-toolbar-actions"
        onClick={() => setMenu(mobileActionsOpen ? null : "actions")}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {menu === "workspaces" && <div id="workspace-mobile-picker" className="workspace-mobile-picker" role="dialog" aria-label="Workspace list">
        <ul>
          {workspaces.map((workspace) => <li key={workspace.id}>
            <button
              type="button"
              className="workspace-mobile-option"
              aria-pressed={activeWorkspaceId === workspace.id}
              autoFocus={activeWorkspaceId === workspace.id}
              onClick={() => { onSelect(workspace.id); setMenu(null); }}
            >{workspace.name}</button>
            <button
              type="button"
              className="workspace-icon-button"
              aria-label={`Rename workspace ${workspace.name}`}
              title="Rename workspace"
              disabled={requestPending}
              onClick={(event) => openTabMenu(workspace.id, workspacePickerRef.current ?? event.currentTarget, true)}
            ><WorkspaceIcon name="rename" /></button>
            <button
              type="button"
              className="workspace-icon-button"
              aria-label={`Close workspace ${workspace.name}`}
              title="Close workspace"
              disabled={requestPending}
              onClick={() => removeWorkspace(workspace)}
            ><span aria-hidden="true">×</span></button>
          </li>)}
        </ul>
        <button type="button" className="workspace-mobile-create" disabled={requestPending} onClick={() => setMenu("create")}>＋ Create workspace</button>
      </div>}
      <div id="workspace-toolbar-actions" className={`workspace-actions${mobileActionsOpen ? " is-mobile-open" : ""}`}>
        <div className="workspace-menu-anchor">
          <button type="button" disabled={!hasActiveWorkspace} onClick={() => setMenu(menu === "widgets" ? null : "widgets")}>＋ Add Widgets</button>
          {menu === "widgets" && <div className="workspace-menu" role="menu" aria-label="Widget catalog">
            {WIDGETS.map((widget) => <button role="menuitem" type="button" key={widget.id} disabled={panelCount >= 12 || (widget.id === "chart" && chartCount >= 4) || (widget.id === "tradingAccount" && hasTradingAccount)} onClick={() => { onAddPanel(widget.id); setMenu(null); }}>{widget.label}</button>)}
          </div>}
        </div>
        <div className="workspace-menu-anchor workspace-theme-anchor">
          <button
            type="button"
            className="workspace-icon-button"
            title="Theme Settings"
            disabled={!hasActiveWorkspace}
            aria-label="Theme Settings"
            aria-expanded={menu === "theme"}
            onClick={() => setMenu(menu === "theme" ? null : "theme")}
          >
            <WorkspaceIcon name="theme" />
          </button>
          {menu === "theme" && <ThemeSettings theme={theme} onThemeChange={onThemeChange} />}
        </div>
        <button
          type="button"
          className="workspace-fullscreen workspace-icon-button"
          title={fullscreenLabel}
          aria-label={fullscreenLabel}
          aria-pressed={fullscreen}
          onClick={onFullscreen}
        >
          <WorkspaceIcon name={fullscreen ? "restore" : "fullscreen"} />
        </button>
        {accountControls}
      </div>
      {menu === "create" && <div className="workspace-create-popover" role="dialog" aria-label="Create workspace">
        <strong>Create a new workspace</strong>
        {TEMPLATES.map((template) => <button type="button" key={template.id} onClick={() => { onCreate(template.id); setMenu(null); }}><b>{template.label}</b><small>{template.detail}</small></button>)}
      </div>}
      {tabMenu && menuWorkspace && (
        <div
          ref={tabPopupRef}
          className={`workspace-tab-popup${tabMenu.renaming ? " is-renaming" : ""}`}
          style={{ left: `min(${tabMenu.left}px, 100% - var(--tab-popup-width) - 4px)`, top: tabMenu.top }}
          role={tabMenu.renaming ? "dialog" : "menu"}
          aria-label={tabMenu.renaming ? "Rename workspace" : `Actions for ${menuWorkspace.name}`}
        >
          {tabMenu.renaming ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              onRename(menuWorkspace.id, name);
              closeTabMenu();
            }}>
              <label>
                Workspace name
                <input autoFocus maxLength={80} value={name} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setName(event.currentTarget.value)} />
              </label>
              <div className="workspace-rename-actions">
                <button type="button" onClick={closeTabMenu}>Cancel</button>
                <button type="submit" disabled={!name.trim()}>Save</button>
              </div>
            </form>
          ) : (
            <>
              <button autoFocus type="button" role="menuitem" disabled={requestPending} onClick={() => {
                setName(menuWorkspace.name);
                setTabMenu({ ...tabMenu, renaming: true });
              }}>
                <WorkspaceIcon name="rename" />
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={requestPending}
                onClick={() => removeWorkspace(menuWorkspace)}
              >
                <WorkspaceIcon name="delete" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
      <div className="workspace-menu-dismiss" hidden={menu === null} onClick={() => setMenu(null)} />
    </div>
  );
}

