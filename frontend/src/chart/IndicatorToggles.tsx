import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  normalizeOutsideBarSettings,
  type OutsideBarSettings,
} from "./outsideBar";
import { type SmcSettings } from "./smc";
import {
  BIG_TRADE_SESSIONS,
  DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES,
  normalizeBigTradeSessionMinVolumes,
  type BigTradeSession,
  type BigTradeSessionMinVolumes,
} from "./bigTradeSessions";

/**
 * IndicatorToggles — TradingView-style "Indicators" dropdown.
 *
 * A single button opens a popover listing the available indicators, each with
 * an enable/disable checkbox. The EMA row has a gear button that opens a small
 * settings panel to edit the EMA length and line color. Footprint is M1-only
 * and can be disabled independently. EMA is an explicitly-added overlay
 * (Req 19.3).
 */
export interface EmaSettings {
  enabled: boolean;
  period: number;
  color: string;
  showEma200: boolean;
  ema200Color: string;
}

export const DEFAULT_EMA_SETTINGS: EmaSettings = {
  enabled: false,
  period: 21,
  color: "#2962ff",
  showEma200: false,
  ema200Color: "#e0b341",
};

export function normalizeEmaSettings(input?: Partial<EmaSettings> | null): EmaSettings {
  const rawPeriod = Number(input?.period ?? DEFAULT_EMA_SETTINGS.period);
  const period = Number.isFinite(rawPeriod)
    ? Math.max(1, Math.round(rawPeriod))
    : DEFAULT_EMA_SETTINGS.period;
  return {
    enabled: Boolean(input?.enabled),
    period,
    color:
      typeof input?.color === "string"
        ? input.color
        : DEFAULT_EMA_SETTINGS.color,
    showEma200: Boolean(input?.showEma200),
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
  showUnfinishedAuction: boolean;
}

export interface BigTradeSettings {
  minVolume: number;
  maxVisible: number;
  soundEnabled?: boolean;
  sessionMinVolumes?: BigTradeSessionMinVolumes;
}

export const DEFAULT_FOOTPRINT_SETTINGS: FootprintSettings = {
  showVA: false,
  vaPercent: 70,
  imbalanceMinVolume: 10,
  showImbalance: true,
  showUnfinishedAuction: true,
};

export const DEFAULT_BIG_TRADE_SETTINGS: BigTradeSettings = {
  minVolume: DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES.asia,
  maxVisible: 500,
  soundEnabled: false,
  sessionMinVolumes: DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES,
};

export interface IndicatorTogglesProps {
  volume?: boolean;
  volumeDelta?: boolean;
  cvd?: boolean;
  footprint: boolean;
  fvgGrader?: boolean;
  bigTrades: boolean;
  ema: EmaSettings;
  smc: SmcSettings;
  outsideBar?: OutsideBarSettings;
  footprintSettings: FootprintSettings;
  bigTradeSettings?: BigTradeSettings;
  footprintDisabled?: boolean;
  fvgGraderDisabled?: boolean;
  bigTradeDisabled?: boolean;
  onVolumeChange?: (enabled: boolean) => void;
  onVolumeDeltaChange?: (enabled: boolean) => void;
  onCvdChange?: (enabled: boolean) => void;
  onFootprintChange: (enabled: boolean) => void;
  onFvgGraderChange?: (enabled: boolean) => void;
  onBigTradesChange: (enabled: boolean) => void;
  onEmaChange: (next: EmaSettings) => void;
  onSmcChange: (next: SmcSettings) => void;
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
  onChange: (enabled: boolean) => void;
  trailing?: ReactNode;
}

function IndicatorRow({ label, checked, disabled = false, onChange, trailing }: RowProps) {
  return (
    <div className="indicator-row">
      <label className="indicator-row-main">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span>{label}</span>
      </label>
      {trailing}
    </div>
  );
}

export function IndicatorToggles({
  volume = false,
  volumeDelta = false,
  cvd = false,
  footprint,
  fvgGrader = false,
  bigTrades,
  ema,
  smc,
  outsideBar = DEFAULT_OUTSIDE_BAR_SETTINGS,
  footprintSettings,
  bigTradeSettings = DEFAULT_BIG_TRADE_SETTINGS,
  footprintDisabled = false,
  fvgGraderDisabled = false,
  bigTradeDisabled = false,
  onVolumeChange = () => {},
  onVolumeDeltaChange = () => {},
  onCvdChange = () => {},
  onFootprintChange,
  onFvgGraderChange = () => {},
  onBigTradesChange,
  onEmaChange,
  onSmcChange,
  onOutsideBarChange = () => {},
  onFootprintSettingsChange,
  onBigTradeSettingsChange = () => {},
}: IndicatorTogglesProps) {
  const outsideBarConfig = normalizeOutsideBarSettings(outsideBar);
  const outsideBarDeltaFilter = outsideBarConfig.deltaFilter;
  const [open, setOpen] = useState(false);
  const [combinedSettingsOpen, setCombinedSettingsOpen] = useState(false);
  const [smcSettingsOpen, setSmcSettingsOpen] = useState(false);
  const [fpSettingsOpen, setFpSettingsOpen] = useState(false);
  const [btSettingsOpen, setBtSettingsOpen] = useState(false);
  // Local draft for the length input so typing is smooth; committed on blur/Enter.
  const [lengthDraft, setLengthDraft] = useState(String(ema.period));
  const [smcSwingDraft, setSmcSwingDraft] = useState(String(smc.swingLength));
  const [smcInternalDraft, setSmcInternalDraft] = useState(String(smc.internalLength));
  const [smcFvgExtendDraft, setSmcFvgExtendDraft] = useState(String(smc.fvgExtendBars));
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  const updateOutsideBar = (next: Partial<OutsideBarSettings>) => {
    onOutsideBarChange(
      normalizeOutsideBarSettings({
        ...outsideBarConfig,
        ...next,
      }),
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

  // Close the popover on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCombinedSettingsOpen(false);
        setSmcSettingsOpen(false);
        setFpSettingsOpen(false);
        setBtSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCombinedSettingsOpen(false);
        setSmcSettingsOpen(false);
        setFpSettingsOpen(false);
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
    cvd || ema.enabled || ema.showEma200 || outsideBarConfig.enabled;

  const activeCount =
    (volume ? 1 : 0) +
    (volumeDelta ? 1 : 0) +
    (combinedIndicatorActive ? 1 : 0) +
    (footprint ? 1 : 0) +
    (fvgGrader ? 1 : 0) +
    (bigTrades ? 1 : 0) +
    (smc.enabled ? 1 : 0);

  const toggleCombinedIndicators = (enabled: boolean) => {
    onCvdChange(enabled);
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

  const commitImbMinVol = () => {
    const parsed = Math.round(Number(imbMinVolDraft));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000) {
      onFootprintSettingsChange({ ...footprintSettings, imbalanceMinVolume: parsed });
    } else {
      setImbMinVolDraft(String(footprintSettings.imbalanceMinVolume));
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
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5000) {
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
        className="indicator-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Indicators"
        onClick={() => setOpen((v) => !v)}
      >
        Indicators
        {activeCount > 0 && <span className="indicator-badge">{activeCount}</span>}
        <span className="indicator-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="indicator-menu" role="menu" aria-label="Indicator list">
          <IndicatorRow
            label="Volume"
            checked={volume}
            onChange={onVolumeChange}
          />
          <IndicatorRow
            label="Volume Delta"
            checked={volumeDelta}
            onChange={onVolumeDeltaChange}
          />
          <IndicatorRow
            label="EMA/Wave/OSB"
            checked={combinedIndicatorActive}
            onChange={toggleCombinedIndicators}
            trailing={
              <button
                type="button"
                className="indicator-gear"
                aria-label="EMA/Wave/OSB settings"
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
                ⚙
              </button>
            }
          />
          )}
          {combinedSettingsOpen && (
            <div className="ema-settings" aria-label="EMA/Wave/OSB settings panel">
              <label className="fp-toggle-label">
                <input
                  type="checkbox"
                  checked={cvd}
                  aria-label="Wave Delta"
                  onChange={(event) => onCvdChange(event.currentTarget.checked)}
                />
                <span>Wave Delta</span>
              </label>
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
                ⚙
              </button>
            }
          />
          <IndicatorRow
            label="FVG Grader"
            checked={fvgGrader}
            disabled={fvgGraderDisabled}
            onChange={onFvgGraderChange}
          />
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
                  max={5000}
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
