import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrosshairBox } from "./CrosshairBox";
import type { Bar } from "../socket/messages";

const BAR: Bar = { time: 1730313600000, open: 2345.1, high: 2346, low: 2344.8, close: 2345.7, volume: 142 };

describe("CrosshairBox", () => {
  it("renders the hovered bar's OHLCV values (Req 19.5)", () => {
    render(<CrosshairBox bar={BAR} />);
    expect(screen.getByTestId("ohlcv-open")).toHaveTextContent("2345.1");
    expect(screen.getByTestId("ohlcv-high")).toHaveTextContent("2346.0");
    expect(screen.getByTestId("ohlcv-low")).toHaveTextContent("2344.8");
    expect(screen.getByTestId("ohlcv-close")).toHaveTextContent("2345.7");
    expect(screen.getByTestId("ohlcv-volume")).toHaveTextContent("142");
  });

  it("updates the readout when the hovered bar changes (Req 19.5)", () => {
    const { rerender } = render(<CrosshairBox bar={BAR} />);
    expect(screen.getByTestId("ohlcv-close")).toHaveTextContent("2345.7");

    const next: Bar = { ...BAR, close: 2350.4, volume: 200 };
    rerender(<CrosshairBox bar={next} />);
    expect(screen.getByTestId("ohlcv-close")).toHaveTextContent("2350.4");
    expect(screen.getByTestId("ohlcv-volume")).toHaveTextContent("200");
  });

  it("shows placeholders when the crosshair is off-series", () => {
    render(<CrosshairBox bar={undefined} emptyLabel="—" />);
    for (const id of ["ohlcv-open", "ohlcv-high", "ohlcv-low", "ohlcv-close", "ohlcv-volume"]) {
      expect(screen.getByTestId(id)).toHaveTextContent("—");
    }
  });

  it("respects a custom price precision", () => {
    render(<CrosshairBox bar={BAR} pricePrecision={2} />);
    expect(screen.getByTestId("ohlcv-open")).toHaveTextContent("2345.10");
  });
});
