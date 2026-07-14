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
  /** Overlay mode draws the compact chart panel; standalone fills its shell. */
  layout?: "overlay" | "standalone";
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
    pv.priceToY !== nv.priceToY
  ) {
    return true;
  }
  if (
    prev.displayCount !== next.displayCount ||
    prev.rowHeightPx !== next.rowHeightPx ||
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
