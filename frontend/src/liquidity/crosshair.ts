import type { VolumeDeltaPoint } from "../chart/indicatorReducer";

export interface LiquidityCrosshairViewport {
  left: number;
  width: number;
  top: number;
  priceHeight: number;
  deltaTop: number;
  deltaHeight: number;
  from: number;
  to: number;
  tfMs: number;
  priceMin: number;
  priceMax: number;
  deltaExtent: number;
}

export function liquidityCrosshairAt(
  hover: { x: number; y: number } | null,
  view: LiquidityCrosshairViewport,
  delta: readonly VolumeDeltaPoint[],
) {
  if (!hover || hover.x < view.left || hover.x > view.left + view.width ||
      hover.y < view.top || hover.y > view.deltaTop + view.deltaHeight) return null;
  const rawTime = view.from + (hover.x - view.left) / view.width * (view.to - view.from);
  const time = view.from + Math.min(
    Math.ceil((view.to - view.from) / view.tfMs) - 1,
    Math.floor((rawTime - view.from) / view.tfMs),
  ) * view.tfMs;
  const x = view.left + (time + view.tfMs / 2 - view.from) / (view.to - view.from) * view.width;
  const pane = hover.y <= view.top + view.priceHeight ? "price"
    : hover.y >= view.deltaTop ? "delta" : "gap";
  const value = pane === "price"
    ? view.priceMax - (hover.y - view.top) / view.priceHeight * (view.priceMax - view.priceMin)
    : pane === "delta"
      ? view.deltaExtent - (hover.y - view.deltaTop) / view.deltaHeight * view.deltaExtent * 2
      : null;
  return { x, time, pane, value, y: hover.y,
    delta: delta.find((bar) => bar.time === time)?.delta ?? null };
}

export function drawLiquidityCrosshair(
  context: CanvasRenderingContext2D,
  hover: { x: number; y: number } | null,
  view: LiquidityCrosshairViewport,
  delta: readonly VolumeDeltaPoint[],
  formatTime: (time: number) => string,
  formatVolume: (volume: number) => string,
) {
  const cursor = liquidityCrosshairAt(hover, view, delta);
  if (!cursor) return;
  const bottom = view.deltaTop + view.deltaHeight;
  const right = view.left + view.width;
  context.save();
  context.strokeStyle = "rgba(190, 205, 220, 0.65)";
  context.lineWidth = 1;
  context.setLineDash([3, 3]);
  context.beginPath();
  context.moveTo(cursor.x, view.top);
  context.lineTo(cursor.x, view.top + view.priceHeight);
  context.moveTo(cursor.x, view.deltaTop);
  context.lineTo(cursor.x, bottom);
  if (cursor.value !== null) {
    context.moveTo(view.left, cursor.y);
    context.lineTo(right, cursor.y);
  }
  context.stroke();
  context.setLineDash([]);
  context.font = "11px Segoe UI, sans-serif";
  context.textBaseline = "middle";

  const label = formatTime(cursor.time);
  const labelWidth = Math.min(view.width, context.measureText(label).width + 12);
  const labelLeft = Math.min(right - labelWidth, Math.max(view.left, cursor.x - labelWidth / 2));
  context.fillStyle = "#344352";
  context.fillRect(labelLeft, bottom + 5, labelWidth, 20);
  context.fillStyle = "#edf4fa";
  context.textAlign = "center";
  context.fillText(label, labelLeft + labelWidth / 2, bottom + 15);

  if (cursor.value !== null) {
    context.fillStyle = "#344352";
    context.fillRect(right, cursor.y - 9, 78, 18);
    context.fillStyle = "#edf4fa";
    context.textAlign = "left";
    context.fillText(cursor.pane === "price" ? cursor.value.toFixed(1)
      : formatVolume(cursor.value), right + 6, cursor.y);
  }

  const deltaLabel = cursor.delta === null ? "Delta: --"
    : `Delta: ${cursor.delta > 0 ? "+" : ""}${formatVolume(cursor.delta)}`;
  context.font = "bold 11px Segoe UI, sans-serif";
  context.textAlign = "right";
  const valueWidth = context.measureText(deltaLabel).width + 12;
  context.fillStyle = "#0a1118";
  context.fillRect(right - valueWidth, view.deltaTop + 2, valueWidth, 18);
  context.fillStyle = cursor.delta === null ? "#8d9aaa"
    : cursor.delta >= 0 ? "#00d68f" : "#ff5267";
  context.fillText(deltaLabel, right - 6, view.deltaTop + 11);
  if (cursor.delta !== null) {
    const y = view.deltaTop + (view.deltaExtent - cursor.delta) / (view.deltaExtent * 2) * view.deltaHeight;
    context.beginPath();
    context.arc(cursor.x, y, 3, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
