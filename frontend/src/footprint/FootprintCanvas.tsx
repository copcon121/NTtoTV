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
import {
  calculateXKontrol,
  DEFAULT_XKONTROL_DISPLAY_SETTINGS,
  normalizeXKontrolDisplaySettings,
  xKontrolLevelVisible,
  type XKontrolDisplaySettings,
  type XKontrolSignal,
} from "../chart/xKontrol";

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
  /** Number of most-recent bars selected and used for stable columns. */
  displayCount?: number;
  /** Standalone page price-row height in CSS pixels. */
  rowHeightPx?: number;
  /** Visible bitmap height inside a taller standalone virtual scroller. */
  renderHeightPx?: number;
  /** Current vertical offset inside the standalone virtual scroller. */
  scrollTopPx?: number;
  /** Compact chart overlay or full standalone page canvas. */
  layout?: "overlay" | "standalone";
  /** Show MBoxWave XKontrol signal dots on the footprint columns. */
  showXKontrol?: boolean;
  /** Select which XKontrol signal strengths are drawn. */
  xKontrolSettings?: Partial<XKontrolDisplaySettings>;
  /** Optional longer M1 history used only to warm up XKontrol. */
  xKontrolBars?: ReadonlyMap<number, FootprintBar>;
}

export interface FootprintXKontrolOverlay {
  signals: readonly XKontrolSignal[];
}

export type OrderflowGapSide = "buy" | "sell";

export interface OrderflowGapSignal {
  time: number;
  side: OrderflowGapSide;
  zoneLow: number;
  zoneHigh: number;
  markerPrice: number;
}

export interface FootprintOrderflowGapsOverlay {
  signals: readonly OrderflowGapSignal[];
}

export interface OrderflowGapOptions {
  vaPercent?: number;
  useSwingFilter?: boolean;
  lookbackPeriod?: number;
}

const MIN_THROTTLE_MS = 100;
const MAX_THROTTLE_MS = 125;
const systemNow = () => Date.now();
const MZ_THEME = {
  bidCellStrong: "rgba(250, 128, 114, 1)",
  askCellStrong: "rgba(0, 139, 139, 1)",
  vaZone: "rgba(144, 238, 144, 0.32)",
  vaBorder: "rgba(144, 238, 144, 0.68)",
  text: "#000000",
  poc: "#ff00ff",
  bidAbsorption: "#0000ff",
  askAbsorption: "#ff1493",
  deltaPos: "#008000",
  deltaNeg: "#ff0000",
  unfinishedAuction: "#ffd700",
  orderflowGapBuyZone: "rgba(0, 0, 255, 0.20)",
  orderflowGapBuyBorder: "rgba(0, 0, 255, 0.85)",
  orderflowGapSellZone: "rgba(255, 20, 147, 0.20)",
  orderflowGapSellBorder: "rgba(255, 20, 147, 0.85)",
  xKontrolOffers: "#008080",
  xKontrolBids: "#ff1493",
  candleUp: "#00aa20",
  candleDown: "#8b0000",
  axis: "#737373",
  grid: "rgba(0, 0, 0, 0.08)",
};
const XKONTROL_RADIUS_BY_LEVEL: Readonly<Record<1 | 2 | 3, number>> = {
  1: 3,
  2: 5,
  3: 7,
};

function clampThrottle(ms: number): number {
  return Math.min(Math.max(ms, MIN_THROTTLE_MS), MAX_THROTTLE_MS);
}

/** Draw the selected footprint bars onto the 2D context. Exported for tests. */
export function drawFootprint(
  ctx: CanvasRenderingContext2D,
  inputs: FootprintRenderInputs,
  settings?: FootprintSettings,
  xKontrol?: FootprintXKontrolOverlay,
  orderflowGaps?: FootprintOrderflowGapsOverlay,
): void {
  const showVA = settings?.showVA ?? false;
  const showImbalance = settings?.showImbalance ?? true;
  const showAbsorption = settings?.showAbsorption ?? true;
  const showUnfinishedAuction = settings?.showUnfinishedAuction ?? true;
  const vaPercent = clampPercent(settings?.vaPercent ?? 70);
  const imbalanceMinVolume = Math.max(
    0,
    Math.round(settings?.imbalanceMinVolume ?? 10),
  );
  const absorptionPercent = clampRange(settings?.absorptionPercent ?? 100, 0, 500);
  const absorptionDepth = Math.max(
    0,
    Math.round(settings?.absorptionDepth ?? 5),
  );
  const absorptionFilter = Math.max(
    0,
    Math.round(settings?.absorptionFilter ?? 3),
  );
  const { bars, viewport } = inputs;
  const displayCount = Math.max(
    1,
    Math.round(inputs.displayCount ?? FOOTPRINT_DISPLAY_COUNT),
  );
  const standalone = inputs.layout === "standalone";
  const renderHeight = Math.max(1, inputs.renderHeightPx ?? viewport.height);
  const scrollTop = standalone ? Math.max(0, inputs.scrollTopPx ?? 0) : 0;
  ctx.clearRect(0, 0, viewport.width, renderHeight);
  if (standalone) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewport.width, renderHeight);
  }
  if (bars.length === 0) return;

  const priceStep = inferPriceStep(bars);
  const panelBars = bars.map((bar) => {
    const profile = profileForBar(bar, vaPercent, priceStep);
    return {
      bar,
      profile,
      imbalances: computeImbalances(bar, priceStep, imbalanceMinVolume),
      absorptions: computeAbsorptions(bar, priceStep, {
        percent: absorptionPercent,
        depth: absorptionDepth,
        filter: absorptionFilter,
        referenceClose: profile.close,
      }),
      rowsWithVolume: bar.rows.filter((row) => row.bid > 0 || row.ask > 0),
    };
  });
  if (panelBars.every(({ rowsWithVolume }) => rowsWithVolume.length === 0)) {
    return;
  }

  const rightAxisW = standalone ? 58 : 0;
  const bottomAxisH = standalone ? 34 : 15;
  const panelW = standalone
    ? Math.max(40, viewport.width - 20)
    : Math.min(400, Math.max(40, viewport.width - 20));
  const panelH = Math.max(40, viewport.height - 40);
  const panelX = standalone ? 10 : Math.max(10, viewport.width - panelW - 10);
  const panelY = 20 - scrollTop;
  const panelBottom = panelY + panelH;
  const contentTop = panelY + 25;
  const contentBottom = panelBottom - bottomAxisH;
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
  const defaultRowH = contentHeight / numPriceLevels;
  const rowH = standalone
    ? Math.max(1, Math.min(32, inputs.rowHeightPx ?? defaultRowH))
    : Math.max(1, Math.min(20, defaultRowH));
  const visibleRange = Math.max(priceRange, (contentHeight / rowH) * priceStep);
  const viewportTopPrice = dataMaxPrice + Math.max(0, visibleRange - priceRange) / 2;
  const yForPrice = (price: number) =>
    contentTop + ((viewportTopPrice - price) / priceStep) * rowH;

  const plotLeft = panelX + 10;
  const plotRight = panelX + panelW - rightAxisW - 10;
  const plotW = Math.max(20, plotRight - plotLeft);
  const barW = plotW / displayCount;
  // Keep standalone columns visually distinct when absorption zones and
  // XKontrol markers extend toward neighboring bars.
  const cellW = Math.max(24, barW - (standalone ? 24 : 20));
  const sideW = Math.max(5, (cellW - 4) / 2);
  const fontSize = Math.max(7, Math.min(10, rowH * 0.7));
  const cellFontSize = standalone
    ? Math.max(6, Math.min(13, rowH * 0.72))
    : 10;
  const textColor = viewport.textColor ?? MZ_THEME.text;
  const xKontrolByTime = new Map(
    (xKontrol?.signals ?? []).map((signal) => [signal.time, signal]),
  );
  const orderflowGapByTime = new Map(
    (orderflowGaps?.signals ?? []).map((signal) => [signal.time, signal]),
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX, panelY, panelW, panelH);
  ctx.clip();
  ctx.textBaseline = "middle";

  if (standalone) {
    drawStandaloneFrame(ctx, {
      panelX,
      panelY,
      panelW,
      panelH,
      contentTop,
      contentBottom,
      plotRight,
    });
  }

  panelBars.forEach(({ bar, profile, imbalances, absorptions, rowsWithVolume }, col) => {
    const xCenter = plotLeft + barW * col + barW / 2;
    const bidRight = xCenter - 8;
    const bidLeft = bidRight - sideW;
    const askLeft = xCenter + 8;
    const askRight = askLeft + sideW;
    const fullW = askRight - bidLeft;
    drawPanelCandle(ctx, profile, xCenter, barW, yForPrice);

    const orderflowGap = orderflowGapByTime.get(bar.time);
    if (orderflowGap) {
      drawOrderflowGapZone(
        ctx,
        orderflowGap,
        bidLeft,
        fullW,
        rowH,
        yForPrice,
      );
    }

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
      const isSellAbsorption = showAbsorption && absorptions.sell.has(row.price);
      const isBuyAbsorption = showAbsorption && absorptions.buy.has(row.price);
      const rowTop = y - rowH / 2;
      const rowBottom = y + rowH / 2;
      if (rowBottom < panelY || rowTop > panelBottom) continue;

      if (row.bid > 0) {
        const textX = bidLeft + sideW / 2;
        if (showImbalance && imbalance === "bid") {
          drawImbalanceCircle(ctx, textX, y, fontSize, MZ_THEME.bidCellStrong);
        }
        ctx.fillStyle = textColor;
        ctx.font =
          imbalance === "bid"
            ? `bold ${cellFontSize}px Arial`
            : `${cellFontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(formatCellVolume(row.bid), textX, y);
      }

      if (row.ask > 0) {
        const textX = askLeft + sideW / 2;
        if (showImbalance && imbalance === "ask") {
          drawImbalanceCircle(ctx, textX, y, fontSize, MZ_THEME.askCellStrong);
        }
        ctx.fillStyle = textColor;
        ctx.font =
          imbalance === "ask"
            ? `bold ${cellFontSize}px Arial`
            : `${cellFontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(formatCellVolume(row.ask), textX, y);
      }

      if (isSellAbsorption) {
        drawDashedRect(ctx, bidLeft, rowTop, fullW, rowH, MZ_THEME.bidAbsorption);
      }
      if (isBuyAbsorption) {
        const inset = isSellAbsorption ? 1 : 0;
        drawDashedRect(
          ctx,
          bidLeft + inset,
          rowTop + inset,
          Math.max(1, fullW - inset * 2),
          Math.max(1, rowH - inset * 2),
          MZ_THEME.askAbsorption,
        );
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

    const xKontrolSignal = xKontrolByTime.get(bar.time);
    if (xKontrolSignal) {
      drawXKontrolDot(
        ctx,
        xCenter,
        yForPrice(xKontrolSignal.price),
        xKontrolSignal.code,
      );
    }
  });

  ctx.restore();
}

/** Calculate XKontrol from M1 footprint OHLC plus ladder-derived volume. */
export function calculateFootprintXKontrolSignals(
  bars: ReadonlyMap<number, FootprintBar>,
  settings: Partial<XKontrolDisplaySettings> = DEFAULT_XKONTROL_DISPLAY_SETTINGS,
): XKontrolSignal[] {
  const normalized = normalizeXKontrolDisplaySettings(settings);
  const calculationBars = [...bars.values()]
    .sort((left, right) => left.time - right.time)
    .map((bar) => ({
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.rows.reduce(
        (total, row) => total + Math.max(0, row.bid) + Math.max(0, row.ask),
        0,
      ),
    }));
  return calculateXKontrol(calculationBars).filter((signal) =>
    xKontrolLevelVisible(signal.level, normalized),
  );
}

/**
 * Detect Orderflows Trader-style Value Area gaps between adjacent M1 bars.
 * The optional swing filter mirrors the original offset=1 filter: the prior
 * bar must make a fresh swing high before a sell gap, or a fresh swing low
 * before a buy gap, against up to lookback+1 older bars.
 */
export function calculateOrderflowGapSignals(
  bars: ReadonlyMap<number, FootprintBar>,
  options: OrderflowGapOptions = {},
): OrderflowGapSignal[] {
  const sortedBars = [...bars.values()].sort((left, right) => left.time - right.time);
  if (sortedBars.length < 2) return [];

  const vaPercent = clampPercent(options.vaPercent ?? 70);
  const useSwingFilter = options.useSwingFilter ?? false;
  const lookbackPeriod = Math.max(1, Math.round(options.lookbackPeriod ?? 5));
  const priceStep = inferPriceStep(sortedBars);
  const profiles = sortedBars.map((bar) => profileForBar(bar, vaPercent, priceStep));
  const signals: OrderflowGapSignal[] = [];

  for (let index = 1; index < sortedBars.length; index += 1) {
    const bar = sortedBars[index];
    const current = profiles[index];
    const previous = profiles[index - 1];
    const isDownBar = current.close < current.open;
    const isUpBar = current.close > current.open;

    if (
      isDownBar &&
      current.vah < previous.val &&
      ticksBetween(current.vah, previous.val, priceStep) > 1 &&
      passesOrderflowGapSwingFilter(
        sortedBars,
        index,
        "sell",
        useSwingFilter,
        lookbackPeriod,
      )
    ) {
      signals.push({
        time: bar.time,
        side: "sell",
        zoneLow: roundPrice(current.vah + priceStep),
        zoneHigh: roundPrice(previous.val - priceStep),
        markerPrice: current.high,
      });
    }

    if (
      isUpBar &&
      current.val > previous.vah &&
      ticksBetween(previous.vah, current.val, priceStep) > 1 &&
      passesOrderflowGapSwingFilter(
        sortedBars,
        index,
        "buy",
        useSwingFilter,
        lookbackPeriod,
      )
    ) {
      signals.push({
        time: bar.time,
        side: "buy",
        zoneLow: roundPrice(previous.vah + priceStep),
        zoneHigh: roundPrice(current.val - priceStep),
        markerPrice: current.low,
      });
    }
  }

  return signals;
}

function ticksBetween(lower: number, upper: number, priceStep: number): number {
  if (!Number.isFinite(priceStep) || priceStep <= 0) return 0;
  return (upper - lower) / priceStep;
}

function passesOrderflowGapSwingFilter(
  bars: readonly FootprintBar[],
  currentIndex: number,
  side: OrderflowGapSide,
  enabled: boolean,
  lookbackPeriod: number,
): boolean {
  if (!enabled) return true;
  const previous = bars[currentIndex - 1];
  const olderBars = bars.slice(
    Math.max(0, currentIndex - lookbackPeriod - 2),
    currentIndex - 1,
  );
  if (!previous || olderBars.length === 0) return false;

  if (side === "sell") {
    return previous.high > Math.max(...olderBars.map((bar) => bar.high));
  }
  return previous.low < Math.min(...olderBars.map((bar) => bar.low));
}

function drawXKontrolDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  code: XKontrolSignal["code"],
): void {
  const level = Math.abs(code) as 1 | 2 | 3;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, XKONTROL_RADIUS_BY_LEVEL[level], 0, Math.PI * 2);
  ctx.fillStyle = code > 0 ? MZ_THEME.xKontrolOffers : MZ_THEME.xKontrolBids;
  ctx.fill();
  ctx.restore();
}

function drawOrderflowGapZone(
  ctx: CanvasRenderingContext2D,
  signal: OrderflowGapSignal,
  x: number,
  width: number,
  rowHeight: number,
  yForPrice: (price: number) => number,
): void {
  const zoneTop = yForPrice(signal.zoneHigh) - rowHeight / 2;
  const zoneBottom = yForPrice(signal.zoneLow) + rowHeight / 2;
  const color =
    signal.side === "buy"
      ? MZ_THEME.orderflowGapBuyZone
      : MZ_THEME.orderflowGapSellZone;
  const border =
    signal.side === "buy"
      ? MZ_THEME.orderflowGapBuyBorder
      : MZ_THEME.orderflowGapSellBorder;
  ctx.fillStyle = color;
  ctx.fillRect(x, zoneTop, width, Math.max(1, zoneBottom - zoneTop));
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, zoneTop, width, Math.max(1, zoneBottom - zoneTop));
}

function drawStandaloneFrame(
  ctx: CanvasRenderingContext2D,
  input: {
    panelX: number;
    panelY: number;
    panelW: number;
    panelH: number;
    contentTop: number;
    contentBottom: number;
    plotRight: number;
  },
): void {
  ctx.strokeStyle = "#d4d4d4";
  ctx.lineWidth = 1;
  ctx.strokeRect(input.panelX, input.panelY, input.panelW, input.panelH);
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

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundPrice(price: number): number {
  return Math.round(price * 1e10) / 1e10;
}

function roundToPriceStep(price: number, priceStep: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(priceStep) || priceStep <= 0) {
    return roundPrice(price);
  }
  return roundPrice(Math.round(price / priceStep) * priceStep);
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

function computeAbsorptions(
  bar: FootprintBar,
  priceStep: number,
  settings: {
    percent: number;
    depth: number;
    filter: number;
    referenceClose: number;
  },
): { buy: Set<number>; sell: Set<number> } {
  const buy = new Set<number>();
  const sell = new Set<number>();
  if (!Number.isFinite(priceStep) || priceStep <= 0) return { buy, sell };

  const byPrice = new Map(bar.rows.map((row) => [row.price, row]));
  const pricesAsc = [...byPrice.keys()].sort((a, b) => a - b);
  const thresholdRatio = 1 + clampRange(settings.percent, 0, 500) / 100;
  const minDepth = Math.max(0, Math.round(settings.depth));
  const minVolume = Math.max(0, Math.round(settings.filter));
  const referenceClose = roundToPriceStep(settings.referenceClose, priceStep);

  for (const price of pricesAsc) {
    const row = byPrice.get(price);
    if (!row) continue;
    const priceAbove = roundPrice(price + priceStep);
    const askVolAbove = byPrice.get(priceAbove)?.ask ?? 0;
    const bidVol = row.bid;

    const depthFromCloseDown = Math.floor((referenceClose - price) / priceStep + 1e-9);
    if (depthFromCloseDown >= minDepth && askVolAbove > 0) {
      if (bidVol >= minVolume && bidVol / askVolAbove >= thresholdRatio) {
        sell.add(price);
      }
    }

    const depthFromCloseUp = Math.floor((priceAbove - referenceClose) / priceStep + 1e-9);
    if (depthFromCloseUp >= minDepth && bidVol > 0) {
      if (askVolAbove >= minVolume && askVolAbove / bidVol >= thresholdRatio) {
        buy.add(priceAbove);
      }
    }
  }

  return { buy, sell };
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

function drawDashedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  ctx.restore();
}

function footprintSettingsKey(
  settings?: FootprintSettings,
  xKontrol?: FootprintXKontrolOverlay,
  orderflowGaps?: FootprintOrderflowGapsOverlay,
): string {
  return [
    settings?.showVA ?? false,
    settings?.vaPercent ?? 70,
    settings?.showOrderflowsGaps ?? false,
    settings?.orderflowsGapsUseSwingFilter ?? false,
    settings?.imbalanceMinVolume ?? 10,
    settings?.showImbalance ?? true,
    settings?.showAbsorption ?? true,
    settings?.absorptionPercent ?? 100,
    settings?.absorptionDepth ?? 5,
    settings?.absorptionFilter ?? 3,
    settings?.showUnfinishedAuction ?? true,
    ...(xKontrol?.signals.map((signal) => `${signal.time}:${signal.code}`) ?? []),
    ...(orderflowGaps?.signals.map(
      (signal) =>
        `${signal.time}:${signal.side}:${signal.zoneLow}:${signal.zoneHigh}`,
    ) ?? []),
  ].join("|");
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
  now = systemNow,
  settings,
  displayCount = FOOTPRINT_DISPLAY_COUNT,
  rowHeightPx,
  renderHeightPx,
  scrollTopPx,
  layout = "overlay",
  showXKontrol = false,
  xKontrolSettings = DEFAULT_XKONTROL_DISPLAY_SETTINGS,
  xKontrolBars,
}: FootprintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevInputsRef = useRef<FootprintRenderInputs | null>(null);
  const lastDrawAtRef = useRef<number>(-Infinity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRenderRef = useRef<{
    ctx: CanvasRenderingContext2D;
    inputs: FootprintRenderInputs;
    settings?: FootprintSettings;
    xKontrol?: FootprintXKontrolOverlay;
    orderflowGaps?: FootprintOrderflowGapsOverlay;
  } | null>(null);

  const interval = clampThrottle(throttleMs);
  const effectiveDisplayCount = Math.max(1, Math.round(displayCount));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const xKontrol = showXKontrol
      ? {
          signals: calculateFootprintXKontrolSignals(
            xKontrolBars ?? bars,
            xKontrolSettings,
          ),
        }
      : undefined;
    // The compact five-bar preview always shows OF gaps. The standalone page
    // retains its explicit toolbar toggle.
const orderflowGaps = (layout === "overlay" || settings?.showOrderflowsGaps)
  ? {
      signals: calculateOrderflowGapSignals(bars, {
        vaPercent: settings?.vaPercent ?? 70,
        useSwingFilter: settings?.orderflowsGapsUseSwingFilter ?? false,
        lookbackPeriod: 5,
      }),
    }
      : undefined;

    const next: FootprintRenderInputs = {
      bars: selectDisplayBars(bars, effectiveDisplayCount),
      viewport,
      displayCount: effectiveDisplayCount,
      rowHeightPx,
      renderHeightPx,
      scrollTopPx,
      layout,
      settingsKey: footprintSettingsKey(settings, xKontrol, orderflowGaps),
    };

    if (!shouldRedraw(prevInputsRef.current, next)) {
      // If a burst changed and then restored the last-painted state before the
      // trailing edge, discard the obsolete pending frame.
      pendingRenderRef.current = null;
      return; // retain current rendering (Req 14.6, 14.7)
    }

    pendingRenderRef.current = {
      ctx,
      inputs: next,
      settings,
      xKontrol,
      orderflowGaps,
    };
    const renderLatest = () => {
      const pending = pendingRenderRef.current;
      pendingRenderRef.current = null;
      timerRef.current = null;
      if (pending === null) return;
      drawFootprint(
        pending.ctx,
        pending.inputs,
        pending.settings,
        pending.xKontrol,
        pending.orderflowGaps,
      );
      prevInputsRef.current = pending.inputs;
      lastDrawAtRef.current = now();
    };

    const elapsed = now() - lastDrawAtRef.current;
    if (elapsed >= interval && timerRef.current === null) {
      renderLatest();
    } else if (timerRef.current === null) {
      // Trailing-edge: collapse a burst to one draw per interval (Req 14.8).
      timerRef.current = setTimeout(renderLatest, Math.max(0, interval - elapsed));
    }
  }, [
    bars,
    viewport,
    interval,
    now,
    settings,
    effectiveDisplayCount,
    rowHeightPx,
    renderHeightPx,
    scrollTopPx,
    layout,
    showXKontrol,
    xKontrolSettings,
    xKontrolBars,
  ]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRenderRef.current = null;
    },
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      className={`footprint-canvas${
        layout === "standalone" ? " footprint-canvas-standalone" : ""
      }`}
      width={viewport.width}
      height={renderHeightPx ?? viewport.height}
      style={{ width: viewport.width, height: renderHeightPx ?? viewport.height }}
      aria-label="Footprint"
    />
  );
}
