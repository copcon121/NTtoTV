import type { NativeIcebergState } from "../socket/messages";
import { icebergPassesIndividualFilter, icebergStatusVisible, type IcebergFilterContext } from "./icebergFilters";

export function icebergEndTime(row: NativeIcebergState): number {
  // Active describes the exchange identity, not proof of continuing activity.
  // An exhausted tranche may remain active while awaiting a refill or DELETE.
  return Math.max(row.detectedTime, row.endTime ?? row.time);
}

export function visibleIcebergs(
  rows: readonly NativeIcebergState[], from: number, to: number, now: number,
): NativeIcebergState[] {
  return rows.filter((row) => row.detectedTime <= Math.min(to, now) &&
    icebergEndTime(row) >= from);
}

export const ICEBERG_COLORS = { buy: "#35d6b0", sell: "#ff8a65" } as const;
const BADGE_HEIGHT = 17;
const volumeFormat = new Intl.NumberFormat("en-US");

interface IcebergView {
  from: number; to: number; now: number;
  timeframeMs: number;
  left: number; right: number; top: number; bottom: number;
  xAt: (time: number) => number; yAt: (price: number) => number;
  hover?: { x: number; y: number } | null;
  filter?: IcebergFilterContext;
}

export interface IcebergBadge {
  rows: NativeIcebergState[];
  text: string;
  x: number; y: number; width: number; height: number;
  anchorX: number; anchorY: number;
  active: boolean;
  filtered: boolean;
}

interface IcebergGroup {
  rows: NativeIcebergState[];
  individualFiltered: boolean;
  filtered: boolean;
  time: number;
  price: number;
  total: number;
}

function candleCenter(time: number, view: IcebergView): number {
  return Math.floor(time / view.timeframeMs) * view.timeframeMs + view.timeframeMs / 2;
}

function groupIcebergs(rows: readonly NativeIcebergState[], view: IcebergView, textWidth: (text: string) => number): IcebergGroup[] {
  const groups: IcebergGroup[] = [];
  const filter = view.filter;
  const candidates = visibleIcebergs(rows, view.from, view.to, view.now)
    .filter((row) => !filter || icebergStatusVisible(row, filter.settings))
    .sort((a, b) => a.detectedTime - b.detectedTime || a.orderId.localeCompare(b.orderId));
  for (const row of candidates) {
    const individualFiltered = filter ? !icebergPassesIndividualFilter(row, filter) : false;
    const group = groups.find((item) => {
      const first = item.rows[0];
      if (first.side !== row.side || item.individualFiltered !== individualFiltered ||
          (first.status === "active") !== (row.status === "active") ||
          (first.status === "invalidated") !== (row.status === "invalidated")) return false;
      if (!filter) return first.price === row.price && candleCenter(first.detectedTime, view) === candleCenter(row.detectedTime, view);
      if (!filter.settings.aggregate) return false;
      const width = textWidth(volumeFormat.format(item.total)) + 24;
      return Math.abs(view.xAt(row.detectedTime) - view.xAt(item.time)) <= width * filter.settings.timeArea / 10 &&
        Math.abs(view.yAt(row.price) - view.yAt(item.price)) <= BADGE_HEIGHT * filter.settings.priceArea / 10;
    });
    if (group) {
      const total = group.total + row.executedVolume;
      if (total > 0) {
        group.time += (row.detectedTime - group.time) * row.executedVolume / total;
        group.price += (row.price - group.price) * row.executedVolume / total;
      }
      group.rows.push(row);
      group.total = total;
    } else groups.push({ rows: [row], individualFiltered, filtered: individualFiltered,
      time: row.detectedTime, price: row.price, total: row.executedVolume });
  }
  for (const group of groups) group.filtered = group.individualFiltered ||
    (filter !== undefined && group.total < filter.settings.aggregateMinVolume);
  return groups.filter((group) => !group.filtered || filter?.settings.showFiltered);
}

/** Screen-space aggregation is visual only; rejected orders cannot boost qualified groups. */
export function layoutIcebergBadges(
  rows: readonly NativeIcebergState[], view: IcebergView,
  textWidth: (text: string) => number,
): IcebergBadge[] {
  const badges: IcebergBadge[] = [];
  const sorted = groupIcebergs(rows, view, textWidth).sort((a, b) =>
    Number(a.filtered) - Number(b.filtered) ||
    Number(b.rows[0].status === "active") - Number(a.rows[0].status === "active") || b.time - a.time);
  for (const group of sorted) {
    const row = group.rows[0];
    const active = row.status === "active";
    const text = volumeFormat.format(group.total);
    const width = Math.min(view.right - view.left, textWidth(text) + 24);
    const anchorX = view.xAt(candleCenter(group.time, view));
    const anchorY = view.yAt(group.price);
    if (anchorX < view.left || anchorX > view.right || anchorY < view.top || anchorY > view.bottom) continue;
    const x = Math.max(view.left, Math.min(anchorX - width / 2,
      view.right - width));
    const direction = row.side === "buy" ? -1 : 1;
    // Try short offset lanes before suppressing an older overlapping icon.
    for (let lane = 0; lane < 3; lane += 1) {
      const offset = 7 + lane * (BADGE_HEIGHT + 3);
      const y = Math.max(view.top, Math.min(
        anchorY + direction * offset - (direction < 0 ? BADGE_HEIGHT : 0),
        view.bottom - BADGE_HEIGHT,
      ));
      if (badges.some((badge) => x < badge.x + badge.width + 3 && x + width + 3 > badge.x &&
          y < badge.y + badge.height + 2 && y + BADGE_HEIGHT + 2 > badge.y)) continue;
      badges.push({ rows: group.rows, text, x, y, width, height: BADGE_HEIGHT, anchorX, anchorY, active, filtered: group.filtered });
      break;
    }
  }
  return badges;
}

function roundedBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  const r = Math.min(4, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Icon + total at the detection candle, with a thin trace of observed activity. */
export function drawNativeIcebergs(
  ctx: CanvasRenderingContext2D, rows: readonly NativeIcebergState[], view: IcebergView,
): void {
  ctx.save();
  ctx.font = "600 11px Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineWidth = 1;
  const groups = groupIcebergs(rows, view, (text) => ctx.measureText(text).width);
  for (const group of groups) for (const row of group.rows) {
    const y = view.yAt(row.price);
    if (y < view.top || y > view.bottom) continue;
    const start = view.xAt(Math.max(view.from, row.detectedTime));
    const end = view.xAt(Math.min(view.to, icebergEndTime(row)));
    ctx.strokeStyle = ICEBERG_COLORS[row.side];
    ctx.globalAlpha = (row.status === "active" ? 0.75 : 0.3) * (group.filtered ? view.filter!.settings.filteredOpacity : 1);
    ctx.setLineDash(row.status === "invalidated" ? [3, 3] : []);
    ctx.beginPath();
    ctx.moveTo(start, y);
    ctx.lineTo(Math.max(start + 2, end), y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const badges = layoutIcebergBadges(rows, view, (text) => ctx.measureText(text).width);
  for (const badge of badges) {
    const bid = badge.rows[0].side === "buy";
    const color = ICEBERG_COLORS[badge.rows[0].side];
    ctx.strokeStyle = color;
    ctx.globalAlpha = (badge.active ? 1 : badge.rows[0].status === "invalidated" ? 0.4 : 0.8) *
      (badge.filtered ? view.filter!.settings.filteredOpacity : 1);
    ctx.beginPath();
    const stemX = Math.max(badge.x + 5, Math.min(badge.anchorX, badge.x + badge.width - 5));
    ctx.moveTo(badge.anchorX, badge.anchorY);
    ctx.lineTo(stemX, badge.y + (badge.rows[0].side === "buy" ? badge.height : 0));
    ctx.stroke();
    roundedBox(ctx, badge.x, badge.y, badge.width, badge.height);
    ctx.fillStyle = "#1a2226";
    ctx.fill();
    // Mirror the iceberg glyph so passive BID and ASK differ by shape and color.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(badge.x + 5, badge.y + (bid ? 10 : 6));
    ctx.lineTo(badge.x + 9, badge.y + (bid ? 4 : 12));
    ctx.lineTo(badge.x + 14, badge.y + (bid ? 10 : 6));
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(badge.x + 4, badge.y + (bid ? 12 : 4), 11, 1);
    ctx.fillStyle = "#f5f8fa";
    ctx.fillText(badge.text, badge.x + 19, badge.y + badge.height / 2, Math.max(1, badge.width - 22));
  }
  const hover = view.hover;
  const hit = hover && badges.find((badge) => hover.x >= badge.x && hover.x <= badge.x + badge.width &&
    hover.y >= badge.y && hover.y <= badge.y + badge.height);
  if (hit) {
    const total = hit.rows.reduce((sum, row) => sum + row.executedVolume, 0);
    const refills = hit.rows.reduce((sum, row) => sum + row.refillCount, 0);
    const status = [...new Set(hit.rows.map((row) => row.status))].join(" / ");
    const detail = [
      `${hit.rows[0].side === "buy" ? "BID" : "ASK"} iceberg - ${volumeFormat.format(total)} executed`,
      `${status} - ${hit.rows.length} order${hit.rows.length === 1 ? "" : "s"} - ${refills} refill${refills === 1 ? "" : "s"}${hit.filtered ? " - below filter" : ""}`,
    ];
    const width = Math.min(view.right - view.left, Math.max(...detail.map((text) => ctx.measureText(text).width)) + 16);
    const x = Math.max(view.left, Math.min(hit.x, view.right - width));
    const y = Math.max(view.top, Math.min(hit.y + hit.height + 6, view.bottom - 40));
    ctx.globalAlpha = 1;
    roundedBox(ctx, x, y, width, 40);
    ctx.fillStyle = "#182d3b";
    ctx.fill();
    ctx.fillStyle = "#eaf3fb";
    detail.forEach((text, index) => ctx.fillText(text, x + 8, y + 12 + index * 16, Math.max(1, width - 16)));
  }
  ctx.restore();
}
