import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketOrderBar } from "./MarketOrderBar";

const settings = {
  volumeLots: 0.1,
  slDistanceGc: 3,
  tpDistanceGc: 6,
  takeProfit1rEnabled: true,
  autoSupertrendAfter1rEnabled: false,
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

  it("shows only the account mode and balance in the compact account summary", () => {
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

    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.queryByText(/Exness-Demo/)).not.toBeInTheDocument();
    expect(screen.getByText("Bal 10,000.00")).toBeInTheDocument();
    expect(screen.queryByText("Eq 9,999.50")).not.toBeInTheDocument();
    expect(screen.queryByText("Open 2")).not.toBeInTheDocument();
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

  it("offers independent Auto L and Auto S toggles using the configured lots", () => {
    const onAutoTradeSettingsChange = vi.fn();
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
        autoTradeSettings={{
          longEnabled: false,
          shortEnabled: false,
          volumeLots: 0.1,
          updatedAt: 1,
        }}
        onAutoTradeSettingsChange={onAutoTradeSettingsChange}
      />,
    );

    expect(screen.queryByText(/BOS\/CHoCH/)).not.toBeInTheDocument();
    expect(screen.getByText("Auto L").closest("label")).toHaveAttribute(
      "title",
      expect.stringContaining("close 50% at +1R"),
    );
    expect(screen.getByText("Auto S").closest("label")).toHaveAttribute(
      "title",
      expect.stringContaining("remaining 50% at +3R"),
    );
    fireEvent.click(screen.getByLabelText("Auto trade L"));
    fireEvent.click(screen.getByLabelText("Auto trade S"));

    expect(onAutoTradeSettingsChange).toHaveBeenNthCalledWith(1, {
      longEnabled: true,
      shortEnabled: false,
      volumeLots: 0.1,
      updatedAt: 1,
    });
    expect(onAutoTradeSettingsChange).toHaveBeenNthCalledWith(2, {
      longEnabled: false,
      shortEnabled: true,
      volumeLots: 0.1,
      updatedAt: 1,
    });
  });

  it("toggles automatic 50% take profit at 1R", () => {
    const onSettingsChange = vi.fn();
    render(
      <MarketOrderBar
        openOrderCount={0}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />,
    );

    const toggle = screen.getByLabelText("Take profit 50% at 1R");
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...settings,
      takeProfit1rEnabled: false,
    });
  });

  it("toggles SuperTrend trailing for the remainder after 1R", () => {
    const onSettingsChange = vi.fn();
    render(
      <MarketOrderBar
        openOrderCount={0}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />,
    );

    const toggle = screen.getByLabelText("Auto SuperTrend trailing after 1R");
    expect(toggle).not.toBeChecked();
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...settings,
      autoSupertrendAfter1rEnabled: true,
    });
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
    const onOrderRowSupertrendTrailing = vi.fn();
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
            canSupertrendTrail: true,
            supertrendTrailing: true,
            supertrendTrailingTimeframe: "1m",
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
        onOrderRowSupertrendTrailing={onOrderRowSupertrendTrailing}
        onOrderRowClose={onOrderRowClose}
        onOrderRowCancel={onOrderRowCancel}
      />,
    );

    expect(screen.getAllByRole("button", { name: "BE" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Trailing" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "BE" }));
    fireEvent.click(screen.getByRole("button", { name: "Trailing" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("BUY fill")).toBeInTheDocument();
    expect(screen.getByText("SELL limit")).toBeInTheDocument();
    expect(screen.getByText("+$6.30")).toBeInTheDocument();
    expect(screen.getByLabelText("Open order controls").parentElement).toHaveClass(
      "market-order-main",
    );
    expect(onOrderRowBreakEven).toHaveBeenCalledWith("app:ord_1");
    expect(onOrderRowSupertrendTrailing).toHaveBeenCalledWith("app:ord_1");
    expect(onOrderRowClose).toHaveBeenCalledWith("app:ord_1");
    expect(onOrderRowCancel).toHaveBeenCalledWith("mt5order:8");
  });

  it("keeps open order rows in place when realtime updates arrive out of order", () => {
    const firstRows = [
      {
        id: "app:older",
        side: "buy" as const,
        title: "BUY older",
        detail: "0.06 @ 4181.1",
        pnlText: "+$5.70",
        pnlValue: 5.7,
        action: "close" as const,
      },
      {
        id: "app:newer",
        side: "buy" as const,
        title: "BUY newer",
        detail: "0.06 @ 4182.4",
        pnlText: "-$1.20",
        pnlValue: -1.2,
        action: "close" as const,
      },
    ];
    const { container, rerender } = render(
      <MarketOrderBar
        openOrderCount={firstRows.length}
        orderRows={firstRows}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    const visibleTitles = () =>
      Array.from(container.querySelectorAll(".market-order-row-title")).map(
        (node) => node.textContent,
      );
    expect(visibleTitles()).toEqual(["BUY older", "BUY newer"]);

    rerender(
      <MarketOrderBar
        openOrderCount={3}
        orderRows={[
          { ...firstRows[1], pnlText: "+$2.40", pnlValue: 2.4 },
          { ...firstRows[0], pnlText: "+$8.10", pnlValue: 8.1 },
          {
            id: "app:latest",
            side: "sell",
            title: "SELL latest",
            detail: "0.03 @ 4184.0",
            pnlText: "+$0.20",
            pnlValue: 0.2,
            action: "close",
          },
        ]}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(visibleTitles()).toEqual(["BUY older", "BUY newer", "SELL latest"]);
    expect(screen.getByText("+$8.10")).toBeInTheDocument();
    expect(screen.getByText("+$2.40")).toBeInTheDocument();
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

  it("allows switching the chart sizing input from lots to account risk", () => {
    const onSettingsChange = vi.fn();
    const { rerender } = render(
      <MarketOrderBar
        openOrderCount={0}
        settings={{ ...settings, riskAmount: 100 }}
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Sizing mode"), {
      target: { value: "risk" },
    });
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...settings,
      riskAmount: 100,
      sizingMode: "risk",
    });

    rerender(
      <MarketOrderBar
        openOrderCount={0}
        settings={{ ...settings, riskAmount: 100, sizingMode: "risk" }}
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />,
    );
    const risk = screen.getByLabelText("Risk $") as HTMLInputElement;
    fireEvent.focus(risk);
    fireEvent.change(risk, { target: { value: "125" } });
    fireEvent.blur(risk);
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...settings,
      riskAmount: 125,
      sizingMode: "risk",
    });
  });
});
