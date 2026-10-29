export interface LiquidityHeatmapSettings {
  minDurationSeconds: number;
  saturationMultiple: number;
  contrast: number;
  opacity: number;
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
  opacity: 1,
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
    opacity: number(source.opacity, 1, 0, 2),
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

export function liquidityLineAppearance(
  size: number | null,
  threshold: number,
  settings: LiquidityHeatmapSettings,
  ended = false,
  stale = false,
): { alpha: number; width: number; dash: number[] } {
  const alpha = size === null ? 0.3 : liquidityHeatmapAlpha(size, threshold, settings);
  // Use the size of THIS observation, never a lifetime peak. A refill followed
  // by a reduction must return to the same brightness and width as before.
  const intensity = size === null ? 0 : Math.max(0, (alpha - 0.12) / 0.82);
  return {
    alpha: Math.min(1, alpha * (ended || stale ? 0.55 : 1) * settings.opacity),
    width: 1 + 4 * intensity,
    dash: ended ? [5, 4] : [],
  };
}

export type LiquiditySizeChange = "steady" | "add" | "remove";

export function liquidityLineColor(
  size: number | null,
  threshold: number,
  settings: LiquidityHeatmapSettings,
  change: LiquiditySizeChange,
  side: "bid" | "ask",
): string {
  if (size === null || change === "steady") {
    return side === "bid" ? "0, 214, 143" : "255, 82, 103";
  }
  if (change === "remove") return "156, 126, 232";
  // A fixed volume scale, so a refill warms up without recoloring other rows.
  const intensity = Math.max(0, (liquidityHeatmapAlpha(size, threshold, settings) - 0.12) / 0.82);
  const stops = [[34, 160, 255], [35, 224, 213], [255, 223, 80], [255, 142, 56]];
  const position = Math.min(stops.length - 1, intensity * (stops.length - 1));
  const index = Math.min(stops.length - 2, Math.floor(position));
  return stops[index].map((value, channel) =>
    Math.round(value + (stops[index + 1][channel] - value) * (position - index)),
  ).join(", ");
}

export function drawLiquidityLevel(
  context: CanvasRenderingContext2D,
  line: HeatmapLine & { side: "bid" | "ask"; threshold: number },
  viewport: {
    from: number; to: number; now: number; pixelsPerMs: number;
    showLive: boolean; y: number; xAt: (time: number) => number;
    settings: LiquidityHeatmapSettings;
  },
): number | null {
  const { from, to, now, pixelsPerMs, showLive, y, xAt, settings } = viewport;
  if (settings.opacity === 0) return null;
  const ended = line.endedAt !== null && line.endedAt <= now;
  const stale = !ended && now - line.lastAt > LIQUIDITY_STALE_MS;
  const samples = knownLineSamples(line);
  let sampleIndex = 0;
  let change: LiquiditySizeChange = "steady";
  const changeAt = (time: number): LiquiditySizeChange => {
    while (sampleIndex + 1 < samples.length && samples[sampleIndex + 1].time <= time) {
      const before = samples[sampleIndex];
      const after = samples[++sampleIndex];
      if (!before.active || after.time - before.time > LIQUIDITY_STALE_MS) change = "steady";
      else if (after.size !== before.size) change = after.size > before.size ? "add" : "remove";
    }
    return change;
  };
  const stroke = (start: number, end: number, size: number | null, retired: boolean, faded: boolean) => {
    const style = liquidityLineAppearance(size, line.threshold, settings, retired, faded);
    const color = liquidityLineColor(size, line.threshold, settings, changeAt(start), line.side);
    context.strokeStyle = `rgba(${color}, ${style.alpha})`;
    context.lineWidth = style.width;
    context.setLineDash(style.dash);
    context.beginPath();
    context.moveTo(xAt(start), y);
    context.lineTo(xAt(end), y);
    context.stroke();
  };
  context.save();
  context.lineCap = "butt";
  const segments = removeHeatmapSpeckles(liquidityHeatmapSegments(line, from, to, now), pixelsPerMs);
  for (const segment of segments) stroke(segment.from, segment.to, segment.size, ended, stale);
  const projection = showLive ? liquidityLiveProjection(line, from, to, now) : null;
  // The live book uses the same solid style as its latest observed size.
  // Dashed strokes are reserved for completed levels, never future space.
  if (projection) stroke(projection.from, projection.to, projection.size, false, false);
  context.restore();
  return projection ? xAt(projection.to) : null;
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
