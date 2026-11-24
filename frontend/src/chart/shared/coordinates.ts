import type { UtcViewport } from "./sync";

/** Continuous UTC mapping over the actual loaded bar calendar, including gaps and extrapolated margins. */
export function timeToLogical(times: readonly number[], utcMs: number, fallbackStepMs = 60_000): number | null {
  if (!times.length || !Number.isFinite(utcMs)) return null;
  if (times.length === 1) return (utcMs - times[0]) / fallbackStepMs;
  let low = 0, high = times.length - 1;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (times[middle] < utcMs) low = middle + 1; else high = middle; }
  const right = Math.max(1, low);
  const left = right - 1;
  if (utcMs > times[times.length - 1]) {
    const n = times.length - 1;
    return n + (utcMs - times[n]) / Math.max(1, times[n] - times[n - 1]);
  }
  return left + (utcMs - times[left]) / Math.max(1, times[right] - times[left]);
}
export function logicalToTime(times: readonly number[], logical: number, fallbackStepMs = 60_000): number | null {
  if (!times.length || !Number.isFinite(logical)) return null;
  if (times.length === 1) return times[0] + logical * fallbackStepMs;
  const left = Math.max(0, Math.min(times.length - 2, Math.floor(logical)));
  return times[left] + (logical - left) * Math.max(1, times[left + 1] - times[left]);
}
export function viewportEqual(a: UtcViewport | undefined, b: UtcViewport | undefined): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.fromUtcMs - b.fromUtcMs) < 1 && Math.abs(a.toUtcMs - b.toUtcMs) < 1
    && JSON.stringify(a.priceRange) === JSON.stringify(b.priceRange);
}
/** Main charts may have indicator/volume-only points in their global logical calendar. */
export function utcToChartLogical(times: readonly number[], logicalIndices: readonly number[], utcMs: number): number | null {
  const index = timeToLogical(times, utcMs);
  return index === null ? null : logicalToTime(logicalIndices, index, 1);
}
export function chartLogicalToUtc(times: readonly number[], logicalIndices: readonly number[], logical: number): number | null {
  const index = timeToLogical(logicalIndices, logical, 1);
  return index === null ? null : logicalToTime(times, index);
}
export interface SessionInterval { start: number; end: number }
/** Preserve MP's compressed sessions while keeping wire anchors invertible UTC values. */
export function sessionPositionToUtc(sessions: readonly SessionInterval[], position: number): number | null {
  if (!sessions.length || !Number.isFinite(position)) return null;
  const index = Math.max(0, Math.min(sessions.length - 1, Math.floor(position)));
  return sessions[index].start + (position - index) * Math.max(1, sessions[index].end - sessions[index].start);
}
export function utcToSessionPosition(sessions: readonly SessionInterval[], utcMs: number): number | null {
  if (!sessions.length || !Number.isFinite(utcMs)) return null;
  const index = sessions.findIndex(s => utcMs >= s.start && utcMs <= s.end);
  if (index >= 0) {
    // A compressed integer boundary cannot mean both prior close and next open.
    // Reject the prior close when a gap follows; UTC remains unambiguous on the linked host.
    if (utcMs === sessions[index].end && index + 1 < sessions.length && sessions[index + 1].start !== utcMs) return null;
    return index + (utcMs - sessions[index].start) / Math.max(1, sessions[index].end - sessions[index].start);
  }
  // Closed-session gaps have no unique compressed coordinate. Never fabricate an anchor in them.
  if (utcMs > sessions[0].start && utcMs < sessions[sessions.length - 1].end) return null;
  const outside = utcMs < sessions[0].start ? 0 : sessions.length - 1;
  return outside + (utcMs - sessions[outside].start) / Math.max(1, sessions[outside].end - sessions[outside].start);
}
