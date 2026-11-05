import type { SiStopChain } from "../socket/messages";
import { siStopPasses, type SiStopSettings } from "./siStops";

interface View {
  from: number; to: number; timeframeMs: number;
  left: number; right: number; top: number; bottom: number;
  xAt: (time: number) => number; yAt: (price: number) => number;
  hover: { x: number; y: number } | null;
  settings: SiStopSettings;
  threshold: number;
}

interface Group {
  rows: SiStopChain[]; time: number; price: number; volume: number; filtered: boolean;
}

export function siStopGroups(rows: readonly SiStopChain[], view: View,
  measure: (text: string) => number): Group[] {
  if (!view.settings.enabled) return [];
  const groups: Group[] = [];
  for (const row of rows) {
    if (row.time < view.from || row.time > view.to) continue;
    const filtered = !siStopPasses(row, view.settings, view.threshold);
    const group = view.settings.aggregate && groups.find((g) =>
      g.rows[0].side === row.side && g.filtered === filtered &&
      Math.abs(view.xAt(row.time) - view.xAt(g.time)) <= (measure(String(g.volume)) + 29) * view.settings.timeArea / 10 &&
      Math.abs(view.yAt(row.price) - view.yAt(g.price)) <= 17 * view.settings.priceArea / 10);
    if (group) {
      const total = group.volume + row.executedVolume;
      group.time += (row.time - group.time) * row.executedVolume / total;
      group.price += (row.price - group.price) * row.executedVolume / total;
      group.volume = total;
      group.rows.push(row);
    } else groups.push({ rows: [row], time: row.time, price: row.price, volume: row.executedVolume, filtered });
  }
  for (const group of groups) group.filtered ||= group.volume < view.settings.aggregateMinVolume;
  return groups.filter((g) => !g.filtered || view.settings.showFiltered);
}

/** Completed chains use their last execution candle/price, never an MV peak. */
export function drawSiStops(ctx: CanvasRenderingContext2D, rows: readonly SiStopChain[], view: View): void {
  ctx.save();
  ctx.font = "600 11px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const groups = siStopGroups(rows, view, (s) => ctx.measureText(s).width)
    .sort((a, b) => b.time - a.time);
  const occupied: { x: number; y: number; width: number }[] = [];
  let hit: { group: Group; x: number; y: number } | undefined;
  for (const group of groups) {
    const candle = Math.floor(group.time / view.timeframeMs) * view.timeframeMs + view.timeframeMs / 2;
    const x = view.xAt(candle);
    const anchorY = view.yAt(group.price);
    if (x < view.left || x > view.right || anchorY < view.top || anchorY > view.bottom) continue;
    const text = group.volume.toLocaleString("en-US");
    const width = Math.min(view.right - view.left, ctx.measureText(text).width + 29);
    const left = Math.max(view.left, Math.min(x - width / 2, view.right - width));
    const buy = group.rows[0].side === "buy";
    let y = 0;
    let available = false;
    for (let lane = 0; lane < 3; lane++) {
      y = Math.max(view.top, Math.min(anchorY + (buy ? -1 : 1) * (30 + lane * 20) - 8, view.bottom - 17));
      if (!occupied.some((b) => left < b.x + b.width + 2 && left + width + 2 > b.x && Math.abs(y - b.y) < 19)) {
        available = true;
        break;
      }
    }
    if (!available) continue;
    occupied.push({ x: left, y, width });
    const color = buy ? view.settings.buyColor : view.settings.sellColor;
    ctx.globalAlpha = group.filtered ? view.settings.filteredOpacity : 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, anchorY); ctx.lineTo(x, y + (buy ? 17 : 0)); ctx.stroke();
    ctx.fillStyle = "#132329";
    ctx.fillRect(left, y, width, 17);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(left + 4, y + 8); ctx.lineTo(left + 9, y + 3);
    ctx.lineTo(left + 14, y + 8); ctx.lineTo(left + 9, y + 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#071813"; ctx.fillText("S", left + 6, y + 8.5);
    ctx.fillStyle = "#f0f7f6"; ctx.fillText(text, left + 20, y + 8.5);
    if (view.hover && view.hover.x >= left && view.hover.x <= left + width &&
        view.hover.y >= y && view.hover.y <= y + 17) hit = { group, x: left, y: y + 23 };
  }
  if (hit) {
    const group = hit.group;
    const executions = group.rows.reduce((sum, r) => sum + r.executionCount, 0);
    const lines = [
      `${group.rows[0].side.toUpperCase()} SI Stops - ${group.volume.toLocaleString("en-US")} contracts`,
      `${group.rows.length} chain${group.rows.length === 1 ? "" : "s"}${group.rows.length > 1 ? " grouped" : ""} - ${executions} trade prints`,
      group.filtered ? "Inferred stop activity - below filter" : "Inferred stop activity",
    ];
    const height = lines.length * 17 + 6;
    const width = Math.min(view.right - view.left, Math.max(...lines.map((s) => ctx.measureText(s).width)) + 16);
    const x = Math.max(view.left, Math.min(hit.x, view.right - width));
    const y = Math.max(view.top, Math.min(hit.y, view.bottom - height));
    ctx.globalAlpha = 1; ctx.fillStyle = "#162b31"; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#edf8f5";
    lines.forEach((s, i) => ctx.fillText(s, x + 8, y + 11 + i * 17));
  }
  ctx.restore();
}
