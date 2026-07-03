import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IndicatorToggles,
  type EmaSettings,
  DEFAULT_BIG_TRADE_SETTINGS,
  DEFAULT_EMA_SETTINGS,
  DEFAULT_FOOTPRINT_SETTINGS,
} from "./IndicatorToggles";
import { DEFAULT_MGANN_SWING_SETTINGS } from "./mgannSwing";
import { DEFAULT_OUTSIDE_BAR_SETTINGS } from "./outsideBar";
import { DEFAULT_SMC_SETTINGS, type SmcSettings } from "./smc";

afterEach(() => {
  cleanup();
});

const EMA: EmaSettings = { ...DEFAULT_EMA_SETTINGS };
const SMC: SmcSettings = { ...DEFAULT_SMC_SETTINGS };

function open() {
  fireEvent.click(screen.getByLabelText("Indicators"));
}

describe("IndicatorToggles", () => {
  it("opens the dropdown and toggles each indicator", () => {
    const onVolume = vi.fn();
    const onVolumeDelta = vi.fn();
    const onMgannSwing = vi.fn();
    const onFootprint = vi.fn();
    const onFvgGrader = vi.fn();
    const onBigTrades = vi.fn();
    const onEma = vi.fn();
    const onSmc = vi.fn();
    const onOutsideBar = vi.fn();
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades
        ema={EMA}
        smc={SMC}
        onVolumeChange={onVolume}
        onVolumeDeltaChange={onVolumeDelta}
        onMgannSwingChange={onMgannSwing}
        onFootprintChange={onFootprint}
        onFvgGraderChange={onFvgGrader}
        onBigTradesChange={onBigTrades}
        onEmaChange={onEma}
        onSmcChange={onSmc}
        onOutsideBarChange={onOutsideBar}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    expect(screen.queryByLabelText("EMA 21")).not.toBeInTheDocument();

    open();
    fireEvent.click(screen.getByLabelText("Volume"));
    fireEvent.click(screen.getByLabelText("Volume Delta"));
    fireEvent.click(screen.getByLabelText("MGannSwing"));
    fireEvent.click(screen.getByLabelText("EMA/OSB"));
    fireEvent.click(screen.getByLabelText("SMC"));
    fireEvent.click(screen.getByLabelText("Footprint"));
    fireEvent.click(screen.getByLabelText("FVG Grader"));
    fireEvent.click(screen.getByLabelText("BigTrade"));

    expect(onVolume).toHaveBeenCalledWith(true);
    expect(onVolumeDelta).toHaveBeenCalledWith(true);
    expect(onMgannSwing).toHaveBeenCalledWith(true);
    expect(onEma).toHaveBeenCalledWith({
      ...EMA,
      enabled: false,
      showEma200: false,
    });
    expect(onOutsideBar).toHaveBeenCalledWith({
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: false,
    });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, enabled: true });
    expect(onFootprint).toHaveBeenCalledWith(true);
    expect(onFvgGrader).toHaveBeenCalledWith(true);
    expect(onBigTrades).toHaveBeenCalledWith(false);
  });

  it("shows MGannSwing as a standalone indicator with its own settings", () => {
    const onMgannSwing = vi.fn();
    const onMgannSwingSettings = vi.fn();
    render(
      <IndicatorToggles
        mgannSwing={false}
        mgannSwingSettings={DEFAULT_MGANN_SWING_SETTINGS}
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onMgannSwingChange={onMgannSwing}
        onMgannSwingSettingsChange={onMgannSwingSettings}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByLabelText("MGannSwing")).toBeInTheDocument();
    expect(screen.getByLabelText("EMA/OSB")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("MGannSwing"));
    fireEvent.click(screen.getByLabelText("MGannSwing settings"));
    fireEvent.click(screen.getByLabelText("MGannSwing Wave Delta"));
    fireEvent.click(screen.getByLabelText("MGannSwing Wave Delta Numbers"));
    fireEvent.click(
      screen.getByLabelText("MGannSwing Wave Delta Numbers Impulse Only"),
    );
    fireEvent.click(screen.getByLabelText("MGannSwing Signals"));
    fireEvent.click(screen.getByLabelText("MGannSwing Smart Filter"));
    fireEvent.click(screen.getByLabelText("MGannSwing Impulse Waves"));
    fireEvent.change(
      screen.getByLabelText("MGannSwing impulse length multiplier"),
      { target: { value: "1.25" } },
    );
    fireEvent.blur(screen.getByLabelText("MGannSwing impulse length multiplier"));
    fireEvent.change(
      screen.getByLabelText("MGannSwing impulse delta multiplier"),
      { target: { value: "1.5" } },
    );
    fireEvent.blur(screen.getByLabelText("MGannSwing impulse delta multiplier"));
    fireEvent.change(screen.getByLabelText("MGannSwing impulse break ticks"), {
      target: { value: "2" },
    });
    fireEvent.blur(screen.getByLabelText("MGannSwing impulse break ticks"));

    expect(onMgannSwing).toHaveBeenCalledWith(true);
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(1, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      showWaveDelta: false,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(2, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      showWaveDeltaNumbers: true,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(3, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      waveDeltaNumbersImpulseOnly: false,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(4, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      showSignals: false,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(5, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      smartFilter: false,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(6, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      showImpulseWaves: false,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(7, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      impulseLengthMultiplier: 1.25,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(8, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      impulseVolumeMultiplier: 1.5,
    });
    expect(onMgannSwingSettings).toHaveBeenNthCalledWith(9, {
      ...DEFAULT_MGANN_SWING_SETTINGS,
      impulseBreakTicks: 2,
    });
  });

  it("edits Volume Profile display settings", () => {
    const onWidth = vi.fn();
    const onDevelopingPoc = vi.fn();
    render(
      <IndicatorToggles
        dailyVolumeProfile
        dailyVolumeProfileWidth={84}
        dailyVolumeProfileDevelopingPoc
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onDailyVolumeProfileWidthChange={onWidth}
        onDailyVolumeProfileDevelopingPocChange={onDevelopingPoc}
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("Volume Profile settings"));
    fireEvent.change(screen.getByLabelText("Volume Profile width"), {
      target: { value: "96" },
    });
    fireEvent.click(screen.getByLabelText("Volume Profile developing POC"));

    expect(onWidth).toHaveBeenCalledWith(96);
    expect(onDevelopingPoc).toHaveBeenCalledWith(false);
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
    expect(screen.getByLabelText("FVG Grader")).not.toBeDisabled();
    expect(screen.getByLabelText("BigTrade")).not.toBeDisabled();
    expect(screen.getByLabelText("EMA/OSB")).not.toBeDisabled();
    expect(screen.getByLabelText("SMC")).not.toBeDisabled();
  });

  it("can disable FVG Grader independently", () => {
    render(
      <IndicatorToggles
        footprint={false}
        fvgGrader={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        fvgGraderDisabled
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByLabelText("FVG Grader")).toBeDisabled();
    expect(screen.getByLabelText("Footprint")).not.toBeDisabled();
    expect(screen.getByLabelText("BigTrade")).not.toBeDisabled();
  });

  it("can disable BigTrade independently", () => {
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        bigTradeDisabled
        onFootprintChange={() => {}}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByLabelText("Footprint")).not.toBeDisabled();
    expect(screen.getByLabelText("BigTrade")).toBeDisabled();
    expect(screen.getByLabelText("EMA/OSB")).not.toBeDisabled();
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
    fireEvent.click(screen.getByLabelText("EMA/OSB settings"));
    fireEvent.click(screen.getByLabelText("Outside Bar"));
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

  it("allows decimal Outside Bar delta multiplier edits", () => {
    const onOutsideBar = vi.fn();
    const outsideBar = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
      deltaFilter: {
        ...DEFAULT_OUTSIDE_BAR_SETTINGS.deltaFilter,
        enabled: true,
      },
    };
    render(
      <IndicatorToggles
        footprint={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        outsideBar={outsideBar}
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
    fireEvent.click(screen.getByLabelText("EMA/OSB settings"));
    const input = screen.getByLabelText(
      "Outside Bar filter delta multiplier",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.6" } });
    expect(input.value).toBe("0.6");
    fireEvent.blur(input);

    expect(onOutsideBar).toHaveBeenCalledWith({
      ...outsideBar,
      deltaFilter: {
        ...outsideBar.deltaFilter,
        deltaMultiplier: 0.6,
      },
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
    fireEvent.click(screen.getByLabelText("EMA/OSB settings"));
    const input = screen.getByLabelText("EMA length");
    fireEvent.change(input, { target: { value: "21" } });
    fireEvent.blur(input);

    expect(onEma).toHaveBeenCalledWith({ ...EMA, period: 21 });
  });

  it("toggles EMA 200 inside the EMA settings panel", () => {
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
    fireEvent.click(screen.getByLabelText("EMA/OSB settings"));
    fireEvent.click(screen.getByLabelText("EMA 200"));

    expect(onEma).toHaveBeenCalledWith({ ...EMA, showEma200: false });
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
    const structureLine = screen.getByLabelText("SMC structure line extend bars");
    const fvgLookback = screen.getByLabelText("SMC FVG threshold lookback");
    const fvgExtend = screen.getByLabelText("SMC FVG extend bars");
    const fvgLimit = screen.getByLabelText("SMC active FVG display limit");
    const fvgFactor = screen.getByLabelText("SMC FVG threshold multiplier");
    const fvgVolume = screen.getByLabelText("FVG volume confirmation");
    const showPd = screen.getByLabelText("Show PD");
    fireEvent.change(swing, { target: { value: "21" } });
    fireEvent.blur(swing);
    fireEvent.change(internal, { target: { value: "3" } });
    fireEvent.blur(internal);
    fireEvent.change(structureLine, { target: { value: "44" } });
    fireEvent.blur(structureLine);
    fireEvent.change(fvgLookback, { target: { value: "90" } });
    fireEvent.blur(fvgLookback);
    fireEvent.change(fvgFactor, { target: { value: "1.8" } });
    fireEvent.blur(fvgFactor);
    fireEvent.click(fvgVolume);
    fireEvent.change(fvgExtend, { target: { value: "2" } });
    fireEvent.blur(fvgExtend);
    fireEvent.change(fvgLimit, { target: { value: "4" } });
    fireEvent.blur(fvgLimit);
    fireEvent.click(showPd);

    expect(onSmc).toHaveBeenCalledWith({ ...SMC, swingLength: 21 });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, internalLength: 3 });
    expect(onSmc).toHaveBeenCalledWith({
      ...SMC,
      structureLineExtendBars: 44,
    });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, fvgThresholdLookback: 90 });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, fvgThresholdMultiplier: 1.8 });
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, fvgVolumeConfirmation: true });
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
    fireEvent.click(screen.getByLabelText("EMA/OSB settings"));
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
    fireEvent.click(screen.getByLabelText("EMA/OSB settings"));
    const input = screen.getByLabelText("EMA length") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(onEma).not.toHaveBeenCalled();
    expect(input.value).toBe("21"); // reverted
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
    const asia = screen.getByLabelText("BigTrade Asia min volume");
    const eu = screen.getByLabelText("BigTrade EU min volume");
    const us = screen.getByLabelText("BigTrade US min volume");
    const limit = screen.getByLabelText("BigTrade display limit");
    fireEvent.change(asia, { target: { value: "35" } });
    fireEvent.blur(asia);
    fireEvent.change(eu, { target: { value: "60" } });
    fireEvent.blur(eu);
    fireEvent.change(us, { target: { value: "120" } });
    fireEvent.blur(us);
    fireEvent.change(limit, { target: { value: "200" } });
    fireEvent.blur(limit);

    expect(onBigTradeSettings).toHaveBeenCalledWith({
      ...DEFAULT_BIG_TRADE_SETTINGS,
      minVolume: 35,
      sessionMinVolumes: {
        asia: 35,
        eu: 50,
        us: 100,
      },
    });
    expect(onBigTradeSettings).toHaveBeenCalledWith({
      ...DEFAULT_BIG_TRADE_SETTINGS,
      minVolume: 30,
      sessionMinVolumes: {
        asia: 30,
        eu: 60,
        us: 100,
      },
    });
    expect(onBigTradeSettings).toHaveBeenCalledWith({
      ...DEFAULT_BIG_TRADE_SETTINGS,
      minVolume: 30,
      sessionMinVolumes: {
        asia: 30,
        eu: 50,
        us: 120,
      },
    });
    expect(onBigTradeSettings).toHaveBeenCalledWith({
      ...DEFAULT_BIG_TRADE_SETTINGS,
      maxVisible: 200,
    });
  });
});
