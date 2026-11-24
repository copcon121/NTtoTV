import type { WorkspaceTheme } from "../workspace/types";
// footprint module — pure footprint display model.
//
// The testable core of the FootprintCanvas (design.md "Frontend Modules":
// FootprintCanvas, Req 14.2, 14.6, 14.7, 14.8, 19.4). The React/canvas layer is
// kept thin so this selection + redraw-decision logic is unit/property-testable
// without a real canvas.
//
// Responsibilities:
//   - keep the live M1 footprint bars merged by time (last-write-wins);
//   - SELECT exactly the last 5 M1 bars for display (Req 14.2 / Property 19);
//   - decide when a redraw is needed: only on a data / price-scale / layout
//     change; otherwise retain the current rendering (Req 14.6, 14.7).
//   - the 100-125ms redraw throttle (Req 14.8) is enforced by the canvas layer
//     using `shouldRedraw` + a throttling clock; this module stays pure.

import { type FootprintUpdateMessage } from "../socket/messages";

/** Number of live M1 footprint bars displayed, matching NT panel mode. */
export const FOOTPRINT_DISPLAY_COUNT = 5;

/** A footprint bar held by the model (keyed by `time`). */
export type FootprintBar = FootprintUpdateMessage;

/** Price-scale + layout state the canvas renders against. */
export interface FootprintViewport {
  /** Pixel y for a price (from the chart price scale). Identity-compared. */
  priceToY: (price: number) => number;
  /** Canvas width in CSS pixels. */
  width: number;
  /** Canvas height in CSS pixels. */
  height: number;
  /** Contrast text color selected from the chart background. */
  textColor?: string;
  theme?: WorkspaceTheme;
  /** Pixel x at a bar's canonical timestamp, used by chart-aligned ladders. */
  timeToX?: (time: number) => number | null;
  /** Horizontal distance between bars in CSS pixels. */
  barSpacing?: number;
}

/**
 * Merge a `footprint_update` into a time-keyed map of live bars, returning the
 * updated map. Last-write-wins by `time` (an in-progress M1 bar is overwritten
 * as it fills). The input map is not mutated.
 */
export function mergeFootprint(
  bars: ReadonlyMap<number, FootprintBar>,
  msg: FootprintBar,
): Map<number, FootprintBar> {
  const next = new Map(bars);
  next.set(msg.time, msg);
  return next;
}

/**
 * Merge one live bar while retaining only the newest time buckets. The main
 * chart displays a small trailing footprint window, so allowing this map to
 * grow for the whole browser session only makes every immutable update and
 * selection progressively more expensive.
 */
export function mergeFootprintCapped(
  bars: ReadonlyMap<number, FootprintBar>,
  msg: FootprintBar,
  maxBars: number,
): Map<number, FootprintBar> {
  const next = mergeFootprint(bars, msg);
  const cap = Math.max(1, Math.floor(maxBars));
  if (next.size <= cap) return next;

  const oldestTimes = [...next.keys()].sort((left, right) => left - right);
  for (let index = 0; index < oldestTimes.length - cap; index += 1) {
    next.delete(oldestTimes[index]);
  }
  return next;
}

/**
 * Select exactly the last {@link FOOTPRINT_DISPLAY_COUNT} M1 bars by time,
 * ascending. When fewer bars exist, all are returned. (Req 14.2,
 * Property 19)
 */
export function selectDisplayBars(
  bars: ReadonlyMap<number, FootprintBar>,
  count: number = FOOTPRINT_DISPLAY_COUNT,
): FootprintBar[] {
  const sorted = [...bars.values()].sort((a, b) => a.time - b.time);
  return sorted.slice(Math.max(0, sorted.length - count));
}

/** Select only ladders intersecting the chart, including either edge bar. */
export function selectChartDisplayBars(
  bars: ReadonlyMap<number, FootprintBar>,
  viewport: FootprintViewport,
): FootprintBar[] {
  const { timeToX, barSpacing, width } = viewport;
  if (!timeToX || !barSpacing || !Number.isFinite(barSpacing) || barSpacing <= 0 || width <= 0) return [];
  const halfWidth = barSpacing / 2;
  const limit = Math.min(200, Math.ceil(width / barSpacing) + 2);
  return [...bars.values()]
    .sort((left, right) => left.time - right.time)
    .filter((bar) => {
      const x = timeToX(bar.time);
      return x !== null && Number.isFinite(x) && x >= -halfWidth && x <= width + halfWidth;
    })
    .slice(0, limit);
}

/** Combine adjacent price ticks while keeping both sides' executed volume. */
export function groupFootprintRows(
  bar: FootprintBar,
  priceStep: number,
  ticksPerRow: number,
): FootprintBar {
  if (!Number.isFinite(priceStep) || priceStep <= 0 || !Number.isInteger(ticksPerRow) || ticksPerRow <= 1) return bar;
  const rows = new Map<number, FootprintBar["rows"][number]>();
  for (const row of bar.rows) {
    const tick = Math.round(row.price / priceStep);
    const groupTick = Math.floor(tick / ticksPerRow) * ticksPerRow + (ticksPerRow - 1) / 2;
    const price = Math.round(groupTick * priceStep * 1e10) / 1e10;
    const current = rows.get(price);
    if (current) {
      current.bid += row.bid;
      current.ask += row.ask;
    } else {
      rows.set(price, { price, bid: row.bid, ask: row.ask, imbalance: null });
    }
  }
  return { ...bar, rows: [...rows.values()].sort((left, right) => right.price - left.price) };
}

/** A snapshot of what drives the canvas rendering, for change detection. */
export interface FootprintRenderInputs {
  /** The selected display bars (identity per-bar from the merged map). */
  bars: readonly FootprintBar[];
  /** The viewport (price scale + layout). */
  viewport: FootprintViewport;
  /** Stable column count used by the canvas layout. */
  displayCount?: number;
  /** Optional standalone page price-row height in CSS pixels. */
  rowHeightPx?: number;
  /** Visible bitmap height when the standalone layout uses a taller virtual scroller. */
  renderHeightPx?: number;
  /** Vertical offset into the standalone virtual scroller. */
  scrollTopPx?: number;
  /** Overlay mode draws the compact chart panel; standalone fills its shell. */
  layout?: "overlay" | "standalone" | "chart";
  /** Stable key for display settings that affect drawing. */
  settingsKey?: string;
}

/**
 * Decide whether the canvas needs a redraw given the previous and next render
 * inputs. Returns true only when the displayed bars, the price-scale mapping,
 * or the layout (width/height) changed; otherwise the current rendering is
 * retained (Req 14.6, 14.7).
 *
 * Bars are compared by identity (the merge produces a fresh object only when a
 * bar actually changed) and by length/time, so an unchanged stream that
 * re-emits the same object does not force a redraw.
 */
export function shouldRedraw(
  prev: FootprintRenderInputs | null,
  next: FootprintRenderInputs,
): boolean {
  if (prev === null) return true;
  const pv = prev.viewport;
  const nv = next.viewport;
  if (
    pv.width !== nv.width ||
    pv.height !== nv.height ||
    pv.textColor !== nv.textColor ||
    pv.theme !== nv.theme ||
    pv.timeToX !== nv.timeToX ||
    pv.barSpacing !== nv.barSpacing ||
    pv.priceToY !== nv.priceToY
  ) {
    return true;
  }
  if (
    prev.displayCount !== next.displayCount ||
    prev.rowHeightPx !== next.rowHeightPx ||
    prev.renderHeightPx !== next.renderHeightPx ||
    prev.scrollTopPx !== next.scrollTopPx ||
    prev.layout !== next.layout
  ) {
    return true;
  }
  if (prev.settingsKey !== next.settingsKey) return true;
  if (prev.bars.length !== next.bars.length) return true;
  for (let i = 0; i < next.bars.length; i++) {
    // Reference inequality OR a content change (time/poc/rows length) triggers
    // a redraw. Reference check is the fast path for the common steady state.
    const a = prev.bars[i];
    const b = next.bars[i];
    if (a === b) continue;
    if (
      a.time !== b.time ||
      a.open !== b.open ||
      a.high !== b.high ||
      a.low !== b.low ||
      a.close !== b.close ||
      a.poc !== b.poc ||
      a.vah !== b.vah ||
      a.val !== b.val ||
      a.barDelta !== b.barDelta ||
      a.rows.length !== b.rows.length
    ) {
      return true;
    }
    // Same scalar header but a different object: compare row volumes.
    for (let r = 0; r < b.rows.length; r++) {
      const ar = a.rows[r];
      const br = b.rows[r];
      if (
        ar.price !== br.price ||
        ar.bid !== br.bid ||
        ar.ask !== br.ask ||
        ar.imbalance !== br.imbalance
      ) {
        return true;
      }
    }
  }
  return false;
}
