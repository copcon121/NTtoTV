import { type FormEvent, useEffect, useRef, useState } from "react";

import { type AlertEventMessage } from "../socket/messages";
import {
  type Alert,
  type AlertType,
  type TelegramNotificationConfig,
  type TelegramNotificationInput,
  type WebPushNotificationConfig,
} from "./types";

/**
 * AlertPanel — alert lines and enable/disable/delete controls.
 *
 * Renders each configured alert with an enable/disable toggle and a delete
 * button (Req 16.5). When an `alert_event` arrives the panel shows a toast and
 * plays a sound. One-shot price-cross alerts are deleted after firing.
 *
 * Side effects (sound) are injected so the component is testable under jsdom.
 * The parent owns the alert list + CRUD calls and feeds the latest
 * `alert_event` down via `lastEvent`; the panel raises `onToggle` / `onDelete`
 * for the parent to persist through the REST API.
 */
export interface AlertPanelProps {
  /** Configured alerts (from `GET /api/alerts`). */
  alerts: readonly Alert[];
  /** The most recent `alert_event`, or undefined. Drives toast and sound. */
  lastEvent?: AlertEventMessage;
  /** Enable/disable an alert (parent persists via PATCH). */
  onToggle?: (id: string, enabled: boolean) => void;
  /** Delete an alert (parent persists via DELETE). */
  onDelete?: (id: string) => void;
  /** Create an alert (parent persists via POST). */
  onCreate?: (input: {
    type: AlertType;
    params: Record<string, number | string | boolean>;
  }) => void;
  /** Telegram notification config loaded from the backend. */
  telegram?: TelegramNotificationConfig;
  /** Persist Telegram notification config. */
  onTelegramSave?: (input: TelegramNotificationInput) => void;
  /** Send a test Telegram message using the saved backend config. */
  onTelegramTest?: () => void;
  /** Optional save/test status shown in the Telegram section. */
  telegramStatus?: string;
  /** Web Push notification config loaded from the backend. */
  webPush?: WebPushNotificationConfig;
  /** Enable Web Push on this browser/device. */
  onWebPushEnable?: () => void;
  /** Disable Web Push on this browser/device/profile. */
  onWebPushDisable?: () => void;
  /** Send a test Web Push message using saved backend subscriptions. */
  onWebPushTest?: () => void;
  /** Optional status shown in the Web Push section. */
  webPushStatus?: string;
  /** Whether the current browser exposes the Push API. */
  webPushSupported?: boolean;
  /** Injected sound player (defaults to a no-op when unavailable). */
  playSound?: () => void;
  /** How long the toast stays visible (ms). */
  toastMs?: number;
  /** Injected timer for deterministic tests. */
  now?: () => number;
  /** Whether the configuration panel content is visible. Toast still renders. */
  open?: boolean;
}

const DEFAULT_TOAST_MS = 4000;
const SMC_EXTERNAL_BREAK_TYPE: AlertType = "smc_external_break_big_trade";
const LIQUIDITY_POOL_BREAK_TYPE: AlertType = "liquidity_pool_break";
const MGANN_BREAK_LS_TYPE: AlertType = "mgann_break_ls";
const MGANN_SWEEP_TYPE: AlertType = "mgann_sweep";
const MGANN_BIG_TRADE_SWEEP_TYPE: AlertType = "mgann_big_trade_sweep";
const SMC_EXTERNAL_BIG_TRADE_DEFAULT = "50";
const LIQUIDITY_POOL_BREAK_DEFAULT_TIMEFRAME = "1m";
const MGANN_SWEEP_BIG_TRADE_DEFAULT = "70";
const MGANN_SWEEP_VOLUME_DELTA_MULTIPLIER_DEFAULT = "2";
const MGANN_SWEEP_SPREAD_MULTIPLIER_DEFAULT = "2";
const SMC_SWING_LENGTH = 50;
const SMC_LOOKAHEAD_BARS = 5;
const SMC_MAX_BARS = 20;
const SMC_PAUSE_ON_INSIDE_BARS = true;
const SMC_RETEST_TOLERANCE_TICKS = 50;
const MGANN_SWEEP_VOLUME_DELTA_LOOKBACK = 20;
const MGANN_SWEEP_SPREAD_LOOKBACK = 20;
const MGANN_SWEEP_SWING_SIZE = 5;
const MGANN_SWEEP_PIVOT_LOOKBACK_BARS = 120;
const MGANN_SWEEP_MIN_PIVOT_CUTS = 2;
const MGANN_SWEEP_MAX_PIVOT_CUTS = 20;
const MGANN_SWEEP_CONFIRMATION_BARS = 2;
const MGANN_SWEEP_BREAK_TICKS = 0;
const MGANN_SWEEP_LIQUIDITY_ATR_MARGIN = 4;
const MGANN_SWEEP_LIQUIDITY_LOOKBACK_BARS = 5;
const LIQUIDITY_POOL_BREAK_SWING_SIZE = 5;
const LIQUIDITY_POOL_BREAK_LOOKBACK_BARS = 120;
const LIQUIDITY_POOL_BREAK_ATR_MARGIN = 4;

function defaultPlaySound(): void {
  // Best-effort: a short beep via the Web Audio API when available. Wrapped so
  // a missing/blocked AudioContext never throws into the render path.
  try {
    const Ctx =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctx === undefined) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // ignore — sound is a non-critical enhancement
  }
}

function isLevelAlertType(type: AlertType): boolean {
  return (
    type === "price_crosses_level" ||
    type === "bar_closes_above" ||
    type === "bar_closes_below"
  );
}

function isThresholdAlertType(type: AlertType): boolean {
  return type === "volume_delta_threshold" || type === "big_trade_threshold";
}

function isSmcAlertType(type: AlertType): boolean {
  return type === SMC_EXTERNAL_BREAK_TYPE;
}

function isLiquidityPoolBreakType(type: AlertType): boolean {
  return type === LIQUIDITY_POOL_BREAK_TYPE;
}

function isMgannBreakType(type: AlertType): boolean {
  return (
    type === MGANN_BREAK_LS_TYPE ||
    type === MGANN_SWEEP_TYPE ||
    type === MGANN_BIG_TRADE_SWEEP_TYPE
  );
}

function mgannBreakRequiresBigTrade(alert: Alert): boolean {
  if (alert.type === MGANN_BIG_TRADE_SWEEP_TYPE) return true;
  if (alert.type === MGANN_SWEEP_TYPE) return false;
  return alert.params.requireBigTrade === true;
}

function alertInputLabel(type: AlertType): string {
  if (isLevelAlertType(type)) return "Alert level";
  if (isSmcAlertType(type)) return "BigTrade threshold";
  return "Alert threshold";
}

function alertInputPlaceholder(type: AlertType): string {
  if (isLevelAlertType(type)) return "level";
  if (isSmcAlertType(type)) return "BT threshold";
  return "threshold";
}

function alertDescription(alert: Alert): string {
  if (alert.type === "supertrend_direction_change") {
    const timeframe = String(alert.params.timeframe ?? "1m").toUpperCase();
    const period = String(alert.params.period ?? 10);
    const multiplier = String(alert.params.multiplier ?? 3);
    const method = String(alert.params.atrMethod ?? "rma").toUpperCase();
    const repeat = alert.params.repeat === true ? " (repeat)" : "";
    return `${timeframe} Supertrend ${period} / ${multiplier} ${method}${repeat}`;
  }
  if (alert.type === "sweep_reversal") {
    const timeframe = String(alert.params.timeframe ?? "1m").toUpperCase();
    const pool = alert.params.equalSwingFilter === true
      ? `, ATR pool x${String(alert.params.liquidityMinPivots ?? 2)}`
      : "";
    const repeat = alert.params.repeat === true ? " (repeat)" : "";
    return `${timeframe} Sweep Reversal${pool}${repeat}`;
  }
  if (alert.type === LIQUIDITY_POOL_BREAK_TYPE) {
    const timeframe = alert.params.timeframe === "5m" ? "M5" : "M1";
    const side = String(alert.params.side ?? "both").toUpperCase();
    const sideLabel = side === "BOTH" ? "BSL/SSL" : side;
    const swings = String(
      alert.params.minPivotCuts ?? MGANN_SWEEP_MIN_PIVOT_CUTS,
    );
    const repeat = alert.params.repeat === true ? " (repeat)" : "";
    return `${timeframe} Liquidity Pool Break ${sideLabel} x${swings}${repeat}`;
  }
  if (alert.type === SMC_EXTERNAL_BREAK_TYPE) {
    const threshold = alert.params.bigTradeThreshold;
    const repeat = alert.params.repeat === true ? " (repeat)" : "";
    return `External BOS/CHoCH, BT > ${String(threshold)}${repeat}`;
  }
  if (isMgannBreakType(alert.type)) {
    const repeat = alert.params.repeat === true ? " (repeat)" : "";
    const bigTrade = mgannBreakRequiresBigTrade(alert)
      ? `, BT > ${String(alert.params.bigTradeThreshold)}`
      : "";
    const liquidity =
      alert.params.filterLiquidity === true
        ? `, liquidity CHoCH x${String(
            alert.params.minPivotCuts ?? MGANN_SWEEP_MIN_PIVOT_CUTS,
          )}`
        : "";
    return `mGann Break L/S${bigTrade}, delta x${String(
      alert.params.volumeDeltaMultiplier ??
        alert.params.volumeMultiplier ??
        MGANN_SWEEP_VOLUME_DELTA_MULTIPLIER_DEFAULT,
    )}, spread x${String(
      alert.params.spreadMultiplier ?? MGANN_SWEEP_SPREAD_MULTIPLIER_DEFAULT,
    )}${liquidity}${repeat}`;
  }
  return [
    alert.type,
    "level" in alert.params ? ` @ ${String(alert.params.level)}` : "",
    "threshold" in alert.params ? ` >= ${String(alert.params.threshold)}` : "",
    alert.params.repeat === true ? " (repeat)" : "",
  ].join("");
}

export function AlertPanel({
  alerts,
  lastEvent,
  onToggle,
  onDelete,
  onCreate,
  telegram,
  onTelegramSave,
  onTelegramTest,
  telegramStatus,
  webPush,
  onWebPushEnable,
  onWebPushDisable,
  onWebPushTest,
  webPushStatus,
  webPushSupported = false,
  playSound = defaultPlaySound,
  toastMs = DEFAULT_TOAST_MS,
  open = true,
}: AlertPanelProps) {
  const [toast, setToast] = useState<AlertEventMessage | null>(null);
  // Create-form state: the alert type and its single numeric input.
  const [newType, setNewType] = useState<AlertType>("price_crosses_level");
  const [newValue, setNewValue] = useState("");
  const [newRepeat, setNewRepeat] = useState(false);
  const [newMgannRequireBigTrade, setNewMgannRequireBigTrade] = useState(false);
  const [newMgannFilterLiquidity, setNewMgannFilterLiquidity] = useState(true);
  const [newMgannLiquidityMinSwings, setNewMgannLiquidityMinSwings] = useState(
    String(MGANN_SWEEP_MIN_PIVOT_CUTS),
  );
  const [newLiquidityBreakSide, setNewLiquidityBreakSide] = useState("both");
  const [newLiquidityBreakTimeframe, setNewLiquidityBreakTimeframe] = useState(
    LIQUIDITY_POOL_BREAK_DEFAULT_TIMEFRAME,
  );
  const [newLiquidityBreakMinSwings, setNewLiquidityBreakMinSwings] = useState(
    String(MGANN_SWEEP_MIN_PIVOT_CUTS),
  );
  const [newMgannSweepVolumeDeltaMultiplier, setNewMgannSweepVolumeDeltaMultiplier] =
    useState(MGANN_SWEEP_VOLUME_DELTA_MULTIPLIER_DEFAULT);
  const [newMgannSweepSpreadMultiplier, setNewMgannSweepSpreadMultiplier] =
    useState(MGANN_SWEEP_SPREAD_MULTIPLIER_DEFAULT);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramScreenshot, setTelegramScreenshot] = useState(true);
  // Track the last handled event so re-renders with the same event don't
  // re-toast / re-play the sound or delete it more than once.
  const handledRef = useRef<AlertEventMessage | undefined>(undefined);

  useEffect(() => {
    if (lastEvent === undefined || lastEvent === handledRef.current) return;
    handledRef.current = lastEvent;
    setToast(lastEvent);
    playSound();
    if (lastEvent.alertType === "price_crosses_level") {
      onDelete?.(lastEvent.alertId);
    }
  }, [lastEvent, onDelete, playSound]);

  // Keep dismissal independent from parent callback identities. Live chart
  // renders can recreate onDelete while this toast is visible; coupling that
  // callback to this timer would cancel the timeout without scheduling a new
  // one for an event that has already been handled.
  useEffect(() => {
    if (toast === null) return;
    const handle = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(handle);
  }, [toast, toastMs]);

  // Whether the selected alert type uses a price `level`, a threshold, or the
  // dynamic SMC strategy's BigTrade threshold.
  const isLevelType = isLevelAlertType(newType);
  const isThresholdType = isThresholdAlertType(newType);
  const isExternalBreakType = newType === SMC_EXTERNAL_BREAK_TYPE;
  const isLiquidityPoolBreak = isLiquidityPoolBreakType(newType);
  const isMgannSweep = isMgannBreakType(newType);
  const isMgannSweepWithBigTrade = isMgannSweep && newMgannRequireBigTrade;
  const showNumericInput =
    !isLiquidityPoolBreak && !isMgannSweep;
  const showRepeat =
    isThresholdType ||
    isSmcAlertType(newType) ||
    isLiquidityPoolBreak ||
    isMgannSweep;
  const paramKey = isLevelType ? "level" : "threshold";
  const hasWebPushPublicKey = Boolean(webPush?.publicKey);

  const changeType = (type: AlertType) => {
    setNewType(type);
    if (type === SMC_EXTERNAL_BREAK_TYPE) {
      setNewValue((value) => value || SMC_EXTERNAL_BIG_TRADE_DEFAULT);
      setNewRepeat(true);
    } else if (type === LIQUIDITY_POOL_BREAK_TYPE) {
      setNewValue("");
      setNewLiquidityBreakSide("both");
      setNewLiquidityBreakTimeframe(LIQUIDITY_POOL_BREAK_DEFAULT_TIMEFRAME);
      setNewLiquidityBreakMinSwings(String(MGANN_SWEEP_MIN_PIVOT_CUTS));
      setNewRepeat(true);
    } else if (isMgannBreakType(type)) {
      setNewMgannRequireBigTrade(type === MGANN_BIG_TRADE_SWEEP_TYPE);
      setNewMgannFilterLiquidity(true);
      setNewMgannLiquidityMinSwings(String(MGANN_SWEEP_MIN_PIVOT_CUTS));
      setNewValue((value) => value || MGANN_SWEEP_BIG_TRADE_DEFAULT);
      setNewMgannSweepVolumeDeltaMultiplier(
        MGANN_SWEEP_VOLUME_DELTA_MULTIPLIER_DEFAULT,
      );
      setNewMgannSweepSpreadMultiplier(MGANN_SWEEP_SPREAD_MULTIPLIER_DEFAULT);
      setNewRepeat(true);
    }
  };

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    if (isLiquidityPoolBreak) {
      const rawMinSwings = Number(newLiquidityBreakMinSwings);
      if (!Number.isFinite(rawMinSwings)) return;
      const minPivotCuts = Math.min(
        MGANN_SWEEP_MAX_PIVOT_CUTS,
        Math.max(MGANN_SWEEP_MIN_PIVOT_CUTS, Math.round(rawMinSwings)),
      );
      onCreate?.({
        type: LIQUIDITY_POOL_BREAK_TYPE,
        params: {
          side: newLiquidityBreakSide,
          timeframe: newLiquidityBreakTimeframe,
          swingSize: LIQUIDITY_POOL_BREAK_SWING_SIZE,
          pivotLookbackBars: LIQUIDITY_POOL_BREAK_LOOKBACK_BARS,
          minPivotCuts,
          liquidityAtrMargin: LIQUIDITY_POOL_BREAK_ATR_MARGIN,
          repeat: newRepeat,
        },
      });
      return;
    }
    if (isMgannSweep) {
      const bigTradeThreshold = Number(
        newMgannRequireBigTrade
          ? newValue || MGANN_SWEEP_BIG_TRADE_DEFAULT
          : MGANN_SWEEP_BIG_TRADE_DEFAULT,
      );
      const volumeDeltaMultiplier = Number(newMgannSweepVolumeDeltaMultiplier);
      const spreadMultiplier = Number(newMgannSweepSpreadMultiplier);
      const rawLiquidityMinSwings = Number(newMgannLiquidityMinSwings);
      if (
        !Number.isFinite(bigTradeThreshold) ||
        !Number.isFinite(volumeDeltaMultiplier) ||
        !Number.isFinite(spreadMultiplier) ||
        !Number.isFinite(rawLiquidityMinSwings)
      ) {
        return;
      }
      const liquidityMinSwings = Math.min(
        MGANN_SWEEP_MAX_PIVOT_CUTS,
        Math.max(MGANN_SWEEP_MIN_PIVOT_CUTS, Math.round(rawLiquidityMinSwings)),
      );
      onCreate?.({
        type: MGANN_BREAK_LS_TYPE,
        params: {
          requireBigTrade: newMgannRequireBigTrade,
          filterLiquidity: newMgannFilterLiquidity,
          bigTradeThreshold,
          timeframe: "1m",
          volumeDeltaLookback: MGANN_SWEEP_VOLUME_DELTA_LOOKBACK,
          volumeDeltaMultiplier,
          minSpreadTicks: 0,
          spreadLookback: MGANN_SWEEP_SPREAD_LOOKBACK,
          spreadMultiplier,
          swingSize: MGANN_SWEEP_SWING_SIZE,
          pivotLookbackBars: MGANN_SWEEP_PIVOT_LOOKBACK_BARS,
          minPivotCuts: liquidityMinSwings,
          confirmationBars: MGANN_SWEEP_CONFIRMATION_BARS,
          breakTicks: MGANN_SWEEP_BREAK_TICKS,
          liquidityAtrMargin: MGANN_SWEEP_LIQUIDITY_ATR_MARGIN,
          liquiditySweepLookbackBars: MGANN_SWEEP_LIQUIDITY_LOOKBACK_BARS,
          repeat: newRepeat,
        },
      });
      setNewValue(MGANN_SWEEP_BIG_TRADE_DEFAULT);
      return;
    }
    const value = Number(newValue);
    if (!Number.isFinite(value)) return;
    if (isExternalBreakType) {
      onCreate?.({
        type: newType,
        params: {
          bigTradeThreshold: value,
          swingLength: SMC_SWING_LENGTH,
          lookaheadBars: SMC_LOOKAHEAD_BARS,
          effectiveLookaheadBars: SMC_LOOKAHEAD_BARS,
          maxBars: SMC_MAX_BARS,
          pauseOnInsideBars: SMC_PAUSE_ON_INSIDE_BARS,
          retestToleranceTicks: SMC_RETEST_TOLERANCE_TICKS,
          repeat: newRepeat,
        },
      });
      setNewValue(SMC_EXTERNAL_BIG_TRADE_DEFAULT);
      return;
    }
    onCreate?.({
      type: newType,
      params: {
        [paramKey]: value,
        ...(isThresholdType && newRepeat ? { repeat: true } : {}),
      },
    });
    setNewValue("");
  };

  useEffect(() => {
    if (telegram === undefined) return;
    setTelegramEnabled(telegram.enabled);
    setTelegramChatId(telegram.chatId);
    setTelegramScreenshot(telegram.sendScreenshot);
    setTelegramToken("");
  }, [telegram]);

  const submitTelegram = (e: FormEvent) => {
    e.preventDefault();
    const input: TelegramNotificationInput = {
      enabled: telegramEnabled,
      chatId: telegramChatId,
      sendScreenshot: telegramScreenshot,
    };
    const token = telegramToken.trim();
    if (token.length > 0) {
      input.botToken = token;
    }
    onTelegramSave?.(input);
  };

  return (
    <>
      {toast !== null && (
        <div className="alert-toast" role="alert" data-testid="alert-toast">
          <div className="alert-toast-title">Alert</div>
          <div className="alert-toast-message">{toast.message}</div>
          <div className="alert-toast-meta">
            {toast.contract} @ {toast.price.toFixed(1)}
          </div>
        </div>
      )}

      {open && (
        <div className="alert-panel" aria-label="Alerts">
      <form className="alert-create" onSubmit={submitCreate} aria-label="Create alert">
        <select
          aria-label="Alert type"
          value={newType}
          onChange={(e) => changeType(e.target.value as AlertType)}
        >
          <option value="price_crosses_level">Price crosses</option>
          <option value="bar_closes_above">Bar closes above</option>
          <option value="bar_closes_below">Bar closes below</option>
          <option value="volume_delta_threshold">Volume delta ≥</option>
          <option value="big_trade_threshold">Big trade ≥</option>
          <option value="liquidity_pool_break">
            Liquidity Pool Break
          </option>
          <option value="smc_external_break_big_trade">
            External BOS/CHoCH + BigTrade
          </option>
          <option value="mgann_break_ls">
            mGann Break L/S
          </option>
        </select>
        {showNumericInput && (
          <input
            type="number"
            step="any"
            aria-label={alertInputLabel(newType)}
            placeholder={alertInputPlaceholder(newType)}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
        )}
        {isLiquidityPoolBreak && (
          <>
            <select
              aria-label="Liquidity pool break side"
              value={newLiquidityBreakSide}
              onChange={(e) => setNewLiquidityBreakSide(e.target.value)}
            >
              <option value="both">BSL + SSL</option>
              <option value="bsl">BSL only</option>
              <option value="ssl">SSL only</option>
            </select>
            <select
              aria-label="Liquidity pool break timeframe"
              value={newLiquidityBreakTimeframe}
              onChange={(e) => setNewLiquidityBreakTimeframe(e.target.value)}
            >
              <option value="1m">M1</option>
              <option value="5m">M5</option>
            </select>
            <label className="alert-param">
              <span>Liquidity pool</span>
              <input
                type="number"
                min={MGANN_SWEEP_MIN_PIVOT_CUTS}
                max={MGANN_SWEEP_MAX_PIVOT_CUTS}
                step={1}
                aria-label="Liquidity break minimum swings"
                value={newLiquidityBreakMinSwings}
                onChange={(e) => setNewLiquidityBreakMinSwings(e.target.value)}
              />
            </label>
          </>
        )}
        {isMgannSweep && (
          <>
            <label className="alert-param alert-param-checkbox">
              <input
                type="checkbox"
                aria-label="Require BigTrade"
                checked={newMgannRequireBigTrade}
                onChange={(e) => setNewMgannRequireBigTrade(e.target.checked)}
              />
              <span>BigTrade</span>
            </label>
            <label className="alert-param alert-param-checkbox">
              <input
                type="checkbox"
                aria-label="Filter CHoCH by liquidity"
                checked={newMgannFilterLiquidity}
                onChange={(e) => setNewMgannFilterLiquidity(e.target.checked)}
              />
              <span>Liquidity CHoCH</span>
            </label>
            {newMgannFilterLiquidity && (
              <label className="alert-param">
                <span>Liquidity pool</span>
                <input
                  type="number"
                  min={MGANN_SWEEP_MIN_PIVOT_CUTS}
                  max={MGANN_SWEEP_MAX_PIVOT_CUTS}
                  step={1}
                  aria-label="Liquidity pool minimum swings"
                  value={newMgannLiquidityMinSwings}
                  onChange={(e) => setNewMgannLiquidityMinSwings(e.target.value)}
                />
              </label>
            )}
            {isMgannSweepWithBigTrade && (
              <label className="alert-param">
                <span>BigTrade &gt;</span>
                <input
                  type="number"
                  step="any"
                  aria-label="BigTrade threshold"
                  placeholder="70"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </label>
            )}
            <label className="alert-param">
              <span>Delta x</span>
              <input
                type="number"
                step="0.1"
                aria-label="Volume Delta multiplier"
                placeholder="2"
                value={newMgannSweepVolumeDeltaMultiplier}
                onChange={(e) =>
                  setNewMgannSweepVolumeDeltaMultiplier(e.target.value)
                }
              />
            </label>
            <label className="alert-param">
              <span>Spread x</span>
              <input
                type="number"
                step="0.1"
                aria-label="Spread multiplier"
                placeholder="2"
                value={newMgannSweepSpreadMultiplier}
                onChange={(e) =>
                  setNewMgannSweepSpreadMultiplier(e.target.value)
                }
              />
            </label>
          </>
        )}
        {showRepeat && (
          <label className="alert-repeat">
            <input
              type="checkbox"
              checked={newRepeat}
              aria-label="Repeat alert"
              onChange={(e) => setNewRepeat(e.currentTarget.checked)}
            />
            <span>Repeat</span>
          </label>
        )}
        <button type="submit" className="alert-add">Add</button>
      </form>

      <ul className="alert-list">
        {alerts.map((alert) => (
          <li key={alert.id} className="alert-line" data-testid={`alert-${alert.id}`}>
            <span className="alert-desc">{alertDescription(alert)}</span>
            <label className="alert-toggle">
              <input
                type="checkbox"
                checked={alert.enabled}
                aria-label={`Enable ${alert.id}`}
                onChange={(e) => onToggle?.(alert.id, e.target.checked)}
              />
            </label>
            <button
              type="button"
              className="alert-delete"
              aria-label={`Delete ${alert.id}`}
              onClick={() => onDelete?.(alert.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

          <form
            className="telegram-settings"
            aria-label="Telegram settings"
            onSubmit={submitTelegram}
          >
            <div className="telegram-settings-header">Telegram</div>
            <label className="telegram-row telegram-row-check">
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.currentTarget.checked)}
              />
              <span>Send alerts to Telegram</span>
            </label>
            <label className="telegram-row">
              <span>Bot token</span>
              <input
                type="password"
                aria-label="Telegram bot token"
                placeholder={telegram?.hasBotToken ? "Saved token" : "123:abc"}
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.currentTarget.value)}
              />
            </label>
            <label className="telegram-row">
              <span>Chat ID</span>
              <input
                type="text"
                aria-label="Telegram chat id"
                placeholder="user/group/channel id, not bot username"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.currentTarget.value)}
              />
            </label>
            <label className="telegram-row telegram-row-check">
              <input
                type="checkbox"
                checked={telegramScreenshot}
                onChange={(e) => setTelegramScreenshot(e.currentTarget.checked)}
              />
              <span>Attach chart screenshot</span>
            </label>
            <div className="telegram-actions">
              <button type="submit" className="telegram-save">
                Save
              </button>
              <button
                type="button"
                className="telegram-test"
                onClick={() => onTelegramTest?.()}
              >
                Test
              </button>
              {telegramStatus && (
                <span className="telegram-status">{telegramStatus}</span>
              )}
            </div>
          </form>

          <section className="telegram-settings" aria-label="Web Push settings">
            <div className="telegram-settings-header">iPhone / Web Push</div>
            <div className="telegram-row">
              <span>Alerts on this device</span>
              <span>
                {webPush?.enabled
                  ? `${webPush.subscriptionCount} device${
                      webPush.subscriptionCount === 1 ? "" : "s"
                    }`
                  : "Off"}
              </span>
            </div>
            <div className="telegram-actions">
              <button
                type="button"
                className="telegram-save"
                disabled={!webPushSupported || !hasWebPushPublicKey}
                onClick={() => onWebPushEnable?.()}
              >
                Enable
              </button>
              <button
                type="button"
                className="telegram-test"
                disabled={!webPush?.enabled || webPush.subscriptionCount <= 0}
                onClick={() => onWebPushTest?.()}
              >
                Test
              </button>
              <button
                type="button"
                className="telegram-test"
                disabled={!webPush?.enabled}
                onClick={() => onWebPushDisable?.()}
              >
                Disable
              </button>
              {webPushStatus && (
                <span className="telegram-status">{webPushStatus}</span>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
