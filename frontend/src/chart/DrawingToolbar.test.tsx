import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DrawingToolbar } from "./DrawingToolbar";
import { DRAWING_TOOLS } from "./drawings/types";

describe("DrawingToolbar", () => {
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
});
