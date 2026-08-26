// alerts module — shared alert types mirroring the REST/`/ws/chart` shapes.
//
// Alert definitions and event-log entries used by the AlertPanel (Req 16.5,
// 17.4). Alert types match the backend Alert_Engine (Req 16.1).

/** Supported alert types (Req 16.1). */
export type AlertType =
  | "price_crosses_level"
  | "bar_closes_above"
  | "bar_closes_below"
  | "volume_delta_threshold"
  | "big_trade_threshold"
  | "stacked_imbalance"
  | "liquidity_pool_break"
  | "smc_external_break_big_trade"
  | "mgann_break_ls"
  | "mgann_sweep"
  | "mgann_big_trade_sweep";

/** An alert definition as returned by `GET /api/alerts`. */
export interface Alert {
  id: string;
  profileId?: string;
  symbol: string;
  type: AlertType;
  params: Record<string, number | string | boolean>;
  enabled: boolean;
}

export interface TelegramNotificationConfig {
  enabled: boolean;
  chatId: string;
  sendScreenshot: boolean;
  hasBotToken: boolean;
}

export interface TelegramNotificationInput {
  enabled: boolean;
  chatId: string;
  sendScreenshot: boolean;
  botToken?: string;
}

export interface WebPushNotificationConfig {
  enabled: boolean;
  subscriptionCount: number;
  publicKey: string;
}

export interface WebPushNotificationInput {
  enabled: boolean;
}

export interface WebPushSendResult {
  sent: number;
  removed: number;
  failed: number;
  reason?: string;
}
