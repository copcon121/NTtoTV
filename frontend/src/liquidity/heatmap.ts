export interface LiquidityHeatmapSettings {
  minDurationSeconds: number;
  saturationMultiple: number;
  contrast: number;
}

export interface LiquiditySizeSample {
  time: number;
  size: number;
  active: boolean;
}

export interface HeatmapLine {
  startedAt: number;
  lastAt: number;
  endedAt: number | null;
  currentSize: number;
  active: boolean;
  samples?: LiquiditySizeSample[];
}

export const LIQUIDITY_STALE_MS = 90_000;
export const DEFAULT_HEATMAP_SETTINGS: LiquidityHeatmapSettings = {
  minDurationSeconds: 60,
  saturationMultiple: 4,
  contrast: 1,
};
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const MAX_SAMPLES_PER_LINE = 20_000;

export function normalizeHeatmapSettings(input: unknown): LiquidityHeatmapSettings {
  const source = input && typeof input === "object"
    ? input as Partial<LiquidityHeatmapSettings> : {};
  const number = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    minDurationSeconds: number(source.minDurationSeconds, 60, 0, 600),
    saturationMultiple: number(source.saturationMultiple, 4, 2, 20),
    contrast: number(source.contrast, 1, 0.3, 3),
  };
}

export function knownLineSamples(line: HeatmapLine): LiquiditySizeSample[] {
  // The final observation can seed a future live segment. Earlier presence
  // is rendered separately, without assigning it an invented historical size.
  return line.samples?.length ? line.samples : [{
    time: line.lastAt, size: line.currentSize, active: line.active,
  }];
}

export function mergeSizeSamples(
  first: readonly LiquiditySizeSample[],
  second: readonly LiquiditySizeSample[],
): LiquiditySizeSample[] {
  const byTime = new Map<number, LiquiditySizeSample>();
  for (const sample of [...first, ...second]) {
    if (Number.isFinite(sample.time) && Number.isFinite(sample.size)) {
      byTime.set(sample.time, sample);
    }
  }
  const sorted = [...byTime.values()].sort((a, b) => a.time - b.time);
  const cutoff = (sorted[sorted.length - 1]?.time ?? 0) - RETENTION_MS;
  const firstRetained = sorted.findIndex((sample) => sample.time >= cutoff);
  // Keep one carry-in anchor, and bound memory on very busy levels.
  return sorted.slice(Math.max(0, firstRetained - 1)).slice(-MAX_SAMPLES_PER_LINE);
}

export function heatmapLineEnd(line: HeatmapLine, now: number): number {
  return line.endedAt ?? (line.active && now - line.lastAt <= LIQUIDITY_STALE_MS
    ? now : line.lastAt);
}

// Current resting orders in the right margin, separate from recorded history.
export function liquidityLiveProjection(
  line: HeatmapLine,
  from: number,
  to: number,
  now: number,
): { from: number; to: number; size: number } | null {
  if (!line.active || line.endedAt !== null || line.currentSize <= 0 ||
      line.lastAt > now || now - line.lastAt > LIQUIDITY_STALE_MS) return null;
  const start = Math.max(from, now);
  return to > start ? { from: start, to, size: line.currentSize } : null;
}

export function heatmapLineVisible(
  line: HeatmapLine,
  settings: LiquidityHeatmapSettings,
  now: number,
  pixelsPerMs: number,
): boolean {
  const duration = heatmapLineEnd(line, now) - line.startedAt;
  return duration >= settings.minDurationSeconds * 1_000 && duration * pixelsPerMs >= 3;
}

export function liquidityHeatmapAlpha(
  size: number,
  threshold: number,
  settings: LiquidityHeatmapSettings,
): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  // Stable scale: panning/zooming and an unrelated giant order never recolor
  // history. Saturate at a configurable multiple of the tracker threshold.
  const ratio = size / Math.max(1, threshold);
  const intensity = Math.min(1, Math.max(0,
    Math.log1p(Math.max(0, ratio - 1)) / Math.log(settings.saturationMultiple),
  ));
  return 0.12 + 0.82 * Math.pow(intensity, settings.contrast);
}

export function liquidityHeatmapSegments(
  line: HeatmapLine,
  from: number,
  to: number,
  now: number,
): Array<{ from: number; to: number; size: number | null }> {
  const samples = knownLineSamples(line);
  const end = Math.min(to, heatmapLineEnd(line, now));
  const segments: Array<{ from: number; to: number; size: number | null }> = [];
  // Lifecycle history already establishes that the level existed. Retain its
  // band even when per-size history was not recorded by the older backend.
  // Null explicitly means presence only; never color it from peak/currentSize.
  const prefixStart = Math.max(from, line.startedAt);
  const prefixEnd = Math.min(end, samples[0].time);
  if (prefixEnd > prefixStart) {
    segments.push({ from: prefixStart, to: prefixEnd, size: null });
  }
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!sample.active || sample.size <= 0) continue;
    const start = Math.max(from, line.startedAt, sample.time);
    // Do not bridge a disconnected or unobserved interval indefinitely.
    const stop = Math.min(end, samples[index + 1]?.time ?? end,
      sample.time + LIQUIDITY_STALE_MS);
    if (stop <= start) continue;
    const previous = segments[segments.length - 1];
    if (previous && previous.to === start && previous.size === sample.size) {
      previous.to = stop;
    } else {
      segments.push({ from: start, to: stop, size: sample.size });
    }
  }
  return segments;
}

export function removeHeatmapSpeckles<T extends { from: number; to: number }>(
  segments: readonly T[], pixelsPerMs: number,
): T[] {
  const visible: T[] = [];
  let start = 0;
  while (start < segments.length) {
    let end = start + 1;
    while (end < segments.length && segments[end - 1].to === segments[end].from) end += 1;
    // Judge a continuous run as a whole. Frequent size changes may each be
    // subpixel, but must not erase a continuous wall of resting liquidity.
    if ((segments[end - 1].to - segments[start].from) * pixelsPerMs >= 3) {
      visible.push(...segments.slice(start, end));
    }
    start = end;
  }
  return visible;
}
