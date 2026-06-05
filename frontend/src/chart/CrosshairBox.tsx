import type { Bar } from "../socket/messages";

/**
 * CrosshairBox — OHLCV readout that follows the crosshair.
 *
 * When the crosshair moves over a bar, the parent passes that bar's OHLCV here
 * and this box displays the values (Req 19.5). It is purely presentational:
 * the ChartContainer (task 12.3) owns the Lightweight Charts crosshair-move
 * subscription and feeds the hovered bar down as `bar`. When `bar` is
 * undefined (crosshair off the series) the box shows neutral placeholders.
 *
 * Requirements: 19.1 (crosshair OHLCV box region), 19.5 (update with the bar's
 * values as the crosshair moves over a bar).
 */
export interface CrosshairBoxProps {
  /** The bar currently under the crosshair, or undefined when off-series. */
  bar?: Bar;
  /**
   * Number of fraction digits used to format O/H/L/C prices. GC ticks in
   * tenths, so one decimal is a sensible default; the parent can override.
   */
  pricePrecision?: number;
  /** Placeholder shown for each field when no bar is hovered. */
  emptyLabel?: string;
}

interface FieldProps {
  label: string;
  value: string;
  testId: string;
}

function Field({ label, value, testId }: FieldProps) {
  return (
    <span className="ohlcv-field">
      <span className="ohlcv-label">{label}</span>
      <span className="ohlcv-value" data-testid={testId}>
        {value}
      </span>
    </span>
  );
}

export function CrosshairBox({
  bar,
  pricePrecision = 1,
  emptyLabel = "—",
}: CrosshairBoxProps) {
  const price = (n: number | undefined): string =>
    n === undefined ? emptyLabel : n.toFixed(pricePrecision);
  const volume = (n: number | undefined): string =>
    n === undefined ? emptyLabel : String(n);

  return (
    <div className="crosshair-box" aria-label="OHLCV">
      <Field label="O" value={price(bar?.open)} testId="ohlcv-open" />
      <Field label="H" value={price(bar?.high)} testId="ohlcv-high" />
      <Field label="L" value={price(bar?.low)} testId="ohlcv-low" />
      <Field label="C" value={price(bar?.close)} testId="ohlcv-close" />
      <Field label="V" value={volume(bar?.volume)} testId="ohlcv-volume" />
    </div>
  );
}
