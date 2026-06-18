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
    const onFixedRangeProfileModeChange = vi.fn();
    const onDeleteAll = vi.fn();

    render(
      <DrawingToolbar
        className="drawing-toolbar-mobile"
        activeTool={null}
        drawingCount={2}
        fixedRangeProfileMode="volume"
        onToolSelect={onToolSelect}
        onFixedRangeProfileModeChange={onFixedRangeProfileModeChange}
        onDeleteAll={onDeleteAll}
      />,
    );

    for (const tool of DRAWING_TOOLS) {
      fireEvent.click(screen.getByRole("button", { name: tool.label }));
      expect(onToolSelect).toHaveBeenLastCalledWith(tool.type);
    }

    expect(screen.getByRole("button", { name: "Volume fixed profile" }))
      .toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Bid/ask fixed profile" }));
    expect(onFixedRangeProfileModeChange).toHaveBeenCalledWith("bidAsk");

    fireEvent.click(screen.getByRole("button", { name: "Delete all drawings (2)" }));
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
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
