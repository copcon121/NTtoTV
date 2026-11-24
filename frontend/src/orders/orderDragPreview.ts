import type { ExnessExecutionState, Mt5OpenTrades } from "../api/client";
import type { OrderLineField } from "../chart/lightweightChartsAdapter";
import type { TradingOrder } from "../socket/messages";

export type OrderDragPrices = Partial<Record<OrderLineField, number>>;

export interface OrderDragPreview {
  key: string;
  prices: OrderDragPrices;
  checkFrom?: number;
}

export function reconcileOrderDragPreviews(
  previews: ReadonlyMap<string, OrderDragPreview>,
  sequence: number,
  snapshot: ExnessExecutionState,
): ReadonlyMap<string, OrderDragPreview> {
  if (previews.size === 0) return previews;
  const pendingTargets = new Set<string>();
  for (const order of snapshot.orders) {
    if (order.actionPending) pendingTargets.add(order.id);
  }
  for (const position of snapshot.trades.positions) {
    if (position.actionPending) pendingTargets.add(`mt5pos:${position.brokerPositionTicket}`);
  }
  for (const order of snapshot.trades.orders) {
    if (order.actionPending) pendingTargets.add(`mt5order:${order.brokerOrderTicket}`);
  }
  const uncertainKeys = new Set(snapshot.account?.uncertainActions?.map((action) => action.key));
  const next = new Map(previews);
  for (const [id, preview] of previews) {
    if (preview.checkFrom !== undefined && sequence >= preview.checkFrom &&
        (!pendingTargets.has(id) || uncertainKeys.has(preview.key))) {
      next.delete(id);
    }
  }
  return next.size === previews.size ? previews : next;
}

export function applyOrderDragPreviews(
  orders: readonly TradingOrder[],
  trades: Mt5OpenTrades,
  previews: ReadonlyMap<string, OrderDragPreview>,
): { orders: readonly TradingOrder[]; trades: Mt5OpenTrades } {
  if (previews.size === 0) return { orders, trades };
  function apply<T extends { actionPending?: boolean }>(item: T, id: string): T {
    const preview = previews.get(id);
    return preview ? { ...item, ...preview.prices, actionPending: true } : item;
  }
  return {
    orders: orders.map((order) => apply(order, order.id)),
    trades: {
      positions: trades.positions.map((position) => apply(position, `mt5pos:${position.brokerPositionTicket}`)),
      orders: trades.orders.map((order) => apply(order, `mt5order:${order.brokerOrderTicket}`)),
    },
  };
}
