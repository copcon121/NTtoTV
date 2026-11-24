import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspacePanel } from "./types";
import { WorkspaceBoard } from "./WorkspaceBoard";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const panels: WorkspacePanel[] = [
  { id: "chart", type: "chart" },
  { id: "account", type: "tradingAccount" },
];

function props(overrides: Partial<ComponentProps<typeof WorkspaceBoard>> = {}): ComponentProps<typeof WorkspaceBoard> {
  return {
    panels,
    layout: { columnSplit: 50, firstRowSplit: 50 },
    onSelect: vi.fn(),
    onFullscreen: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    renderChartControls: () => <span>Chart controls</span>,
    renderPanel: (panel) => <span>{panel.type === "tradingAccount" ? "Broker account identity" : "Chart content"}</span>,
    ...overrides,
  };
}

describe("WorkspaceBoard trading account dock", () => {
  it.each([true, false])("keeps account settings beside dock and close in compact=%s mode", (compactTradingAccount) => {
    const onAccountSettings = vi.fn();
    const onResize = vi.fn();
    const onRemove = vi.fn();
    render(<WorkspaceBoard {...props({ compactTradingAccount, onAccountSettings, onResize, onRemove })} />);
    const account = screen.getByRole("region", { name: "Trading Account" });
    const gear = within(account).getByRole("button", { name: "Account settings" });
    const dock = within(account).getByRole("button", { name: "Dock to right" });
    const close = within(account).getByRole("button", { name: "Remove Trading Account panel" });
    const lock = within(account).getByRole("button", { name: "Keep Trading Account visible when maximizing widgets" });
    expect(gear).toHaveAttribute("title", "Account settings");
    expect(gear).toHaveAttribute("type", "button");
    expect(gear.nextElementSibling).toBe(dock);
    expect(dock.nextElementSibling).toBe(lock);
    expect(lock.nextElementSibling).toBe(close);
    gear.focus();
    expect(gear).toHaveFocus();
    fireEvent.click(gear);
    expect(onAccountSettings).toHaveBeenCalledOnce();
    expect(onResize).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(dock);
    expect(onResize).toHaveBeenCalledWith(expect.objectContaining({ tradingAccountPosition: "right" }));
    fireEvent.click(close);
    expect(onRemove).toHaveBeenCalledWith("account");
  });

  it("omits account settings when the caller does not provide a connected-account action", () => {
    render(<WorkspaceBoard {...props({ compactTradingAccount: true })} />);
    expect(screen.queryByRole("button", { name: "Account settings" })).not.toBeInTheDocument();
  });

  it("uses content height for the account even when an older workspace saved a large split", () => {
    const normal = props();
    const { container, rerender } = render(<WorkspaceBoard {...normal} />);
    const board = container.firstElementChild as HTMLElement;
    const rowTracks = board.style.gridTemplateRows;

    rerender(<WorkspaceBoard {...normal} layout={{ ...normal.layout, tradingAccountSplit: 50 }} />);

    expect(board.style.gridTemplateRows).toBe(rowTracks);
    expect(rowTracks).toContain("repeat(1, max-content)");
    expect(rowTracks).not.toContain("132px");
    expect(screen.queryByRole("separator", { name: "Resize trading account" })).not.toBeInTheDocument();
  });

  it("removes the authenticated account title row while retaining its close control and content", () => {
    const onRemove = vi.fn();
    render(<WorkspaceBoard {...props({ compactTradingAccount: true, onRemove })} />);

    const account = screen.getByRole("region", { name: "Trading Account" });
    expect(within(account).queryByText("Trading Account")).not.toBeInTheDocument();
    expect(within(account).getByText("Broker account identity")).toBeInTheDocument();
    fireEvent.click(within(account).getByRole("button", { name: "Remove Trading Account panel" }));
    expect(onRemove).toHaveBeenCalledWith("account");
  });

  it("keeps the guest header and leaves no extra content track for an account-only workspace", () => {
    const { container } = render(<WorkspaceBoard {...props({ panels: [panels[1]] })} />);

    expect(screen.getByText("Trading Account")).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).style.gridTemplateRows).toBe("repeat(1, max-content)");
  });

  it("allocates compact account tracks below stacked mobile panels and restores fullscreen cleanly", () => {
    const mobilePanels: WorkspacePanel[] = [panels[0], { id: "profile", type: "marketProfile" }, panels[1]];
    const initial = props({ panels: mobilePanels, compactTradingAccount: true });
    const { container, rerender } = render(<WorkspaceBoard {...initial} />);
    const board = container.firstElementChild as HTMLElement;
    const tracks = board.style.gridTemplateRows;

    expect(board.style.getPropertyValue("--mobile-row-tracks")).toBe("repeat(2, minmax(260px, 1fr)) repeat(1, max-content)");
    rerender(<WorkspaceBoard {...initial} fullscreenId="chart" />);
    expect(board.style.gridTemplateRows).toBe("minmax(0, 1fr)");
    expect(screen.queryByRole("region", { name: "Trading Account" })).not.toBeInTheDocument();
    rerender(<WorkspaceBoard {...initial} />);
    expect(board.style.gridTemplateRows).toBe(tracks);
  });
});

describe("WorkspaceBoard panel dragging and reordering (TakeProfit behavior)", () => {
  const multiPanels: WorkspacePanel[] = [
    { id: "chart-1", type: "chart" },
    { id: "footprint-1", type: "footprint" },
    { id: "aiscan-1", type: "aiScan" },
  ];

  it("provides uniform top-left drag grip handles on all widget types when multiple panels exist", () => {
    render(<WorkspaceBoard {...props({ panels: multiPanels })} />);

    const chartGrip = screen.getByRole("button", { name: "Drag to move Chart panel" });
    const footprintGrip = screen.getByRole("button", { name: "Drag to move Footprint panel" });
    const aiScanGrip = screen.getByRole("button", { name: "Drag to move AI Scan panel" });

    expect(chartGrip).toBeInTheDocument();
    expect(footprintGrip).toBeInTheDocument();
    expect(aiScanGrip).toBeInTheDocument();
    expect(chartGrip).toHaveAttribute("draggable", "true");
    expect(footprintGrip).toHaveAttribute("draggable", "true");
    expect(aiScanGrip).toHaveAttribute("draggable", "true");
  });

  it("reorders panels when dragging and dropping onto another panel", () => {
    const onMove = vi.fn();
    const { container } = render(<WorkspaceBoard {...props({ panels: multiPanels, onMove })} />);

    const chartGrip = screen.getByRole("button", { name: "Drag to move Chart panel" });
    const footprintPanel = container.querySelector("#workspace-panel-footprint-1") as HTMLElement;

    // Simulate drag start
    fireEvent.dragStart(chartGrip, {
      dataTransfer: { setData: vi.fn(), effectAllowed: "move" },
    });

    // Simulate drag over target panel
    fireEvent.dragOver(footprintPanel, {
      dataTransfer: { dropEffect: "move" },
    });

    expect(footprintPanel).toHaveClass("is-drop-target");

    // Simulate drop
    fireEvent.drop(footprintPanel);

    expect(onMove).toHaveBeenCalledWith("chart-1", "footprint-1");
  });

  it("supports keyboard reordering using arrow keys on the grip handle", () => {
    const onMove = vi.fn();
    render(<WorkspaceBoard {...props({ panels: multiPanels, onMove })} />);

    const footprintGrip = screen.getByRole("button", { name: "Drag to move Footprint panel" });

    // ArrowLeft moves earlier (to chart-1)
    fireEvent.keyDown(footprintGrip, { key: "ArrowLeft" });
    expect(onMove).toHaveBeenCalledWith("footprint-1", "chart-1");

    // ArrowRight moves later (to aiscan-1)
    fireEvent.keyDown(footprintGrip, { key: "ArrowRight" });
    expect(onMove).toHaveBeenCalledWith("footprint-1", "aiscan-1");
  });

  it("cancels dragging cleanly on Escape without reordering", () => {
    const onMove = vi.fn();
    const { container } = render(<WorkspaceBoard {...props({ panels: multiPanels, onMove })} />);

    const chartGrip = screen.getByRole("button", { name: "Drag to move Chart panel" });
    const footprintPanel = container.querySelector("#workspace-panel-footprint-1") as HTMLElement;

    fireEvent.dragStart(chartGrip, { dataTransfer: { setData: vi.fn(), effectAllowed: "move" } });
    fireEvent.dragOver(footprintPanel, { dataTransfer: { dropEffect: "move" } });
    expect(footprintPanel).toHaveClass("is-drop-target");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(footprintPanel).not.toHaveClass("is-drop-target");

    fireEvent.drop(footprintPanel);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not show drag handles when only a single content panel exists", () => {
    render(<WorkspaceBoard {...props({ panels: [{ id: "chart-1", type: "chart" }] })} />);

    expect(screen.queryByRole("button", { name: "Drag to move Chart panel" })).not.toBeInTheDocument();
  });

  it("hides drag handles and disables dragging when in fullscreen", () => {
    render(<WorkspaceBoard {...props({ panels: multiPanels, fullscreenId: "chart-1" })} />);

    expect(screen.queryByRole("button", { name: "Drag to move Chart panel" })).not.toBeInTheDocument();
  });
});

describe("WorkspaceBoard Trading Account right and bottom docking", () => {
  const accountWithCharts: WorkspacePanel[] = [
    { id: "chart-1", type: "chart" },
    { id: "chart-2", type: "chart" },
    { id: "account", type: "tradingAccount" },
  ];

  it("renders with right dock layout when tradingAccountPosition is right", () => {
    const { container } = render(
      <WorkspaceBoard
        {...props({
          panels: accountWithCharts,
          layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountPosition: "right" },
        })}
      />,
    );
    const board = container.firstElementChild as HTMLElement;
    expect(board).toHaveClass("has-right-dock");
    expect(board.style.gridTemplateColumns).toContain("minmax(280px, 360px)");

    const accountPanel = container.querySelector("#workspace-panel-account") as HTMLElement;
    expect(accountPanel).toHaveClass("is-right-dock");
    expect(accountPanel.style.gridColumn).toBe("3 / 4");
  });

  it("toggles trading account dock between bottom and right via the dock toggle button", () => {
    const onResize = vi.fn();
    const { rerender } = render(
      <WorkspaceBoard
        {...props({
          panels: accountWithCharts,
          layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountPosition: "bottom" },
          onResize,
        })}
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: "Dock to right" });
    fireEvent.click(toggleBtn);

    expect(onResize).toHaveBeenCalledWith(
      expect.objectContaining({ tradingAccountPosition: "right" }),
    );

    rerender(
      <WorkspaceBoard
        {...props({
          panels: accountWithCharts,
          layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountPosition: "right" },
          onResize,
        })}
      />,
    );

    const toggleBottomBtn = screen.getByRole("button", { name: "Dock to bottom" });
    fireEvent.click(toggleBottomBtn);

    expect(onResize).toHaveBeenCalledWith(
      expect.objectContaining({ tradingAccountPosition: "bottom" }),
    );
  });

  it("provides dock toggle in compact account mode", () => {
    const onResize = vi.fn();
    render(
      <WorkspaceBoard
        {...props({
          panels: accountWithCharts,
          compactTradingAccount: true,
          layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountPosition: "bottom" },
          onResize,
        })}
      />,
    );

    const compactToggle = screen.getByRole("button", { name: "Dock to right" });
    expect(compactToggle).toBeInTheDocument();
    fireEvent.click(compactToggle);
    expect(onResize).toHaveBeenCalledWith(
      expect.objectContaining({ tradingAccountPosition: "right" }),
    );
  });
});

describe("WorkspaceBoard wide and compact layouts", () => {
  const widePanels: WorkspacePanel[] = [
    { id: "chart", type: "chart" }, { id: "fp", type: "footprint" }, { id: "lq", type: "liquidity" },
    { id: "scan", type: "aiScan" }, { id: "mp", type: "marketProfile" }, { id: "account", type: "tradingAccount" },
  ];

  it("places three widgets across with a separate right dock and two working resize dividers", () => {
    vi.stubGlobal("innerWidth", 1920);
    const onResize = vi.fn();
    const onMove = vi.fn();
    const layout = { columnSplit: 61, firstRowSplit: 43, threeColumnSplits: [28, 65] as [number, number], tradingAccountPosition: "right" as const };
    const { container } = render(<WorkspaceBoard {...props({ panels: widePanels, layout, onResize, onMove })} />);
    const board = container.firstElementChild as HTMLElement;
    expect(board.dataset.contentColumns).toBe("3");
    expect(container.querySelector<HTMLElement>("#workspace-panel-lq")!.style.gridColumn).toBe("3 / span 1");
    expect(container.querySelector<HTMLElement>("#workspace-panel-account")!.style.gridColumn).toBe("4 / 5");
    expect(container.querySelector<HTMLElement>("#workspace-panel-mp")!.style.gridColumn).toBe("2 / span 2");
    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize columns 2 and 3" }), { key: "ArrowRight" });
    expect(onResize).toHaveBeenCalledWith({ ...layout, threeColumnSplits: [28, 70] });
    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize columns 1 and 2" }), { key: "ArrowLeft" });
    expect(onResize).toHaveBeenCalledWith({ ...layout, threeColumnSplits: [23, 65] });
    fireEvent.keyDown(screen.getByRole("button", { name: "Drag to move AI Scan panel" }), { key: "ArrowUp" });
    expect(onMove).toHaveBeenCalledWith("scan", "chart");
    fireEvent.dragStart(screen.getByRole("button", { name: "Drag to move Liquidity panel" }), { dataTransfer: { setData: vi.fn() } });
    fireEvent.drop(container.querySelector("#workspace-panel-chart")!);
    expect(onMove).toHaveBeenCalledWith("lq", "chart");
  });

  it("responds to board resizing without saving over positions, and restores the dock after mobile/fullscreen", () => {
    vi.stubGlobal("innerWidth", 3840);
    let width = 3840;
    let notifyResize: () => void = () => {};
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width, height: 900, left: 0, top: 0 } as DOMRect));
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { notifyResize = callback; } observe() {} disconnect() {} });
    const onResize = vi.fn();
    const initial = props({ panels: widePanels, onResize, layout: { columnSplit: 61, firstRowSplit: 43, threeColumnSplits: [28, 65], tradingAccountPosition: "right" } });
    const { container, rerender } = render(<WorkspaceBoard {...initial} />);
    const board = container.firstElementChild as HTMLElement;
    expect(board.dataset.contentColumns).toBe("3");
    width = 1200;
    actResize();
    expect(board.dataset.contentColumns).toBe("2");
    expect(board.style.gridTemplateColumns).toContain("61fr");
    width = 390;
    actResize();
    expect(board.dataset.contentColumns).toBe("1");
    expect(board).not.toHaveClass("has-right-dock");
    expect(container.querySelector<HTMLElement>("#workspace-panel-lq")!.style.gridRow).toBe("3");
    width = 3840;
    actResize();
    expect(board).toHaveClass("has-right-dock");
    expect(board.style.gridTemplateColumns).toContain("28fr");
    rerender(<WorkspaceBoard {...initial} fullscreenId="lq" />);
    expect(board.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
    expect(container.querySelector<HTMLElement>("#workspace-panel-lq")!.style.gridRow).toBe("1");
    rerender(<WorkspaceBoard {...initial} />);
    expect(board.dataset.contentColumns).toBe("3");
    expect(onResize).not.toHaveBeenCalled();

    function actResize() { act(() => notifyResize()); }
  });

  it("uses the compact menu layout in short iPhone landscape dimensions", () => {
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    const { container } = render(<WorkspaceBoard {...props({ panels: widePanels, layout: { columnSplit: 61, firstRowSplit: 43, tradingAccountPosition: "right" } })} />);
    expect(container.firstElementChild).toHaveAttribute("data-compact", "true");
    expect(container.firstElementChild).not.toHaveClass("has-right-dock");
  });

  it("allows changing the saved right-dock preference while the account is stacked on mobile", () => {
    vi.stubGlobal("innerWidth", 390);
    const onResize = vi.fn();
    render(<WorkspaceBoard {...props({ panels: widePanels, onResize, compactTradingAccount: true, layout: { columnSplit: 61, firstRowSplit: 43, tradingAccountPosition: "right" } })} />);
    fireEvent.click(screen.getByRole("button", { name: "Dock to bottom" }));
    expect(onResize).toHaveBeenCalledWith({ columnSplit: 61, firstRowSplit: 43, tradingAccountPosition: "bottom" });
  });

  it("toggles tradingAccountLocked between true and false via the lock button", () => {
    const onResize = vi.fn();
    const { rerender } = render(<WorkspaceBoard {...props({ onResize, layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountLocked: false } })} />);
    const lockBtn = screen.getByRole("button", { name: "Keep Trading Account visible when maximizing widgets" });
    expect(lockBtn).toHaveAttribute("aria-pressed", "false");
    expect(lockBtn).toHaveAttribute("title", "Lock Trading Account");
    fireEvent.click(lockBtn);
    expect(onResize).toHaveBeenCalledWith(expect.objectContaining({ tradingAccountLocked: true }));

    rerender(<WorkspaceBoard {...props({ onResize, layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountLocked: true } })} />);
    const lockedBtn = screen.getByRole("button", { name: "Keep Trading Account visible when maximizing widgets" });
    expect(lockedBtn).toHaveAttribute("aria-pressed", "true");
    expect(lockedBtn).toHaveAttribute("title", "Unlock Trading Account");
    fireEvent.click(lockedBtn);
    expect(onResize).toHaveBeenCalledWith(expect.objectContaining({ tradingAccountLocked: false }));
  });

  it("hides unlocked account when maximizing a widget while retaining mounted input state", () => {
    const renderPanel = (panel: WorkspacePanel) => panel.type === "tradingAccount" ? (
      <div>
        <label htmlFor="lot-input">Lot size</label>
        <input id="lot-input" defaultValue="0.05" />
      </div>
    ) : <div>Chart content</div>;

    const initial = props({ renderPanel, layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountLocked: false } });
    const { container, rerender } = render(<WorkspaceBoard {...initial} />);

    const accountPanel = container.querySelector("#workspace-panel-account") as HTMLElement;
    expect(accountPanel).not.toHaveAttribute("hidden");

    const input = screen.getByLabelText("Lot size") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.25" } });
    expect(input.value).toBe("0.25");

    // Maximize chart
    rerender(<WorkspaceBoard {...initial} fullscreenId="chart" />);
    // Account panel is hidden via HTML hidden attribute, but still mounted in DOM
    expect(accountPanel).toHaveAttribute("hidden");
    // Input element is still in the document and retains its changed value
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("0.25");

    // Restore workspace
    rerender(<WorkspaceBoard {...initial} fullscreenId={undefined} />);
    expect(accountPanel).not.toHaveAttribute("hidden");
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("0.25");
  });

  it("keeps locked account visible when maximizing a widget in bottom dock", () => {
    const initial = props({ layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountPosition: "bottom", tradingAccountLocked: true } });
    const { container, rerender } = render(<WorkspaceBoard {...initial} />);
    const board = container.firstElementChild as HTMLElement;

    expect(board).toHaveAttribute("data-account-locked", "true");
    const accountPanel = container.querySelector("#workspace-panel-account") as HTMLElement;
    expect(accountPanel).not.toHaveAttribute("hidden");

    // Maximize chart: account remains visible
    rerender(<WorkspaceBoard {...initial} fullscreenId="chart" />);
    expect(accountPanel).not.toHaveAttribute("hidden");
    expect(board.style.gridTemplateRows).toContain("max-content");

    // Restore
    rerender(<WorkspaceBoard {...initial} fullscreenId={undefined} />);
    expect(accountPanel).not.toHaveAttribute("hidden");
  });

  it("keeps locked account visible in right dock when maximizing a widget", () => {
    const initial = props({ layout: { columnSplit: 50, firstRowSplit: 50, tradingAccountPosition: "right", tradingAccountLocked: true } });
    const { container, rerender } = render(<WorkspaceBoard {...initial} />);
    const board = container.firstElementChild as HTMLElement;

    expect(board).toHaveClass("has-right-dock");
    const accountPanel = container.querySelector("#workspace-panel-account") as HTMLElement;
    expect(accountPanel).toHaveClass("is-right-dock");
    expect(accountPanel).not.toHaveAttribute("hidden");

    // Maximize chart: account remains visible in right dock
    rerender(<WorkspaceBoard {...initial} fullscreenId="chart" />);
    expect(board).toHaveClass("has-right-dock");
    expect(accountPanel).not.toHaveAttribute("hidden");
    expect(accountPanel.style.gridColumn).toBe("2 / 3");

    // Restore
    rerender(<WorkspaceBoard {...initial} fullscreenId={undefined} />);
    expect(accountPanel).not.toHaveAttribute("hidden");
  });

  it("fires onSelect and applies is-selected class on pointerDown and focus for any panel", () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(<WorkspaceBoard {...props({ onSelect, selectedId: "chart" })} />);

    const chartPanel = container.querySelector("#workspace-panel-chart") as HTMLElement;
    const accountPanel = container.querySelector("#workspace-panel-account") as HTMLElement;

    expect(chartPanel).toHaveClass("is-selected");
    expect(accountPanel).not.toHaveClass("is-selected");

    fireEvent.pointerDown(accountPanel);
    expect(onSelect).toHaveBeenCalledWith("account");

    fireEvent.focus(accountPanel);
    expect(onSelect).toHaveBeenCalledWith("account");

    rerender(<WorkspaceBoard {...props({ onSelect, selectedId: "account" })} />);
    expect(accountPanel).toHaveClass("is-selected");
    expect(chartPanel).not.toHaveClass("is-selected");

    fireEvent.pointerDown(chartPanel);
    expect(onSelect).toHaveBeenCalledWith("chart");
  });

  it("resizes the second wide divider from pointer coordinates measured before the account dock", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    vi.stubGlobal("innerWidth", 1920);
    const onResize = vi.fn();
    const { container } = render(<WorkspaceBoard {...props({ panels: widePanels, onResize, layout: { columnSplit: 61, firstRowSplit: 43, tradingAccountPosition: "right" } })} />);
    vi.spyOn(container.firstElementChild!, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1920, height: 900 } as DOMRect);
    vi.spyOn(container.querySelector("#workspace-panel-account")!, "getBoundingClientRect").mockReturnValue({ left: 1557 } as DOMRect);
    const separator = screen.getByRole("separator", { name: "Resize columns 2 and 3" });
    Object.assign(separator, { setPointerCapture: vi.fn(), hasPointerCapture: () => true });
    fireEvent.pointerDown(separator, { clientX: 1040, button: 0 });
    fireEvent.pointerMove(separator, { clientX: 1162 });
    expect(separator).toHaveAttribute("aria-valuenow", "75");
    fireEvent.pointerUp(separator, { clientX: 1162 });
    expect(onResize).toHaveBeenCalledWith({ columnSplit: 61, firstRowSplit: 43, tradingAccountPosition: "right", threeColumnSplits: [33, 75] });
  });

  it("applies the current pointer dock target on release and cleans up Escape cancellation", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    vi.stubGlobal("innerWidth", 1920);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1920, height: 900 } as DOMRect);
    const onResize = vi.fn();
    const { container } = render(<WorkspaceBoard {...props({ panels: widePanels, onResize })} />);
    const grip = screen.getByRole("button", { name: "Drag to move Trading Account panel" });
    fireEvent.pointerDown(grip, { button: 0, clientX: 100, clientY: 800 });
    fireEvent.pointerMove(window, { clientX: 1800, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 1800, clientY: 300 });
    expect(onResize).toHaveBeenCalledWith(expect.objectContaining({ tradingAccountPosition: "right" }));
    onResize.mockClear();
    fireEvent.pointerDown(grip, { button: 0, clientX: 100, clientY: 800 });
    fireEvent.pointerMove(window, { clientX: 1800, clientY: 300 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(window, { clientX: 1800, clientY: 300 });
    expect(onResize).not.toHaveBeenCalled();
    expect(container.querySelector(".workspace-dock-overlay")).not.toBeInTheDocument();
  });

  it("configures compact mobile single-content grid with minmax(0, 1fr) and max-content", () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    const { container } = render(<WorkspaceBoard {...props({ compactTradingAccount: true })} />);
    const board = container.firstElementChild as HTMLElement;
    expect(board).toHaveAttribute("data-compact", "true");
    expect(board.style.getPropertyValue("--mobile-row-tracks")).toBe("minmax(0, 1fr) repeat(1, max-content)");
    expect(board).toHaveClass("is-single");
    expect(board).toHaveClass("has-trading-account");
  });
});
