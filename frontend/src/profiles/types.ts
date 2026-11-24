import type {
  BigTradeSettings,
  EmaSettings,
  FootprintSettings,
} from "../chart/IndicatorToggles";
import type { FixedRangeProfileMode } from "../chart/drawings/types";
import type { DrawingState } from "../chart/drawings/types";
import type { OutsideBarSettings } from "../chart/outsideBar";
import type { MgannSwingSettings } from "../chart/mgannSwing";
import type { MgannBreakSettings } from "../chart/mgannBreak";
import type { XKontrolDisplaySettings } from "../chart/xKontrol";
import type { SmcSettings } from "../chart/smc";
import type { SweepReversalSettings } from "../chart/sweepReversal";
import type { SupertrendSettings } from "../chart/supertrend";
import type { Timeframe } from "../socket/messages";

export interface ProfileMarketOrderSettings {
  volumeLots: number;
  slDistanceGc: number;
  tpDistanceGc: number;
  /** Close half of each new manual Market/Limit order once it reaches +1R. */
  takeProfit1rEnabled?: boolean;
  /** Arm the current SuperTrend trailing configuration after the 1R partial. */
  autoSupertrendAfter1rEnabled?: boolean;
  /** Optional sizing mode for backwards compatibility with older profiles. */
  sizingMode?: "lots" | "risk";
  /** Target account-currency risk for chart orders when sizingMode is "risk". */
  riskAmount?: number;
}

export interface LiquidityChartProfileState {
  version: 1;
  heatmap?: import("../liquidity/heatmap").LiquidityHeatmapSettings;
  timeframe: "15s" | "30s" | "1m" | "5m";
  visibleBars: number;
  offsetBars: number;
  priceScale: number;
  pricePanPx: number;
  filters: {
    longTerm: boolean;
    relative: boolean;
    absolute: boolean;
  };
  showVwap: boolean;
  showBigTrades: boolean;
  /** Native iceberg display settings belong to the standalone liquidity page. */
  showNativeIcebergs?: boolean;
  nativeIcebergSessionMinVolumes?: import("../liquidity/icebergSessions").IcebergSessionMinVolumes;
  nativeIcebergFilters?: import("../liquidity/icebergFilters").IcebergFilterSettings;
  siStops?: import("../liquidity/siStops").SiStopSettings;
  alertSounds?: import("../liquidity/alertSounds").LiquidityAlertSounds;
  bigTradeSettings: BigTradeSettings;
}

export interface ChartProfilePayload {
  version: 1;
  timeframe: Timeframe;
  chartBackgroundColor: string;
  /** Candle spacing below which dense indicator overlays are hidden. */
  denseOverlayMinBarSpacing?: number;
  /** Optional for backwards compatibility with profiles saved before Volume existed. */
  showVolume?: boolean;
  /** Optional for backwards compatibility with profiles saved before this toggle existed. */
  showVolumeDelta?: boolean;
  /** Optional for profiles saved before the XKontrol overlay existed. */
  showXKontrol?: boolean;
  /** Optional level visibility for the XKontrol overlay. */
  xKontrol?: XKontrolDisplaySettings;
  /** Original TDU triangles and candle/delta divergence overlay. */
  showTduSignals?: boolean;
  /** Optional for backwards compatibility with profiles saved before this toggle existed. */
  showCvd?: boolean;
  /** Optional for backwards compatibility with profiles saved before this toggle existed. */
  showDailyVolumeProfile?: boolean;
  /** Optional session volume profile histogram width in CSS pixels. */
  dailyVolumeProfileWidth?: number;
  /** Optional flag to show the session developing POC and value-area paths. */
  showDailyVolumeProfileDevelopingPoc?: boolean;
  /** Optional session volume profile row ticks (price grouping). */
  dailyVolumeProfileRowTicks?: number;
  /** Optional number of trading sessions included in the session volume profile. */
  dailyVolumeProfileDays?: number;
  /** Optional for backwards compatibility with profiles saved before MGannSwing existed. */
  showMgannSwing?: boolean;
  /** Optional for backwards compatibility with profiles saved before MGannSwing existed. */
  mgannSwing?: MgannSwingSettings;
  /** Legacy setting from profiles saved before footprint zoom replaced the preview. */
  showFootprint?: boolean;
  /** Optional for backwards compatibility with profiles saved before FVG Grader existed. */
  showFvgGrader?: boolean;
  /** Optional maximum number of FVG Grader signals to fetch/display on M1. */
  fvgSignalLimit?: number;
  /** Optional for backwards compatibility with profiles saved before mGann Break visibility existed. */
  showMgannBreak?: boolean;
  /** Optional M1 lookback window used to load mGann Break L/S chart markers. */
  mgannBreakSignalHistoryBars?: number;
  /** Optional maximum number of mGann Break L/S chart markers to display. */
  mgannBreakSignalLimit?: number;
  /** Detection settings for the standalone mGann Break L/S indicator. */
  mgannBreak?: MgannBreakSettings;
  /** Version of the mGann Break detector settings, used to retire stale snapshots. */
  mgannBreakSettingsVersion?: number;
  showBigTrades: boolean;
  ema: EmaSettings;
  /** Optional for profiles saved before Supertrend was introduced. */
  supertrend?: SupertrendSettings;
  smc: SmcSettings;
  /** Optional for profiles saved before standalone Sweep Reversal existed. */
  sweepReversal?: SweepReversalSettings;
  outsideBar?: OutsideBarSettings;
  footprintSettings: FootprintSettings;
  bigTradeSettings?: BigTradeSettings;
  /** Standalone /lq display state, saved independently from the main chart. */
  liquidityChart?: LiquidityChartProfileState;
  marketOrderSettings?: ProfileMarketOrderSettings;
  timezoneOffsetMinutes?: number;
  fixedRangeProfileMode?: FixedRangeProfileMode;
  drawings: DrawingState[];
}

export interface ChartProfile {
  id: string;
  name: string;
  payload: ChartProfilePayload;
  createdAt: number;
  updatedAt: number;
}
