export const LIQUIDITY_HISTORY_PAGE_LIMIT = 5_000;
export const LIQUIDITY_CANDLE_RETENTION_MS = 48 * 60 * 60 * 1_000;

/** Keep each inclusive range below the REST endpoints' 5,000-bar cap. */
export function liquidityHistoryRanges(from: number, to: number, tfMs: number) {
  const ranges: { from: number; to: number }[] = [];
  for (let start = from; start <= to;) {
    const end = Math.min(to,
      Math.floor(start / tfMs) * tfMs + LIQUIDITY_HISTORY_PAGE_LIMIT * tfMs - 1);
    ranges.push({ from: start, to: end });
    start = end + 1;
  }
  return ranges;
}
