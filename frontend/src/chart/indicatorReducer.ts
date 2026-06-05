// chart module — pure indicator-series reducer (VolumeDelta + BigTrade).
//
// The testable core of the IndicatorLayer (design.md "Frontend Modules":
// IndicatorLayer, Req 13, 15.5, 19.2). It folds realtime `volume_delta_update`
// and `big_trade` events into incrementally-merged series so the React layer /
// Lightweight Charts series can be driven with `series.update()` calls, never a
// full-data replacement.
//
// VolumeDelta: one delta value per bar time, overwritten in place while the bar
// is in progress (last-write-wins by time), kept sorted ascending and
// duplicate-free — exactly the barReducer invariant.
//
// BigTrade: discrete markers keyed by the backend's NT-style tradeId when
// available. Each distinct reconstructed big trade is its own marker; a repeat
// of the same key overwrites (the merge already happened server-side). Bubble
// sizing is derived from the visible maximum volume (Req 15.5) by
// `bubbleRadius`.

import {
  type BigTradeMessage,
  type Side,
  type VolumeDeltaUpdateMessage,
} from "../socket/messages";

/** A single VolumeDelta point on the indicator series. */
export interface VolumeDeltaPoint {
  time: number;
  delta: number;
  /** Present only in CumulativeDelta mode (Req 13.7). */
  cumulativeDelta?: number;
}

/** A discrete BigTrade marker. */
export interface BigTradeMarker {
  tradeId?: number;
  time: number;
  price: number;
  volume: number;
  side: Side;
}

export type VolumeDeltaSeries = readonly VolumeDeltaPoint[];
export type BigTradeMarkers = readonly BigTradeMarker[];

function lowerBound(times: readonly { time: number }[], time: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pointsEqual(a: VolumeDeltaPoint, b: VolumeDeltaPoint): boolean {
  return (
    a.time === b.time &&
    a.delta === b.delta &&
    a.cumulativeDelta === b.cumulativeDelta
  );
}

/** What an apply did, mirroring the barReducer outcome kinds. */
export type IndicatorApplicationKind = "append" | "overwrite" | "insert" | "noop";

export interface VolumeDeltaApplication {
  kind: IndicatorApplicationKind;
  series: VolumeDeltaSeries;
  point: VolumeDeltaPoint;
  index: number;
}

/**
 * Apply a `volume_delta_update` to the series incrementally (overwrite the
 * in-progress bar by time, append/insert a new bar in time order). Never
 * mutates the input; never a full replacement.
 */
export function applyVolumeDelta(
  series: VolumeDeltaSeries,
  msg: Pick<
    VolumeDeltaUpdateMessage,
    "time" | "delta" | "cumulativeDelta"
  >,
): VolumeDeltaApplication {
  const incoming: VolumeDeltaPoint = {
    time: msg.time,
    delta: msg.delta,
    ...(msg.cumulativeDelta !== undefined
      ? { cumulativeDelta: msg.cumulativeDelta }
      : {}),
  };
  const at = lowerBound(series, incoming.time);
  if (at < series.length && series[at].time === incoming.time) {
    const existing = series[at];
    if (pointsEqual(existing, incoming)) {
      return { kind: "noop", series, point: existing, index: at };
    }
    const next = series.slice();
    next[at] = incoming;
    return { kind: "overwrite", series: next, point: incoming, index: at };
  }
  const next = series.slice();
  next.splice(at, 0, incoming);
  const kind: IndicatorApplicationKind =
    at === series.length ? "append" : "insert";
  return { kind, series: next, point: incoming, index: at };
}

/** Fold a sequence of volume-delta updates over an initial series. */
export function reduceVolumeDelta(
  initial: VolumeDeltaSeries,
  updates: Iterable<Pick<VolumeDeltaUpdateMessage, "time" | "delta" | "cumulativeDelta">>,
): VolumeDeltaSeries {
  let series: VolumeDeltaSeries = initial.slice();
  for (const u of updates) series = applyVolumeDelta(series, u).series;
  return series;
}

export type BigTradeInput = Pick<
  BigTradeMessage,
  "time" | "price" | "volume" | "side"
> &
  Partial<Pick<BigTradeMessage, "tradeId">>;

function markerKey(marker: BigTradeMarker): string {
  if (marker.tradeId !== undefined) {
    return `${marker.time}:${marker.side}:${marker.tradeId}`;
  }
  return `${marker.time}:${marker.side}`;
}

export interface BigTradeApplication {
  kind: "append" | "overwrite" | "insert" | "noop";
  markers: BigTradeMarkers;
}

/**
 * Apply a `big_trade` event to the marker set. Markers are kept sorted by
 * (time, tradeId, side); a repeat of the same key overwrites (no duplicates).
 */
export function applyBigTrade(
  markers: BigTradeMarkers,
  msg: BigTradeInput,
): BigTradeApplication {
  const incoming: BigTradeMarker = {
    ...(msg.tradeId !== undefined ? { tradeId: msg.tradeId } : {}),
    time: msg.time,
    price: msg.price,
    volume: msg.volume,
    side: msg.side,
  };
  const key = markerKey(incoming);
  const existingIndex = markers.findIndex((m) => markerKey(m) === key);
  if (existingIndex >= 0) {
    const existing = markers[existingIndex];
    if (
      existing.price === incoming.price &&
      existing.volume === incoming.volume
    ) {
      return { kind: "noop", markers };
    }
    const next = markers.slice();
    next[existingIndex] = incoming;
    return { kind: "overwrite", markers: next };
  }
  // Insert in (time, tradeId, side) order.
  const next = markers.slice();
  let at = next.length;
  for (let i = 0; i < next.length; i++) {
    if (
      next[i].time > incoming.time ||
      (next[i].time === incoming.time &&
        (next[i].tradeId ?? 0) > (incoming.tradeId ?? 0)) ||
      (next[i].time === incoming.time &&
        (next[i].tradeId ?? 0) === (incoming.tradeId ?? 0) &&
        next[i].side > incoming.side)
    ) {
      at = i;
      break;
    }
  }
  next.splice(at, 0, incoming);
  const kind = at === next.length - 1 ? "append" : "insert";
  return { kind, markers: next };
}

/** Fold a sequence of big trades over an initial marker set. */
export function reduceBigTrades(
  initial: BigTradeMarkers,
  updates: Iterable<BigTradeInput>,
): BigTradeMarkers {
  let markers: BigTradeMarkers = initial.slice();
  for (const u of updates) markers = applyBigTrade(markers, u).markers;
  return markers;
}

/**
 * Bubble radius for a big trade, proportional to the visible maximum volume
 * (Req 15.5). Returns a radius in `[minRadius, maxRadius]`; a trade equal to the
 * visible max gets `maxRadius`, and zero/empty visible max yields `minRadius`.
 */
export function bubbleRadius(
  volume: number,
  visibleMaxVolume: number,
  minRadius = 4,
  maxRadius = 24,
): number {
  if (visibleMaxVolume <= 0 || volume <= 0) return minRadius;
  const frac = Math.min(volume / visibleMaxVolume, 1);
  return minRadius + frac * (maxRadius - minRadius);
}

/** The maximum volume among markers within a visible [from, to] time range. */
export function visibleMaxVolume(
  markers: BigTradeMarkers,
  from: number,
  to: number,
): number {
  let max = 0;
  for (const m of markers) {
    if (m.time >= from && m.time <= to && m.volume > max) max = m.volume;
  }
  return max;
}
