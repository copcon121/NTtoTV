import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketOrderBar } from "./MarketOrderBar";

const settings = {
  volumeLots: 0.1,
  slDistanceGc: 3,
  tpDistanceGc: 6,
};

describe("MarketOrderBar", () => {
  it("keeps the bottom login action hidden when the user is not authenticated", () => {
    render(
      <MarketOrderBar
        openOrderCount={0}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Fake" })).not.toBeInTheDocument();
  });

  it("keeps trading actions hidden when authenticated without MT5 account", () => {
    render(
      <MarketOrderBar
        openOrderCount={0}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BUY" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SELL" })).not.toBeInTheDocument();
  });

  it("shows verified account balance when connected", () => {
    render(
      <MarketOrderBar
        account={{
          accountId: "acct",
          login: 123,
          server: "Exness-Demo",
          tradeMode: "demo",
          currency: "USD",
          balance: 10000,
          equity: 9999.5,
        }}
        openOrderCount={0}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(screen.getByText("Balance 10,000.00 USD")).toBeInTheDocument();
    expect(screen.getByText("Equity 9,999.50 USD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "BUY" })).toBeInTheDocument();
  });

  it("lets mobile users clear and replace numeric settings before commit", () => {
    const onSettingsChange = vi.fn();
    render(
      <MarketOrderBar
        openOrderCount={0}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />,
    );

    const lots = screen.getByLabelText("Lots") as HTMLInputElement;
    fireEvent.focus(lots);
    fireEvent.change(lots, { target: { value: "" } });

    expect(lots.value).toBe("");
    expect(onSettingsChange).not.toHaveBeenCalled();

    fireEvent.change(lots, { target: { value: "1.25" } });
    fireEvent.blur(lots);

    expect(onSettingsChange).toHaveBeenCalledWith({
      ...settings,
      volumeLots: 1.25,
    });
  });

  it("accepts decimal comma or decimal point for mobile numeric settings", () => {
    const onSettingsChange = vi.fn();
    render(
      <MarketOrderBar
        openOrderCount={0}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />,
    );

    const lots = screen.getByLabelText("Lots") as HTMLInputElement;
    fireEvent.focus(lots);
    fireEvent.change(lots, { target: { value: "0,25" } });
    fireEvent.blur(lots);

    expect(onSettingsChange).toHaveBeenCalledWith({
      ...settings,
      volumeLots: 0.25,
    });

    const sl = screen.getByLabelText("SL") as HTMLInputElement;
    fireEvent.focus(sl);
    fireEvent.change(sl, { target: { value: "1.5" } });
    fireEvent.blur(sl);

    expect(onSettingsChange).toHaveBeenCalledWith({
      ...settings,
      slDistanceGc: 1.5,
    });
  });
});
