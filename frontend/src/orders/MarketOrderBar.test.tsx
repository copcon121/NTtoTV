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
    expect(screen.getByText("Bal 10,000.00 USD")).toBeInTheDocument();
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

  it("keeps manual order and exit controls without Auto L or Auto S", () => {
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

    expect(screen.queryByLabelText("Auto trade L")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Auto trade S")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SELL" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "BUY" })).toBeEnabled();
    expect(screen.getByLabelText("Sizing mode")).toBeInTheDocument();
    expect(screen.getByLabelText("Take profit 50% at 1R")).toBeInTheDocument();
    expect(screen.getByLabelText("Auto SuperTrend trailing after 1R")).toBeInTheDocument();
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
    const risk = screen.getByLabelText("Risk amount") as HTMLInputElement;
    fireEvent.focus(risk);
    fireEvent.change(risk, { target: { value: "125" } });
    fireEvent.blur(risk);
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...settings,
      riskAmount: 125,
      sizingMode: "risk",
    });
  });

  it("shows concise Trading Account floating PnL with raw USC formatting and stale indicator", () => {
    const { rerender } = render(
      <MarketOrderBar
        account={{
          accountId: "acct-usc",
          login: 789,
          server: "Exness-Real",
          tradeMode: "live",
          currency: "USC",
          balance: 100000,
          equity: 100012.34,
          floatingPnl: 12.34,
          accountStateStale: false,
        }}
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    const pnlEl = screen.getByText("PnL +12.34 USC");
    expect(pnlEl).toBeInTheDocument();
    expect(pnlEl).toHaveClass("winning");
    expect(pnlEl).not.toHaveClass("is-stale");

    // Stale losing PnL
    rerender(
      <MarketOrderBar
        account={{
          accountId: "acct-usc",
          login: 789,
          server: "Exness-Real",
          tradeMode: "live",
          currency: "USC",
          balance: 100000,
          equity: 99950,
          floatingPnl: -50.0,
          accountStateStale: true,
        }}
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    const stalePnlEl = screen.getByText("PnL -50.00 USC (stale)");
    expect(stalePnlEl).toBeInTheDocument();
    expect(stalePnlEl).toHaveClass("losing");
    expect(stalePnlEl).toHaveClass("is-stale");
  });

  it("shows concise Trading Account floating PnL in USD formatting", () => {
    render(
      <MarketOrderBar
        account={{
          accountId: "acct-usd",
          login: 456,
          server: "Exness-Demo",
          tradeMode: "demo",
          currency: "USD",
          balance: 5000,
          equity: 5025.5,
          floatingPnl: 25.5,
        }}
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
      />,
    );

    expect(screen.getByText("PnL +$25.50")).toBeInTheDocument();
  });

  it("renders BE and 50% buttons and handles click callbacks", () => {
    const onBreakEven = vi.fn();
    const onClose50 = vi.fn();
    const onClose = vi.fn();
    render(
      <MarketOrderBar
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
        orderRows={[
          {
            id: "row-1",
            title: "BUY 0.10",
            detail: "@ 2650.0",
            side: "buy",
            action: "close",
            volumeLots: 0.1,
            canBreakEven: true,
          },
        ]}
        onOrderRowBreakEven={onBreakEven}
        onOrderRowClose50Percent={onClose50}
        onOrderRowClose={onClose}
      />,
    );

    const beBtn = screen.getByRole("button", { name: "BE" });
    const close50Btn = screen.getByRole("button", { name: "50%" });
    const closeBtn = screen.getByRole("button", { name: "Close" });

    expect(beBtn).not.toBeDisabled();
    expect(close50Btn).not.toBeDisabled();
    expect(closeBtn).not.toBeDisabled();

    fireEvent.click(beBtn);
    expect(onBreakEven).toHaveBeenCalledWith("row-1");

    fireEvent.click(close50Btn);
    expect(onClose50).toHaveBeenCalledWith("row-1", 0.1);

    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith("row-1");
  });

  it("disables all action buttons and shows '...' on BE button when breakEvenPending is true", () => {
    render(
      <MarketOrderBar
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
        orderRows={[
          {
            id: "row-1",
            title: "BUY 0.10",
            detail: "@ 2650.0",
            side: "buy",
            action: "close",
            volumeLots: 0.1,
            canBreakEven: true,
            breakEvenPending: true,
          },
        ]}
      />,
    );

    const beBtn = screen.getByRole("button", { name: "..." });
    const close50Btn = screen.getByRole("button", { name: "50%" });
    const closeBtn = screen.getByRole("button", { name: "Close" });

    expect(beBtn).toBeDisabled();
    expect(close50Btn).toBeDisabled();
    expect(closeBtn).toBeDisabled();
  });

  it("disables all action buttons and shows '...' on 50% button when close50Pending is true", () => {
    render(
      <MarketOrderBar
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
        orderRows={[
          {
            id: "row-1",
            title: "BUY 0.10",
            detail: "@ 2650.0",
            side: "buy",
            action: "close",
            volumeLots: 0.1,
            canBreakEven: true,
            close50Pending: true,
          },
        ]}
      />,
    );

    const beBtn = screen.getByRole("button", { name: "BE" });
    const close50Btn = screen.getByRole("button", { name: "..." });
    const closeBtn = screen.getByRole("button", { name: "Close" });

    expect(beBtn).toBeDisabled();
    expect(close50Btn).toBeDisabled();
    expect(closeBtn).toBeDisabled();
  });

  it("disables all action buttons and shows '...' on Close button when pending is true", () => {
    render(
      <MarketOrderBar
        openOrderCount={1}
        settings={settings}
        onSettingsChange={vi.fn()}
        onMarketOrder={vi.fn()}
        orderRows={[
          {
            id: "row-1",
            title: "BUY 0.10",
            detail: "@ 2650.0",
            side: "buy",
            action: "close",
            volumeLots: 0.1,
            canBreakEven: true,
            pending: true,
          },
        ]}
      />,
    );

    const beBtn = screen.getByRole("button", { name: "BE" });
    const close50Btn = screen.getByRole("button", { name: "50%" });
    const closeBtn = screen.getByRole("button", { name: "..." });

    expect(beBtn).toBeDisabled();
    expect(close50Btn).toBeDisabled();
    expect(closeBtn).toBeDisabled();
  });

  it("labels cent risk and balance with USC and updates labels when the account changes", () => {
    const props = {
      openOrderCount: 0,
      settings: { ...settings, sizingMode: "risk" as const, riskAmount: 10 },
      onSettingsChange: vi.fn(),
      onMarketOrder: vi.fn(),
    };
    const account = {
      accountId: "cent", login: 1, server: "Exness", tradeMode: "live" as const,
      currency: "USC", balance: 209.80, connected: true,
    };
    const { rerender } = render(<MarketOrderBar {...props} account={account} />);
    expect(screen.getByLabelText("Risk USC")).toHaveValue("10");
    expect(screen.getByRole("option", { name: "Risk USC" })).toBeInTheDocument();
    expect(screen.getByText(/Bal .*USC/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Risk $" })).not.toBeInTheDocument();

    rerender(<MarketOrderBar {...props} account={{ ...account, currency: "USD" }} />);
    expect(screen.getByLabelText("Risk $")).toHaveValue("10");
    expect(screen.getByText(/Bal .*USD/)).toBeInTheDocument();
  });
});
