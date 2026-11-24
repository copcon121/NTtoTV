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
import { DEFAULT_MGANN_BREAK_SETTINGS } from "./mgannBreak";
import { DEFAULT_OUTSIDE_BAR_SETTINGS } from "./outsideBar";
import { DEFAULT_SMC_SETTINGS, type SmcSettings } from "./smc";
import { DEFAULT_XKONTROL_DISPLAY_SETTINGS } from "./xKontrol";

afterEach(() => {
  cleanup();
});

const EMA: EmaSettings = { ...DEFAULT_EMA_SETTINGS };
const SMC: SmcSettings = { ...DEFAULT_SMC_SETTINGS };

function open() {
  fireEvent.click(screen.getByLabelText("Indicators"));
}

describe("IndicatorToggles", () => {
  it("edits the dense overlay auto-hide spacing and rejects invalid input", () => {
    const onSpacingChange = vi.fn();
    render(<IndicatorToggles
      bigTrades={false} ema={EMA} smc={SMC}
      footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
      onBigTradesChange={() => {}}
      onEmaChange={() => {}} onSmcChange={() => {}}
      onFootprintSettingsChange={() => {}}
      onDenseOverlayMinBarSpacingChange={onSpacingChange}
    />);
    open();
    const input = screen.getByLabelText("Auto-hide below (px)");
    expect(input).toHaveValue(6);
    fireEvent.change(input, { target: { value: "9.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSpacingChange).toHaveBeenLastCalledWith(9.5);
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(onSpacingChange).toHaveBeenLastCalledWith(0);
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);
    expect(input).toHaveValue(6);
    expect(onSpacingChange).toHaveBeenCalledTimes(2);
  });

  it("configures the optional Orderflows Gaps swing filter", () => {
    const onSettings = vi.fn();
    render(
      <IndicatorToggles
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        onFootprintSettingsChange={onSettings}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("Footprint settings"));
    const swingToggle = screen.getByLabelText("Orderflows Gaps swing filter");
    expect(swingToggle).not.toBeDisabled();
    fireEvent.click(swingToggle);
    expect(onSettings).toHaveBeenLastCalledWith({
      ...DEFAULT_FOOTPRINT_SETTINGS,
      orderflowsGapsUseSwingFilter: true,
    });
  });

  it("configures the three XKontrol levels independently", () => {
    const onSettings = vi.fn();
    render(
      <IndicatorToggles
        xKontrol
        xKontrolSettings={DEFAULT_XKONTROL_DISPLAY_SETTINGS}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onXKontrolSettingsChange={onSettings}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("XKontrol settings"));
    expect(screen.getByLabelText("XKontrol Level 1 Initial")).toBeChecked();
    expect(screen.getByLabelText("XKontrol Level 2 Strong")).toBeChecked();
    expect(screen.getByLabelText("XKontrol Level 3 Total")).toBeChecked();

    fireEvent.click(screen.getByLabelText("XKontrol Level 1 Initial"));
    fireEvent.click(screen.getByLabelText("XKontrol Level 2 Strong"));
    fireEvent.click(screen.getByLabelText("XKontrol Level 3 Total"));

    expect(onSettings).toHaveBeenNthCalledWith(1, {
      ...DEFAULT_XKONTROL_DISPLAY_SETTINGS,
      showInitial: false,
    });
    expect(onSettings).toHaveBeenNthCalledWith(2, {
      ...DEFAULT_XKONTROL_DISPLAY_SETTINGS,
      showStrong: false,
    });
    expect(onSettings).toHaveBeenNthCalledWith(3, {
      ...DEFAULT_XKONTROL_DISPLAY_SETTINGS,
      showTotal: false,
    });
  });

  it("opens the dropdown and toggles each indicator", () => {
    const onVolumeDelta = vi.fn();
    const onMgannSwing = vi.fn();
    const onFvgGrader = vi.fn();
    const onMgannBreak = vi.fn();
    const onBigTrades = vi.fn();
    const onEma = vi.fn();
    const onSmc = vi.fn();
    const onOutsideBar = vi.fn();
    render(
      <IndicatorToggles
        bigTrades
        ema={EMA}
        smc={SMC}
        onVolumeDeltaChange={onVolumeDelta}
        onMgannSwingChange={onMgannSwing}
        onFvgGraderChange={onFvgGrader}
        onMgannBreakChange={onMgannBreak}
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
    expect(screen.getByLabelText("Volume")).toBeChecked();
    expect(screen.getByLabelText("Volume")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Volume Delta"));
    fireEvent.click(screen.getByLabelText("MGannSwing"));
    fireEvent.click(screen.getByLabelText("EMA/OSB"));
    fireEvent.click(screen.getByLabelText("SMC"));
    fireEvent.click(screen.getByLabelText("FVG Grader"));
    fireEvent.click(screen.getByLabelText("mGann Break L/S"));
    fireEvent.click(screen.getByLabelText("BigTrade"));

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
    expect(onFvgGrader).toHaveBeenCalledWith(true);
    expect(onMgannBreak).toHaveBeenCalledWith(false);
    expect(onBigTrades).toHaveBeenCalledWith(false);
  });

  it("shows MGannSwing as a standalone indicator with its own settings", () => {
    const onMgannSwing = vi.fn();
    const onMgannSwingSettings = vi.fn();
    render(
      <IndicatorToggles
        mgannSwing={false}
        mgannSwingSettings={DEFAULT_MGANN_SWING_SETTINGS}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onMgannSwingChange={onMgannSwing}
        onMgannSwingSettingsChange={onMgannSwingSettings}
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

  it("keeps GC Push Momentum out of the indicator menu", () => {
    render(
      <IndicatorToggles
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.queryByLabelText("GC Push Momentum")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GC Push Momentum settings")).not.toBeInTheDocument();
    expect(screen.getByLabelText("TDU Buy/Sell Momentum")).toBeEnabled();
  });

  it("disables TDU Buy/Sell Momentum outside M1 and M5", () => {
    render(
      <IndicatorToggles
        tduSignals
        tduSignalsDisabled
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByLabelText("TDU Buy/Sell Momentum")).toBeDisabled();
  });

  it("can disable MGannSwing independently", () => {
    const onMgannSwing = vi.fn();
    render(
      <IndicatorToggles
        mgannSwing
        mgannSwingDisabled
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onMgannSwingChange={onMgannSwing}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByLabelText("MGannSwing")).toBeDisabled();
    expect(screen.getByLabelText("MGannSwing settings")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("MGannSwing"));
    fireEvent.click(screen.getByLabelText("MGannSwing settings"));

    expect(onMgannSwing).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("MGannSwing Wave Delta")).not.toBeInTheDocument();
  });

  it("edits Volume Profile display settings", () => {
    const onWidth = vi.fn();
    const onDevelopingPoc = vi.fn();
    const onRowTicks = vi.fn();
    const onDays = vi.fn();
    render(
      <IndicatorToggles
        dailyVolumeProfile
        dailyVolumeProfileWidth={84}
        dailyVolumeProfileDevelopingPoc
        dailyVolumeProfileRowTicks={2}
        dailyVolumeProfileDays={1}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onDailyVolumeProfileWidthChange={onWidth}
        onDailyVolumeProfileDevelopingPocChange={onDevelopingPoc}
        onDailyVolumeProfileRowTicksChange={onRowTicks}
        onDailyVolumeProfileDaysChange={onDays}
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
    fireEvent.click(
      screen.getByLabelText("Volume Profile developing POC and value area"),
    );

    const tickSizeInput = screen.getByLabelText("Volume Profile tick size");
    expect(tickSizeInput).toHaveValue(2);
    fireEvent.change(tickSizeInput, { target: { value: "5" } });
    fireEvent.keyDown(tickSizeInput, { key: "Enter" });

    const daysInput = screen.getByLabelText("Volume Profile days");
    expect(daysInput).toHaveValue(1);
    fireEvent.change(daysInput, { target: { value: "3" } });
    fireEvent.blur(daysInput);

    expect(onWidth).toHaveBeenCalledWith(96);
    expect(onDevelopingPoc).toHaveBeenCalledWith(false);
    expect(onRowTicks).toHaveBeenCalledWith(5);
    expect(onDays).toHaveBeenCalledWith(3);
  });

  it("offers footprint settings in place of the five-bar toggle", () => {
    render(
      <IndicatorToggles
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.queryByRole("checkbox", { name: "Footprint" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Footprint settings" })).toBeEnabled();
    expect(screen.getByLabelText("FVG Grader")).not.toBeDisabled();
    expect(screen.getByLabelText("BigTrade")).not.toBeDisabled();
    expect(screen.getByLabelText("EMA/OSB")).not.toBeDisabled();
    expect(screen.getByLabelText("SMC")).not.toBeDisabled();
  });

  it("can disable FVG Grader independently", () => {
    render(
      <IndicatorToggles
        fvgGrader={false}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        fvgGraderDisabled
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByLabelText("FVG Grader")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Footprint settings" })).toBeEnabled();
    expect(screen.getByLabelText("BigTrade")).not.toBeDisabled();
  });

  it("edits the FVG Grader display limit", () => {
    const onLimit = vi.fn();
    render(
      <IndicatorToggles
        fvgGrader
        fvgSignalLimit={100}
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        onFvgSignalLimitChange={onLimit}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("FVG Grader settings"));
    fireEvent.change(screen.getByLabelText("FVG Grader display limit"), {
      target: { value: "150" },
    });

    expect(onLimit).toHaveBeenCalledWith(150);
  });

  it("edits the mGann Break L/S chart history window and signal limit", () => {
    const onHistoryBars = vi.fn();
    const onLimit = vi.fn();
    render(
      <IndicatorToggles
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        mgannBreakSignalHistoryBars={1000}
        mgannBreakSignalLimit={500}
        onMgannBreakSignalHistoryBarsChange={onHistoryBars}
        onMgannBreakSignalLimitChange={onLimit}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("mGann Break L/S display settings"));
    fireEvent.change(screen.getByLabelText("mGann Break L/S history bars"), {
      target: { value: "2500" },
    });
    fireEvent.change(screen.getByLabelText("mGann Break L/S display limit"), {
      target: { value: "750" },
    });

    expect(onHistoryBars).toHaveBeenCalledWith(2500);
    expect(onLimit).toHaveBeenCalledWith(750);
  });

  it("edits mGann Break detector settings and creates a server alert", () => {
    const onSettings = vi.fn();
    const onCreateAlert = vi.fn();
    render(
      <IndicatorToggles
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        mgannBreakSettings={DEFAULT_MGANN_BREAK_SETTINGS}
        onMgannBreakSettingsChange={onSettings}
        onCreateMgannBreakAlert={onCreateAlert}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    fireEvent.click(screen.getByLabelText("mGann Break L/S display settings"));
    fireEvent.click(screen.getByLabelText("mGann Break require BigTrade"));
    fireEvent.change(screen.getByLabelText("mGann Break Delta x"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByLabelText("mGann Break liquidity filter"));
    fireEvent.click(screen.getByRole("button", { name: "Create server alert" }));

    expect(onSettings).toHaveBeenNthCalledWith(1, {
      ...DEFAULT_MGANN_BREAK_SETTINGS,
      requireBigTrade: true,
    });
    expect(onSettings).toHaveBeenNthCalledWith(2, {
      ...DEFAULT_MGANN_BREAK_SETTINGS,
      volumeDeltaMultiplier: 3,
    });
    expect(onSettings).toHaveBeenNthCalledWith(3, {
      ...DEFAULT_MGANN_BREAK_SETTINGS,
      filterLiquidity: false,
    });
    expect(onCreateAlert).toHaveBeenCalledTimes(1);
  });

  it("can disable BigTrade independently", () => {
    render(
      <IndicatorToggles
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        bigTradeDisabled
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );

    open();
    expect(screen.getByRole("button", { name: "Footprint settings" })).toBeEnabled();
    expect(screen.getByLabelText("BigTrade")).toBeDisabled();
    expect(screen.getByLabelText("EMA/OSB")).not.toBeDisabled();
    expect(screen.getByLabelText("SMC")).not.toBeDisabled();
  });

  it("shows a count badge of active indicators", () => {
    render(
      <IndicatorToggles
        bigTrades
        ema={{ ...EMA, enabled: true }}
        smc={SMC}
        onBigTradesChange={() => {}}
        onEmaChange={() => {}}
        onSmcChange={() => {}}
        footprintSettings={DEFAULT_FOOTPRINT_SETTINGS}
        onFootprintSettingsChange={() => {}}
      />,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows the master visibility state without putting the toggle in the menu", () => {
    const props = {
      bigTrades: true,
      ema: { ...EMA, enabled: true },
      smc: SMC,
      onBigTradesChange: () => {},
      onEmaChange: () => {},
      onSmcChange: () => {},
      footprintSettings: DEFAULT_FOOTPRINT_SETTINGS,
      onFootprintSettingsChange: () => {},
    };
    const { rerender } = render(
      <IndicatorToggles {...props} indicatorsVisible />,
    );

    open();
    expect(screen.queryByLabelText("Hide all indicators")).toBeNull();

    rerender(<IndicatorToggles {...props} indicatorsVisible={false} />);
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Footprint" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("BigTrade")).toBeChecked();
  });

  it("toggles and edits Outside Bar settings", () => {
    const onOutsideBar = vi.fn();
    render(
      <IndicatorToggles
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        outsideBar={DEFAULT_OUTSIDE_BAR_SETTINGS}
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
        bigTrades={false}
        ema={EMA}
        smc={SMC}
        outsideBar={outsideBar}
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
        bigTrades={false}
        ema={EMA}
        smc={SMC}
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
        bigTrades={false}
        ema={EMA}
        smc={SMC}
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
        bigTrades={false}
        ema={EMA}
        smc={SMC}
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
    const liquidityPool = screen.getByLabelText(
      "SMC liquidity pool minimum swings",
    );
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
    fireEvent.change(liquidityPool, { target: { value: "4" } });
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
    expect(onSmc).toHaveBeenCalledWith({ ...SMC, liquidityMinSwings: 4 });
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
        bigTrades={false}
        ema={EMA}
        smc={SMC}
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
        bigTrades={false}
        ema={EMA}
        smc={SMC}
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
        bigTrades
        ema={EMA}
        smc={SMC}
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
    fireEvent.change(limit, { target: { value: "40" } });
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
      maxVisible: 40,
    });
  });
});
