import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarReplayControls, type BarReplayControlsProps } from "./BarReplayControls";

function props(overrides: Partial<BarReplayControlsProps> = {}): BarReplayControlsProps {
  return {
    phase: "idle",
    playing: false,
    speed: 1,
    currentBar: 0,
    totalBars: 100,
    onCancelSelection: vi.fn(),
    onTogglePlaying: vi.fn(),
    onStepBack: vi.fn(),
    onStepForward: vi.fn(),
    onSpeedChange: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  };
}

describe("BarReplayControls", () => {
  it("does not render an idle trigger inside the chart", () => {
    const { container } = render(<BarReplayControls {...props()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders playback, step, speed and live controls", () => {
    const input = props({
      phase: "active",
      currentBar: 25,
    });
    render(<BarReplayControls {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Replay speed" }), {
      target: { value: "2" },
    });
    expect(input.onStepForward).toHaveBeenCalledOnce();
    expect(input.onSpeedChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("option", { name: "10x" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "20x" })).toBeInTheDocument();
    expect(screen.queryByText(/25\/100/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live" })).toBeInTheDocument();
  });
});
