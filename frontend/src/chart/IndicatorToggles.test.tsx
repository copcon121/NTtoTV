import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IndicatorToggles,
  type EmaSettings,
  DEFAULT_BIG_TRADE_SETTINGS,
  DEFAULT_FOOTPRINT_SETTINGS,
} from "./IndicatorToggles";
import { DEFAULT_OUTSIDE_BAR_SETTINGS } from "./outsideBar";
import { DEFAULT_SMC_SETTINGS, type SmcSettings } from "./smc";

afterEach(() => {
  cleanup();
});

const EMA: EmaSettings = { enabled: false, period: 200, color: "#2962ff" };
const SMC: SmcSettings = { ...DEFAULT_SMC_SETTINGS };

function open() {
  fireEvent.click(screen.getByLabelText("Indicators"));
}

describe("IndicatorToggles", () => {
  it("opens the dropdown and toggles each indicator", () => {
    const onFootprint = vi.fn();
    const onBigTrades = vi.fn();
    const onEma = vi.fn();
    const onSmc = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades
        ema={EMA}
        smc={SMC}
        onFootprintChange={onFootprint}
        onBigTradesChange={onBigTrades}
        onEmaChange={onEma}
        onSmcChange={onSmc}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    expect(screen.queryByLabelText("EMA 200")).not.toBeInTheDocument();

    open();
    fireEvent.click(screen.getByLabelText("EMA 200"));
    fireEvent.click(screen.getByLabelText("SMC"));
    fireEvent.click(screen.getByLabelText("Footprint"));
    fireEvent.click(screen.getByLabelText("BigTrade"));

    expect(onEma).toHaveBeenCalledWith({ ...EMA, enabled: true });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, enabled: true });
    expect(onFootprint).toHaveBeenCalledWith(true);
    expect(onBigTrades).toHaveBeenCalledWith(false);
  });

  it("can disable footprint independently", () => {
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        footprintDisabled
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByLabelText("Footprint")).toBeDisabled();
    expect(screen.getByLabelText("BigTrade")).not.toBeDisabled();
    expect(screen.getByLabelText("EMA 200")).not.toBeDisabled();
    expect(screen.getByLabelText("SMC")).not.toBeDisabled();
  });

  it("shows a count badge of active indicators", () => {
    render(
      <IndicatorToggles
        footprint
        bigTrades
        ema={{ ...EMA, enabled: true }}
        smc={SMC}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("toggles and edits Outside Bar settings", () => {
    const onOutsideBar = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        outsideBar={DEFAULT_OUTSIDE_BAR_SETTINGS}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        onOutsideBarChange={onOutsideBar}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("Outside Bar"));
    fireEvent.click(screen.getByLabelText("Outside Bar settings"));
    fireEvent.change(screen.getByLabelText("Outside Bar bullish color"), {
      target: { value: "#123456" },
    });

    expect(onOutsideBar).toHaveBeenCalledWith({
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
    });
    expect(onOutsideBar).toHaveBeenCalledWith({
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      bullColor: "#123456",
    });
  });

  it("edits the EMA length via the settings panel", () => {
    const onEma = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={onEma}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("EMA settings"));
    const input = screen.getByLabelText("EMA length");
    fireEvent.change(input, { target: { value: "21" } });
    fireEvent.blur(input);

    expect(onEma).toHaveBeenCalledWith({ ...EMA, period: 21 });
  });

  it("edits the SMC lengths and FVG controls via the settings panel", () => {
    const onSmc = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={onSmc}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("SMC settings"));
    const swing = screen.getByLabelText("SMC swing length");
    const internal = screen.getByLabelText("SMC internal length");
    const fvgExtend = screen.getByLabelText("SMC FVG extend bars");
    const fvgLimit = screen.getByLabelText("SMC active FVG display limit");
    const showPd = screen.getByLabelText("Show PD");
    fireEvent.change(swing, { target: { value: "21" } });
    fireEvent.blur(swing);
    fireEvent.change(internal, { target: { value: "3" } });
    fireEvent.blur(internal);
    fireEvent.change(fvgExtend, { target: { value: "2" } });
    fireEvent.blur(fvgExtend);
    fireEvent.change(fvgLimit, { target: { value: "4" } });
    fireEvent.blur(fvgLimit);
    fireEvent.click(showPd);

    expect(onSmc).toHaveBeenCalledWith({ ...SMC, swingLength: 21 });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, internalLength: 3 });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, fvgExtendBars: 2 });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, maxFairValueGaps: 4 });
    expect(onSmc).toHaveBeenCalledWith({
      ...SMC,
      showPremiumDiscount: false,
    });
  });

  it("changes the EMA color from a preset swatch", () => {
    const onEma = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={onEma}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("EMA settings"));
    fireEvent.click(screen.getByLabelText("EMA color #e0b341"));

    expect(onEma).toHaveBeenCalledWith({ ...EMA, color: "#e0b341" });
  });

  it("reverts an invalid length on blur", () => {
    const onEma = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={onEma}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("EMA settings"));
    const input = screen.getByLabelText("EMA length") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(onEma).not.toHaveBeenCalled();
    expect(input.value).toBe("200"); // reverted
  });

  it("edits BigTrade display settings", () => {
    const onBigTradeSettings = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades
        ema={EMA}
        smc={SMC}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
        bigTradeSettings={DEFAULT_BIG_TRADE_SETTINGS}
        onBigTradeSettingsChange={onBigTradeSettings}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("BigTrade settings"));
    const minVol = screen.getByLabelText("BigTrade min volume");
    const limit = screen.getByLabelText("BigTrade display limit");
    fireEvent.change(minVol, { target: { value: "80" } });
    fireEvent.blur(minVol);
    fireEvent.change(limit, { target: { value: "200" } });
    fireEvent.blur(limit);

    expect(onBigTradeSettings).toHaveBeenCalledWith({
      ...DEFAULT_BIG_TRADE_SETTINGS,
      minVolume: 80,
    });
    expect(onBigTradeSettings).toHaveBeenCalledWith({
      ...DEFAULT_BIG_TRADE_SETTINGS,
      maxVisible: 200,
    });
  });
});
