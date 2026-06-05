import type { Timeframe } from "../socket/messages";

/**
 * TimeframeSelector — selects the active bar aggregation interval.
 *
 * Presents the supported timeframes (1m, 3m, 5m, 15m, 30m, 1h, 4h, 1D from the
 * design Glossary) as a row of buttons and calls back when the user picks one.
 * Purely presentational: the parent owns the `value` state and reacts to
 * `onChange` (e.g. to switch the chart series via the MemoryCache).
 *
 * Requirements: 19.1 (timeframe selector region), supports the timeframe set
 * defined in Req 9.1 / design Glossary.
 */

/** The supported timeframes in display order (design Glossary: Timeframe). */
export const TIMEFRAMES: readonly Timeframe[] = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1D",
] as const;

export interface TimeframeSelectorProps {
  /** Currently selected timeframe (controlled). */
  value: Timeframe;
  /** Called with the new timeframe when the user selects a different one. */
  onChange: (tf: Timeframe) => void;
  /** Optional override of the timeframe set to render (defaults to TIMEFRAMES). */
  timeframes?: readonly Timeframe[];
}

export function TimeframeSelector({
  value,
  onChange,
  timeframes = TIMEFRAMES,
}: TimeframeSelectorProps) {
  return (
    <nav
      className="timeframe-selector"
      role="radiogroup"
      aria-label="Timeframe selector"
    >
      {timeframes.map((tf) => {
        const selected = tf === value;
        return (
          <button
            key={tf}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? "timeframe-option selected" : "timeframe-option"}
            // Avoid emitting a no-op change when the active timeframe is clicked.
            onClick={() => {
              if (!selected) {
                onChange(tf);
              }
            }}
          >
            {tf}
          </button>
        );
      })}
    </nav>
  );
}
