import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  normalizeOutsideBarSettings,
  type OutsideBarSettings,
} from "./outsideBar";
import {
  DEFAULT_MGANN_SWING_SETTINGS,
  normalizeMgannSwingSettings,
  type MgannSwingSettings,
} from "./mgannSwing";
import {
  DEFAULT_MGANN_BREAK_SETTINGS,
  normalizeMgannBreakSettings,
  type MgannBreakSettings,
} from "./mgannBreak";
import { type SmcSettings } from "./smc";
import {
  DEFAULT_SWEEP_REVERSAL_SETTINGS,
  normalizeSweepReversalSettings,
  type SweepReversalSettings,
} from "./sweepReversal";
import {
  BIG_TRADE_SESSIONS,
  DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES,
  normalizeBigTradeSessionMinVolumes,
  type BigTradeSession,
  type BigTradeSessionMinVolumes,
} from "./bigTradeSessions";
import {
  DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  MAX_SESSION_VOLUME_PROFILE_WIDTH_PX,
  MIN_SESSION_VOLUME_PROFILE_WIDTH_PX,
  normalizeSessionVolumeProfileWidth,
} from "./sessionVolumeProfileSettings";
import {
  DEFAULT_GC_PUSH_MOMENTUM_SETTINGS,
  normalizeGcPushMomentumSettings,
  type GcPushMomentumSettings,
} from "./gcPushMomentum";

/**
 * IndicatorToggles â€” TradingView-style "Indicators" dropdown.
 *
 * A single button opens a popover listing the available indicators, each with
 * an enable/disable checkbox. Volume is intentionally always enabled. The EMA
 * row has a gear button that opens a small settings panel to edit the EMA
 * length and line color. Footprint is M1-only and can be disabled
 * independently. EMA is an explicitly-added overlay (Req 19.3).
 */
export interface EmaSettings {
  enabled: boolean;
  period: number;
  color: string;
  showEma200: boolean;
  ema200Color: string;
}

export const DEFAULT_EMA_SETTINGS: EmaSettings = {
  enabled: true,
  period: 21,
  color: "#2962ff",
  showEma200: true,
  ema200Color: "#e0b341",
};

export function normalizeEmaSettings(input?: Partial<EmaSettings> | null): EmaSettings {
  const rawPeriod = Number(input?.period ?? DEFAULT_EMA_SETTINGS.period);
  const period = Number.isFinite(rawPeriod)
    ? Math.max(1, Math.round(rawPeriod))
    : DEFAULT_EMA_SETTINGS.period;
  return {
    enabled: input?.enabled ?? DEFAULT_EMA_SETTINGS.enabled,
    period,
    color:
      typeof input?.color === "string"
        ? input.color
        : DEFAULT_EMA_SETTINGS.color,
    showEma200: input?.showEma200 ?? DEFAULT_EMA_SETTINGS.showEma200,
    ema200Color:
      typeof input?.ema200Color === "string"
        ? input.ema200Color
        : DEFAULT_EMA_SETTINGS.ema200Color,
  };
}

export interface FootprintSettings {
  showVA: boolean;
  vaPercent: number;
  imbalanceMinVolume: number;
  showImbalance: boolean;
  showAbsorption: boolean;
  absorptionPercent: number;
  absorptionDepth: number;
  absorptionFilter: number;
  showUnfinishedAuction: boolean;
}

export interface BigTradeSettings {
  minVolume: number;
  maxVisible: number;
  soundEnabled?: boolean;
  sessionMinVolumes?: BigTradeSessionMinVolumes;
}

/** Hard rendering budget for the custom BigTrade canvas primitive. */
export const MAX_BIG_TRADE_VISIBLE = 500;

export const DEFAULT_FOOTPRINT_SETTINGS: FootprintSettings = {
  showVA: false,
  vaPercent: 70,
  imbalanceMinVolume: 10,
  showImbalance: true,
  showAbsorption: true,
  absorptionPercent: 100,
  absorptionDepth: 5,
  absorptionFilter: 3,
  showUnfinishedAuction: true,
};

export const DEFAULT_BIG_TRADE_SETTINGS: BigTradeSettings = {
  minVolume: DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES.asia,
  maxVisible: MAX_BIG_TRADE_VISIBLE,
  soundEnabled: false,
  sessionMinVolumes: DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES,
};

export function normalizeBigTradeMaxVisible(value: unknown): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed)
    ? Math.min(MAX_BIG_TRADE_VISIBLE, Math.max(1, parsed))
    : DEFAULT_BIG_TRADE_SETTINGS.maxVisible;
}
export const DEFAULT_FVG_SIGNAL_LIMIT = 100;
export const MIN_FVG_SIGNAL_LIMIT = 25;
export const MAX_FVG_SIGNAL_LIMIT = 2000;
export const DEFAULT_MGANN_BREAK_SIGNAL_HISTORY_BARS = 1000;
export const MIN_MGANN_BREAK_SIGNAL_HISTORY_BARS = 250;
export const MAX_MGANN_BREAK_SIGNAL_HISTORY_BARS = 5000;
export const DEFAULT_MGANN_BREAK_SIGNAL_LIMIT = 500;
export const MIN_MGANN_BREAK_SIGNAL_LIMIT = 25;
export const MAX_MGANN_BREAK_SIGNAL_LIMIT = 5000;

export function normalizeFvgSignalLimit(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_FVG_SIGNAL_LIMIT;
  return Math.min(MAX_FVG_SIGNAL_LIMIT, Math.max(MIN_FVG_SIGNAL_LIMIT, parsed));
}

export function normalizeMgannBreakSignalHistoryBars(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_MGANN_BREAK_SIGNAL_HISTORY_BARS;
  return Math.min(
    MAX_MGANN_BREAK_SIGNAL_HISTORY_BARS,
    Math.max(MIN_MGANN_BREAK_SIGNAL_HISTORY_BARS, parsed),
  );
}

export function normalizeMgannBreakSignalLimit(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_MGANN_BREAK_SIGNAL_LIMIT;
  return Math.min(
    MAX_MGANN_BREAK_SIGNAL_LIMIT,
    Math.max(MIN_MGANN_BREAK_SIGNAL_LIMIT, parsed),
  );
}

export interface IndicatorTogglesProps {
  /** Temporary master visibility; individual indicator settings stay unchanged. */
  indicatorsVisible?: boolean;
  volumeDelta?: boolean;
  gcPushMomentum?: boolean;
  gcPushMomentumSettings?: Partial<GcPushMomentumSettings>;
  mgannSwing?: boolean;
  mgannSwingSettings?: Partial<MgannSwingSettings>;
  footprint: boolean;
  fvgGrader?: boolean;
  fvgSignalLimit?: number;
  /** Whether mGann Break L/S markers are visible on the chart. */
  mgannBreak?: boolean;
  mgannBreakSignalHistoryBars?: number;
  mgannBreakSignalLimit?: number;
  mgannBreakSettings?: Partial<MgannBreakSettings>;
  bigTrades: boolean;
  ema: EmaSettings;
  smc: SmcSettings;
  sweepReversal?: Partial<SweepReversalSettings>;
  outsideBar?: OutsideBarSettings;
  footprintSettings: FootprintSettings;
  bigTradeSettings?: BigTradeSettings;
  mgannSwingDisabled?: boolean;
  gcPushMomentumDisabled?: boolean;
  footprintDisabled?: boolean;
  fvgGraderDisabled?: boolean;
  bigTradeDisabled?: boolean;
  onVolumeDeltaChange?: (enabled: boolean) => void;
  onGcPushMomentumChange?: (enabled: boolean) => void;
  onGcPushMomentumSettingsChange?: (next: GcPushMomentumSettings) => void;
  onMgannSwingChange?: (enabled: boolean) => void;
  onMgannSwingSettingsChange?: (next: MgannSwingSettings) => void;
  onFootprintChange: (enabled: boolean) => void;
  onFvgGraderChange?: (enabled: boolean) => void;
  onFvgSignalLimitChange?: (limit: number) => void;
  onMgannBreakChange?: (enabled: boolean) => void;
  onMgannBreakSignalHistoryBarsChange?: (bars: number) => void;
  onMgannBreakSignalLimitChange?: (limit: number) => void;
  onMgannBreakSettingsChange?: (next: MgannBreakSettings) => void;
  onCreateMgannBreakAlert?: () => void;
  dailyVolumeProfile?: boolean;
  dailyVolumeProfileWidth?: number;
  dailyVolumeProfileDevelopingPoc?: boolean;
  onDailyVolumeProfileChange?: (enabled: boolean) => void;
  onDailyVolumeProfileWidthChange?: (widthPx: number) => void;
  onDailyVolumeProfileDevelopingPocChange?: (enabled: boolean) => void;
  onBigTradesChange: (enabled: boolean) => void;
  onEmaChange: (next: EmaSettings) => void;
  onSmcChange: (next: SmcSettings) => void;
  onSweepReversalChange?: (next: SweepReversalSettings) => void;
  onCreateSweepReversalAlert?: () => void;
  onOutsideBarChange?: (next: OutsideBarSettings) => void;
  onFootprintSettingsChange: (next: FootprintSettings) => void;
  onBigTradeSettingsChange?: (next: BigTradeSettings) => void;
}

/** A few common EMA colors for the swatch row. */
const EMA_COLOR_PRESETS = [
  "#2962ff",
  "#e0b341",
  "#26a69a",
  "#ef5350",
  "#ab47bc",
  "#d8d8d8",
];

interface RowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (enabled: boolean) => void;
  trailing?: ReactNode;
}

function IndicatorRow({
  label,
  checked,
  disabled = false,
  title,
  onChange,
  trailing,
}: RowProps) {
  return (
    <div className="indicator-row" title={title}>
      <label className="indicator-row-main">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => {
            if (!disabled) onChange(event.currentTarget.checked);
          }}
        />
        <span>{label}</span>
      </label>
      {trailing}
    </div>
  );
}

export function IndicatorToggles({
  indicatorsVisible = true,
  volumeDelta = false,
  gcPushMomentum = false,
  gcPushMomentumSettings = DEFAULT_GC_PUSH_MOMENTUM_SETTINGS,
  mgannSwing = false,
  mgannSwingSettings = DEFAULT_MGANN_SWING_SETTINGS,
  footprint,
  fvgGrader = false,
  fvgSignalLimit = DEFAULT_FVG_SIGNAL_LIMIT,
  mgannBreak = true,
  mgannBreakSignalHistoryBars = DEFAULT_MGANN_BREAK_SIGNAL_HISTORY_BARS,
  mgannBreakSignalLimit = DEFAULT_MGANN_BREAK_SIGNAL_LIMIT,
  mgannBreakSettings = DEFAULT_MGANN_BREAK_SETTINGS,
  bigTrades,
  dailyVolumeProfile = false,
  dailyVolumeProfileWidth = DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  dailyVolumeProfileDevelopingPoc = true,
  ema,
  smc,
  sweepReversal = DEFAULT_SWEEP_REVERSAL_SETTINGS,
  outsideBar = DEFAULT_OUTSIDE_BAR_SETTINGS,
  footprintSettings,
  bigTradeSettings = DEFAULT_BIG_TRADE_SETTINGS,
  mgannSwingDisabled = false,
  gcPushMomentumDisabled = false,
  footprintDisabled = false,
  fvgGraderDisabled = false,
  bigTradeDisabled = false,
  onVolumeDeltaChange = () => {},
  onGcPushMomentumChange = () => {},
  onGcPushMomentumSettingsChange = () => {},
  onMgannSwingChange = () => {},
  onMgannSwingSettingsChange = () => {},
  onFootprintChange,
  onFvgGraderChange = () => {},
  onFvgSignalLimitChange = () => {},
  onMgannBreakChange = () => {},
  onMgannBreakSignalHistoryBarsChange = () => {},
  onMgannBreakSignalLimitChange = () => {},
  onMgannBreakSettingsChange = () => {},
  onCreateMgannBreakAlert = () => {},
  onDailyVolumeProfileChange = () => {},
  onDailyVolumeProfileWidthChange = () => {},
  onDailyVolumeProfileDevelopingPocChange = () => {},
  onBigTradesChange,
  onEmaChange,
  onSmcChange,
  onSweepReversalChange = () => {},
  onCreateSweepReversalAlert = () => {},
  onOutsideBarChange = () => {},
  onFootprintSettingsChange,
  onBigTradeSettingsChange = () => {},
}: IndicatorTogglesProps) {
  const outsideBarConfig = normalizeOutsideBarSettings(outsideBar);
  const sweepConfig = normalizeSweepReversalSettings(sweepReversal);
  const mgannSwingConfig = normalizeMgannSwingSettings(mgannSwingSettings);
  const mgannBreakConfig = normalizeMgannBreakSettings(mgannBreakSettings);
  const gcPushMomentumConfig = normalizeGcPushMomentumSettings(
    gcPushMomentumSettings,
  );
  const outsideBarDeltaFilter = outsideBarConfig.deltaFilter;
  const [open, setOpen] = useState(false);
  const [combinedSettingsOpen, setCombinedSettingsOpen] = useState(false);
  const [dailyVolumeProfileSettingsOpen, setDailyVolumeProfileSettingsOpen] =
    useState(false);
  const [mgannSwingSettingsOpen, setMgannSwingSettingsOpen] = useState(false);
  const [gcPushMomentumSettingsOpen, setGcPushMomentumSettingsOpen] =
    useState(false);
  const [smcSettingsOpen, setSmcSettingsOpen] = useState(false);
  const [sweepSettingsOpen, setSweepSettingsOpen] = useState(false);
  const [fpSettingsOpen, setFpSettingsOpen] = useState(false);
  const [fvgSettingsOpen, setFvgSettingsOpen] = useState(false);
  const [mgannBreakSettingsOpen, setMgannBreakSettingsOpen] = useState(false);
  const [btSettingsOpen, setBtSettingsOpen] = useState(false);
  // Local draft for the length input so typing is smooth; committed on blur/Enter.
  const [lengthDraft, setLengthDraft] = useState(String(ema.period));
  const [smcSwingDraft, setSmcSwingDraft] = useState(String(smc.swingLength));
  const [smcInternalDraft, setSmcInternalDraft] = useState(String(smc.internalLength));
  const [smcFvgExtendDraft, setSmcFvgExtendDraft] = useState(String(smc.fvgExtendBars));
  const [smcStructureLineExtendDraft, setSmcStructureLineExtendDraft] =
    useState(String(smc.structureLineExtendBars));
  const [smcFvgLimitDraft, setSmcFvgLimitDraft] = useState(String(smc.maxFairValueGaps));
  const [smcSwingObLimitDraft, setSmcSwingObLimitDraft] = useState(
    String(smc.maxSwingOrderBlocks),
  );
  const [smcFvgLookbackDraft, setSmcFvgLookbackDraft] = useState(
    String(smc.fvgThresholdLookback),
  );
  const [smcFvgThresholdDraft, setSmcFvgThresholdDraft] = useState(
    String(smc.fvgThresholdMultiplier),
  );
  const [vaPercentDraft, setVaPercentDraft] = useState(String(footprintSettings.vaPercent));
  const [imbMinVolDraft, setImbMinVolDraft] = useState(String(footprintSettings.imbalanceMinVolume));
  const [absPercentDraft, setAbsPercentDraft] = useState(String(footprintSettings.absorptionPercent));
  const [absDepthDraft, setAbsDepthDraft] = useState(String(footprintSettings.absorptionDepth));
  const [absFilterDraft, setAbsFilterDraft] = useState(String(footprintSettings.absorptionFilter));
  const [btSessionMinVolDrafts, setBtSessionMinVolDrafts] = useState<
    Record<BigTradeSession, string>
  >(() => {
    const minVolumes = normalizeBigTradeSessionMinVolumes(bigTradeSettings);
    return {
      asia: String(minVolumes.asia),
      eu: String(minVolumes.eu),
      us: String(minVolumes.us),
    };
  });
  const [btLimitDraft, setBtLimitDraft] = useState(String(bigTradeSettings.maxVisible));
  const [obLookbackDraft, setObLookbackDraft] = useState(
    String(outsideBarDeltaFilter.lookbackBars),
  );
  const [obDeltaMultiplierDraft, setObDeltaMultiplierDraft] = useState(
    String(outsideBarDeltaFilter.deltaMultiplier),
  );
  const [mgannImpulseLengthDraft, setMgannImpulseLengthDraft] = useState(
    String(mgannSwingConfig.impulseLengthMultiplier),
  );
  const [mgannImpulseVolumeDraft, setMgannImpulseVolumeDraft] = useState(
    String(mgannSwingConfig.impulseVolumeMultiplier),
  );
  const [mgannImpulseBreakDraft, setMgannImpulseBreakDraft] = useState(
    String(mgannSwingConfig.impulseBreakTicks),
  );
  const [gcPushHorizonDraft, setGcPushHorizonDraft] = useState(
    String(gcPushMomentumConfig.horizonBars),
  );
  const [gcPushVolatilityHalfLifeDraft, setGcPushVolatilityHalfLifeDraft] =
    useState(String(gcPushMomentumConfig.volatilityHalfLifeBars));
  const [gcPushStrongPercentileDraft, setGcPushStrongPercentileDraft] = useState(
    String(Math.round(gcPushMomentumConfig.strongPercentile * 100)),
  );
  const rootRef = useRef<HTMLDivElement | null>(null);

  const updateOutsideBar = (next: Partial<OutsideBarSettings>) => {
    onOutsideBarChange(
      normalizeOutsideBarSettings({
        ...outsideBarConfig,
        ...next,
      }),
    );
  };

  const updateMgannBreak = (next: Partial<MgannBreakSettings>) => {
    onMgannBreakSettingsChange(
      normalizeMgannBreakSettings({ ...mgannBreakConfig, ...next }),
    );
  };

  const updateOutsideBarDeltaFilter = (
    next: Partial<OutsideBarSettings["deltaFilter"]>,
  ) => {
    updateOutsideBar({
      deltaFilter: {
        ...outsideBarDeltaFilter,
        ...next,
      },
    });
  };

  // Keep the draft in sync when the period changes from outside.
  useEffect(() => {
    setLengthDraft(String(ema.period));
  }, [ema.period]);

  useEffect(() => {
    setSmcSwingDraft(String(smc.swingLength));
  }, [smc.swingLength]);

  useEffect(() => {
    setSmcInternalDraft(String(smc.internalLength));
  }, [smc.internalLength]);

  useEffect(() => {
    setSmcFvgExtendDraft(String(smc.fvgExtendBars));
  }, [smc.fvgExtendBars]);

  useEffect(() => {
    setSmcStructureLineExtendDraft(String(smc.structureLineExtendBars));
  }, [smc.structureLineExtendBars]);

  useEffect(() => {
    setSmcFvgLimitDraft(String(smc.maxFairValueGaps));
  }, [smc.maxFairValueGaps]);

  useEffect(() => {
    setSmcSwingObLimitDraft(String(smc.maxSwingOrderBlocks));
  }, [smc.maxSwingOrderBlocks]);

  useEffect(() => {
    setSmcFvgLookbackDraft(String(smc.fvgThresholdLookback));
  }, [smc.fvgThresholdLookback]);

  useEffect(() => {
    setSmcFvgThresholdDraft(String(smc.fvgThresholdMultiplier));
  }, [smc.fvgThresholdMultiplier]);

  useEffect(() => {
    const minVolumes = normalizeBigTradeSessionMinVolumes(bigTradeSettings);
    setBtSessionMinVolDrafts({
      asia: String(minVolumes.asia),
      eu: String(minVolumes.eu),
      us: String(minVolumes.us),
    });
  }, [
    bigTradeSettings.minVolume,
    bigTradeSettings.sessionMinVolumes?.asia,
    bigTradeSettings.sessionMinVolumes?.eu,
    bigTradeSettings.sessionMinVolumes?.us,
  ]);

  useEffect(() => {
    setBtLimitDraft(String(bigTradeSettings.maxVisible));
  }, [bigTradeSettings.maxVisible]);

  useEffect(() => {
    setObLookbackDraft(String(outsideBarDeltaFilter.lookbackBars));
  }, [outsideBarDeltaFilter.lookbackBars]);

  useEffect(() => {
    setObDeltaMultiplierDraft(String(outsideBarDeltaFilter.deltaMultiplier));
  }, [outsideBarDeltaFilter.deltaMultiplier]);

  useEffect(() => {
    setMgannImpulseLengthDraft(String(mgannSwingConfig.impulseLengthMultiplier));
  }, [mgannSwingConfig.impulseLengthMultiplier]);

  useEffect(() => {
    setMgannImpulseVolumeDraft(String(mgannSwingConfig.impulseVolumeMultiplier));
  }, [mgannSwingConfig.impulseVolumeMultiplier]);

  useEffect(() => {
    setMgannImpulseBreakDraft(String(mgannSwingConfig.impulseBreakTicks));
  }, [mgannSwingConfig.impulseBreakTicks]);

  useEffect(() => {
    setGcPushHorizonDraft(String(gcPushMomentumConfig.horizonBars));
  }, [gcPushMomentumConfig.horizonBars]);

  useEffect(() => {
    setGcPushVolatilityHalfLifeDraft(
      String(gcPushMomentumConfig.volatilityHalfLifeBars),
    );
  }, [gcPushMomentumConfig.volatilityHalfLifeBars]);

  useEffect(() => {
    setGcPushStrongPercentileDraft(
      String(Math.round(gcPushMomentumConfig.strongPercentile * 100)),
    );
  }, [gcPushMomentumConfig.strongPercentile]);

  useEffect(() => {
    if (mgannSwingDisabled) {
      setMgannSwingSettingsOpen(false);
    }
  }, [mgannSwingDisabled]);

  useEffect(() => {
    if (gcPushMomentumDisabled) {
      setGcPushMomentumSettingsOpen(false);
    }
  }, [gcPushMomentumDisabled]);

  useEffect(() => {
    setVaPercentDraft(String(footprintSettings.vaPercent));
  }, [footprintSettings.vaPercent]);

  useEffect(() => {
    setImbMinVolDraft(String(footprintSettings.imbalanceMinVolume));
  }, [footprintSettings.imbalanceMinVolume]);

  useEffect(() => {
    setAbsPercentDraft(String(footprintSettings.absorptionPercent));
  }, [footprintSettings.absorptionPercent]);

  useEffect(() => {
    setAbsDepthDraft(String(footprintSettings.absorptionDepth));
  }, [footprintSettings.absorptionDepth]);

  useEffect(() => {
    setAbsFilterDraft(String(footprintSettings.absorptionFilter));
  }, [footprintSettings.absorptionFilter]);

  // Close the popover on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCombinedSettingsOpen(false);
        setDailyVolumeProfileSettingsOpen(false);
        setMgannSwingSettingsOpen(false);
        setGcPushMomentumSettingsOpen(false);
        setSmcSettingsOpen(false);
        setSweepSettingsOpen(false);
        setFpSettingsOpen(false);
        setMgannBreakSettingsOpen(false);
        setBtSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCombinedSettingsOpen(false);
        setDailyVolumeProfileSettingsOpen(false);
        setMgannSwingSettingsOpen(false);
        setGcPushMomentumSettingsOpen(false);
        setSmcSettingsOpen(false);
        setSweepSettingsOpen(false);
        setFpSettingsOpen(false);
        setMgannBreakSettingsOpen(false);
        setBtSettingsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const combinedIndicatorActive =
    ema.enabled || ema.showEma200 || outsideBarConfig.enabled;

  const activeCount =
    1 +
    (volumeDelta ? 1 : 0) +
    (gcPushMomentum && !gcPushMomentumDisabled ? 1 : 0) +
    (dailyVolumeProfile ? 1 : 0) +
    (mgannSwing && !mgannSwingDisabled ? 1 : 0) +
    (combinedIndicatorActive ? 1 : 0) +
    (footprint ? 1 : 0) +
    (fvgGrader ? 1 : 0) +
    (mgannBreak ? 1 : 0) +
    (bigTrades ? 1 : 0) +
    (smc.enabled ? 1 : 0) +
    (sweepConfig.enabled ? 1 : 0);
  const normalizedDailyVolumeProfileWidth =
    normalizeSessionVolumeProfileWidth(dailyVolumeProfileWidth);
  const normalizedFvgSignalLimit = normalizeFvgSignalLimit(fvgSignalLimit);
  const normalizedMgannBreakSignalHistoryBars = normalizeMgannBreakSignalHistoryBars(
    mgannBreakSignalHistoryBars,
  );
  const normalizedMgannBreakSignalLimit = normalizeMgannBreakSignalLimit(
    mgannBreakSignalLimit,
  );

  const toggleCombinedIndicators = (enabled: boolean) => {
    onEmaChange(
      enabled
        ? { ...ema, enabled: true }
        : { ...ema, enabled: false, showEma200: false },
    );
    updateOutsideBar({ enabled });
  };

  const commitLength = () => {
    const parsed = Math.round(Number(lengthDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000) {
      onEmaChange({ ...ema, period: parsed });
    } else {
      setLengthDraft(String(ema.period)); // revert invalid input
    }
  };

  const commitVaPercent = () => {
    const parsed = Math.round(Number(vaPercentDraft));
    if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 95) {
      onFootprintSettingsChange({ ...footprintSettings, vaPercent: parsed });
    } else {
      setVaPercentDraft(String(footprintSettings.vaPercent));
    }
  };

  const commitSmcSwingLength = () => {
    const parsed = Math.round(Number(smcSwingDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 500) {
      onSmcChange({ ...smc, swingLength: parsed });
    } else {
      setSmcSwingDraft(String(smc.swingLength));
    }
  };

  const commitSmcInternalLength = () => {
    const parsed = Math.round(Number(smcInternalDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 200) {
      onSmcChange({ ...smc, internalLength: parsed });
    } else {
      setSmcInternalDraft(String(smc.internalLength));
    }
  };

  const commitSmcFvgExtend = () => {
    const parsed = Math.round(Number(smcFvgExtendDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
      onSmcChange({ ...smc, fvgExtendBars: parsed });
    } else {
      setSmcFvgExtendDraft(String(smc.fvgExtendBars));
    }
  };

  const commitSmcStructureLineExtend = () => {
    const parsed = Math.round(Number(smcStructureLineExtendDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 500) {
      onSmcChange({ ...smc, structureLineExtendBars: parsed });
    } else {
      setSmcStructureLineExtendDraft(String(smc.structureLineExtendBars));
    }
  };

  const commitSmcFvgLimit = () => {
    const parsed = Math.round(Number(smcFvgLimitDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 50) {
      onSmcChange({ ...smc, maxFairValueGaps: parsed });
    } else {
      setSmcFvgLimitDraft(String(smc.maxFairValueGaps));
    }
  };

  const commitSmcSwingObLimit = () => {
    const parsed = Math.round(Number(smcSwingObLimitDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
      onSmcChange({ ...smc, maxSwingOrderBlocks: parsed });
    } else {
      setSmcSwingObLimitDraft(String(smc.maxSwingOrderBlocks));
    }
  };

  const commitSmcFvgLookback = () => {
    const parsed = Math.round(Number(smcFvgLookbackDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 500) {
      onSmcChange({ ...smc, fvgThresholdLookback: parsed });
    } else {
      setSmcFvgLookbackDraft(String(smc.fvgThresholdLookback));
    }
  };

  const commitSmcFvgThreshold = () => {
    const parsed = Number(smcFvgThresholdDraft);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) {
      onSmcChange({ ...smc, fvgThresholdMultiplier: parsed });
    } else {
      setSmcFvgThresholdDraft(String(smc.fvgThresholdMultiplier));
    }
  };

  const commitMgannImpulseLength = () => {
    const parsed = Number(mgannImpulseLengthDraft);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 10) {
      onMgannSwingSettingsChange(
        normalizeMgannSwingSettings({
          ...mgannSwingConfig,
          impulseLengthMultiplier: parsed,
        }),
      );
    } else {
      setMgannImpulseLengthDraft(
        String(mgannSwingConfig.impulseLengthMultiplier),
      );
    }
  };

  const commitMgannImpulseVolume = () => {
    const parsed = Number(mgannImpulseVolumeDraft);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 10) {
      onMgannSwingSettingsChange(
        normalizeMgannSwingSettings({
          ...mgannSwingConfig,
          impulseVolumeMultiplier: parsed,
        }),
      );
    } else {
      setMgannImpulseVolumeDraft(
        String(mgannSwingConfig.impulseVolumeMultiplier),
      );
    }
  };

  const commitMgannImpulseBreakTicks = () => {
    const parsed = Math.round(Number(mgannImpulseBreakDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      onMgannSwingSettingsChange(
        normalizeMgannSwingSettings({
          ...mgannSwingConfig,
          impulseBreakTicks: parsed,
        }),
      );
    } else {
      setMgannImpulseBreakDraft(String(mgannSwingConfig.impulseBreakTicks));
    }
  };

  const updateGcPushMomentum = (
    next: Partial<GcPushMomentumSettings>,
  ) => {
    onGcPushMomentumSettingsChange(
      normalizeGcPushMomentumSettings({
        ...gcPushMomentumConfig,
        ...next,
      }),
    );
  };

  const commitGcPushHorizon = () => {
    const parsed = Math.round(Number(gcPushHorizonDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
      updateGcPushMomentum({ horizonBars: parsed });
    } else {
      setGcPushHorizonDraft(String(gcPushMomentumConfig.horizonBars));
    }
  };

  const commitGcPushVolatilityHalfLife = () => {
    const parsed = Math.round(Number(gcPushVolatilityHalfLifeDraft));
    if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 240) {
      updateGcPushMomentum({ volatilityHalfLifeBars: parsed });
    } else {
      setGcPushVolatilityHalfLifeDraft(
        String(gcPushMomentumConfig.volatilityHalfLifeBars),
      );
    }
  };

  const commitGcPushStrongPercentile = () => {
    const parsed = Math.round(Number(gcPushStrongPercentileDraft));
    if (Number.isFinite(parsed) && parsed >= 80 && parsed <= 99) {
      updateGcPushMomentum({ strongPercentile: parsed / 100 });
    } else {
      setGcPushStrongPercentileDraft(
        String(Math.round(gcPushMomentumConfig.strongPercentile * 100)),
      );
    }
  };

  const commitImbMinVol = () => {
    const parsed = Math.round(Number(imbMinVolDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000) {
      onFootprintSettingsChange({ ...footprintSettings, imbalanceMinVolume: parsed });
    } else {
      setImbMinVolDraft(String(footprintSettings.imbalanceMinVolume));
    }
  };

  const commitAbsPercent = () => {
    const parsed = Math.round(Number(absPercentDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 500) {
      onFootprintSettingsChange({ ...footprintSettings, absorptionPercent: parsed });
    } else {
      setAbsPercentDraft(String(footprintSettings.absorptionPercent));
    }
  };

  const commitAbsDepth = () => {
    const parsed = Math.round(Number(absDepthDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      onFootprintSettingsChange({ ...footprintSettings, absorptionDepth: parsed });
    } else {
      setAbsDepthDraft(String(footprintSettings.absorptionDepth));
    }
  };

  const commitAbsFilter = () => {
    const parsed = Math.round(Number(absFilterDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000) {
      onFootprintSettingsChange({ ...footprintSettings, absorptionFilter: parsed });
    } else {
      setAbsFilterDraft(String(footprintSettings.absorptionFilter));
    }
  };

  const commitBtSessionMinVol = (session: BigTradeSession) => {
    const parsed = Math.round(Number(btSessionMinVolDrafts[session]));
    const current = normalizeBigTradeSessionMinVolumes(bigTradeSettings);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000) {
      const nextSessionMinVolumes = { ...current, [session]: parsed };
      onBigTradeSettingsChange({
        ...bigTradeSettings,
        minVolume: Math.min(
          nextSessionMinVolumes.asia,
          nextSessionMinVolumes.eu,
          nextSessionMinVolumes.us,
        ),
        sessionMinVolumes: nextSessionMinVolumes,
      });
    } else {
      setBtSessionMinVolDrafts((drafts) => ({
        ...drafts,
        [session]: String(current[session]),
      }));
    }
  };

  const commitBtLimit = () => {
    const parsed = Math.round(Number(btLimitDraft));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_BIG_TRADE_VISIBLE) {
      onBigTradeSettingsChange({ ...bigTradeSettings, maxVisible: parsed });
    } else {
      setBtLimitDraft(String(bigTradeSettings.maxVisible));
    }
  };

  const commitOutsideBarLookback = () => {
    const parsed = Math.round(Number(obLookbackDraft));
    if (Number.isFinite(parsed) && parsed >= 5 && parsed <= 500) {
      updateOutsideBarDeltaFilter({ lookbackBars: parsed });
    } else {
      setObLookbackDraft(String(outsideBarDeltaFilter.lookbackBars));
    }
  };

  const commitOutsideBarDeltaMultiplier = () => {
    const parsed = Number(obDeltaMultiplierDraft);
    if (Number.isFinite(parsed) && parsed >= 0.1 && parsed <= 10) {
      updateOutsideBarDeltaFilter({ deltaMultiplier: parsed });
    } else {
      setObDeltaMultiplierDraft(String(outsideBarDeltaFilter.deltaMultiplier));
    }
  };

  return (
    <div className="indicator-toggles" ref={rootRef}>
      <button
        type="button"
        className={`indicator-button${indicatorsVisible ? "" : " is-muted"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Indicators"
        onClick={() => setOpen((v) => !v)}
      >
        Indicators
        {indicatorsVisible ? (
          activeCount > 0 && <span className="indicator-badge">{activeCount}</span>
        ) : (
          <span className="indicator-badge is-muted">Off</span>
        )}
        <span className="indicator-caret" aria-hidden="true">
          {"\u25BE"}
        </span>
      </button>
      {open && (
        <div className="indicator-menu" role="menu" aria-label="Indicator list">
          <IndicatorRow
            label="Volume"
            checked
            disabled
            onChange={() => {}}
          />
          <IndicatorRow
            label="Volume Delta"
            checked={volumeDelta}
            onChange={onVolumeDeltaChange}
          />
          <IndicatorRow
            label="GC Push Momentum"
            checked={gcPushMomentum}
            disabled={gcPushMomentumDisabled}
            title={
              gcPushMomentumDisabled
                ? "GC Push Momentum is available on the 1-minute and 5-minute charts"
                : "Volatility-normalized price push with order-flow confirmation"
            }
            onChange={onGcPushMomentumChange}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="GC Push Momentum settings"
                aria-expanded={gcPushMomentumSettingsOpen}
                disabled={gcPushMomentumDisabled}
                onClick={() => setGcPushMomentumSettingsOpen((value) => !value)}
              >
                {"\u2699"}
              </button>
            }
          />
          {gcPushMomentumSettingsOpen && !gcPushMomentumDisabled && (
            <div
              className="ema-settings"
              aria-label="GC Push Momentum settings panel"
            >
              <label className="ema-setting-line">
                <span className="ema-setting-label">Push horizon</span>
                <input
                  className="ema-length-input"
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  aria-label="GC Push Momentum horizon bars"
                  value={gcPushHorizonDraft}
                  onChange={(event) =>
                    setGcPushHorizonDraft(event.currentTarget.value)
                  }
                  onBlur={commitGcPushHorizon}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitGcPushHorizon();
                  }}
                />
              </label>
              <label className="ema-setting-line">
                <span className="ema-setting-label">Vol half-life</span>
                <input
                  className="ema-length-input"
                  type="number"
                  min={10}
                  max={240}
                  step={1}
                  aria-label="GC Push Momentum volatility half-life"
                  value={gcPushVolatilityHalfLifeDraft}
                  onChange={(event) =>
                    setGcPushVolatilityHalfLifeDraft(event.currentTarget.value)
                  }
                  onBlur={commitGcPushVolatilityHalfLife}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitGcPushVolatilityHalfLife();
                    }
                  }}
                />
              </label>
              <label className="ema-setting-line">
                <span className="ema-setting-label">Strong %ile</span>
                <input
                  className="ema-length-input"
                  type="number"
                  min={80}
                  max={99}
                  step={1}
                  aria-label="GC Push Momentum strong percentile"
                  value={gcPushStrongPercentileDraft}
                  onChange={(event) =>
                    setGcPushStrongPercentileDraft(event.currentTarget.value)
                  }
                  onBlur={commitGcPushStrongPercentile}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitGcPushStrongPercentile();
                  }}
                />
              </label>
            </div>
          )}
          <IndicatorRow
            label="Volume Profile"
            checked={dailyVolumeProfile}
            onChange={onDailyVolumeProfileChange}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="Volume Profile settings"
                aria-expanded={dailyVolumeProfileSettingsOpen}
                onClick={() => setDailyVolumeProfileSettingsOpen((v) => !v)}
              >
                {"\u2699"}
              </button>
            }
          />
          {dailyVolumeProfileSettingsOpen && (
            <div className="ema-settings" aria-label="Volume Profile settings panel">
              <div className="ema-setting-line">
                <span className="ema-setting-label">Width</span>
                <div className="profile-width-control">
                  <input
                    type="range"
                    min={MIN_SESSION_VOLUME_PROFILE_WIDTH_PX}
                    max={MAX_SESSION_VOLUME_PROFILE_WIDTH_PX}
                    step={4}
                    aria-label="Volume Profile width"
                    value={normalizedDailyVolumeProfileWidth}
                    onChange={(event) =>
                      onDailyVolumeProfileWidthChange(
                        normalizeSessionVolumeProfileWidth(
                          event.currentTarget.value,
                        ),
                      )
                    }
                  />
                  <span className="profile-width-value">
                    {normalizedDailyVolumeProfileWidth}px
                  </span>
                </div>
              </div>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={dailyVolumeProfileDevelopingPoc}
                  aria-label="Volume Profile developing POC and value area"
                  onChange={(event) =>
                    onDailyVolumeProfileDevelopingPocChange(
                      event.currentTarget.checked,
                    )
                  }
                />
                <span>Dev POC/VA</span>
              </label>
            </div>
          )}
          <IndicatorRow
            label="MGannSwing"
            checked={mgannSwing}
            disabled={mgannSwingDisabled}
            onChange={onMgannSwingChange}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="MGannSwing settings"
                aria-expanded={mgannSwingSettingsOpen}
                disabled={mgannSwingDisabled}
                onClick={() => setMgannSwingSettingsOpen((v) => !v)}
              >
                ...
              </button>
            }
          />
          {mgannSwingSettingsOpen && !mgannSwingDisabled && (
            <div className="ema-settings" aria-label="MGannSwing settings panel">
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannSwingConfig.showWaveDelta}
                  aria-label="MGannSwing Wave Delta"
                  onChange={(event) =>
                    onMgannSwingSettingsChange({
                      ...mgannSwingConfig,
                      showWaveDelta: event.currentTarget.checked,
                    })
                  }
                />
                <span>Wave Delta</span>
              </label>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannSwingConfig.showSwingLine}
                  aria-label="MGannSwing Swing Line"
                  onChange={(event) =>
                    onMgannSwingSettingsChange({
                      ...mgannSwingConfig,
                      showSwingLine: event.currentTarget.checked,
                    })
                  }
                />
                <span>Swing Line</span>
              </label>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannSwingConfig.showWaveDeltaNumbers}
                  aria-label="MGannSwing Wave Delta Numbers"
                  onChange={(event) =>
                    onMgannSwingSettingsChange({
                      ...mgannSwingConfig,
                      showWaveDeltaNumbers: event.currentTarget.checked,
                    })
                  }
                />
                <span>Wave Delta Numbers</span>
              </label>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannSwingConfig.waveDeltaNumbersImpulseOnly}
                  aria-label="MGannSwing Wave Delta Numbers Impulse Only"
                  onChange={(event) =>
                    onMgannSwingSettingsChange({
                      ...mgannSwingConfig,
                      waveDeltaNumbersImpulseOnly: event.currentTarget.checked,
                    })
                  }
                />
                <span>Impulse Only</span>
              </label>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannSwingConfig.showSignals}
                  aria-label="MGannSwing Signals"
                  onChange={(event) =>
                    onMgannSwingSettingsChange({
                      ...mgannSwingConfig,
                      showSignals: event.currentTarget.checked,
                    })
                  }
                />
                <span>Signals</span>
              </label>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannSwingConfig.smartFilter}
                  aria-label="MGannSwing Smart Filter"
                  onChange={(event) =>
                    onMgannSwingSettingsChange({
                      ...mgannSwingConfig,
                      smartFilter: event.currentTarget.checked,
                    })
                  }
                />
                <span>Smart Filter</span>
              </label>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannSwingConfig.showImpulseWaves}
                  aria-label="MGannSwing Impulse Waves"
                  onChange={(event) =>
                    onMgannSwingSettingsChange({
                      ...mgannSwingConfig,
                      showImpulseWaves: event.currentTarget.checked,
                    })
                  }
                />
                <span>Impulse Waves</span>
              </label>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Len x</span>
                <input
                  type="number"
                  className="ema-length-input"
                  aria-label="MGannSwing impulse length multiplier"
                  min={1}
                  max={10}
                  step={0.05}
                  value={mgannImpulseLengthDraft}
                  onChange={(event) =>
                    setMgannImpulseLengthDraft(event.currentTarget.value)
                  }
                  onBlur={commitMgannImpulseLength}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitMgannImpulseLength();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Delta x</span>
                <input
                  type="number"
                  className="ema-length-input"
                  aria-label="MGannSwing impulse delta multiplier"
                  min={1}
                  max={10}
                  step={0.05}
                  value={mgannImpulseVolumeDraft}
                  onChange={(event) =>
                    setMgannImpulseVolumeDraft(event.currentTarget.value)
                  }
                  onBlur={commitMgannImpulseVolume}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitMgannImpulseVolume();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Break</span>
                <input
                  type="number"
                  className="ema-length-input"
                  aria-label="MGannSwing impulse break ticks"
                  min={0}
                  max={100}
                  step={1}
                  value={mgannImpulseBreakDraft}
                  onChange={(event) =>
                    setMgannImpulseBreakDraft(event.currentTarget.value)
                  }
                  onBlur={commitMgannImpulseBreakTicks}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitMgannImpulseBreakTicks();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </div>
          )}
          <IndicatorRow
            label="mGann Break L/S"
            checked={mgannBreak}
            onChange={onMgannBreakChange}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="mGann Break L/S display settings"
                aria-expanded={mgannBreakSettingsOpen}
                onClick={() => setMgannBreakSettingsOpen((value) => !value)}
              >
                {"\u2699"}
              </button>
            }
          />
          {mgannBreakSettingsOpen && (
            <div className="ema-settings" aria-label="mGann Break L/S display settings panel">
              <div className="ema-setting-line">
                <span className="ema-setting-label">M1 bars</span>
                <input
                  type="number"
                  min={MIN_MGANN_BREAK_SIGNAL_HISTORY_BARS}
                  max={MAX_MGANN_BREAK_SIGNAL_HISTORY_BARS}
                  step={250}
                  className="ema-length-input"
                  aria-label="mGann Break L/S history bars"
                  value={normalizedMgannBreakSignalHistoryBars}
                  onChange={(event) =>
                    onMgannBreakSignalHistoryBarsChange(
                      normalizeMgannBreakSignalHistoryBars(event.currentTarget.value),
                    )
                  }
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Signals</span>
                <input
                  type="number"
                  min={MIN_MGANN_BREAK_SIGNAL_LIMIT}
                  max={MAX_MGANN_BREAK_SIGNAL_LIMIT}
                  step={25}
                  className="ema-length-input"
                  aria-label="mGann Break L/S display limit"
                  value={normalizedMgannBreakSignalLimit}
                  onChange={(event) =>
                    onMgannBreakSignalLimitChange(
                      normalizeMgannBreakSignalLimit(event.currentTarget.value),
                    )
                  }
                />
              </div>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannBreakConfig.requireBigTrade}
                  aria-label="mGann Break require BigTrade"
                  onChange={(event) =>
                    updateMgannBreak({ requireBigTrade: event.currentTarget.checked })
                  }
                />
                <span>Require BigTrade</span>
              </label>
              {mgannBreakConfig.requireBigTrade && (
                <label className="ema-setting-line">
                  <span className="ema-setting-label">BigTrade &gt;</span>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    className="ema-length-input"
                    aria-label="mGann Break BigTrade threshold"
                    value={mgannBreakConfig.bigTradeThreshold}
                    onChange={(event) =>
                      updateMgannBreak({ bigTradeThreshold: Number(event.currentTarget.value) })
                    }
                  />
                </label>
              )}
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={mgannBreakConfig.filterLiquidity}
                  aria-label="mGann Break liquidity filter"
                  onChange={(event) =>
                    updateMgannBreak({ filterLiquidity: event.currentTarget.checked })
                  }
                />
                <span>Liquidity CHoCH</span>
              </label>
              {([
                ["Delta lookback", "volumeDeltaLookback", 1, 5000, 1],
                ["Delta x", "volumeDeltaMultiplier", 0.1, 100, 0.1],
                ["Min spread ticks", "minSpreadTicks", 0, 5000, 1],
                ["Spread lookback", "spreadLookback", 1, 5000, 1],
                ["Spread x", "spreadMultiplier", 0.1, 100, 0.1],
                ["Swing size", "swingSize", 1, 100, 1],
                ["Pivot lookback", "pivotLookbackBars", 1, 5000, 1],
                ["Pivot tolerance ticks", "pivotToleranceTicks", 0, 5000, 1],
                ["Min pivot wick ticks", "minPivotWickTicks", 0, 5000, 1],
                ["Confirm bars", "confirmationBars", 0, 100, 1],
                ["Break ticks", "breakTicks", 0, 5000, 1],
              ] as const).map(([label, key, min, max, step]) => (
                <label className="ema-setting-line" key={key}>
                  <span className="ema-setting-label">{label}</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    className="ema-length-input"
                    aria-label={`mGann Break ${label}`}
                    value={mgannBreakConfig[key]}
                    onChange={(event) =>
                      updateMgannBreak({ [key]: Number(event.currentTarget.value) })
                    }
                  />
                </label>
              ))}
              {mgannBreakConfig.filterLiquidity && (
                <>
                  {([
                    ["Liquidity pivots", "minPivotCuts", 2, 20, 1],
                    ["Liquidity ATR /10", "liquidityAtrMargin", 0.1, 100, 0.5],
                    ["Sweep lookback", "liquiditySweepLookbackBars", 1, 5000, 1],
                  ] as const).map(([label, key, min, max, step]) => (
                    <label className="ema-setting-line" key={key}>
                      <span className="ema-setting-label">{label}</span>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        className="ema-length-input"
                        aria-label={`mGann Break ${label}`}
                        value={mgannBreakConfig[key]}
                        onChange={(event) =>
                          updateMgannBreak({ [key]: Number(event.currentTarget.value) })
                        }
                      />
                    </label>
                  ))}
                </>
              )}
              <button
                type="button"
                className="indicator-alert-button"
                onClick={onCreateMgannBreakAlert}
              >
                Create server alert
              </button>
            </div>
          )}
          <IndicatorRow
            label="EMA/OSB"
            checked={combinedIndicatorActive}
            onChange={toggleCombinedIndicators}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="EMA/OSB settings"
                aria-expanded={combinedSettingsOpen}
                onClick={() => setCombinedSettingsOpen((v) => !v)}
              >
                ...
              </button>
            }
          />
          {false && (
          <IndicatorRow
            label={`EMA ${ema.period}`}
            checked={ema.enabled}
            onChange={(enabled) => onEmaChange({ ...ema, enabled })}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="EMA settings"
                aria-expanded={combinedSettingsOpen}
                onClick={() => setCombinedSettingsOpen((v) => !v)}
              >
                {"\u2699"}
              </button>
            }
          />
          )}
          {combinedSettingsOpen && (
            <div className="ema-settings" aria-label="EMA/OSB settings panel">
              <div className="indicator-settings-section">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={ema.enabled}
                    aria-label={`EMA ${ema.period}`}
                    onChange={(event) =>
                      onEmaChange({ ...ema, enabled: event.currentTarget.checked })
                    }
                  />
                  <span>EMA {ema.period}</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Length</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="ema-length-input"
                  aria-label="EMA length"
                  value={lengthDraft}
                  onChange={(e) => setLengthDraft(e.currentTarget.value)}
                  onBlur={commitLength}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitLength();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Color</span>
                <div className="ema-color-row">
                  {EMA_COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        "ema-color-swatch" +
                        (color.toLowerCase() === ema.color.toLowerCase()
                          ? " is-selected"
                          : "")
                      }
                      style={{ background: color }}
                      aria-label={`EMA color ${color}`}
                      aria-pressed={color.toLowerCase() === ema.color.toLowerCase()}
                      onClick={() => onEmaChange({ ...ema, color })}
                    />
                  ))}
                  <input
                    type="color"
                    className="ema-color-picker"
                    aria-label="EMA custom color"
                    value={ema.color}
                    onChange={(e) => onEmaChange({ ...ema, color: e.currentTarget.value })}
                  />
                </div>
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={ema.showEma200}
                    aria-label="EMA 200"
                    onChange={(e) =>
                      onEmaChange({
                        ...ema,
                        showEma200: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>EMA 200</span>
                </label>
              </div>
              <div className="indicator-settings-section">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={outsideBarConfig.enabled}
                    aria-label="Outside Bar"
                    onChange={(event) =>
                      updateOutsideBar({ enabled: event.currentTarget.checked })
                    }
                  />
                  <span>Outside Bar</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Bull</span>
                <input
                  type="color"
                  className="ema-color-picker"
                  aria-label="Outside Bar bullish color"
                  value={outsideBarConfig.bullColor}
                  onChange={(e) =>
                    updateOutsideBar({
                      bullColor: e.currentTarget.value,
                    })
                  }
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Bear</span>
                <input
                  type="color"
                  className="ema-color-picker"
                  aria-label="Outside Bar bearish color"
                  value={outsideBarConfig.bearColor}
                  onChange={(e) =>
                    updateOutsideBar({
                      bearColor: e.currentTarget.value,
                    })
                  }
                />
              </div>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={outsideBarDeltaFilter.enabled}
                  aria-label="Outside Bar delta filter"
                  onChange={(event) =>
                    updateOutsideBarDeltaFilter({
                      enabled: event.currentTarget.checked,
                    })
                  }
                />
                <span>M1 delta filter</span>
              </label>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Lookback</span>
                <input
                  type="number"
                  className="ema-length-input"
                  aria-label="Outside Bar filter lookback"
                  min={5}
                  max={500}
                  value={obLookbackDraft}
                  onChange={(event) => setObLookbackDraft(event.currentTarget.value)}
                  onBlur={commitOutsideBarLookback}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitOutsideBarLookback();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Delta x</span>
                <input
                  type="number"
                  className="ema-length-input"
                  aria-label="Outside Bar filter delta multiplier"
                  min={0.1}
                  max={10}
                  step={0.05}
                  value={obDeltaMultiplierDraft}
                  onChange={(event) =>
                    setObDeltaMultiplierDraft(event.currentTarget.value)
                  }
                  onBlur={commitOutsideBarDeltaMultiplier}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitOutsideBarDeltaMultiplier();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={outsideBarDeltaFilter.requireRangeExpansion}
                  aria-label="Outside Bar range expansion filter"
                  onChange={(event) =>
                    updateOutsideBarDeltaFilter({
                      requireRangeExpansion: event.currentTarget.checked,
                    })
                  }
                />
                <span>Range &gt; prev 2</span>
              </label>
            </div>
          )}
          <IndicatorRow
            label="Sweep Reversal"
            checked={sweepConfig.enabled}
            title="Close-based liquidity sweep and structure reversal"
            onChange={(enabled) =>
              onSweepReversalChange({ ...sweepConfig, enabled })
            }
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="Sweep Reversal settings"
                aria-expanded={sweepSettingsOpen}
                onClick={() => setSweepSettingsOpen((value) => !value)}
              >
                {"\u2699"}
              </button>
            }
          />
          {sweepSettingsOpen && (
            <div className="ema-settings" aria-label="Sweep Reversal settings panel">
              {([
                ["Swing", "swingLength", 2, 50, 1],
                ["ATR", "atrLength", 1, 500, 1],
                ["Penetration", "minPenetrationAtr", 0, 10, 0.05],
                ["Structure", "structureLength", 1, 20, 1],
                ["Confirm bars", "maxConfirmationBars", 1, 100, 1],
                ["Displacement", "minDisplacementAtr", 0, 10, 0.05],
              ] as const).map(([label, key, min, max, step]) => (
                <label className="ema-setting-line" key={key}>
                  <span className="ema-setting-label">{label}</span>
                  <input
                    type="number"
                    className="ema-length-input"
                    min={min}
                    max={max}
                    step={step}
                    aria-label={`Sweep Reversal ${label}`}
                    value={sweepConfig[key]}
                    onChange={(event) =>
                      onSweepReversalChange(
                        normalizeSweepReversalSettings({
                          ...sweepConfig,
                          [key]: Number(event.currentTarget.value),
                        }),
                      )
                    }
                  />
                </label>
              ))}
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={sweepConfig.equalSwingFilter}
                  aria-label="Sweep Reversal equal swing ATR filter"
                  onChange={(event) =>
                    onSweepReversalChange({
                      ...sweepConfig,
                      equalSwingFilter: event.currentTarget.checked,
                    })
                  }
                />
                <span>Equal-swing ATR pool</span>
              </label>
              {sweepConfig.equalSwingFilter && (
                <>
                  {([
                    ["Min pivots", "liquidityMinPivots", 2, 20, 1],
                    ["Pool lookback", "liquidityLookbackBars", 1, 1000, 1],
                    ["Pool ATR", "liquidityAtrLength", 1, 500, 1],
                    ["ATR margin /10", "liquidityAtrMargin", 0.1, 100, 0.5],
                  ] as const).map(([label, key, min, max, step]) => (
                    <label className="ema-setting-line" key={key}>
                      <span className="ema-setting-label">{label}</span>
                      <input
                        type="number"
                        className="ema-length-input"
                        min={min}
                        max={max}
                        step={step}
                        aria-label={`Sweep Reversal ${label}`}
                        value={sweepConfig[key]}
                        onChange={(event) =>
                          onSweepReversalChange(
                            normalizeSweepReversalSettings({
                              ...sweepConfig,
                              [key]: Number(event.currentTarget.value),
                            }),
                          )
                        }
                      />
                    </label>
                  ))}
                </>
              )}
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={sweepConfig.showDeveloping}
                  aria-label="Sweep Reversal show developing"
                  onChange={(event) =>
                    onSweepReversalChange({
                      ...sweepConfig,
                      showDeveloping: event.currentTarget.checked,
                    })
                  }
                />
                <span>Show developing</span>
              </label>
              {([
                ["Extension", "confirmedExtension", 0, 50],
                ["History", "maxHistory", 1, 150],
              ] as const).map(([label, key, min, max]) => (
                <label className="ema-setting-line" key={key}>
                  <span className="ema-setting-label">{label}</span>
                  <input
                    type="number"
                    className="ema-length-input"
                    min={min}
                    max={max}
                    value={sweepConfig[key]}
                    aria-label={`Sweep Reversal ${label}`}
                    onChange={(event) =>
                      onSweepReversalChange(
                        normalizeSweepReversalSettings({
                          ...sweepConfig,
                          [key]: Number(event.currentTarget.value),
                        }),
                      )
                    }
                  />
                </label>
              ))}
              <div className="ema-setting-line">
                <span className="ema-setting-label">Zone</span>
                <input
                  type="color"
                  className="ema-color-picker"
                  aria-label="Sweep Reversal zone color"
                  value={sweepConfig.zoneColor}
                  onChange={(event) => onSweepReversalChange({ ...sweepConfig, zoneColor: event.currentTarget.value })}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Level</span>
                <input
                  type="color"
                  className="ema-color-picker"
                  aria-label="Sweep Reversal level color"
                  value={sweepConfig.levelColor}
                  onChange={(event) => onSweepReversalChange({ ...sweepConfig, levelColor: event.currentTarget.value })}
                />
              </div>
              <button
                type="button"
                className="indicator-alert-button"
                onClick={onCreateSweepReversalAlert}
              >
                Create server alert
              </button>
            </div>
          )}
          <IndicatorRow
            label="SMC"
            checked={smc.enabled}
            onChange={(enabled) => onSmcChange({ ...smc, enabled })}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="SMC settings"
                aria-expanded={smcSettingsOpen}
                onClick={() => setSmcSettingsOpen((v) => !v)}
              >
                ...
              </button>
            }
          />
          {smcSettingsOpen && (
            <div className="ema-settings" aria-label="SMC settings panel">
              <div className="ema-setting-line">
                <span className="ema-setting-label">Swing</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="ema-length-input"
                  aria-label="SMC swing length"
                  value={smcSwingDraft}
                  onChange={(e) => setSmcSwingDraft(e.currentTarget.value)}
                  onBlur={commitSmcSwingLength}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcSwingLength();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Internal</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="ema-length-input"
                  aria-label="SMC internal length"
                  value={smcInternalDraft}
                  onChange={(e) => setSmcInternalDraft(e.currentTarget.value)}
                  onBlur={commitSmcInternalLength}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcInternalLength();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Structure line</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  className="ema-length-input"
                  aria-label="SMC structure line extend bars"
                  value={smcStructureLineExtendDraft}
                  onChange={(e) =>
                    setSmcStructureLineExtendDraft(e.currentTarget.value)
                  }
                  onBlur={commitSmcStructureLineExtend}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcStructureLineExtend();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={smc.showInternal}
                    onChange={(e) =>
                      onSmcChange({ ...smc, showInternal: e.currentTarget.checked })
                    }
                  />
                  <span>Show internal</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={smc.showZones}
                    onChange={(e) =>
                      onSmcChange({ ...smc, showZones: e.currentTarget.checked })
                    }
                  />
                  <span>Show zones</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    aria-label="SMC show liquidity"
                    checked={smc.showLiquidity}
                    onChange={(e) =>
                      onSmcChange({ ...smc, showLiquidity: e.currentTarget.checked })
                    }
                  />
                  <span>Show liquidity</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Liquidity pool</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  step={1}
                  className="ema-length-input"
                  aria-label="SMC liquidity pool minimum swings"
                  value={smc.liquidityMinSwings}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value);
                    if (Number.isFinite(value)) {
                      onSmcChange({
                        ...smc,
                        liquidityMinSwings: Math.min(20, Math.max(2, Math.round(value))),
                      });
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Liquidity ATR</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="ema-length-input"
                  aria-label="SMC liquidity ATR margin"
                  value={smc.liquidityAtrMargin}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value);
                    if (Number.isFinite(value)) onSmcChange({ ...smc, liquidityAtrMargin: value });
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Liquidity lookback</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="ema-length-input"
                  aria-label="SMC liquidity lookback bars"
                  value={smc.liquidityLookbackBars}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value);
                    if (Number.isFinite(value)) onSmcChange({ ...smc, liquidityLookbackBars: value });
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Liquidity limit</span>
                <input
                  type="number"
                  min={0}
                  max={80}
                  className="ema-length-input"
                  aria-label="SMC liquidity display limit"
                  value={smc.maxLiquidityPools}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value);
                    if (Number.isFinite(value)) onSmcChange({ ...smc, maxLiquidityPools: value });
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={smc.showPremiumDiscount}
                    onChange={(e) =>
                      onSmcChange({
                        ...smc,
                        showPremiumDiscount: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Show PD</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={smc.fvgAutoThreshold}
                    onChange={(e) =>
                      onSmcChange({
                        ...smc,
                        fvgAutoThreshold: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Auto FVG threshold</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">FVG lookback</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="ema-length-input"
                  aria-label="SMC FVG threshold lookback"
                  value={smcFvgLookbackDraft}
                  onChange={(e) => setSmcFvgLookbackDraft(e.currentTarget.value)}
                  onBlur={commitSmcFvgLookback}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcFvgLookback();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">FVG factor</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  className="ema-length-input"
                  aria-label="SMC FVG threshold multiplier"
                  value={smcFvgThresholdDraft}
                  onChange={(e) => setSmcFvgThresholdDraft(e.currentTarget.value)}
                  onBlur={commitSmcFvgThreshold}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcFvgThreshold();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={smc.fvgVolumeConfirmation}
                    onChange={(e) =>
                      onSmcChange({
                        ...smc,
                        fvgVolumeConfirmation: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>FVG volume confirmation</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">FVG extend</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="ema-length-input"
                  aria-label="SMC FVG extend bars"
                  value={smcFvgExtendDraft}
                  onChange={(e) => setSmcFvgExtendDraft(e.currentTarget.value)}
                  onBlur={commitSmcFvgExtend}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcFvgExtend();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Active FVG</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  className="ema-length-input"
                  aria-label="SMC active FVG display limit"
                  value={smcFvgLimitDraft}
                  onChange={(e) => setSmcFvgLimitDraft(e.currentTarget.value)}
                  onBlur={commitSmcFvgLimit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcFvgLimit();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Swing OB</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="ema-length-input"
                  aria-label="SMC swing order block limit"
                  value={smcSwingObLimitDraft}
                  onChange={(e) => setSmcSwingObLimitDraft(e.currentTarget.value)}
                  onBlur={commitSmcSwingObLimit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitSmcSwingObLimit();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </div>
          )}
          <IndicatorRow
            label="Footprint"
            checked={footprint}
            disabled={footprintDisabled}
            onChange={onFootprintChange}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="Footprint settings"
                aria-expanded={fpSettingsOpen}
                onClick={() => setFpSettingsOpen((v) => !v)}
              >
                {"\u2699"}
              </button>
            }
          />
          <IndicatorRow
            label="FVG Grader"
            checked={fvgGrader}
            disabled={fvgGraderDisabled}
            onChange={onFvgGraderChange}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="FVG Grader settings"
                aria-expanded={fvgSettingsOpen}
                disabled={fvgGraderDisabled}
                onClick={() => setFvgSettingsOpen((v) => !v)}
              >
                {"\u2699"}
              </button>
            }
          />
          {fvgSettingsOpen && (
            <div className="ema-settings" aria-label="FVG Grader settings panel">
              <div className="ema-setting-line">
                <span className="ema-setting-label">Limit</span>
                <input
                  type="number"
                  min={MIN_FVG_SIGNAL_LIMIT}
                  max={MAX_FVG_SIGNAL_LIMIT}
                  step={25}
                  className="ema-length-input"
                  aria-label="FVG Grader display limit"
                  value={normalizedFvgSignalLimit}
                  onChange={(event) =>
                    onFvgSignalLimitChange(
                      normalizeFvgSignalLimit(event.currentTarget.value),
                    )
                  }
                />
              </div>
            </div>
          )}
          {fpSettingsOpen && (
            <div className="ema-settings" aria-label="Footprint settings panel">
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={footprintSettings.showVA}
                    onChange={(e) =>
                      onFootprintSettingsChange({
                        ...footprintSettings,
                        showVA: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Show VA</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">VA %</span>
                <input
                  type="number"
                  min={10}
                  max={95}
                  className="ema-length-input"
                  aria-label="VA percent"
                  value={vaPercentDraft}
                  onChange={(e) => setVaPercentDraft(e.currentTarget.value)}
                  onBlur={commitVaPercent}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitVaPercent();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={footprintSettings.showImbalance}
                    onChange={(e) =>
                      onFootprintSettingsChange({
                        ...footprintSettings,
                        showImbalance: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Imbalance</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Min Vol</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className="ema-length-input"
                  aria-label="Imbalance min volume"
                  value={imbMinVolDraft}
                  onChange={(e) => setImbMinVolDraft(e.currentTarget.value)}
                  onBlur={commitImbMinVol}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitImbMinVol();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={footprintSettings.showAbsorption}
                    onChange={(e) =>
                      onFootprintSettingsChange({
                        ...footprintSettings,
                        showAbsorption: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Absorption</span>
                </label>
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Abs %</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  className="ema-length-input"
                  aria-label="Absorption percent"
                  value={absPercentDraft}
                  onChange={(e) => setAbsPercentDraft(e.currentTarget.value)}
                  onBlur={commitAbsPercent}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitAbsPercent();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Abs depth</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="ema-length-input"
                  aria-label="Absorption depth"
                  value={absDepthDraft}
                  onChange={(e) => setAbsDepthDraft(e.currentTarget.value)}
                  onBlur={commitAbsDepth}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitAbsDepth();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <span className="ema-setting-label">Abs filter</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  className="ema-length-input"
                  aria-label="Absorption filter"
                  value={absFilterDraft}
                  onChange={(e) => setAbsFilterDraft(e.currentTarget.value)}
                  onBlur={commitAbsFilter}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitAbsFilter();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={footprintSettings.showUnfinishedAuction}
                    onChange={(e) =>
                      onFootprintSettingsChange({
                        ...footprintSettings,
                        showUnfinishedAuction: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Unfinished Auction</span>
                </label>
              </div>
            </div>
          )}
          <IndicatorRow
            label="BigTrade"
            checked={bigTrades}
            disabled={bigTradeDisabled}
            onChange={onBigTradesChange}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="BigTrade settings"
                aria-expanded={btSettingsOpen}
                onClick={() => setBtSettingsOpen((v) => !v)}
              >
                ...
              </button>
            }
          />
          {btSettingsOpen && (
            <div className="ema-settings" aria-label="BigTrade settings panel">
              {BIG_TRADE_SESSIONS.map(({ key, label }) => (
                <div className="ema-setting-line" key={key}>
                  <span className="ema-setting-label">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    className="ema-length-input"
                    aria-label={`BigTrade ${label} min volume`}
                    value={btSessionMinVolDrafts[key]}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setBtSessionMinVolDrafts((drafts) => ({
                        ...drafts,
                        [key]: value,
                      }));
                    }}
                    onBlur={() => commitBtSessionMinVol(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitBtSessionMinVol(key);
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </div>
              ))}
              <div className="ema-setting-line">
                <span className="ema-setting-label">Limit</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_BIG_TRADE_VISIBLE}
                  className="ema-length-input"
                  aria-label="BigTrade display limit"
                  value={btLimitDraft}
                  onChange={(e) => setBtLimitDraft(e.currentTarget.value)}
                  onBlur={commitBtLimit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitBtLimit();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="ema-setting-line">
                <label className="fp-toggle-label">
                  <input
                    type="checkbox"
                    checked={bigTradeSettings.soundEnabled ?? false}
                    aria-label="BigTrade sound"
                    onChange={(e) =>
                      onBigTradeSettingsChange({
                        ...bigTradeSettings,
                        soundEnabled: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Sound</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
