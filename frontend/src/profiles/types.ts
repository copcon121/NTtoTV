import type {
  BigTradeSettings,
  EmaSettings,
  FootprintSettings,
} from "../chart/IndicatorToggles";
import type { FixedRangeProfileMode } from "../chart/drawings/types";
import type { DrawingState } from "../chart/drawings/types";
import type { OutsideBarSettings } from "../chart/outsideBar";
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
  showFootprint: boolean;
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
