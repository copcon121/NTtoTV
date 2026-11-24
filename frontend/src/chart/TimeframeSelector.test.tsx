import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TimeframeSelector } from "./TimeframeSelector";

function openSelector() {
  const trigger = screen.getByRole("button", { name: /Timeframe selector/ });
  fireEvent.click(trigger);
  return trigger;
}

afterEach(() => localStorage.clear());

describe("TimeframeSelector", () => {
  it("groups the presets and marks the active timeframe", () => {
    render(<TimeframeSelector value="15m" onChange={() => {}} />);
    const trigger = openSelector();
    const menu = screen.getByRole("group", { name: "Timeframes" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    for (const label of ["Seconds", "Minutes", "Hours", "Days"]) {
      expect(within(menu).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(within(menu).getByRole("button", { name: "15 Minutes" })).toHaveAttribute(
      "aria-pressed", "true",
    );
    expect(within(menu).getByRole("button", { name: "1 Week" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "1 Month" })).toBeInTheDocument();
  });

  it("changes to the chosen timeframe and closes the menu", () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1m" onChange={onChange} />);
    const trigger = openSelector();
    fireEvent.click(screen.getByRole("button", { name: "1 Week" }));
    expect(onChange.mock.calls).toEqual([["1W"]]);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("keeps the selection when the active timeframe is clicked", () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1D" onChange={onChange} />);
    openSelector();
    fireEvent.click(screen.getByRole("button", { name: "1 Day" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("collapses groups and limits options to the supplied set", () => {
    render(
      <TimeframeSelector value="5m" onChange={() => {}} timeframes={["5m", "1h"]} />,
    );
    openSelector();
    expect(screen.queryByRole("button", { name: "Days" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Minutes" }));
    expect(screen.queryByRole("button", { name: "5 Minutes" })).toBeNull();
    expect(screen.getByRole("button", { name: "1 Hour" })).toBeInTheDocument();
  });

  it("remembers pins and lets Escape dismiss the menu", () => {
    const view = render(<TimeframeSelector value="1m" onChange={() => {}} />);
    const trigger = openSelector();
    const pin = screen.getByRole("button", { name: "Pin 1 Month" });
    fireEvent.click(pin);
    expect(pin).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(pin, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    view.unmount();

    const onChange = vi.fn();
    render(<TimeframeSelector value="1m" onChange={onChange} />);
    const favorites = screen.getByRole("group", { name: "Pinned timeframes" });
    fireEvent.click(within(favorites).getByRole("button", { name: "1 Month" }));
    expect(onChange.mock.calls).toEqual([["1M"]]);
  });
});
