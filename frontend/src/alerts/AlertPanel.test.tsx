import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AlertEventMessage } from "../socket/messages";
import { AlertPanel } from "./AlertPanel";
import { type Alert } from "./types";

afterEach(() => {
  cleanup();
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
    id: "a_5",
    symbol: "GC",
    type: "mgann_fvg_retest",
    params: {
      timeframe: "5m",
      swingSize: 2,
      maxZoneAge: 0,
      minGapTicks: 1,
      retestToleranceTicks: 0,
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
    expect(screen.getByTestId("alert-a_5")).toHaveTextContent(
      "M5 FVG retest by mGann wave (repeat)",
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

  it("raises onCreate with selected mGann FVG retest timeframe", () => {
    const onCreate = vi.fn();
    render(<AlertPanel alerts={alerts} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("Alert type"), {
      target: { value: "mgann_fvg_retest" },
    });

    expect(screen.getByLabelText("mGann FVG timeframe")).toHaveValue("5m");
    expect(screen.getByLabelText("Repeat alert")).toBeChecked();

    fireEvent.change(screen.getByLabelText("mGann FVG timeframe"), {
      target: { value: "1m" },
    });
    fireEvent.click(screen.getByText("Add"));

    expect(onCreate).toHaveBeenCalledWith({
      type: "mgann_fvg_retest",
      params: {
        timeframe: "1m",
        repeat: true,
      },
    });
  });

  it("on alert_event shows a toast, plays a sound, and logs the event (Req 17.4)", () => {
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
    expect(screen.getByLabelText("Alert event log")).toHaveTextContent(
      "GC crossed 2345",
    );
  });

  it("appends each distinct event to the log newest-first", () => {
    const playSound = vi.fn();
    const { rerender } = render(
      <AlertPanel alerts={alerts} playSound={playSound} lastEvent={event({ message: "first", time: 1 })} />,
    );
    rerender(
      <AlertPanel alerts={alerts} playSound={playSound} lastEvent={event({ message: "second", time: 2 })} />,
    );
    const log = screen.getByLabelText("Alert event log");
    const entries = log.querySelectorAll(".alert-log-entry");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("second"); // newest first
    expect(playSound).toHaveBeenCalledTimes(2);
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
});
