import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { type AlertEventMessage } from "../socket/messages";
import {
  type Alert,
  type AlertType,
  type AlertLogEntry,
  type TelegramNotificationConfig,
  type TelegramNotificationInput,
  toLogEntry,
} from "./types";

/**
 * AlertPanel — alert lines, enable/disable/delete controls, and the event log.
 *
 * Renders each configured alert with an enable/disable toggle and a delete
 * button (Req 16.5). When an `alert_event` arrives the panel shows a toast,
 * plays a sound, and appends the event to the visible event log (Req 17.4).
 *
 * Side effects (sound) are injected so the component is testable under jsdom.
 * The parent owns the alert list + CRUD calls and feeds the latest
 * `alert_event` down via `lastEvent`; the panel raises `onToggle` / `onDelete`
 * for the parent to persist through the REST API.
 */
export interface AlertPanelProps {
  /** Configured alerts (from `GET /api/alerts`). */
  alerts: readonly Alert[];
  /** The most recent `alert_event`, or undefined. Drives toast/sound/log. */
  lastEvent?: AlertEventMessage;
  /** Enable/disable an alert (parent persists via PATCH). */
  onToggle?: (id: string, enabled: boolean) => void;
  /** Delete an alert (parent persists via DELETE). */
  onDelete?: (id: string) => void;
  /** Create an alert (parent persists via POST). */
  onCreate?: (input: {
    type: AlertType;
    params: Record<string, number | boolean>;
  }) => void;
  /** Telegram notification config loaded from the backend. */
  telegram?: TelegramNotificationConfig;
  /** Persist Telegram notification config. */
  onTelegramSave?: (input: TelegramNotificationInput) => void;
  /** Send a test Telegram message using the saved backend config. */
  onTelegramTest?: () => void;
  /** Optional save/test status shown in the Telegram section. */
  telegramStatus?: string;
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
const SMC_STRATEGY_TYPE: AlertType = "smc_external_break_big_trade";
const SMC_BIG_TRADE_DEFAULT = "50";
const SMC_SWING_LENGTH = 50;
const SMC_LOOKAHEAD_BARS = 5;
const SMC_MAX_BARS = 20;
const SMC_PAUSE_ON_INSIDE_BARS = true;

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

function alertInputLabel(type: AlertType): string {
  if (isLevelAlertType(type)) return "Alert level";
  if (type === SMC_STRATEGY_TYPE) return "BigTrade threshold";
  return "Alert threshold";
}

function alertInputPlaceholder(type: AlertType): string {
  if (isLevelAlertType(type)) return "level";
  if (type === SMC_STRATEGY_TYPE) return "BT threshold";
  return "threshold";
}

function alertDescription(alert: Alert): string {
  if (alert.type === SMC_STRATEGY_TYPE) {
    const threshold = alert.params.bigTradeThreshold;
    const repeat = alert.params.repeat === true ? " (repeat)" : "";
    return `External BOS/CHoCH, BT > ${String(threshold)}${repeat}`;
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
  playSound = defaultPlaySound,
  toastMs = DEFAULT_TOAST_MS,
  open = true,
}: AlertPanelProps) {
  const [log, setLog] = useState<AlertLogEntry[]>([]);
  const [toast, setToast] = useState<AlertLogEntry | null>(null);
  // Create-form state: the alert type and its single numeric input.
  const [newType, setNewType] = useState<AlertType>("price_crosses_level");
  const [newValue, setNewValue] = useState("");
  const [newRepeat, setNewRepeat] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramScreenshot, setTelegramScreenshot] = useState(true);
  // Track the last handled event so re-renders with the same event don't
  // re-toast / re-log / re-play the sound.
  const handledRef = useRef<AlertEventMessage | undefined>(undefined);
  const alertIds = useMemo(() => new Set(alerts.map((alert) => alert.id)), [alerts]);

  useEffect(() => {
    if (lastEvent === undefined || lastEvent === handledRef.current) return;
    handledRef.current = lastEvent;
    const entry = toLogEntry(lastEvent);
    setLog((prev) => [entry, ...prev]); // newest first (Req 17.4)
    setToast(entry);
    playSound();
    const handle = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(handle);
  }, [lastEvent, playSound, toastMs]);

  useEffect(() => {
    setLog((prev) => prev.filter((entry) => alertIds.has(entry.alertId)));
    setToast((prev) => (prev !== null && alertIds.has(prev.alertId) ? prev : null));
  }, [alertIds]);

  // Whether the selected alert type uses a price `level`, a threshold, or the
  // dynamic SMC strategy's BigTrade threshold.
  const isLevelType = isLevelAlertType(newType);
  const isThresholdType = isThresholdAlertType(newType);
  const isSmcStrategyType = newType === SMC_STRATEGY_TYPE;
  const showRepeat = isThresholdType || isSmcStrategyType;
  const paramKey = isLevelType ? "level" : "threshold";

  const changeType = (type: AlertType) => {
    setNewType(type);
    if (type === SMC_STRATEGY_TYPE) {
      setNewValue((value) => value || SMC_BIG_TRADE_DEFAULT);
      setNewRepeat(true);
    }
  };

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(newValue);
    if (!Number.isFinite(value)) return;
    if (isSmcStrategyType) {
      onCreate?.({
        type: newType,
        params: {
          bigTradeThreshold: value,
          swingLength: SMC_SWING_LENGTH,
          lookaheadBars: SMC_LOOKAHEAD_BARS,
          effectiveLookaheadBars: SMC_LOOKAHEAD_BARS,
          maxBars: SMC_MAX_BARS,
          pauseOnInsideBars: SMC_PAUSE_ON_INSIDE_BARS,
          repeat: newRepeat,
        },
      });
      setNewValue(SMC_BIG_TRADE_DEFAULT);
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
          <option value="smc_external_break_big_trade">
            External BOS/CHoCH + BigTrade
          </option>
        </select>
        <input
          type="number"
          step="any"
          aria-label={alertInputLabel(newType)}
          placeholder={alertInputPlaceholder(newType)}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
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

      <ol className="alert-log" aria-label="Alert event log">
        {log.map((entry, i) => (
          <li key={`${entry.alertId}-${entry.time}-${i}`} className="alert-log-entry">
            <span className="alert-log-time">{entry.time}</span>
            <span className="alert-log-message">{entry.message}</span>
          </li>
        ))}
      </ol>

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
        </div>
      )}
    </>
  );
}
