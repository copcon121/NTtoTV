import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App layout chrome", () => {
  it("renders the TradingView-like layout regions (Req 19.1)", () => {
    render(<App />);
    // Toolbar with symbol/contract label, timeframe selector, status indicator.
    expect(screen.getByRole("toolbar", { name: "Chart toolbar" })).toBeInTheDocument();
    expect(screen.getByTestId("symbol")).toHaveTextContent("GC");
    expect(screen.getByRole("radiogroup", { name: "Timeframe selector" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Chart area + crosshair OHLCV box.
    expect(screen.getByLabelText("OHLCV")).toBeInTheDocument();
  });

  it("switches the active timeframe when a selector option is clicked", () => {
    render(<App />);
    expect(screen.getByRole("radio", { name: "1m" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "5m" }));
    expect(screen.getByRole("radio", { name: "5m" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "1m" })).toHaveAttribute("aria-checked", "false");
  });
});
