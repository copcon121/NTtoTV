import type {
  BigTradeSettings,
  EmaSettings,
  FootprintSettings,
} from "../chart/IndicatorToggles";
import type { FixedRangeProfileMode } from "../chart/drawings/types";
import type { DrawingState } from "../chart/drawings/types";
import type { OutsideBarSettings } from "../chart/outsideBar";
import type { MgannSwingSettings } from "../chart/mgannSwing";
import type { GcPushMomentumSettings } from "../chart/gcPushMomentum";
import type { SmcSettings } from "../chart/smc";
import type { Timeframe } from "../socket/messages";

export interface ProfileMarketOrderSettings {
  volumeLots: number;
  slDistanceGc: number;
  tpDistanceGc: number;
  /** Optional sizing mode for backwards compatibility with older profiles. */
  sizingMode?: "lots" | "risk";
  /** Target account-currency risk for chart orders when sizingMode is "risk". */
  riskAmount?: number;
}

export interface ChartProfilePayload {
  version: 1;
  timeframe: Timeframe;
  chartBackgroundColor: string;
  /** Optional for backwards compatibility with profiles saved before Volume existed. */
  showVolume?: boolean;
  /** Optional for backwards compatibility with profiles saved before this toggle existed. */
  showVolumeDelta?: boolean;
  /** Optional for profiles saved before GC Push Momentum existed. */
  showGcPushMomentum?: boolean;
  /** Optional volatility/threshold configuration for GC Push Momentum. */
  gcPushMomentum?: GcPushMomentumSettings;
  /** Optional for backwards compatibility with profiles saved before this toggle existed. */
  showCvd?: boolean;
  /** Optional for backwards compatibility with profiles saved before this toggle existed. */
  showDailyVolumeProfile?: boolean;
  /** Optional session volume profile histogram width in CSS pixels. */
  dailyVolumeProfileWidth?: number;
  /** Optional flag to show the session developing POC and value-area paths. */
  showDailyVolumeProfileDevelopingPoc?: boolean;
  /** Optional for backwards compatibility with profiles saved before MGannSwing existed. */
  showMgannSwing?: boolean;
  /** Optional for backwards compatibility with profiles saved before MGannSwing existed. */
  mgannSwing?: MgannSwingSettings;
  showFootprint: boolean;
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
  showBigTrades: boolean;
  ema: EmaSettings;
  smc: SmcSettings;
  outsideBar?: OutsideBarSettings;
  footprintSettings: FootprintSettings;
  bigTradeSettings?: BigTradeSettings;
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
