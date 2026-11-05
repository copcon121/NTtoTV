import { useMemo, useRef } from "react";
import type { TradingOrder, TradingPosition } from "../socket/messages";

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function samePrice(left: number | null | undefined, right: number | null | undefined): boolean {
  return finite(left) && finite(right) && Math.abs(left - right) < 1e-8;
}

function chartLevel(
  broker: number | null | undefined,
  incoming: number | null | undefined,
  previousBroker: number | null | undefined,
  previous: number | null | undefined,
  savedBroker: number | null | undefined,
  saved: number | null | undefined,
): number | undefined {
  if (samePrice(broker, previousBroker) && finite(previous)) return previous;
  if (samePrice(broker, savedBroker) && finite(saved)) return saved;
  return finite(incoming) ? incoming : undefined;
}

export function stabilizeBrokerChartLevels(
  previous: readonly TradingPosition[],
  incoming: readonly TradingPosition[],
  orders: readonly TradingOrder[],
): TradingPosition[] {
  const byTicket = new Map(previous.map((position) => [position.brokerPositionTicket, position]));
  const savedByTicket = new Map(orders
    .filter((order) => order.brokerPositionTicket != null &&
      (!order.gcAnchored || (order.source === "market_bar" && order.kind === "market")))
    .map((order) => [order.brokerPositionTicket, order]));
  return incoming.map((position) => {
    const candidate = byTicket.get(position.brokerPositionTicket);
    const prior = candidate?.side === position.side &&
      candidate.symbolBroker === position.symbolBroker ? candidate : undefined;
    const hint = savedByTicket.get(position.brokerPositionTicket);
    const saved = hint?.side === position.side &&
      (!hint.symbolBroker || !position.symbolBroker || hint.symbolBroker === position.symbolBroker)
      ? hint : undefined;
    // A new basis must not move a filled entry or unchanged stop when a partial
    // close refreshes the account. A real broker edit adopts that level's new
    // GC coordinate independently, so MT5 edits remain visible.
    const entryGcEstimate = chartLevel(position.entryBroker, position.entryGcEstimate,
      prior?.entryBroker, prior?.entryGcEstimate,
      saved?.fillPriceBroker ?? saved?.entryBroker,
      saved?.fillPriceGcEstimate ?? saved?.entryGc);
    const slGc = samePrice(position.slBroker, position.entryBroker) && finite(entryGcEstimate)
      ? entryGcEstimate
      : chartLevel(position.slBroker, position.slGc,
        prior?.slBroker, prior?.slGc, saved?.slBroker, saved?.slGc);
    const tpGc = chartLevel(position.tpBroker, position.tpGc,
      prior?.tpBroker, prior?.tpGc, saved?.tpBroker, saved?.tpGc);
    if (entryGcEstimate === position.entryGcEstimate && slGc === position.slGc && tpGc === position.tpGc) {
      return position;
    }
    return { ...position, entryGcEstimate, slGc, tpGc };
  });
}

export function useBrokerChartPositions(
  positions: readonly TradingPosition[],
  orders: readonly TradingOrder[],
  ownerKey: string,
): TradingPosition[] {
  const last = useRef<{ ownerKey: string; positions: TradingPosition[] }>({
    ownerKey, positions: [],
  });
  return useMemo(() => {
    const previous = last.current.ownerKey === ownerKey ? last.current.positions : [];
    const projected = stabilizeBrokerChartLevels(previous, positions, orders);
    last.current = { ownerKey, positions: projected };
    return projected;
  }, [positions, orders, ownerKey]);
}

function brokerLevelChanged(actual: number | null | undefined, saved: number | null | undefined): boolean {
  if (actual === undefined) return false;
  if (actual === null) return finite(saved);
  return !samePrice(actual, saved);
}

/** Display observed broker edits even for a GC-anchored chart bracket. */
export function projectBrokerOrder(
  order: TradingOrder,
  position: TradingPosition | undefined,
): TradingOrder {
  if (position === undefined) return order;
  const brokerFixed = !order.gcAnchored ||
    (order.source === "market_bar" && order.kind === "market");
  const entry = brokerFixed && finite(position.entryGcEstimate);
  const sl = brokerFixed || brokerLevelChanged(position.slBroker, order.slBroker);
  const tp = brokerFixed || brokerLevelChanged(position.tpBroker, order.tpBroker);
  if (!entry && !sl && !tp) return order;
  return {
    ...order,
    ...(entry ? {
      entryGc: position.entryGcEstimate,
      fillPriceGcEstimate: position.entryGcEstimate,
    } : {}),
    ...(sl ? { slGc: position.slGc, slBroker: position.slBroker } : {}),
    ...(tp ? { tpGc: position.tpGc, tpBroker: position.tpBroker } : {}),
  };
}
