import type { Bar } from "../cache/types";

export const BAR_REPLAY_SPEEDS = [0.5, 1, 2, 5, 10, 20] as const;

export type BarReplaySpeed = (typeof BAR_REPLAY_SPEEDS)[number];

export function barReplayDelayMs(speed: BarReplaySpeed): number {
  return Math.round(1_000 / speed);
}

/** Find the loaded candle selected by a chart click. */
export function findReplayBarIndex(
  bars: readonly Bar[],
  selectedTime: number,
): number {
  if (bars.length === 0 || !Number.isFinite(selectedTime)) return -1;
  let low = 0;
  let high = bars.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (bars[middle].time < selectedTime) low = middle + 1;
    else high = middle;
  }
  if (low < bars.length && bars[low].time === selectedTime) return low;
  if (low === 0) return 0;
  if (low === bars.length) return bars.length - 1;
  return selectedTime - bars[low - 1].time <= bars[low].time - selectedTime
    ? low - 1
    : low;
}

/** The selected candle is the first hidden candle, matching TradingView replay. */
export function replayCursorBeforeSelection(selectedIndex: number): number {
  return Math.max(0, selectedIndex - 1);
}

export function replayBarsThrough(
  bars: readonly Bar[],
  cursorIndex: number,
): readonly Bar[] {
  if (bars.length === 0 || cursorIndex < 0) return [];
  return bars.slice(0, Math.min(cursorIndex + 1, bars.length));
}

export function timedValuesBefore<T extends { time: number }>(
  values: readonly T[],
  cutoffExclusive: number,
): readonly T[] {
  return values.filter((value) => value.time < cutoffExclusive);
}

export function timedMapThrough<T>(
  values: ReadonlyMap<number, T>,
  inclusiveTime: number,
): ReadonlyMap<number, T> {
  const visible = new Map<number, T>();
  for (const [time, value] of values) {
    if (time <= inclusiveTime) visible.set(time, value);
  }
  return visible;
}
