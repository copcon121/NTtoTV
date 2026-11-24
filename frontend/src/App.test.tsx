import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App layout chrome", () => {
  it("renders the TradingView-like layout regions (Req 19.1)", () => {
    render(<App />);
    // Toolbar with symbol/contract label, timeframe selector, status indicator.
    expect(screen.getByRole("toolbar", { name: "Chart toolbar" })).toBeInTheDocument();
    expect(screen.getByTestId("symbol")).toHaveTextContent("GC");
    expect(screen.getByRole("button", { name: "Timeframe selector, 1 Minute" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Chart area + crosshair OHLCV box.
    expect(screen.getByLabelText("OHLCV")).toBeInTheDocument();
  });

  it("hides the market order bar until the user logs in", () => {
    render(<App />);

    expect(
      screen.queryByRole("region", { name: "Market orders" }),
    ).not.toBeInTheDocument();
  });

  it("switches the active timeframe when a selector option is clicked", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Timeframe selector, 1 Minute" }));
    fireEvent.click(screen.getByRole("button", { name: "1 Month" }));
    expect(screen.getByRole("button", { name: "Timeframe selector, 1 Month" }))
      .toHaveAttribute("aria-expanded", "false");
  });
});
