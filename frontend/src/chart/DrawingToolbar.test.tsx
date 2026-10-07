import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DrawingToolbar } from "./DrawingToolbar";
import { DRAWING_TOOLS } from "./drawings/types";

describe("DrawingToolbar", () => {
  it("puts the order drawing tool first", () => {
    render(
      <DrawingToolbar
        activeTool={null}
        drawingCount={0}
        onToolSelect={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName("Order");
  });

  it("renders all drawing tools and forwards delete all", () => {
    const onToolSelect = vi.fn();
    const onDeleteAll = vi.fn();

    render(
      <DrawingToolbar
        className="drawing-toolbar-mobile"
        activeTool={null}
        drawingCount={2}
        onToolSelect={onToolSelect}
        onDeleteAll={onDeleteAll}
      />,
    );

    for (const tool of DRAWING_TOOLS) {
      fireEvent.click(screen.getByRole("button", { name: tool.label }));
      expect(onToolSelect).toHaveBeenLastCalledWith(tool.type);
    }

    fireEvent.click(screen.getByRole("button", { name: "Delete all drawings (2)" }));
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
  });

  it("toggles hide-all indicators beside the delete button", () => {
    const onIndicatorsVisibleChange = vi.fn();

    render(
      <DrawingToolbar
        activeTool={null}
        drawingCount={0}
        indicatorsVisible
        onToolSelect={vi.fn()}
        onDeleteAll={vi.fn()}
        onIndicatorsVisibleChange={onIndicatorsVisibleChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide all indicators" }));
    expect(onIndicatorsVisibleChange).toHaveBeenCalledWith(false);
  });

  it("offers restore when indicators are hidden", () => {
    render(
      <DrawingToolbar
        activeTool={null}
        drawingCount={0}
        indicatorsVisible={false}
        onToolSelect={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Restore indicators" }),
      ).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles live ENTRY, SL, and TP order levels", () => {
    const onOrderLevelsVisibleChange = vi.fn();

    const { rerender } = render(
      <DrawingToolbar
        activeTool={null}
        drawingCount={0}
        orderLevelsVisible
        onToolSelect={vi.fn()}
        onDeleteAll={vi.fn()}
        onOrderLevelsVisibleChange={onOrderLevelsVisibleChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide order levels" }));
    expect(onOrderLevelsVisibleChange).toHaveBeenCalledWith(false);

    rerender(
      <DrawingToolbar
        activeTool={null}
        drawingCount={0}
        orderLevelsVisible={false}
        onToolSelect={vi.fn()}
        onDeleteAll={vi.fn()}
        onOrderLevelsVisibleChange={onOrderLevelsVisibleChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Show order levels" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows date range and hides the retired vertical line tool", () => {
    render(
      <DrawingToolbar
        activeTool={null}
        drawingCount={0}
        onToolSelect={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Date Range" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vertical Line" })).toBeNull();
  });

  it("toggles the mobile toolbar open and closed", () => {
    render(
      <DrawingToolbar
        className="drawing-toolbar-mobile"
        activeTool={null}
        drawingCount={0}
        onToolSelect={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Drawing tools" });
    const toggle = screen.getByRole("button", { name: "Open drawing tools" });
    expect(toolbar).toHaveClass("is-collapsed");

    fireEvent.click(toggle);
    expect(toolbar).toHaveClass("is-open");
    expect(
      screen.getByRole("button", { name: "Close drawing tools" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Close drawing tools" }));
    expect(toolbar).toHaveClass("is-collapsed");
  });
});
