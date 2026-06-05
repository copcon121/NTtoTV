import { useEffect, useRef } from "react";

import {
  FOOTPRINT_DISPLAY_COUNT,
  type FootprintBar,
  type FootprintRenderInputs,
  type FootprintViewport,
  selectDisplayBars,
  shouldRedraw,
} from "./footprintModel";
import type { FootprintSettings } from "../chart/IndicatorToggles";

/**
 * FootprintCanvas - NT-style panel mode for the last 5 live M1 footprint bars.
 *
 * Renders the bid-by-ask ladder for the selected display bars on a dedicated
 * canvas layer with its own panel price scale (Req 14.2, 19.4). It redraws
 * only when the displayed bars, the price scale, or the
 * layout change (Req 14.6, 14.7) and throttles redraws to the 100-125ms window
 * (Req 14.8) using a trailing-edge timer so a burst of updates collapses to one
 * draw per interval.
 *
 * The selection + redraw-decision logic is the pure `footprintModel`; this
 * component is the thin canvas/React shell.
 */
export interface FootprintCanvasProps {
  /** The live M1 footprint bars, keyed by time (already merged by the parent). */
  bars: ReadonlyMap<number, FootprintBar>;
  /** The viewport (price-scale mapping + layout) from the chart. */
  viewport: FootprintViewport;
  /** Min redraw interval (ms); clamped to the 100-125ms window (Req 14.8). */
  throttleMs?: number;
  /** Optional injected clock (ms) for deterministic tests. */
  now?: () => number;
  /** Footprint display settings (VA, imbalance, unfinished auction). */
  settings?: FootprintSettings;
}

const MIN_THROTTLE_MS = 100;
const MAX_THROTTLE_MS = 125;
const MZ_THEME = {
  bidCellStrong: "rgba(250, 128, 114, 1)",
  askCellStrong: "rgba(0, 139, 139, 1)",
  vaZone: "rgba(144, 238, 144, 0.32)",
  vaBorder: "rgba(144, 238, 144, 0.68)",
  text: "#000000",
  poc: "#ff00ff",
  deltaPos: "#008000",
  deltaNeg: "#ff0000",
  unfinishedAuction: "#ffd700",
  candleUp: "#00aa20",
  candleDown: "#8b0000",
};

function clampThrottle(ms: number): number {
  return Math.min(Math.max(ms, MIN_THROTTLE_MS), MAX_THROTTLE_MS);
}

/** Draw the selected footprint bars onto the 2D context. Exported for tests. */
export function drawFootprint(
  ctx: CanvasRenderingContext2D,
  inputs: FootprintRenderInputs,
  settings?: FootprintSettings,
): void {
  const showVA = settings?.showVA ?? false;
  const showImbalance = settings?.showImbalance ?? true;
  const showUnfinishedAuction = settings?.showUnfinishedAuction ?? true;
  const vaPercent = clampPercent(settings?.vaPercent ?? 70);
  const imbalanceMinVolume = Math.max(
    0,
    Math.round(settings?.imbalanceMinVolume ?? 10),
  );
  const { bars, viewport } = inputs;
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  if (bars.length === 0) return;

  const priceStep = inferPriceStep(bars);
  const panelBars = bars.map((bar) => ({
    bar,
    profile: profileForBar(bar, vaPercent, priceStep),
    imbalances: computeImbalances(bar, priceStep, imbalanceMinVolume),
    rowsWithVolume: bar.rows.filter((row) => row.bid > 0 || row.ask > 0),
  }));
  if (panelBars.every(({ rowsWithVolume }) => rowsWithVolume.length === 0)) {
    return;
  }

  const panelW = Math.min(400, Math.max(40, viewport.width - 20));
  const panelH = Math.max(40, viewport.height - 40);
  const panelX = Math.max(10, viewport.width - panelW - 10);
  const panelY = 20;
  const panelBottom = panelY + panelH;
  const contentTop = panelY + 25;
  const contentBottom = panelBottom - 15;
  const contentHeight = contentBottom - contentTop;
  if (contentHeight <= 0) return;

  const allPrices = panelBars
    .flatMap(({ bar, profile }) => [
      profile.open,
      profile.high,
      profile.low,
      profile.close,
      ...bar.rows.map((row) => row.price),
    ])
    .filter(isFiniteNumber);
  if (allPrices.length === 0) return;

  let dataMinPrice = Math.min(...allPrices);
  let dataMaxPrice = Math.max(...allPrices);
  if (dataMinPrice >= dataMaxPrice) {
    dataMinPrice -= 20 * priceStep;
    dataMaxPrice += 20 * priceStep;
  }
  dataMaxPrice += 5 * priceStep;
  dataMinPrice -= 5 * priceStep;

  const priceRange = Math.max(priceStep, dataMaxPrice - dataMinPrice);
  const numPriceLevels = Math.max(10, Math.ceil(priceRange / priceStep) + 1);
  const rowH = Math.max(1, Math.min(20, contentHeight / numPriceLevels));
  const visibleRange = Math.max(priceRange, (contentHeight / rowH) * priceStep);
  const viewportTopPrice = dataMaxPrice + Math.max(0, visibleRange - priceRange) / 2;
  const yForPrice = (price: number) =>
    contentTop + ((viewportTopPrice - price) / priceStep) * rowH;

  const barW = (panelW - 20) / Math.max(1, FOOTPRINT_DISPLAY_COUNT);
  const cellW = Math.max(24, barW - 20);
  const sideW = Math.max(5, (cellW - 4) / 2);
  const fontSize = Math.max(7, Math.min(10, rowH * 0.7));
  const textColor = viewport.textColor ?? MZ_THEME.text;

  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX, panelY, panelW, panelH);
  ctx.clip();
  ctx.textBaseline = "middle";

  panelBars.forEach(({ bar, profile, imbalances, rowsWithVolume }, col) => {
    const xCenter = panelX + 10 + barW * col + barW / 2;
    const bidRight = xCenter - 8;
    const bidLeft = bidRight - sideW;
    const askLeft = xCenter + 8;
    const askRight = askLeft + sideW;
    const fullW = askRight - bidLeft;
    drawPanelCandle(ctx, profile, xCenter, barW, yForPrice);

    if (showVA && isFiniteNumber(profile.vah) && isFiniteNumber(profile.val)) {
      const yVah = yForPrice(profile.vah);
      const yVal = yForPrice(profile.val);
      const top = Math.min(yVah, yVal);
      const height = Math.max(1, Math.abs(yVal - yVah));
      ctx.fillStyle = MZ_THEME.vaZone;
      ctx.fillRect(bidLeft, top, fullW, height);
      ctx.strokeStyle = MZ_THEME.vaBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(bidLeft, top, fullW, height);
    }

    for (const row of bar.rows) {
      const y = yForPrice(row.price);
      const isPoc = Math.abs(row.price - profile.poc) < priceStep / 2;
      const imbalance = imbalances.get(row.price) ?? null;
      const rowTop = y - rowH / 2;
      const rowBottom = y + rowH / 2;
      if (rowBottom < panelY || rowTop > panelBottom) continue;

      if (row.bid > 0) {
        const textX = bidLeft + sideW / 2;
        if (showImbalance && imbalance === "bid") {
          drawImbalanceCircle(ctx, textX, y, fontSize, MZ_THEME.bidCellStrong);
        }
        ctx.fillStyle = textColor;
        ctx.font = imbalance === "bid" ? "bold 10px Arial" : "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(formatCellVolume(row.bid), textX, y);
      }

      if (row.ask > 0) {
        const textX = askLeft + sideW / 2;
        if (showImbalance && imbalance === "ask") {
          drawImbalanceCircle(ctx, textX, y, fontSize, MZ_THEME.askCellStrong);
        }
        ctx.fillStyle = textColor;
        ctx.font = imbalance === "ask" ? "bold 10px Arial" : "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(formatCellVolume(row.ask), textX, y);
      }

      if (isPoc) {
        ctx.strokeStyle = MZ_THEME.poc;
        ctx.lineWidth = 2;
        ctx.strokeRect(bidLeft, rowTop, fullW, rowH);
      }
    }

    if (showUnfinishedAuction && (bar.unfinishedAuction.high || bar.unfinishedAuction.low)) {
      ctx.strokeStyle = MZ_THEME.unfinishedAuction;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      if (bar.unfinishedAuction.high && rowsWithVolume[0]) {
        const y = yForPrice(rowsWithVolume[0].price);
        ctx.beginPath();
        ctx.moveTo(bidLeft, y);
        ctx.lineTo(askRight, y);
        ctx.stroke();
      }
      if (bar.unfinishedAuction.low && rowsWithVolume[rowsWithVolume.length - 1]) {
        const y = yForPrice(rowsWithVolume[rowsWithVolume.length - 1].price);
        ctx.beginPath();
        ctx.moveTo(bidLeft, y);
        ctx.lineTo(askRight, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  });
  ctx.restore();
}

function inferPriceStep(bars: readonly FootprintBar[]): number {
  const prices = Array.from(
    new Set(bars.flatMap((bar) => bar.rows.map((row) => row.price))),
  ).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) diffs.push(diff);
  }
  return diffs.length > 0 ? Math.max(0.000001, Math.min(...diffs)) : 0.1;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 70;
  return Math.min(95, Math.max(10, value));
}

function roundPrice(price: number): number {
  return Math.round(price * 1e10) / 1e10;
}

function computeImbalances(
  bar: FootprintBar,
  priceStep: number,
  minVolume: number,
): Map<number, "bid" | "ask"> {
  const result = new Map<number, "bid" | "ask">();
  const byPrice = new Map(bar.rows.map((row) => [row.price, row]));
  const pricesAsc = [...byPrice.keys()].sort((a, b) => a - b);
  const factor = 2; // NT default ImbalancePercent=100.
  const isImbalanced = (dominant: number, opposingDiagonal: number) => {
    if (dominant < minVolume) return false;
    if (opposingDiagonal === 0) return true;
    return dominant / opposingDiagonal >= factor;
  };

  for (const price of pricesAsc) {
    const row = byPrice.get(price);
    if (!row) continue;
    const priceAbove = roundPrice(price + priceStep);
    const askAbove = byPrice.get(priceAbove)?.ask ?? 0;
    if (isImbalanced(row.bid, askAbove)) {
      result.set(price, "bid");
    }
    if (isImbalanced(askAbove, row.bid)) {
      result.set(priceAbove, "ask");
    }
  }
  return result;
}

function formatCellVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${formatScaledVolume(volume / 1_000_000)}M`;
  }
  if (volume >= 1_000) {
    return `${formatScaledVolume(volume / 1_000)}K`;
  }
  return String(volume);
}

function formatScaledVolume(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

interface BarProfile {
  open: number;
  high: number;
  low: number;
  close: number;
  poc: number;
  vah: number;
  val: number;
}

function profileForBar(
  bar: FootprintBar,
  vaPercent: number,
  priceStep: number,
): BarProfile {
  const rowPrices = bar.rows
    .filter((row) => row.bid > 0 || row.ask > 0)
    .map((row) => row.price)
    .filter(isFiniteNumber);
  const fallback = isFiniteNumber(bar.poc)
    ? bar.poc
    : rowPrices.length > 0
      ? rowPrices[rowPrices.length - 1]
      : 0;
  const open = isFiniteNumber(bar.open) ? bar.open : fallback;
  const close = isFiniteNumber(bar.close) ? bar.close : fallback;
  const priceSet = [...rowPrices, open, close, fallback];
  const high = isFiniteNumber(bar.high) ? bar.high : Math.max(...priceSet);
  const low = isFiniteNumber(bar.low) ? bar.low : Math.min(...priceSet);
  const profileLevels = computeProfileLevels(bar, vaPercent, priceStep);
  return {
    open,
    high,
    low,
    close,
    poc: profileLevels?.poc ?? fallback,
    vah: profileLevels?.vah ?? (isFiniteNumber(bar.vah) ? bar.vah : fallback),
    val: profileLevels?.val ?? (isFiniteNumber(bar.val) ? bar.val : fallback),
  };
}

function computeProfileLevels(
  bar: FootprintBar,
  vaPercent: number,
  priceStep: number,
): Pick<BarProfile, "poc" | "vah" | "val"> | null {
  if (bar.rows.length === 0) return null;
  const byPrice = new Map(bar.rows.map((row) => [row.price, row]));
  const pricesAsc = [...byPrice.keys()].sort((a, b) => a - b);
  let poc = pricesAsc[0];
  let pocVolume = -1;
  let totalVolume = 0;

  for (const price of pricesAsc) {
    const row = byPrice.get(price);
    if (!row) continue;
    const volume = row.bid + row.ask;
    totalVolume += volume;
    if (volume > pocVolume || (volume === pocVolume && price > poc)) {
      poc = price;
      pocVolume = volume;
    }
  }

  let vah = poc;
  let val = poc;
  const targetVolume = totalVolume * vaPercent / 100;
  let accumulatedVolume = Math.max(0, pocVolume);
  let lowerPrice = roundPrice(poc - priceStep);
  let upperPrice = roundPrice(poc + priceStep);

  while (accumulatedVolume < targetVolume) {
    const lower = byPrice.get(lowerPrice);
    const upper = byPrice.get(upperPrice);
    const lowerVolume = lower ? lower.bid + lower.ask : 0;
    const upperVolume = upper ? upper.bid + upper.ask : 0;

    if (lowerVolume <= 0 && upperVolume <= 0) break;
    if (lowerVolume > 0 && lowerVolume > upperVolume) {
      accumulatedVolume += lowerVolume;
      val = lowerPrice;
      lowerPrice = roundPrice(lowerPrice - priceStep);
    } else if (upperVolume > 0 && upperVolume > lowerVolume) {
      accumulatedVolume += upperVolume;
      vah = upperPrice;
      upperPrice = roundPrice(upperPrice + priceStep);
    } else {
      if (lowerVolume > 0) {
        accumulatedVolume += lowerVolume;
        val = lowerPrice;
        lowerPrice = roundPrice(lowerPrice - priceStep);
      }
      if (upperVolume > 0) {
        accumulatedVolume += upperVolume;
        vah = upperPrice;
        upperPrice = roundPrice(upperPrice + priceStep);
      }
    }
  }

  return { poc, vah, val };
}

function drawImbalanceCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fontSize: number,
  color: string,
): void {
  const r = fontSize * 1.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPanelCandle(
  ctx: CanvasRenderingContext2D,
  profile: BarProfile,
  xCenter: number,
  barW: number,
  yForPrice: (price: number) => number,
): void {
  const openY = yForPrice(profile.open);
  const closeY = yForPrice(profile.close);
  const highY = yForPrice(profile.high);
  const lowY = yForPrice(profile.low);
  const isBullish = profile.close >= profile.open;
  const color = isBullish ? MZ_THEME.candleUp : MZ_THEME.candleDown;
  const candleWidth = Math.min(10, Math.max(4, barW - 18));

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xCenter, highY);
  ctx.lineTo(xCenter, lowY);
  ctx.stroke();

  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(1, Math.abs(closeY - openY));
  const bodyLeft = xCenter - candleWidth / 2;
  if (isBullish) {
    ctx.strokeRect(bodyLeft, bodyTop, candleWidth, bodyHeight);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(bodyLeft, bodyTop, candleWidth, bodyHeight);
  }
}

export function FootprintCanvas({
  bars,
  viewport,
  throttleMs = MIN_THROTTLE_MS,
  now = () => Date.now(),
  settings,
}: FootprintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevInputsRef = useRef<FootprintRenderInputs | null>(null);
  const lastDrawAtRef = useRef<number>(-Infinity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const interval = clampThrottle(throttleMs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const next: FootprintRenderInputs = {
      bars: selectDisplayBars(bars),
      viewport,
    };

    if (!shouldRedraw(prevInputsRef.current, next)) {
      return; // retain current rendering (Req 14.6, 14.7)
    }

    const render = () => {
      drawFootprint(ctx, next, settings);
      prevInputsRef.current = next;
      lastDrawAtRef.current = now();
      timerRef.current = null;
    };

    const elapsed = now() - lastDrawAtRef.current;
    if (elapsed >= interval) {
      render();
    } else if (timerRef.current === null) {
      // Trailing-edge: collapse a burst to one draw per interval (Req 14.8).
      timerRef.current = setTimeout(render, interval - elapsed);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [bars, viewport, interval, now, settings]);

  return (
    <canvas
      ref={canvasRef}
      className="footprint-canvas"
      width={viewport.width}
      height={viewport.height}
      style={{ width: viewport.width, height: viewport.height }}
      aria-label="Footprint"
    />
  );
}
