export const MIN_DENSE_OVERLAY_BAR_SPACING = 6;
export const MAX_DENSE_OVERLAY_BAR_SPACING = 30;
const STORAGE_KEY = "gc-chart-platform.indicator-zoom-min-spacing";

export function normalizeDenseOverlayMinSpacing(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return MIN_DENSE_OVERLAY_BAR_SPACING;
  }
  return Math.min(MAX_DENSE_OVERLAY_BAR_SPACING, Math.max(0, value));
}

export function readDenseOverlayMinSpacing(
  storage?: Pick<Storage, "getItem">,
): number {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw
      ? normalizeDenseOverlayMinSpacing(JSON.parse(raw))
      : MIN_DENSE_OVERLAY_BAR_SPACING;
  } catch {
    return MIN_DENSE_OVERLAY_BAR_SPACING;
  }
}

export function persistDenseOverlayMinSpacing(
  value: number,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    storage?.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeDenseOverlayMinSpacing(value)),
    );
  } catch {
    // The setting still applies for this session if browser storage is unavailable.
  }
}

export function shouldRenderDenseOverlay(
  barSpacing: number,
  minSpacing = MIN_DENSE_OVERLAY_BAR_SPACING,
): boolean {
  return (
    Number.isFinite(barSpacing) &&
    barSpacing >= normalizeDenseOverlayMinSpacing(minSpacing)
  );
}
