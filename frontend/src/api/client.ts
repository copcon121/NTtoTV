// api module — thin REST client for the backend control + read endpoints.
//
// Wraps the `/api/*` REST surface the live app needs at startup and for alert
// CRUD. `fetch` is injectable so the client is testable without a network, and
// the base URL is configurable (defaults to same-origin `/api`, which the Vite
// dev server proxies to the backend).

import {
  type Alert,
  type TelegramNotificationConfig,
  type TelegramNotificationInput,
} from "../alerts/types";
import type { AlertEventMessage } from "../socket/messages";
import { type ChartProfile, type ChartProfilePayload } from "../profiles/types";
import type { DeltaProfileData } from "../orderflow/deltaProfile";
import {
  type BigTradeMessage,
  type FvgSignalUpdateMessage,
  type FootprintRow,
  type FootprintUpdateMessage,
  type Side,
  type StackedImbalance,
  type TradingOrder,
  type TradingPosition,
  type Timeframe,
} from "../socket/messages";

export interface ContractsResponse {
  symbol: string;
  active: string;
  candidates: { contract: string; autoSelected?: boolean }[];
}

export interface VolumeDeltaBar {
  time: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  deltaHigh: number;
  deltaLow: number;
  openDelta: number;
  closeDelta: number;
  cumulativeDelta?: number;
}

export interface FootprintRestBar {
  time: number;
  rows: FootprintRow[];
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  poc: number;
  pocVolume?: number;
  vah?: number;
  val?: number;
  barDelta: number;
  buyPct: number;
  sellPct: number;
  stackedImbalance?: StackedImbalance[];
  unfinishedAuction: { high: boolean; low: boolean };
}

export interface FvgSignalRestRow {
  time: number;
  direction: number;
  level: number;
  pulse: number;
  top: number | null;
  bottom: number | null;
  breakoutRatio: number;
  phase: "confirmed";
}

export interface BigTradeRestRow {
  tradeId: number;
  time: number;
  price: number;
  volume: number;
  side: "buy" | "sell";
}

export interface SmcAiSignalRestRow {
  id: string;
  time: number;
  price: number;
  side: "long" | "short";
  zoneType: string;
  huntType: string;
  confirmation: string;
  outcome?: string;
  netR?: number | null;
  text?: string;
}

export interface ProfileListItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApiClientOptions {
  /** Base path for the REST API. Defaults to "/api". */
  basePath?: string;
  /** Injectable fetch (defaults to the global). */
  fetchFn?: typeof fetch;
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface Mt5Account {
  accountId: string;
  login: number;
  server: string;
  symbolBroker?: string;
  terminalPath?: string;
  tradeMode: string;
  currency?: string;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
}

export interface Mt5Symbol {
  symbol: string;
  digits: number;
  tickSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  stopsLevel: number;
  pipValue: number;
}

export interface Mt5ConnectInput {
  login: number;
  password: string;
  server: string;
  symbolBroker?: string;
  terminalPath?: string;
}

export interface Mt5Status {
  connected: boolean;
  account: Mt5Account | null;
  error?: string;
}

export interface Mt5Terminal {
  path: string;
  login: number | null;
  server: string | null;
  title: string;
}

export interface OrderSubmitInput {
  source: "chart_bracket" | "market_bar" | "api";
  side: "buy" | "sell";
  kind: "market" | "limit" | "stop";
  volumeLots: number;
  entryGc?: number;
  referenceGc?: number;
  slGc?: number;
  tpGc?: number;
  slDistanceGc?: number;
  tpDistanceGc?: number;
  gcAnchored?: boolean;
  idempotencyKey: string;
}

export interface Mt5PendingOrder {
  brokerOrderTicket: number;
  orderId?: string | null;
  symbolBroker: string;
  side: Side;
  kind: "limit" | "stop";
  volumeLots: number;
  entryBroker: number;
  entryGc?: number | null;
  slBroker?: number | null;
  tpBroker?: number | null;
  slGc?: number | null;
  tpGc?: number | null;
  basisStale?: boolean;
  updatedAt: number;
}

export interface Mt5OpenTrades {
  positions: TradingPosition[];
  orders: Mt5PendingOrder[];
}

export interface Mt5TradePatchInput {
  entryGc?: number | null;
  slGc?: number | null;
  tpGc?: number | null;
}

export interface AnalystReport {
  reportId: string;
  snapshotId: string;
  symbol: string;
  contract: string;
  createdAt: number;
  bias: string;
  decision:
    | "no_trade"
    | "wait_for_buy"
    | "wait_for_sell"
    | "buy_candidate"
    | "sell_candidate";
  confidence: number;
  reason: string[];
  invalidIf: string;
  nextConfirmation: string;
  riskState: string;
  allowedToAlert: boolean;
  allowedToAutoTrade: false;
  rawResponse?: Record<string, unknown>;
}

export interface AnalystRunResponse {
  snapshot: Record<string, unknown>;
  report: AnalystReport | null;
  llmEnabled: boolean;
  error: string | null;
  telegram?: { sent: boolean; reason?: string };
}

export interface AnalystAutoSendState {
  available: boolean;
  enabled: boolean;
  running?: boolean;
  intervalSeconds?: number;
  reason?: string;
}

export interface AnalystEventAiState {
  available: boolean;
  enabled: boolean;
  profileId: string;
  providerMode: "real";
  llmEnabled: boolean;
  reason?: string | null;
}

export class ApiClient {
  private readonly basePath: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.basePath = options.basePath ?? "/api";
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const res = await this.fetchFn(`${this.basePath}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "POST /auth/login"));
    }
    const body = (await res.json()) as { user: AuthUser };
    return body.user;
  }

  async register(username: string, password: string, inviteCode?: string): Promise<AuthUser> {
    const res = await this.fetchFn(`${this.basePath}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        username,
        password,
        ...(inviteCode ? { inviteCode } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "POST /auth/register"));
    }
    const body = (await res.json()) as { user: AuthUser };
    return body.user;
  }

  async me(): Promise<AuthUser | undefined> {
    const res = await this.fetchFn(`${this.basePath}/auth/me`, {
      credentials: "same-origin",
    });
    if (res.status === 401) return undefined;
    if (!res.ok) throw new Error(await this.errorMessage(res, "GET /auth/me"));
    const body = (await res.json()) as { user: AuthUser };
    return body.user;
  }

  async logout(): Promise<void> {
    const res = await this.fetchFn(`${this.basePath}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /auth/logout"));
  }

  async connectMt5(input: Mt5ConnectInput): Promise<Mt5Account> {
    const res = await this.fetchFn(`${this.basePath}/mt5/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /mt5/connect"));
    const body = (await res.json()) as { account: Mt5Account };
    return body.account;
  }

  async mt5Status(): Promise<Mt5Status> {
    return this.getJson<Mt5Status>("/mt5/status");
  }

  async mt5Account(): Promise<Mt5Account> {
    const body = await this.getJson<{ account: Mt5Account }>("/mt5/account");
    return body.account;
  }

  async mt5Symbol(): Promise<Mt5Symbol> {
    const body = await this.getJson<{ symbol: Mt5Symbol }>("/mt5/symbol");
    return body.symbol;
  }

  async mt5Terminals(): Promise<Mt5Terminal[]> {
    try {
      const body = await this.getJson<{ terminals: Mt5Terminal[] }>("/mt5/terminals");
      return body.terminals;
    } catch {
      return [];
    }
  }

  async mt5OpenTrades(): Promise<Mt5OpenTrades> {
    return this.getJson<Mt5OpenTrades>("/mt5/open-trades");
  }

  async patchMt5Position(
    brokerPositionTicket: number,
    input: Pick<Mt5TradePatchInput, "slGc" | "tpGc">,
  ): Promise<TradingPosition> {
    const res = await this.fetchFn(
      `${this.basePath}/mt5/positions/${encodeURIComponent(String(brokerPositionTicket))}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "PATCH /mt5/positions"));
    const body = (await res.json()) as { position: TradingPosition };
    return body.position;
  }

  async closeMt5Position(brokerPositionTicket: number): Promise<void> {
    const res = await this.fetchFn(
      `${this.basePath}/mt5/positions/${encodeURIComponent(String(brokerPositionTicket))}/close`,
      { method: "POST", credentials: "same-origin" },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /mt5/positions/close"));
  }

  async patchMt5Order(
    brokerOrderTicket: number,
    input: Mt5TradePatchInput,
  ): Promise<Mt5PendingOrder> {
    const res = await this.fetchFn(
      `${this.basePath}/mt5/orders/${encodeURIComponent(String(brokerOrderTicket))}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "PATCH /mt5/orders"));
    const body = (await res.json()) as { order: Mt5PendingOrder };
    return body.order;
  }

  async cancelMt5Order(brokerOrderTicket: number): Promise<void> {
    const res = await this.fetchFn(
      `${this.basePath}/mt5/orders/${encodeURIComponent(String(brokerOrderTicket))}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "DELETE /mt5/orders"));
  }

  async orders(openOnly = true): Promise<TradingOrder[]> {
    const query = new URLSearchParams({ openOnly: String(openOnly) });
    const body = await this.getJson<{ orders: TradingOrder[] }>(
      `/orders?${query.toString()}`,
    );
    return body.orders;
  }

  async createOrder(input: OrderSubmitInput): Promise<TradingOrder> {
    const res = await this.fetchFn(`${this.basePath}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /orders"));
    const body = (await res.json()) as { order: TradingOrder };
    return body.order;
  }

  async patchOrder(
    orderId: string,
    input: { entryGc?: number; slGc?: number; tpGc?: number; expectedVersion?: number },
  ): Promise<TradingOrder> {
    const res = await this.fetchFn(
      `${this.basePath}/orders/${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "PATCH /orders"));
    const body = (await res.json()) as { order: TradingOrder };
    return body.order;
  }

  async cancelOrder(orderId: string): Promise<TradingOrder> {
    const res = await this.fetchFn(
      `${this.basePath}/orders/${encodeURIComponent(orderId)}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "DELETE /orders"));
    const body = (await res.json()) as { order: TradingOrder };
    return body.order;
  }

  async closeOrder(orderId: string): Promise<TradingOrder> {
    const res = await this.fetchFn(
      `${this.basePath}/orders/${encodeURIComponent(orderId)}/close`,
      { method: "POST", credentials: "same-origin" },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /orders/close"));
    const body = (await res.json()) as { order: TradingOrder };
    return body.order;
  }

  async analystLatest(
    symbol = "GC",
    contract = "GC",
  ): Promise<AnalystReport | null> {
    const params = new URLSearchParams({ symbol, contract });
    const body = await this.getJson<{ report: AnalystReport | null }>(
      `/analyst/latest?${params.toString()}`,
    );
    return body.report;
  }

  async runAnalyst(
    symbol = "GC",
    contract = "GC",
    profileId?: string,
  ): Promise<AnalystRunResponse> {
    const params = new URLSearchParams({ symbol, contract });
    if (profileId) params.set("profileId", profileId);
    const res = await this.fetchFn(
      `${this.basePath}/analyst/run?${params.toString()}`,
      { method: "POST", credentials: "same-origin" },
    );
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "POST /analyst/run"));
    }
    return (await res.json()) as AnalystRunResponse;
  }

  async analystAutoSend(): Promise<AnalystAutoSendState> {
    return this.getJson<AnalystAutoSendState>("/analyst/auto-send");
  }

  async setAnalystAutoSend(enabled: boolean): Promise<AnalystAutoSendState> {
    const res = await this.fetchFn(`${this.basePath}/analyst/auto-send`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "PUT /analyst/auto-send"));
    }
    return (await res.json()) as AnalystAutoSendState;
  }

  async analystEventAi(profileId = "default"): Promise<AnalystEventAiState> {
    return this.getJson<AnalystEventAiState>(
      `/analyst/event-ai?${this.profileQuery(profileId)}`,
    );
  }

  async setAnalystEventAi(
    enabled: boolean,
    profileId = "default",
  ): Promise<AnalystEventAiState> {
    const res = await this.fetchFn(
      `${this.basePath}/analyst/event-ai?${this.profileQuery(profileId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ enabled }),
      },
    );
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "PUT /analyst/event-ai"));
    }
    return (await res.json()) as AnalystEventAiState;
  }

  /** List the available symbols (Req 18.1). v1: `["GC"]`. */
  async symbols(): Promise<string[]> {
    const body = await this.getJson<{ symbols: string[] }>("/symbols");
    return body.symbols;
  }

  /** Candidate contracts + the Active_Contract for a symbol (Req 18.2). */
  async contracts(symbol: string): Promise<ContractsResponse> {
    return this.getJson<ContractsResponse>(
      `/contracts?symbol=${encodeURIComponent(symbol)}`,
    );
  }

  /** Pin the Active_Contract (manual override, Req 18.3). */
  async setActiveContract(symbol: string, contract: string): Promise<void> {
    const res = await this.fetchFn(`${this.basePath}/contracts/active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, contract }),
    });
    if (!res.ok) {
      throw new Error(`POST /contracts/active failed: ${res.status}`);
    }
  }

  /** List configured alerts (Req 18.8). */
  async alerts(profileId = "default"): Promise<Alert[]> {
    const body = await this.getJson<{ alerts: Alert[] }>(
      `/alerts?${this.profileQuery(profileId)}`,
    );
    return body.alerts;
  }

  /** Create an alert (Req 18.9). Returns the created alert. */
  async createAlert(input: {
    symbol: string;
    type: string;
    params: Record<string, number | string | boolean>;
    enabled?: boolean;
    profileId?: string;
  }): Promise<Alert> {
    const res = await this.fetchFn(`${this.basePath}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        ...input,
        profileId: this.normalizeProfileId(input.profileId),
      }),
    });
    if (!res.ok) {
      throw new Error(`POST /alerts failed: ${res.status}`);
    }
    return (await res.json()) as Alert;
  }

  /** Saved frontend profile metadata. */
  async profiles(): Promise<ProfileListItem[]> {
    const body = await this.getJson<{ profiles: ProfileListItem[] }>("/profiles");
    return body.profiles;
  }

  /** Authenticated user's default chart workspace. */
  async meProfile(): Promise<ChartProfile> {
    const body = await this.getJson<{ profile: ChartProfile }>("/me/profile");
    return body.profile;
  }

  /** Save the authenticated user's default chart workspace. */
  async saveMeProfile(input: {
    name?: string;
    payload: ChartProfilePayload;
  }): Promise<ChartProfile> {
    const res = await this.fetchFn(`${this.basePath}/me/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "PUT /me/profile"));
    }
    const body = (await res.json()) as { profile: ChartProfile };
    return body.profile;
  }

  /** Load Telegram notification config for the active alert profile. */
  async telegramConfig(profileId = "default"): Promise<TelegramNotificationConfig> {
    const body = await this.getJson<{ telegram: TelegramNotificationConfig }>(
      `/notifications/telegram?${this.profileQuery(profileId)}`,
    );
    return body.telegram;
  }

  /** Save Telegram notification config. `botToken` may be omitted to preserve it. */
  async saveTelegramConfig(
    input: TelegramNotificationInput,
    profileId = "default",
  ): Promise<TelegramNotificationConfig> {
    const res = await this.fetchFn(
      `${this.basePath}/notifications/telegram?${this.profileQuery(profileId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new Error(
        await this.errorMessage(res, "PUT /notifications/telegram"),
      );
    }
    const body = (await res.json()) as { telegram: TelegramNotificationConfig };
    return body.telegram;
  }

  /** Send a Telegram test notification for the active profile. */
  async testTelegramConfig(profileId = "default"): Promise<void> {
    const res = await this.fetchFn(
      `${this.basePath}/notifications/telegram/test?${this.profileQuery(profileId)}`,
      { method: "POST" },
    );
    if (!res.ok) {
      throw new Error(
        await this.errorMessage(res, "POST /notifications/telegram/test"),
      );
    }
  }

  /** Forward an alert event to Telegram, optionally with a chart screenshot. */
  async sendTelegramAlert(input: {
    event: AlertEventMessage;
    message: string;
    screenshotDataUrl?: string;
    profileId?: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const res = await this.fetchFn(
      `${this.basePath}/notifications/telegram/alert?${this.profileQuery(
        input.profileId,
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: input.event.alertId,
          alertType: input.event.alertType,
          symbol: input.event.symbol,
          contract: input.event.contract,
          time: input.event.time,
          price: input.event.price,
          message: input.message,
          screenshotDataUrl: input.screenshotDataUrl,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        await this.errorMessage(res, "POST /notifications/telegram/alert"),
      );
    }
    return (await res.json()) as { sent: boolean; reason?: string };
  }

  /** Load one saved frontend profile. */
  async profile(profileId: string): Promise<ChartProfile> {
    const id = encodeURIComponent(this.normalizeProfileId(profileId));
    const body = await this.getJson<{ profile: ChartProfile }>(`/profiles/${id}`);
    return body.profile;
  }

  /** Save one frontend profile payload on the server. */
  async saveProfile(
    profileId: string,
    input: { name?: string; payload: ChartProfilePayload },
  ): Promise<ChartProfile> {
    const id = encodeURIComponent(this.normalizeProfileId(profileId));
    const res = await this.fetchFn(`${this.basePath}/profiles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`PUT /profiles/${id} failed: ${res.status}`);
    }
    const body = (await res.json()) as { profile: ChartProfile };
    return body.profile;
  }

  /** Delete one saved frontend profile. */
  async deleteProfile(profileId: string): Promise<void> {
    const id = encodeURIComponent(this.normalizeProfileId(profileId));
    const res = await this.fetchFn(`${this.basePath}/profiles/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`DELETE /profiles/${id} failed: ${res.status}`);
    }
  }

  /** Per-bar volume delta for the lower two-sided histogram. */
  async volumeDelta(
    symbol: string,
    contract: string,
    timeframe: string,
    limit?: number,
  ): Promise<VolumeDeltaBar[]> {
    const params = new URLSearchParams({
      symbol,
      contract,
      tf: timeframe,
    });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    const body = await this.getJson<{ bars: VolumeDeltaBar[] }>(
      `/orderflow/volume-delta?${params.toString()}`,
    );
    return body.bars;
  }

  /** Last M1 footprint bars with ladders. */
  async footprint(
    symbol: string,
    contract: string,
    count = 5,
  ): Promise<FootprintUpdateMessage[]> {
    const params = new URLSearchParams({
      symbol,
      contract,
      count: String(count),
    });
    const body = await this.getJson<{
      symbol: string;
      contract: string;
      tf: Timeframe;
      bars: FootprintRestBar[];
    }>(`/orderflow/footprint?${params.toString()}`);
    return body.bars.map((bar) => {
      const prices = bar.rows.map((row) => row.price);
      const high = bar.high ?? (prices.length > 0 ? Math.max(...prices) : bar.poc);
      const low = bar.low ?? (prices.length > 0 ? Math.min(...prices) : bar.poc);
      return {
        type: "footprint_update",
        symbol: body.symbol,
        contract: body.contract,
        tf: body.tf,
        time: bar.time,
        rows: bar.rows,
        open: bar.open ?? bar.poc,
        high,
        low,
        close: bar.close ?? bar.poc,
        poc: bar.poc,
        pocVolume: bar.pocVolume ?? 0,
        vah: bar.vah ?? bar.poc,
        val: bar.val ?? bar.poc,
        barDelta: bar.barDelta,
        buyPct: bar.buyPct,
        sellPct: bar.sellPct,
        stackedImbalance: bar.stackedImbalance ?? [],
        unfinishedAuction: bar.unfinishedAuction,
      };
    });
  }

  /** Confirmed M1 FVG Signal Grader candle colors. */
  async fvgSignals(
    symbol: string,
    contract: string,
    limit?: number,
  ): Promise<FvgSignalUpdateMessage[]> {
    const params = new URLSearchParams({
      symbol,
      contract,
      tf: "1m",
    });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    const body = await this.getJson<{
      symbol: string;
      contract: string;
      tf: Timeframe;
      signals: FvgSignalRestRow[];
    }>(`/orderflow/fvg-signals?${params.toString()}`);
    return body.signals.map((signal) => ({
      type: "fvg_signal_update",
      symbol: body.symbol,
      contract: body.contract,
      tf: body.tf,
      time: signal.time,
      direction: signal.direction,
      level: signal.level,
      pulse: signal.pulse,
      top: signal.top,
      bottom: signal.bottom,
      breakoutRatio: signal.breakoutRatio,
      phase: signal.phase,
    }));
  }

  /** Fixed-range delta profile aggregated from cached M1 footprint ladders. */
  async deltaProfile(input: {
    symbol: string;
    contract: string;
    from: number;
    to: number;
    rowTicks?: number;
    valueAreaPct?: number;
  }): Promise<DeltaProfileData> {
    const params = new URLSearchParams({
      symbol: input.symbol,
      contract: input.contract,
      from: String(input.from),
      to: String(input.to),
    });
    if (input.rowTicks !== undefined) {
      params.set("rowTicks", String(input.rowTicks));
    }
    if (input.valueAreaPct !== undefined) {
      params.set("valueAreaPct", String(input.valueAreaPct));
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    try {
      return await this.getJson<DeltaProfileData>(
        `/orderflow/delta-profile?${params.toString()}`,
        { signal: controller.signal },
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  /** Merged big trades for the selected contract. */
  async bigTrades(
    symbol: string,
    contract: string,
    limit?: number,
  ): Promise<BigTradeMessage[]> {
    const params = new URLSearchParams({ symbol, contract });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    const body = await this.getJson<{
      symbol: string;
      contract: string;
      trades: BigTradeRestRow[];
    }>(`/big-trades?${params.toString()}`);
    return body.trades.map((trade) => ({
      type: "big_trade",
      symbol: body.symbol,
      contract: body.contract,
      tradeId: trade.tradeId,
      time: trade.time,
      price: trade.price,
      volume: trade.volume,
      side: trade.side,
    }));
  }

  async smcAiBaselineSignals(input: {
    symbol: string;
    contract: string;
    timeframe: string;
    from?: number;
    to?: number;
    limit?: number;
  }): Promise<SmcAiSignalRestRow[]> {
    const params = new URLSearchParams({
      symbol: input.symbol,
      contract: input.contract,
      tf: input.timeframe,
    });
    if (input.from !== undefined) {
      params.set("from", String(input.from));
    }
    if (input.to !== undefined) {
      params.set("to", String(input.to));
    }
    if (input.limit !== undefined) {
      params.set("limit", String(input.limit));
    }
    const body = await this.getJson<{ signals: SmcAiSignalRestRow[] }>(
      `/smc-ai/baseline-signals?${params.toString()}`,
    );
    return body.signals;
  }

  /** Enable/disable an alert (Req 18.10). */
  async patchAlert(
    id: string,
    enabled: boolean,
    profileId = "default",
  ): Promise<void> {
    await this.fetchFn(
      `${this.basePath}/alerts/${encodeURIComponent(id)}?${this.profileQuery(profileId)}`,
      {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
      },
    );
  }

  /** Update an alert's params (e.g. a dragged price `level`). (Req 18.10) */
  async patchAlertParams(
    id: string,
    params: Record<string, number | string | boolean>,
    profileId = "default",
  ): Promise<void> {
    await this.fetchFn(
      `${this.basePath}/alerts/${encodeURIComponent(id)}?${this.profileQuery(profileId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      },
    );
  }

  /** Delete an alert (Req 18.11). */
  async deleteAlert(id: string, profileId = "default"): Promise<void> {
    await this.fetchFn(
      `${this.basePath}/alerts/${encodeURIComponent(id)}?${this.profileQuery(profileId)}`,
      {
        method: "DELETE",
      },
    );
  }

  private async getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchFn(`${this.basePath}${path}`, {
      ...init,
      credentials: "same-origin",
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private async errorMessage(res: Response, operation: string): Promise<string> {
    try {
      const body = (await res.json()) as {
        error?: { message?: unknown };
      };
      const message = body.error?.message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    } catch {
      /* Fall through to the generic HTTP status. */
    }
    return `${operation} failed: ${res.status}`;
  }

  private normalizeProfileId(profileId: string | undefined): string {
    const normalized = profileId?.trim();
    return normalized ? normalized : "default";
  }

  private profileQuery(profileId: string | undefined): string {
    return new URLSearchParams({
      profileId: this.normalizeProfileId(profileId),
    }).toString();
  }
}
