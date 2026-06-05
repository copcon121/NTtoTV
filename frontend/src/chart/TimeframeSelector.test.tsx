import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TimeframeSelector, TIMEFRAMES } from "./TimeframeSelector";

describe("TimeframeSelector", () => {
  it("renders the full supported timeframe set in order (Req 9.1)", () => {
    render(<TimeframeSelector value="1m" onChange={() => {}} />);
    const labels = screen.getAllByRole("radio").map((b) => b.textContent);
    expect(labels).toEqual(["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D"]);
    expect(TIMEFRAMES).toHaveLength(8);
  });

  it("marks the active timeframe as checked", () => {
    render(<TimeframeSelector value="15m" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "15m" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "1m" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("calls onChange with the selected timeframe (Req 19.1)", () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1m" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "1h" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("1h");
  });

  it("does not emit a change when the active timeframe is clicked", () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1D" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "1D" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("honors a custom timeframe set", () => {
    render(
      <TimeframeSelector value="5m" onChange={() => {}} timeframes={["5m", "1h"]} />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});
