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

  it("shows compact verified account balance when connected", () => {
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
        openOrderCount={2}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(screen.getByText("#123")).toBeInTheDocument();
    expect(screen.queryByText(/Exness-Demo/)).not.toBeInTheDocument();
    expect(screen.getByText("Bal 10,000.00")).toBeInTheDocument();
    expect(screen.getByText("Eq 9,999.50")).toBeInTheDocument();
    expect(screen.getByText("Open 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "BUY" })).toBeInTheDocument();
  });

  it("places sell on the left and buy on the right", () => {
    const onMarketOrder = vi.fn();
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
        onMarketOrder={onMarketOrder}
      />,
    );

    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["SELL", "BUY"]);

    fireEvent.click(screen.getByRole("button", { name: "SELL" }));
    fireEvent.click(screen.getByRole("button", { name: "BUY" }));

    expect(onMarketOrder).toHaveBeenNthCalledWith(1, "sell");
    expect(onMarketOrder).toHaveBeenNthCalledWith(2, "buy");
  });

  it("keeps market buttons hidden while the drawer is closed", () => {
    const onDrawerOpenChange = vi.fn();
    const account = {
      accountId: "acct",
      login: 123,
      server: "Exness-Demo",
      tradeMode: "demo" as const,
      currency: "USD",
      balance: 10000,
      equity: 9999.5,
    };

    const { rerender } = render(
      <MarketOrderBar
        account={account}
        variant="drawer"
        drawerOpen={false}
        onDrawerOpenChange={onDrawerOpenChange}
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "BUY" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SELL" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trade (1)" }));
    expect(onDrawerOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <MarketOrderBar
        account={account}
        variant="drawer"
        drawerOpen
        onDrawerOpenChange={onDrawerOpenChange}
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "BUY" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SELL" })).toBeInTheDocument();
  });

  it("renders one control row per open order", () => {
    const onOrderRowBreakEven = vi.fn();
    const onOrderRowClose = vi.fn();
    const onOrderRowCancel = vi.fn();
    render(
      <MarketOrderBar
        openOrderCount={2}
        orderRows={[
          {
            id: "app:ord_1",
            side: "buy",
            title: "BUY fill",
            detail: "0.01 @ 4335.3",
            pnlText: "+$6.30",
            pnlValue: 6.3,
            action: "close",
            canBreakEven: true,
          },
          {
            id: "mt5order:8",
            side: "sell",
            title: "SELL limit",
            detail: "0.02 @ 4345.0",
            action: "cancel",
          },
        ]}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
        onOrderRowBreakEven={onOrderRowBreakEven}
        onOrderRowClose={onOrderRowClose}
        onOrderRowCancel={onOrderRowCancel}
      />,
    );

    expect(screen.getAllByRole("button", { name: "BE" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "BE" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("BUY fill")).toBeInTheDocument();
    expect(screen.getByText("SELL limit")).toBeInTheDocument();
    expect(screen.getByText("+$6.30")).toBeInTheDocument();
    expect(onOrderRowBreakEven).toHaveBeenCalledWith("app:ord_1");
    expect(onOrderRowClose).toHaveBeenCalledWith("app:ord_1");
    expect(onOrderRowCancel).toHaveBeenCalledWith("mt5order:8");
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
