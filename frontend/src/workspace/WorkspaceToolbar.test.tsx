import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THEME, THEME_PRESETS } from "./themes";
import type { Workspace } from "./types";
import { WorkspaceToolbar, type WorkspaceToolbarProps } from "./WorkspaceToolbar";

const workspaces: Workspace[] = Array.from({ length: 30 }, (_, index) => ({
  id: `workspace-${index + 1}`,
  name: `Workspace ${index + 1}`,
  createdAt: 1,
  updatedAt: 1,
  payload: {
    version: 1,
    template: "scratch",
    panels: [],
    layout: { columnSplit: 50, firstRowSplit: 50 },
    theme: DEFAULT_THEME,
  },
}));

function renderToolbar(overrides: Partial<WorkspaceToolbarProps> = {}) {
  const props: WorkspaceToolbarProps = {
    workspaces,
    activeWorkspaceId: workspaces[0].id,
    theme: DEFAULT_THEME,
    fullscreen: false,
    requestPending: false,
    hasActiveWorkspace: true,
    panelCount: 1,
    chartCount: 1,
    hasTradingAccount: false,
    accountControls: <button type="button">Login</button>,
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onAddPanel: vi.fn(),
    onThemeChange: vi.fn(),
    onFullscreen: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceToolbar {...props} />);
  return props;
}

afterEach(() => vi.restoreAllMocks());

describe("WorkspaceToolbar", () => {
  it("lists every workspace in the mobile picker and selects one near the end", () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Select workspace" }));

    const picker = screen.getByRole("dialog", { name: "Workspace list" });
    expect(within(picker).getAllByRole("listitem")).toHaveLength(30);
    expect(within(picker).getByRole("button", { name: "Workspace 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(picker).getByRole("button", { name: "Workspace 30" }));

    expect(props.onSelect).toHaveBeenCalledWith("workspace-30");
    expect(screen.queryByRole("dialog", { name: "Workspace list" })).not.toBeInTheDocument();
  });

  it("renames a workspace from its visible mobile action", () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Select workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename workspace Workspace 30" }));

    const dialog = screen.getByRole("dialog", { name: "Rename workspace" });
    fireEvent.change(within(dialog).getByLabelText("Workspace name"), { target: { value: "Gold chart" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(props.onRename).toHaveBeenCalledWith("workspace-30", "Gold chart");
    expect(screen.getByRole("button", { name: "Select workspace" })).toHaveFocus();
  });

  it("uses the existing confirmation when closing a workspace from mobile", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const props = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Select workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Close workspace Workspace 30" }));

    expect(confirm).toHaveBeenCalledWith('Delete "Workspace 30"?');
    expect(props.onRemove).toHaveBeenCalledWith("workspace-30");
  });

  it("keeps the workspace when its close confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const props = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Select workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Close workspace Workspace 1" }));

    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it("opens grouped actions and keeps widgets, themes, fullscreen and account controls available", () => {
    const props = renderToolbar();
    const actions = screen.getByRole("button", { name: "Workspace actions" });
    fireEvent.click(actions);
    expect(actions).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "＋ Add Widgets" }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Widget catalog" })).getByRole("menuitem", { name: "Liquidity" }));
    expect(props.onAddPanel).toHaveBeenCalledWith("liquidity");

    fireEvent.click(actions);
    fireEvent.click(screen.getByRole("button", { name: "Theme Settings" }));
    expect(within(screen.getByRole("dialog", { name: "Theme Settings" })).getByRole("button", { name: "+ Add theme" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Theme Settings" })).getByRole("button", { name: "System Light" }));
    expect(props.onThemeChange).toHaveBeenCalledWith(THEME_PRESETS.find((theme) => theme.preset === "System Light"));

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(props.onFullscreen).toHaveBeenCalledOnce();
  });

  it("preserves desktop tabs and their rename context menu", () => {
    const props = renderToolbar();
    const tab = screen.getByRole("tab", { name: "Workspace 2" });
    fireEvent.click(tab);
    expect(props.onSelect).toHaveBeenCalledWith("workspace-2");

    fireEvent.contextMenu(tab);
    fireEvent.click(within(screen.getByRole("menu", { name: "Actions for Workspace 2" })).getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("dialog", { name: "Rename workspace" })).toBeInTheDocument();
  });
});
