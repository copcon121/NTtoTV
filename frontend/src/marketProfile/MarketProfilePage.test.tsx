import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketProfilePage } from "./MarketProfilePage";

describe("MarketProfilePage price display", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("switches between line and OHLC bar display", () => {
    render(<MarketProfilePage />);

    const barButton = screen.getByRole("button", { name: "Bar" });
    const lineButton = screen.getByRole("button", { name: "Line" });
    expect(lineButton).toHaveAttribute("aria-pressed", "true");
    expect(barButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(barButton);

    expect(barButton).toHaveAttribute("aria-pressed", "true");
    expect(lineButton).toHaveAttribute("aria-pressed", "false");
  });
});
