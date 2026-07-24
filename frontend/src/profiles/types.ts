import type {
  BigTradeSettings,
  EmaSettings,
  FootprintSettings,
} from "../chart/IndicatorToggles";
import type { FixedRangeProfileMode } from "../chart/drawings/types";
import type { DrawingState } from "../chart/drawings/types";
import type { OutsideBarSettings } from "../chart/outsideBar";
import type { MgannSwingSettings } from "../chart/mgannSwing";
import type { SmcSettings } from "../chart/smc";
import type { Timeframe } from "../socket/messages";

export interface ProfileMarketOrderSettings {
  volumeLots: number;
  slDistanceGc: number;
  tpDistanceGc: number;
}

export interface ChartProfilePayload {
  version: 1;
  timeframe: Timeframe;
  chartBackgroundColor: string;
  /** Optional for backwards compatibility with profiles saved before Volume existed. */
  showVolume?: boolean;
  /** Optional for backwards compatibility with profiles saved before this toggle existed. */
  showVolumeDelta?: boolean;
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
