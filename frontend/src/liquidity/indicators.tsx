import { useEffect, useMemo, useRef, useState } from "react";
import { ApiClient } from "../api/client";
import { BIG_TRADE_SESSIONS, bigTradeMinVolumeForTime, normalizeBigTradeSessionMinVolumes } from "../chart/bigTradeSessions";
import { DEFAULT_BIG_TRADE_SETTINGS, MAX_BIG_TRADE_VISIBLE, normalizeBigTradeMaxVisible, type BigTradeSettings } from "../chart/IndicatorToggles";
import { bubbleRadius, reduceBigTradesCapped, type BigTradeInput, type BigTradeMarker } from "../chart/indicatorReducer";
import type { ChartSocket } from "../socket/ChartSocket";
import type { Bar } from "../socket/messages";

const STORAGE_KEY = "gc-chart-platform.liquidity-overlays";
const DAY_MS = 86_400_000;
export const VWAP_COLOR = "#f5c542";
export interface LiquidityIndicatorPreferences {
  showVwap: boolean;
  showBigTrades: boolean;
  bigTradeSettings: BigTradeSettings;
}

export function normalizeLiquidityIndicators(input: unknown): LiquidityIndicatorPreferences {
  const source = input && typeof input === "object" ? input as Partial<LiquidityIndicatorPreferences> : {};
  const settings = source.bigTradeSettings ?? DEFAULT_BIG_TRADE_SETTINGS;
  const sessionMinVolumes = normalizeBigTradeSessionMinVolumes(settings);
  return {
    showVwap: source.showVwap !== false,
    showBigTrades: source.showBigTrades !== false,
    bigTradeSettings: {
      minVolume: sessionMinVolumes.asia, sessionMinVolumes,
      maxVisible: normalizeBigTradeMaxVisible(settings.maxVisible),
      soundEnabled: settings.soundEnabled === true,
    },
  };
}

function readPreferences(): Partial<LiquidityIndicatorPreferences> {
  try {
    // Recover display preferences from the earlier full LQ chart profile too.
    return {
      ...JSON.parse(localStorage.getItem("gc-chart-platform.liquidity-chart") ?? "{}"),
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"),
    };
  } catch { return {}; }
}

export function mergeLiquidityBigTrades(
  history: readonly BigTradeInput[], current: readonly BigTradeMarker[], cutoff: number,
): readonly BigTradeMarker[] {
  const merged = new Map<string, BigTradeMarker>();
  for (const trade of [...history, ...current]) {
    if (trade.time < cutoff || !Number.isFinite(trade.price) || !Number.isFinite(trade.volume) || trade.volume <= 0) continue;
    const key = `${trade.time}:${trade.side}:${trade.tradeId ?? "legacy"}`;
    const existing = merged.get(key);
    // Reconstructed executions grow cumulatively. A late REST response must
    // neither shrink a live bubble nor lose a larger finalized execution.
    if (!existing || trade.volume >= existing.volume) merged.set(key, trade);
  }
  return reduceBigTradesCapped([], merged.values(), MAX_BIG_TRADE_VISIBLE);
}

export function visibleLiquidityBigTrades(
  trades: readonly BigTradeMarker[], settings: BigTradeSettings,
): readonly BigTradeMarker[] {
  return trades.filter((trade) => trade.volume >= bigTradeMinVolumeForTime(trade.time, settings))
    .slice(-normalizeBigTradeMaxVisible(settings.maxVisible));
}

const SESSION_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
});
export function gcSessionKey(time: number): string {
  const parts = SESSION_CLOCK.formatToParts(new Date(time));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  // GC's trading date rolls at 17:00 Chicago, including daylight saving time.
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day") + (value("hour") >= 17 ? 1 : 0)))
    .toISOString().slice(0, 10);
}

export interface SessionVwapPoint { time: number; value: number; session: string }
export function sessionVwapPoints(bars: readonly Bar[]): SessionVwapPoint[] {
  let session = "", volume = 0, weighted = 0;
  const points: SessionVwapPoint[] = [];
  for (const bar of [...bars].sort((a, b) => a.time - b.time)) {
    if (![bar.time, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) || bar.volume < 0) continue;
    const key = gcSessionKey(bar.time);
    if (key !== session) { session = key; volume = 0; weighted = 0; }
    volume += bar.volume;
    weighted += ((bar.high + bar.low + bar.close) / 3) * bar.volume;
    if (volume > 0) points.push({ time: bar.time, value: weighted / volume, session });
  }
  return points;
}

export function useLiquidityIndicators(socket: ChartSocket, apiBase: string, timeframe: string, reloadKey: number, bars: readonly Bar[]) {
  const [saved] = useState(readPreferences);
  const [preferences, setPreferences] = useState(() => normalizeLiquidityIndicators(saved));
  const [draft, setDraft] = useState(preferences.bigTradeSettings);
  const [trades, setTrades] = useState<readonly BigTradeMarker[]>([]);
  const [reconnectKey, setReconnectKey] = useState(0);
  const vwapPoints = useMemo(() => sessionVwapPoints(bars), [bars]);
  const tradesRef = useRef(trades);
  const preferencesRef = useRef(preferences);
  const touched = useRef(false);
  const lastSound = useRef(0);
  tradesRef.current = trades;
  preferencesRef.current = preferences;
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Storage may be disabled. */ }
  }, [preferences]);
  useEffect(() => {
    let cancelled = false;
    void new ApiClient({ basePath: apiBase }).meProfile().then((profile) => {
      if (cancelled || touched.current || saved.bigTradeSettings) return;
      setPreferences((value) => normalizeLiquidityIndicators({ ...value,
        showBigTrades: saved.showBigTrades ?? profile.payload.showBigTrades,
        bigTradeSettings: profile.payload.bigTradeSettings ?? DEFAULT_BIG_TRADE_SETTINGS,
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [apiBase, saved]);
  useEffect(() => {
    const controller = new AbortController(), now = Date.now();
    const params = new URLSearchParams({ symbol: "GC", contract: "GC", from: String(now - DAY_MS),
      to: String(now), limit: String(MAX_BIG_TRADE_VISIBLE), cacheOnly: "true" });
    // Independent from candle loading: an unavailable BigTrade cache must not
    // blank the candles, liquidity or VWAP.
    void fetch(`${apiBase}/big-trades?${params}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("BigTrade history unavailable");
      return await response.json() as { trades: BigTradeInput[] };
    }).then((history) => {
      if (controller.signal.aborted) return;
      const next = mergeLiquidityBigTrades(history.trades ?? [], tradesRef.current, Date.now() - DAY_MS);
      tradesRef.current = next;
      setTrades(next);
    }).catch(() => {});
    return () => controller.abort();
  }, [apiBase, timeframe, reloadKey, reconnectKey]);
  useEffect(() => {
    socket.subscribe("GC", ["big_trade"]);
    const offOpen = socket.onOpen(() => setReconnectKey((value) => value + 1));
    const off = socket.on("big_trade", (message) => {
      if (message.symbol !== "GC" || message.contract !== "GC") return;
      const current = preferencesRef.current;
      const threshold = bigTradeMinVolumeForTime(message.time, current.bigTradeSettings);
      const previous = tradesRef.current.find((trade) => trade.tradeId === message.tradeId && trade.time === message.time && trade.side === message.side);
      if (current.showBigTrades && current.bigTradeSettings.soundEnabled && message.volume >= threshold &&
          (!previous || previous.volume < threshold) && Date.now() - lastSound.current >= 250) {
        lastSound.current = Date.now();
        playBigTradeSound();
      }
      const next = reduceBigTradesCapped(tradesRef.current.filter((trade) => trade.time >= Date.now() - DAY_MS), [message], MAX_BIG_TRADE_VISIBLE);
      tradesRef.current = next;
      setTrades(next);
    });
    return () => { offOpen(); off(); socket.unsubscribe("GC", ["big_trade"]); };
  }, [socket]);
  const update = (patch: Partial<LiquidityIndicatorPreferences>) => {
    touched.current = true;
    setPreferences((current) => normalizeLiquidityIndicators({ ...current, ...patch }));
  };
  return { ...preferences, trades, vwapPoints, update, draft, setDraft,
    beginSettings: () => setDraft(preferences.bigTradeSettings),
    resetDraft: () => setDraft({ ...DEFAULT_BIG_TRADE_SETTINGS }),
    applySettings: () => update({ bigTradeSettings: draft }),
  };
}
export type LiquidityIndicators = ReturnType<typeof useLiquidityIndicators>;

export function LiquidityIndicatorControls({ indicators }: { indicators: LiquidityIndicators }) {
  return <>
    <label><input type="checkbox" checked={indicators.showVwap} onChange={(event) => indicators.update({ showVwap: event.currentTarget.checked })} />VWAP</label>
    <label><input type="checkbox" checked={indicators.showBigTrades} onChange={(event) => indicators.update({ showBigTrades: event.currentTarget.checked })} />BigTrade</label>
  </>;
}
export function LiquidityIndicatorSettings({ indicators }: { indicators: LiquidityIndicators }) {
  const sessions = normalizeBigTradeSessionMinVolumes(indicators.draft);
  return <fieldset className="liquidity-settings-group">
    <legend>BigTrade</legend>
    <p className="liquidity-settings-description">Minimum volume by session (New York time). Display settings apply to this Liquidity chart.</p>
    <div className="liquidity-settings-fields">
      {BIG_TRADE_SESSIONS.map(({ key, label }) => <label key={key} className="liquidity-settings-field">
        <span>{label} minimum volume</span>
        <input type="number" min={0} max={1_000_000} step={1} value={sessions[key]}
          onChange={(event) => indicators.setDraft({ ...indicators.draft, sessionMinVolumes: { ...sessions, [key]: Math.max(0, Math.round(Number(event.currentTarget.value))) } })} />
      </label>)}
      <label className="liquidity-settings-field"><span>Maximum BigTrade bubbles</span><input type="number" min={1} max={MAX_BIG_TRADE_VISIBLE} step={1} value={indicators.draft.maxVisible}
        onChange={(event) => indicators.setDraft({ ...indicators.draft, maxVisible: normalizeBigTradeMaxVisible(event.currentTarget.value) })} /></label>
      <label className="liquidity-settings-field market-explorer-check-field"><span>BigTrade sound</span><input type="checkbox" checked={indicators.draft.soundEnabled === true}
        onChange={(event) => indicators.setDraft({ ...indicators.draft, soundEnabled: event.currentTarget.checked })} /></label>
    </div>
  </fieldset>;
}

export function drawLiquidityIndicators(
  context: CanvasRenderingContext2D, indicators: LiquidityIndicators,
  viewport: { from: number; to: number; tfMs: number; right: number; top: number; bottom: number;
    current: boolean; xAt: (time: number) => number; yAt: (price: number) => number },
): void {
  const { from, to, tfMs, right, top, bottom, current, xAt, yAt } = viewport;
  context.save();
  context.setLineDash([]);
  if (indicators.showVwap) {
    const points = indicators.vwapPoints.filter((point) => point.time >= from - tfMs && point.time < to);
    context.strokeStyle = VWAP_COLOR;
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => {
      const x = xAt(point.time + tfMs / 2), y = yAt(point.value);
      if (index === 0 || point.session !== points[index - 1].session) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    const latest = points[points.length - 1];
    if (latest) {
      const y = yAt(latest.value), x = current ? right : xAt(latest.time + tfMs / 2);
      if (current) { context.beginPath(); context.moveTo(xAt(latest.time + tfMs / 2), y); context.lineTo(x, y); context.stroke(); }
      if (y >= top && y <= bottom) {
        context.font = "600 10px Segoe UI, sans-serif";
        context.textAlign = "right";
        context.textBaseline = "middle";
        const label = `VWAP ${latest.value.toFixed(1)}`, width = context.measureText(label).width + 8;
        const labelY = Math.min(bottom - 9, Math.max(top + 9, y));
        context.fillStyle = "#302a12";
        context.fillRect(x - width, labelY - 9, width, 18);
        context.fillStyle = VWAP_COLOR;
        context.fillText(label, x - 4, labelY);
      }
    }
  }
  if (indicators.showBigTrades) {
    const eligible = visibleLiquidityBigTrades(indicators.trades, indicators.bigTradeSettings);
    const maximum = eligible.reduce((value, trade) => Math.max(value, trade.volume), 0);
    for (const trade of eligible) {
      if (trade.time < from || trade.time > to) continue;
      const x = xAt(trade.time), y = yAt(trade.price);
      if (y < top || y > bottom) continue;
      const rgb = trade.side === "buy" ? "30, 144, 255" : "220, 20, 60";
      context.fillStyle = `rgba(${rgb}, 0.3)`;
      context.strokeStyle = `rgba(${rgb}, 0.9)`;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(x, y, bubbleRadius(trade.volume, maximum, 13, 30), 0, Math.PI * 2);
      context.fill(); context.stroke();
      context.fillStyle = "#ffffff";
      context.font = "600 11px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(trade.volume), x, y);
    }
  }
  context.restore();
}

function playBigTradeSound(): void {
  try {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    const context = new Audio(), oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.value = 660; gain.gain.value = 0.2;
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.15);
    oscillator.addEventListener("ended", () => void context.close());
  } catch { /* Sound is optional. */ }
}
