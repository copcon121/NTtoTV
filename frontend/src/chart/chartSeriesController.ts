// chart module — incremental series controller.
//
// Sits between the pure reducer (`barReducer.ts`) and a chart rendering port
// (`ChartSeriesPort`, implemented for real by `lightweightChartsAdapter.ts`).
// The controller owns the current bar series and decides — purely — which
// rendering call to make:
//
//  - On the initial history load it calls `port.setBars()` exactly once
//    (the only full-data load; Req 11.3 allows a bulk load for initial render).
//  - For every realtime `bar_update` it folds the bar through `applyBarUpdate`
//    and, when the merge actually changed something, calls `port.updateBar()`
//    with the single affected bar — an incremental update, never `setBars`
//    again (Req 11.3).
//  - When a `bar_update` leaves the series unchanged (identical in-progress
//    bar) it makes NO port call, so the chart is not repainted when its inputs
//    are unchanged (Req 12.4).
//
// Keeping the port abstract means the controller (and the reducer it drives) is
// fully testable under jsdom with a fake port — no real canvas required.

import {
  type BarApplicationKind,
  type BarSeries,
  applyBarUpdate,
} from "./barReducer";
import { normalizeBars } from "../cache/memoryCache";
import { type Bar } from "../cache/types";

/**
 * The thin rendering surface the controller drives. The Lightweight Charts
 * implementation lives in `lightweightChartsAdapter.ts`; tests use a fake.
 *
 * `setBars` is a bulk (full-data) load used once for initial history.
 * `updateBar` is an incremental single-bar update (maps to `series.update()`).
 */
export interface ChartSeriesPort {
  /** Bulk-load the full series (initial render only). */
  setBars(bars: BarSeries): void;
  /** Apply a single incremental bar update (append/overwrite/insert). */
  updateBar(bar: Bar): void;
}

/** Summary of what an `apply()` call did, for callers/tests to assert on. */
export interface ApplyOutcome {
  kind: BarApplicationKind;
  /** Whether a port render call was issued (false for a `noop`). */
  rendered: boolean;
}

/**
 * Drives a {@link ChartSeriesPort} from an incrementally-merged bar series.
 *
 * The controller is the stateful glue; all merge decisions are delegated to the
 * pure {@link applyBarUpdate} reducer so behavior is deterministic and testable.
 */
export class ChartSeriesController {
  private series: BarSeries = [];
  private loaded = false;

  constructor(private readonly port: ChartSeriesPort) {}

  /** The current merged series (sorted ascending by time, duplicate-free). */
  get bars(): BarSeries {
    return this.series;
  }

  /** Whether the initial history has been loaded yet. */
  get isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Load initial history. Normalizes the bars (sorted, duplicate-free) and
   * performs the single bulk `setBars` load. Calling again replaces the series
   * with a fresh bulk load — used when the symbol/contract/timeframe changes,
   * which is an allowed full repaint (Req 12.4: repaints only on such changes).
   */
  load(bars: readonly Bar[]): void {
    this.series = normalizeBars(bars);
    this.loaded = true;
    this.port.setBars(this.series);
  }

  /**
   * Apply a realtime `bar_update`. Before the initial load this seeds the series
   * with a single bar via a bulk load; afterwards it merges incrementally and
   * issues an incremental `updateBar` only when the merge changed the series.
   */
  apply(bar: Bar): ApplyOutcome {
    if (!this.loaded) {
      // No history yet: treat the first bar as the initial (bulk) series so the
      // series and the rendered state stay in lock-step.
      this.series = [{ ...bar }];
      this.loaded = true;
      this.port.setBars(this.series);
      return { kind: "append", rendered: true };
    }

    const result = applyBarUpdate(this.series, bar);
    this.series = result.bars;

    if (result.kind === "noop") {
      // Inputs unchanged — skip the repaint (Req 12.4).
      return { kind: "noop", rendered: false };
    }

    this.port.updateBar(result.bar);
    return { kind: result.kind, rendered: true };
  }

  /** Apply a batch of `bar_update` bars in order, returning each outcome. */
  applyAll(bars: Iterable<Bar>): ApplyOutcome[] {
    const outcomes: ApplyOutcome[] = [];
    for (const bar of bars) {
      outcomes.push(this.apply(bar));
    }
    return outcomes;
  }
}
