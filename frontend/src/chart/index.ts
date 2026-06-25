// chart module — TradingView Lightweight Charts layout and chrome.
//
// Design Frontend Modules mapped here (see design.md "Frontend Modules"):
//   - ChartContainer       (Req 11.3, 19.1, 19.2)  hosts candle + volume series, incremental updates
//   - IndicatorLayer       (Req 13, 15.5, 19.2)    VolumeDelta + BigTrade series/markers
//   - CrosshairBox         (Req 19.5)              OHLCV readout following crosshair
//   - Toolbar              (Req 19.1)              top toolbar chrome
//   - TimeframeSelector    (Req 19.1)              timeframe switch control
//   - SymbolContractLabel  (Req 10.1, 10.3)        shows GC + resolved contract
//
// ChartContainer (candle + volume series + the incremental bar reducer) is
// implemented in task 12.3. The pure reducer (`barReducer.ts`) is the seam
// Property 22 (task 12.4) tests; the Lightweight Charts library is isolated
// behind `lightweightChartsAdapter.ts` so the reducer/controller are testable
// without a real canvas. IndicatorLayer (14.4), CrosshairBox/Toolbar/etc.
// (12.7) land in later tasks.

export {
  type BarApplication,
  type BarApplicationKind,
  type BarSeries,
  applyBarUpdate,
  barsEqual,
  reduceBars,
} from "./barReducer";

export {
  type ApplyOutcome,
  type ChartSeriesPort,
  ChartSeriesController,
} from "./chartSeriesController";

export {
  type EmaPoint,
  emaSeries,
  emaSmoothing,
  nextEma,
} from "./ema";

export {
  type SmcMarker,
  type SmcMarkerKind,
  type SmcLine,
  type SmcLineKind,
  type SmcOverlay,
  type SmcPremiumDiscountKind,
  type SmcSettings,
  type SmcZone,
  type SmcZoneKind,
  DEFAULT_SMC_SETTINGS,
  computeSmcOverlay,
} from "./smc";

export {
  type OutsideBarDeltaFilterSettings,
  type OutsideBarDeltaPoint,
  type OutsideBarFilterContext,
  type OutsideBarSignalSide,
  type OutsideBarSettings,
  DEFAULT_OUTSIDE_BAR_DELTA_FILTER,
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  isOutsideBar,
  normalizeOutsideBarDeltaFilterSettings,
  normalizeOutsideBarSettings,
  outsideBarColor,
  outsideBarSignal,
} from "./outsideBar";

export {
  type DeltaColors,
  type EmaLineData,
  type LightweightChartsAdapterOptions,
  type VolumeDeltaDatum,
  type AlertLine,
  type OrderLine,
  type OrderLineField,
  type PriceLineSelection,
  type SmcAiSignalMarker,
  LightweightChartsAdapter,
  WAVE_DELTA_OVERLAY_PRICE_SCALE_ID,
  WAVE_DELTA_OVERLAY_SCALE_MARGINS,
  CVD_OVERLAY_PRICE_SCALE_ID,
  CVD_OVERLAY_SCALE_MARGINS,
  VOLUME_OVERLAY_PRICE_SCALE_ID,
  VOLUME_OVERLAY_SCALE_MARGINS,
  toUtcTimestamp,
} from "./lightweightChartsAdapter";

export {
  type TimezoneOffsetOption,
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  TIMEZONE_OFFSET_OPTIONS,
  formatClockForOffset,
  formatCrosshairTimeForOffset,
  formatTickMarkForOffset,
  formatUtcOffset,
  normalizeTimezoneOffsetMinutes,
} from "./timezone";

export {
  type ChartContainerProps,
  type ChartPortFactory,
  type DisposableChartPort,
  type OrderControl,
  ChartContainer,
  filterBigTradeMarkers,
} from "./ChartContainer";

// Layout chrome (task 12.7): Toolbar, TimeframeSelector, SymbolContractLabel,
// and the crosshair OHLCV readout (Req 10.1, 10.3, 19.1, 19.5).
export { Toolbar } from "./Toolbar";
export type { ToolbarProps } from "./Toolbar";

export { TimeframeSelector, TIMEFRAMES } from "./TimeframeSelector";
export type { TimeframeSelectorProps } from "./TimeframeSelector";

export { SymbolContractLabel } from "./SymbolContractLabel";
export type { SymbolContractLabelProps } from "./SymbolContractLabel";

export { ContractSelector } from "./ContractSelector";
export type { ContractSelectorProps } from "./ContractSelector";

export {
  IndicatorToggles,
  DEFAULT_BIG_TRADE_SETTINGS,
  DEFAULT_FOOTPRINT_SETTINGS,
} from "./IndicatorToggles";
export type {
  BigTradeSettings,
  FootprintSettings,
  IndicatorTogglesProps,
} from "./IndicatorToggles";

export { CrosshairBox } from "./CrosshairBox";
export type { CrosshairBoxProps } from "./CrosshairBox";
