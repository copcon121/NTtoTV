export const MIN_DENSE_OVERLAY_BAR_SPACING = 6;

export function shouldRenderDenseOverlay(barSpacing: number): boolean {
  return (
    Number.isFinite(barSpacing) &&
    barSpacing >= MIN_DENSE_OVERLAY_BAR_SPACING
  );
}
