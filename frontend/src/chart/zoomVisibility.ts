export const MIN_DENSE_OVERLAY_BAR_SPACING = 6;

export function normalizeDenseOverlayBarSpacing(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : MIN_DENSE_OVERLAY_BAR_SPACING;
}

export function shouldRenderDenseOverlay(
  barSpacing: number,
  minimumBarSpacing = MIN_DENSE_OVERLAY_BAR_SPACING,
): boolean {
  return (
    Number.isFinite(barSpacing) &&
    barSpacing >= normalizeDenseOverlayBarSpacing(minimumBarSpacing)
  );
}
