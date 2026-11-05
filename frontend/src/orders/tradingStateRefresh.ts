import type {
  ApiClient,
  Mt5OpenTrades,
  Mt5Status,
  SupertrendTrailing,
} from "../api/client";
import type { TradingOrder } from "../socket/messages";

type TradingApi = Pick<
  ApiClient,
  "orders" | "mt5OpenTrades" | "mt5Status" | "supertrendTrailings"
>;

interface TradingStateUpdates {
  guard?: () => () => boolean;
  orders: (orders: TradingOrder[]) => void;
  openTrades: (trades: Mt5OpenTrades) => void;
  status: (status: Mt5Status) => void;
  trailings: (trailings: SupertrendTrailing[]) => void;
}

export function createTradingStateRefresh(
  api: TradingApi,
  updates: TradingStateUpdates,
) {
  let revision = 0;
  return {
    guard() {
      const currentRevision = revision;
      return () => currentRevision === revision;
    },
    invalidate() {
      revision += 1;
    },
    async refresh() {
      const currentRevision = ++revision;
      const canApply = updates.guard?.() ?? (() => true);
      const apply = <T,>(update: (value: T) => void) => (value: T) => {
        if (currentRevision === revision && canApply()) update(value);
      };
      const orderRequests = [
        api.orders(true).then(apply(updates.orders)),
        api.mt5OpenTrades().then(apply(updates.openTrades)),
      ];
      // Account balances and trailing settings must not hold order controls
      // busy once the open orders and positions have been refreshed.
      void Promise.allSettled([
        api.mt5Status().then(apply(updates.status)),
        api.supertrendTrailings().then(apply(updates.trailings)),
      ]);
      await Promise.allSettled(orderRequests);
    },
  };
}
