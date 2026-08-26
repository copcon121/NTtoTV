import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AlertEventMessage } from "../socket/messages";
import { AlertPanel } from "./AlertPanel";
import { type Alert } from "./types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const alerts: Alert[] = [
  {
    id: "a_1",
    symbol: "GC",
    type: "price_crosses_level",
    params: { level: 2345 },
    enabled: true,
  },
  {
    id: "a_2",
    symbol: "GC",
    type: "big_trade_threshold",
    params: { threshold: 30 },
    enabled: false,
  },
  {
    id: "a_3",
    symbol: "GC",
    type: "smc_external_break_big_trade",
    params: {
      bigTradeThreshold: 50,
      swingLength: 50,
      lookaheadBars: 5,
      effectiveLookaheadBars: 5,
      maxBars: 20,
      pauseOnInsideBars: true,
      repeat: true,
    },
    enabled: true,
  },
  {
    id: "a_6",
    symbol: "GC",
    type: "mgann_break_ls",
    params: {
      requireBigTrade: true,
      bigTradeThreshold: 70,
      timeframe: "1m",
      minVolume: 0,
      volumeLookback: 20,
      volumeMultiplier: 2,
      minSpreadTicks: 0,
      spreadLookback: 20,
      spreadMultiplier: 2,
      swingSize: 5,
      pivotLookbackBars: 120,
      minPivotCuts: 2,
      confirmationBars: 2,
      breakTicks: 0,
      repeat: true,
    },
    enabled: true,
  },
  {
    id: "a_7",
    symbol: "GC",
    type: "mgann_sweep",
    params: {
      timeframe: "1m",
      minVolume: 0,
      volumeLookback: 20,
      volumeMultiplier: 2,
      minSpreadTicks: 0,
      spreadLookback: 20,
      spreadMultiplier: 2,
      swingSize: 5,
      pivotLookbackBars: 120,
      minPivotCuts: 2,
      confirmationBars: 2,
      breakTicks: 0,
      repeat: true,
    },
    enabled: true,
  },
  {
    id: "a_8",
    symbol: "GC",
    type: "liquidity_pool_break",
    params: {
      side: "both",
      timeframe: "1m",
      swingSize: 5,
      pivotLookbackBars: 120,
      minPivotCuts: 3,
      liquidityAtrMargin: 4,
      repeat: true,
    },
    enabled: true,
  },
];

function event(overrides: Partial<AlertEventMessage> = {}): AlertEventMessage {
  return {
    type: "alert_event",
    alertId: "a_1",
    alertType: "price_crosses_level",
    symbol: "GC",
    contract: "GC 08-26",
    time: 1000,
    price: 2345,
    message: "GC crossed 2345",
    level: 2345,
    ...overrides,
  };
}

describe("AlertPanel (Req 16.5, 17.4)", () => {
  it("renders an alert line with enable/disable + delete controls per alert", () => {
    render(<AlertPanel alerts={alerts} />);
    expect(screen.getByTestId("alert-a_1")).toBeInTheDocument();
    expect(screen.getByTestId("alert-a_2")).toBeInTheDocument();
    expect(screen.getByTestId("alert-a_3")).toHaveTextContent(
      "External BOS/CHoCH, BT > 50 (repeat)",
    );
    expect(screen.getByTestId("alert-a_6")).toHaveTextContent(
      "mGann Break L/S, BT > 70, vol x2, spread x2 (repeat)",
    );
    expect(screen.getByTestId("alert-a_8")).toHaveTextContent(
      "M1 Liquidity Pool Break BSL/SSL x3 (repeat)",
    );
    expect(screen.getByTestId("alert-a_7")).toHaveTextContent(
      "mGann Break L/S, vol x2, spread x2 (repeat)",
    );
    expect(screen.getByLabelText("Enable a_1")).toBeChecked();
    expect(screen.getByLabelText("Enable a_2")).not.toBeChecked();
    expect(screen.getByLabelText("Delete a_1")).toBeInTheDocument();
  });

  it("raises onToggle when an alert is enabled/disabled", () => {
    const onToggle = vi.fn();
    render(<AlertPanel alerts={alerts} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText("Enable a_2"));
    expect(onToggle).toHaveBeenCalledWith("a_2", true);
  });

  it("raises onDelete when an alert is deleted", () => {
    const onDelete = vi.fn();
    render(<AlertPanel alerts={alerts} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText("Delete a_1"));
    expect(onDelete).toHaveBeenCalledWith("a_1");
  });

  it("raises onCreate with a level for a price-based alert", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert level"), {
      target: { value: "2350" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onCreate).toHaveBeenCalledWith({
      type: "price_crosses_level",
      params: { level: 2350 },
    });
  });

  it("raises onCreate with a threshold for a threshold-based alert", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "big_trade_threshold" },
    });
    fireEvent.change(screen.getByLabelText("Alert threshold"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onCreate).toHaveBeenCalledWith({
      type: "big_trade_threshold",
      params: { threshold: 50 },
    });
  });

  it("can create a repeating threshold alert", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "volume_delta_threshold" },
    });
    fireEvent.change(screen.getByLabelText("Alert threshold"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByLabelText("Repeat alert"));
    fireEvent.click(screen.getByText("Add"));

    expect(onCreate).toHaveBeenCalledWith({
      type: "volume_delta_threshold",
      params: { threshold: 100, repeat: true },
    });
  });

  it("raises onCreate with SMC strategy params and configurable threshold", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "smc_external_break_big_trade" },
    });

    expect(screen.getByLabelText("BigTrade threshold")).toHaveValue(50);
    expect(screen.getByLabelText("Repeat alert")).toBeChecked();

    fireEvent.change(screen.getByLabelText("BigTrade threshold"), {
      target: { value: "75" },
    });
    fireEvent.click(screen.getByLabelText("Repeat alert"));
    fireEvent.click(screen.getByText("Add"));

    expect(onCreate).toHaveBeenCalledWith({
      type: "smc_external_break_big_trade",
      params: {
        bigTradeThreshold: 75,
        swingLength: 50,
        lookaheadBars: 5,
        effectiveLookaheadBars: 5,
        maxBars: 20,
        pauseOnInsideBars: true,
        retestToleranceTicks: 50,
        repeat: false,
      },
    });
  });

  it("does not offer the removed mGann FVG retest alert", () => {
    render(<AlertPanel alerts={alerts} />);

    expect(
      screen.queryByRole("option", { name: "FVG retest by mGann" }),
    ).not.toBeInTheDocument();
  });

  it("raises onCreate with mGann Break L/S BigTrade option params", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "mgann_break_ls" },
    });

    expect(screen.getByLabelText("Require BigTrade")).not.toBeChecked();
    expect(screen.queryByLabelText("BigTrade threshold")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Require BigTrade"));
    expect(screen.getByLabelText("Require BigTrade")).toBeChecked();
    expect(screen.getByLabelText("BigTrade threshold")).toHaveValue(70);
    expect(screen.getByText("BigTrade >")).toBeInTheDocument();
    expect(screen.getByText("Vol x")).toBeInTheDocument();
    expect(screen.getByText("Spread x")).toBeInTheDocument();
    expect(screen.queryByLabelText("mGann break direction")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Volume multiplier")).toHaveValue(2);
    expect(screen.getByLabelText("Spread multiplier")).toHaveValue(2);
    expect(
      screen.queryByLabelText("mGann Break L/S history limit"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Repeat alert")).toBeChecked();

    fireEvent.change(screen.getByLabelText("BigTrade threshold"), {
      target: { value: "85" },
    });
    fireEvent.change(screen.getByLabelText("Volume multiplier"), {
      target: { value: "2.5" },
    });
    fireEvent.change(screen.getByLabelText("Spread multiplier"), {
      target: { value: "2.2" },
    });
    fireEvent.click(screen.getByText("Add"));

    expect(onCreate).toHaveBeenCalledWith({
      type: "mgann_break_ls",
      params: {
        requireBigTrade: true,
        bigTradeThreshold: 85,
        timeframe: "1m",
        minVolume: 0,
        volumeLookback: 20,
        volumeMultiplier: 2.5,
        minSpreadTicks: 0,
        spreadLookback: 20,
        spreadMultiplier: 2.2,
        swingSize: 5,
        pivotLookbackBars: 120,
        minPivotCuts: 2,
        confirmationBars: 2,
        breakTicks: 0,
        filterLiquidity: true,
        liquidityAtrMargin: 4,
        liquiditySweepLookbackBars: 5,
        repeat: true,
      },
    });
  });

  it("raises onCreate with mGann Break L/S params without BigTrade", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "mgann_break_ls" },
    });

    expect(screen.getByLabelText("Require BigTrade")).not.toBeChecked();
    expect(screen.queryByLabelText("BigTrade threshold")).not.toBeInTheDocument();
    expect(screen.queryByText("BigTrade >")).not.toBeInTheDocument();
    expect(screen.getByText("Vol x")).toBeInTheDocument();
    expect(screen.getByText("Spread x")).toBeInTheDocument();
    expect(screen.getByLabelText("Volume multiplier")).toHaveValue(2);
    expect(screen.getByLabelText("Spread multiplier")).toHaveValue(2);
    expect(
      screen.queryByLabelText("mGann Break L/S history limit"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Repeat alert")).toBeChecked();

    fireEvent.change(screen.getByLabelText("Volume multiplier"), {
      target: { value: "2.5" },
    });
    fireEvent.change(screen.getByLabelText("Spread multiplier"), {
      target: { value: "2.2" },
    });
    fireEvent.click(screen.getByText("Add"));

    expect(onCreate).toHaveBeenCalledWith({
      type: "mgann_break_ls",
      params: {
        requireBigTrade: false,
        bigTradeThreshold: 70,
        timeframe: "1m",
        minVolume: 0,
        volumeLookback: 20,
        volumeMultiplier: 2.5,
        minSpreadTicks: 0,
        spreadLookback: 20,
        spreadMultiplier: 2.2,
        swingSize: 5,
        pivotLookbackBars: 120,
        minPivotCuts: 2,
        confirmationBars: 2,
        breakTicks: 0,
        filterLiquidity: true,
        liquidityAtrMargin: 4,
        liquiditySweepLookbackBars: 5,
        repeat: true,
      },
    });
  });

  it("can set the CHoCH liquidity pool minimum for mGann Break L/S", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "mgann_break_ls" },
    });

    fireEvent.change(screen.getByLabelText("Liquidity pool minimum swings"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByText("Add"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mgann_break_ls",
        params: expect.objectContaining({
          filterLiquidity: true,
          minPivotCuts: 4,
          liquidityAtrMargin: 4,
          liquiditySweepLookbackBars: 5,
        }),
      }),
    );
  });

  it("creates a standalone liquidity pool break alert", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "liquidity_pool_break" },
    });

    expect(screen.getByLabelText("Liquidity pool break side")).toHaveValue(
      "both",
    );
    expect(screen.getByLabelText("Liquidity pool break timeframe")).toHaveValue(
      "1m",
    );
    expect(screen.getByLabelText("Liquidity break minimum swings")).toHaveValue(
      2,
    );
    fireEvent.change(screen.getByLabelText("Liquidity pool break side"), {
      target: { value: "ssl" },
    });
    fireEvent.change(screen.getByLabelText("Liquidity pool break timeframe"), {
      target: { value: "5m" },
    });
    fireEvent.change(screen.getByLabelText("Liquidity break minimum swings"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByText("Add"));

    expect(onCreate).toHaveBeenCalledWith({
      type: "liquidity_pool_break",
      params: {
        side: "ssl",
        timeframe: "5m",
        swingSize: 5,
        pivotLookbackBars: 120,
        minPivotCuts: 4,
        liquidityAtrMargin: 4,
        repeat: true,
      },
    });
  });

  it("on alert_event shows a toast and plays a sound without an event log", () => {
    const playSound = vi.fn();
    const { rerender } = render(
      <AlertPanel alerts={alerts} playSound={playSound} />,
    );
    expect(screen.queryByTestId("alert-toast")).not.toBeInTheDocument();

    rerender(
      <AlertPanel alerts={alerts} playSound={playSound} lastEvent={event()} />,
    );

    expect(screen.getByTestId("alert-toast")).toHaveTextContent("GC crossed 2345");
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Alert event log")).not.toBeInTheDocument();
  });

  it("deletes a price-cross alert after it fires", () => {
    const onDelete = vi.fn();
    render(<AlertPanel alerts={alerts} lastEvent={event()} onDelete={onDelete} />);

    expect(onDelete).toHaveBeenCalledWith("a_1");
  });

  it("does not re-fire for the same event object on re-render", () => {
    const playSound = vi.fn();
    const ev = event();
    const { rerender } = render(
      <AlertPanel alerts={alerts} playSound={playSound} lastEvent={ev} />,
    );
    rerender(<AlertPanel alerts={alerts} playSound={playSound} lastEvent={ev} />);
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses the toast when parent callbacks change during live renders", () => {
    vi.useFakeTimers();
    const ev = event();
    const { rerender } = render(
      <AlertPanel alerts={alerts} lastEvent={ev} onDelete={vi.fn()} />,
    );
    expect(screen.getByTestId("alert-toast")).toBeInTheDocument();

    rerender(
      <AlertPanel
        alerts={alerts.filter((alert) => alert.id !== ev.alertId)}
        lastEvent={ev}
        onDelete={vi.fn()}
      />,
    );
    act(() => vi.advanceTimersByTime(4_000));

    expect(screen.queryByTestId("alert-toast")).not.toBeInTheDocument();
  });

  it("raises onTelegramSave with the notification config", () => {
    const onTelegramSave = vi.fn();
    render(
      <AlertPanel
        alerts={alerts}
        telegram={{
          enabled: false,
          chatId: "",
          sendScreenshot: true,
          hasBotToken: false,
        }}
        onTelegramSave={onTelegramSave}
      />,
    );

    fireEvent.click(screen.getByText("Send alerts to Telegram"));
    fireEvent.change(screen.getByLabelText("Telegram bot token"), {
      target: { value: "123:abc" },
    });
    fireEvent.change(screen.getByLabelText("Telegram chat id"), {
      target: { value: "456" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(onTelegramSave).toHaveBeenCalledWith({
      enabled: true,
      chatId: "456",
      sendScreenshot: true,
      botToken: "123:abc",
    });
  });

  it("raises Web Push actions from the notification settings", () => {
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    const onTest = vi.fn();
    render(
      <AlertPanel
        alerts={alerts}
        webPush={{
          enabled: true,
          subscriptionCount: 1,
          publicKey: "public-key",
        }}
        webPushSupported
        onWebPushEnable={onEnable}
        onWebPushDisable={onDisable}
        onWebPushTest={onTest}
      />,
    );

    const section = screen.getByLabelText("Web Push settings");
    fireEvent.click(within(section).getByText("Enable"));
    fireEvent.click(within(section).getByText("Test"));
    fireEvent.click(within(section).getByText("Disable"));

    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onTest).toHaveBeenCalledTimes(1);
    expect(onDisable).toHaveBeenCalledTimes(1);
  });
});
