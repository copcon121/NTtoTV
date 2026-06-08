// socket module — typed `/ws/chart` WebSocket message schemas.
//
// These interfaces mirror the design's "WebSocket Message Schemas" section for
// the `/ws/chart` channel (design.md). All `time` fields are Canonical_Timestamp
// values: integer milliseconds since the Unix epoch (UTC). Prices are numbers in
// contract price units; volumes are integers.
//
// Requirements traceability: 5.2 (event types), 5.4/5.5 (subscribe/unsubscribe),
// 6.2 (pong response to ping), 11.2 (realtime subscribe after history).

/** Supported bar aggregation intervals (design Glossary: Timeframe). */
export type Timeframe = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D";

/**
 * Event types a Frontend client can subscribe to (Req 5.2, 5.4, 5.5).
 * `ping` is intentionally excluded: the server always sends it for heartbeat
 * and the client always answers with `pong`, independent of subscriptions.
 */
export type ChartEventType =
  | "bar_update"
  | "quote_update"
  | "volume_delta_update"
  | "footprint_update"
  | "big_trade"
  | "alert_event"
  | "order_update"
  | "position_update"
  | "account_update"
  | "basis_update"
  | "risk_update"
  | "status";

/** Order-flow / status side discriminator used across several messages. */
export type Side = "buy" | "sell";

/**
 * Footprint imbalance side: which side of the bid-by-ask ladder is imbalanced
 * (Req 14.4, 14.10). Distinct from {@link Side} — the backend's `ImbalanceSide`
 * serializes to `"bid"`/`"ask"`, not `"buy"`/`"sell"`.
 */
export type ImbalanceSide = "bid" | "ask";

// ---------------------------------------------------------------------------
// Client -> Backend (outbound) messages
// ---------------------------------------------------------------------------

/** Subscribe request (Req 5.4). `tf` selects the bar timeframe of interest. */
export interface SubscribeMessage {
  type: "subscribe";
  symbol: string;
  events: ChartEventType[];
  tf?: Timeframe;
}

/** Unsubscribe request (Req 5.5). */
export interface UnsubscribeMessage {
  type: "unsubscribe";
  symbol: string;
  events: ChartEventType[];
  tf?: Timeframe;
}

/** Pong response to a server ping (Req 6.2). */
export interface PongMessage {
  type: "pong";
  time: number;
}

/** Union of every message the client sends to the backend. */
export type OutboundMessage = SubscribeMessage | UnsubscribeMessage | PongMessage;

// ---------------------------------------------------------------------------
// Backend -> Client (inbound) messages
// ---------------------------------------------------------------------------

/** OHLCV bar payload carried by a `bar_update` (Req 9.3). */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Incremental bar update (Req 5.2, 9.3). */
export interface BarUpdateMessage {
  type: "bar_update";
  symbol: string;
  contract: string;
  tf: Timeframe;
  bar: Bar;
  closed: boolean;
}

/** Top-of-book quote update (Req 5.2). */
export interface QuoteUpdateMessage {
  type: "quote_update";
  symbol: string;
  contract: string;
  time: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

/** Per-bar volume delta update (Req 5.2, 13.1). */
export interface VolumeDeltaUpdateMessage {
  type: "volume_delta_update";
  symbol: string;
  contract: string;
  tf: Timeframe;
  time: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  deltaHigh: number;
  deltaLow: number;
  openDelta: number;
  closeDelta: number;
  /** Present only when CumulativeDelta mode is enabled (Req 13.7). */
  cumulativeDelta?: number;
}

/** A single price level in a footprint ladder. */
export interface FootprintRow {
  price: number;
  bid: number;
  ask: number;
  imbalance: ImbalanceSide | null;
}

/** A contiguous run of same-side imbalanced levels (Stacked_Imbalance). */
export interface StackedImbalance {
  side: ImbalanceSide;
  from: number;
  to: number;
}

/** Footprint bar update (Req 5.2, 14). */
export interface FootprintUpdateMessage {
  type: "footprint_update";
  symbol: string;
  contract: string;
  tf: Timeframe;
  time: number;
  rows: FootprintRow[];
  open: number;
  high: number;
  low: number;
  close: number;
  poc: number;
  pocVolume: number;
  vah: number;
  val: number;
  barDelta: number;
  buyPct: number;
  sellPct: number;
  stackedImbalance: StackedImbalance[];
  unfinishedAuction: { high: boolean; low: boolean };
}

/** Big trade marker (Req 5.2, 15.4, 15.5). */
export interface BigTradeMessage {
  type: "big_trade";
  symbol: string;
  contract: string;
  tradeId: number;
  time: number;
  price: number;
  volume: number;
  side: Side;
}

/** Alert firing event (Req 5.2, 17.2). */
export interface AlertEventMessage {
  type: "alert_event";
  alertId: string;
  alertType: string;
  profileId?: string;
  symbol: string;
  contract: string;
  time: number;
  price: number;
  message: string;
  level?: number;
}

/** Connection status event (Req 5.2, 20). */
export interface StatusMessage {
  type: "status";
  state: "connected" | "degraded" | "disconnected";
  time: number;
  reason?: string;
  contract?: string;
}

export interface OrderUpdateMessage {
  type: "order_update";
  symbol: string;
  order: TradingOrder;
}

export interface PositionUpdateMessage {
  type: "position_update";
  symbol: string;
  position: TradingPosition;
}

export interface AccountUpdateMessage {
  type: "account_update";
  symbol: string;
  account: TradingAccount;
}

export interface BasisUpdateMessage {
  type: "basis_update";
  symbol: string;
  symbolBroker: string;
  basis: number;
  stale: boolean;
  time: number;
  warning?: string;
}

export interface RiskUpdateMessage {
  type: "risk_update";
  symbol: string;
  accountId: string;
  killSwitch: boolean;
  tradingEnabled: boolean;
  reason?: string;
}

export interface TradingOrder {
  id: string;
  userId: string;
  accountId: string;
  source: "chart_bracket" | "market_bar" | "api";
  symbolInternal: string;
  contractInternal: string;
  sourceContract?: string | null;
  symbolBroker: string;
  side: Side;
  kind: "market" | "limit" | "stop";
  volumeLots: number;
  gcAnchored: boolean;
  status:
    | "pending_submit"
    | "submitted"
    | "working"
    | "filled"
    | "rejected"
    | "cancelled"
    | "closed"
    | "sync_paused"
    | "sync_error";
  idempotencyKey: string;
  version: number;
  entryGc?: number | null;
  slGc?: number | null;
  tpGc?: number | null;
  entryBroker?: number | null;
  slBroker?: number | null;
  tpBroker?: number | null;
  fillPriceBroker?: number | null;
  fillPriceGcEstimate?: number | null;
  basisAtSubmit?: number | null;
  basisAtLastSync?: number | null;
  brokerOrderTicket?: number | null;
  brokerPositionTicket?: number | null;
  brokerDealTicket?: number | null;
  rejectReason?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TradingPosition {
  brokerPositionTicket: number;
  orderId?: string | null;
  symbolBroker?: string;
  side: Side;
  volumeLots: number;
  entryBroker: number;
  entryGcEstimate?: number;
  slBroker?: number | null;
  tpBroker?: number | null;
  slGc?: number | null;
  tpGc?: number | null;
  profit?: number;
  basisStale?: boolean;
  updatedAt: number;
}

export interface TradingAccount {
  accountId: string;
  tradeMode: "demo" | "live" | string;
  balance: number;
  equity: number;
  freeMargin: number;
  updatedAt: number;
}

/** Heartbeat ping (Req 5.2, 6.1). The client answers with a `pong` (Req 6.2). */
export interface PingMessage {
  type: "ping";
  time: number;
}

/** Union of every message the backend sends to the client. */
export type InboundMessage =
  | BarUpdateMessage
  | QuoteUpdateMessage
  | VolumeDeltaUpdateMessage
  | FootprintUpdateMessage
  | BigTradeMessage
  | AlertEventMessage
  | OrderUpdateMessage
  | PositionUpdateMessage
  | AccountUpdateMessage
  | BasisUpdateMessage
  | RiskUpdateMessage
  | StatusMessage
  | PingMessage;

/** Discriminating `type` literal of every inbound message. */
export type InboundMessageType = InboundMessage["type"];

/** Helper: narrow the inbound union by its `type` discriminator. */
export type InboundMessageOf<T extends InboundMessageType> = Extract<
  InboundMessage,
  { type: T }
>;
