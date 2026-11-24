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
  type WebPushNotificationConfig,
  type WebPushNotificationInput,
  type WebPushSendResult,
} from "../alerts/types";
import type { AlertEventMessage } from "../socket/messages";
import {
  type ChartProfile,
  type ChartProfilePayload,
  type LiquidityChartProfileState,
} from "../profiles/types";
import type {
  DeltaProfileData,
  DeltaProfileSource,
} from "../orderflow/deltaProfile";
import {
  type BigTradeMessage,
  type FvgSignalUpdateMessage,
  type TduSignalUpdateMessage,
  type FootprintRow,
  type FootprintUpdateMessage,
  type Side,
  type StackedImbalance,
  type TradingOrder,
  type TradingPosition,
  type PnlPerPriceUnit,
  type Timeframe,
} from "../socket/messages";
import type { Workspace, WorkspacePayload } from "../workspace/types";

export interface Instrument {
  id: string;
  symbol: string;
  displaySymbol: string;
  venue: string;
  assetClass: string;
  provider: string;
  contractMode: string;
  activeContract?: string;
  readOnly: boolean;
}

export interface AiScanCandidate {
  id: string;
  type: "trendline" | "fibonacci_retracement" | "fibonacci_extension" | "elliott_wave";
  label: string;
  anchors: { time: number; price: number }[];
  technicalScore: number;
  score: number;
  explanation: string;
  invalidIf: string;
  note?: string | null;
}

export interface AiScanResponse {
  scanId: string;
  instrumentId: string;
  symbol: string;
  displaySymbol: string;
  venue: string;
  contract: string;
  timeframe: string;
  depth: "short" | "medium" | "deep";
  density?: string;
  strength?: string;
  aiAvailable: boolean;
  rankingSource: "ai" | "technical-fallback";
  candidates: AiScanCandidate[];
  suggestions?: import("../chart/scanAi/types").ScanAiSuggestion[];
  summary?: {
    totalSuggestions: number;
    groupCounts: Record<string, number>;
  };
}

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

export interface FootprintQuery {
  count?: number;
  from?: number;
  to?: number;
  at?: number;
  context?: number;
}

export interface FootprintResponse {
  symbol: string;
  contract: string;
  tf: Timeframe;
  bars: FootprintUpdateMessage[];
  at?: number;
  context?: number;
  targetFound?: boolean;
}

interface FootprintRestResponse {
  symbol: string;
  contract: string;
  tf: Timeframe;
  bars: FootprintRestBar[];
  at?: number;
  context?: number;
  targetFound?: boolean;
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

export interface TduSignalRestRow {
  time: number;
  momentumDirection: number;
  momentumLevel: number;
  deltaDivergence: number;
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

export interface AlertSignalRestRow {
  id: string;
  alertId: string;
  time: number;
  price: number;
  direction: 1 | -1;
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
  mustChangePassword?: boolean;
}

export interface Mt5Account {
  accountId: string;
  login: number | string;
  server: string;
  symbolBroker?: string;
  terminalPath?: string;
  tradeMode: string;
  currency?: string;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  floatingPnl?: number | null;
  accountStateAt?: number;
  accountStateStale?: boolean;
  provider?: "exness";
  connected?: boolean;
  gateway?: string;
  credentialsStored?: boolean;
  error?: string | null;
  uncertainActions?: { key: string; action: string; createdAt: number }[];
}

export type BrokerTicket = number | string;

export interface ExnessConnectInput {
  accountId: string;
  apiKey: string;
  apiSecret: string;
  gateway?: string;
  symbolBroker?: string;
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

export interface Mt5Status {
  connected: boolean;
  account: Mt5Account | null;
  error?: string;
}

export interface OrderSubmitInput {
  source: "chart_bracket" | "market_bar" | "api";
  side: "buy" | "sell";
  kind: "market" | "limit" | "stop";
  autoPendingKind?: boolean;
  volumeLots: number;
  entryGc?: number;
  referenceGc?: number;
  slGc?: number;
  tpGc?: number;
  slDistanceGc?: number;
  tpDistanceGc?: number;
  takeProfit1rEnabled?: boolean;
  autoSupertrendAfter1rEnabled?: boolean;
  trailingTimeframe?: Timeframe;
  trailingPeriod?: number;
  trailingMultiplier?: number;
  trailingAtrMethod?: SupertrendTrailing["atrMethod"];
  trailingSource?: SupertrendTrailing["source"];
  gcAnchored?: boolean;
  idempotencyKey: string;
}

export interface SupertrendTrailing {
  targetType: "order" | "position";
  targetId: string;
  brokerPositionTicket: BrokerTicket;
  side: Side;
  timeframe: Timeframe;
  period: number;
  multiplier: number;
  atrMethod: "rma" | "sma";
  source: "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4";
  lastBarTime?: number | null;
  lastLine?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SupertrendTrailingInput {
  timeframe: Timeframe;
  period: number;
  multiplier: number;
  atrMethod: SupertrendTrailing["atrMethod"];
  source: SupertrendTrailing["source"];
}

export interface Mt5PendingOrder {
  brokerOrderTicket: BrokerTicket;
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
  actionPending?: boolean;
  pnlPerPriceUnit?: PnlPerPriceUnit;
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
  priceDeltas?: Partial<Record<"entryGc" | "slGc" | "tpGc", number>>;
  breakEven?: boolean;
}

export interface ExnessExecutionState {
  account: Mt5Account | null;
  trades: Mt5OpenTrades;
  orders: TradingOrder[];
  trailings: SupertrendTrailing[];
  actionError?: string | null;
}

function footprintRestBarToMessage(
  body: Pick<FootprintRestResponse, "symbol" | "contract" | "tf">,
  bar: FootprintRestBar,
): FootprintUpdateMessage {
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
}

export class ApiClient {
  private readonly brokerPath = "/execution";

  async execution(): Promise<{ enabled: boolean; profiles: string[]; mode?: string }> {
    try {
      const result = await this.getJson<{ enabled: boolean; profiles: string[]; mode?: string }>("/execution");
      return result;
    } catch {
      return { enabled: false, profiles: [] };
    }
  }

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

  async mt5Status(): Promise<Mt5Status> {
    return this.getJson<Mt5Status>(`${this.brokerPath}/status`);
  }

  async connectExness(input: ExnessConnectInput): Promise<Mt5Account> {
    const res = await this.fetchFn(`${this.basePath}/execution/connect`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "Connect Exness"));
    return ((await res.json()) as { account: Mt5Account }).account;
  }

  async acknowledgeUncertainExecution(key: string): Promise<Mt5Account> {
    const res = await this.fetchFn(`${this.basePath}/execution/acknowledge-uncertain`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "Review execution"));
    return ((await res.json()) as { account: Mt5Account }).account;
  }

  async mt5Account(): Promise<Mt5Account> {
    const body = await this.getJson<{ account: Mt5Account }>(`${this.brokerPath}/account`);
    return body.account;
  }

  async mt5Symbol(): Promise<Mt5Symbol> {
    const body = await this.getJson<{ symbol: Mt5Symbol }>(`${this.brokerPath}/symbol`);
    return body.symbol;
  }

  async mt5OpenTrades(): Promise<Mt5OpenTrades> {
    return this.getJson<Mt5OpenTrades>(`${this.brokerPath}/open-trades`);
  }

  async exnessState(): Promise<ExnessExecutionState> {
    return this.getJson<ExnessExecutionState>("/execution/state");
  }

  async patchMt5Position(
    brokerPositionTicket: BrokerTicket,
    input: Omit<Mt5TradePatchInput, "entryGc"> & { idempotencyKey?: string },
  ): Promise<TradingPosition> {
    const res = await this.fetchFn(
      `${this.basePath}${this.brokerPath}/positions/${encodeURIComponent(String(brokerPositionTicket))}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "PATCH /execution/positions"));
    const body = (await res.json()) as { position: TradingPosition };
    return body.position;
  }

  async closeMt5Position(
    brokerPositionTicket: BrokerTicket,
    volumeLots?: number,
    idempotencyKey?: string,
  ): Promise<void> {
    const payload: { volumeLots?: number; idempotencyKey?: string } = {};
    if (volumeLots !== undefined) payload.volumeLots = volumeLots;
    if (idempotencyKey !== undefined) payload.idempotencyKey = idempotencyKey;
    const body = Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
    const headers = body ? { "Content-Type": "application/json" } : undefined;
    const res = await this.fetchFn(
      `${this.basePath}${this.brokerPath}/positions/${encodeURIComponent(String(brokerPositionTicket))}/close`,
      { method: "POST", headers, credentials: "same-origin", body },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /execution/positions/close"));
  }

  async patchMt5Order(
    brokerOrderTicket: BrokerTicket,
    input: Mt5TradePatchInput & { idempotencyKey?: string },
  ): Promise<Mt5PendingOrder> {
    const res = await this.fetchFn(
      `${this.basePath}${this.brokerPath}/orders/${encodeURIComponent(String(brokerOrderTicket))}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "PATCH /execution/orders"));
    const body = (await res.json()) as { order: Mt5PendingOrder };
    return body.order;
  }

  async cancelMt5Order(brokerOrderTicket: BrokerTicket, idempotencyKey?: string): Promise<void> {
    const body = idempotencyKey ? JSON.stringify({ idempotencyKey }) : undefined;
    const headers = body ? { "Content-Type": "application/json" } : undefined;
    const res = await this.fetchFn(
      `${this.basePath}${this.brokerPath}/orders/${encodeURIComponent(String(brokerOrderTicket))}`,
      { method: "DELETE", headers, credentials: "same-origin", body },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "DELETE /execution/orders"));
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

  async supertrendTrailings(): Promise<SupertrendTrailing[]> {
    const body = await this.getJson<{ trailings: SupertrendTrailing[] }>(
      "/supertrend-trailing",
    );
    return body.trailings;
  }

  async enableSupertrendTrailing(
    targetType: SupertrendTrailing["targetType"],
    targetId: string | number,
    input: SupertrendTrailingInput,
  ): Promise<SupertrendTrailing> {
    const segment = targetType === "order" ? "orders" : "positions";
    const res = await this.fetchFn(
      `${this.basePath}/supertrend-trailing/${segment}/${encodeURIComponent(String(targetId))}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "PUT /supertrend-trailing"));
    }
    const body = (await res.json()) as { trailing: SupertrendTrailing };
    return body.trailing;
  }

  async disableSupertrendTrailing(
    targetType: SupertrendTrailing["targetType"],
    targetId: string | number,
  ): Promise<void> {
    const segment = targetType === "order" ? "orders" : "positions";
    const res = await this.fetchFn(
      `${this.basePath}/supertrend-trailing/${segment}/${encodeURIComponent(String(targetId))}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "DELETE /supertrend-trailing"));
    }
  }

  async patchOrder(
    orderId: string,
    input: Mt5TradePatchInput & { expectedVersion?: number; idempotencyKey?: string },
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

  async cancelOrder(orderId: string, idempotencyKey?: string): Promise<TradingOrder> {
    const requestBody = idempotencyKey ? JSON.stringify({ idempotencyKey }) : undefined;
    const headers = requestBody ? { "Content-Type": "application/json" } : undefined;
    const res = await this.fetchFn(
      `${this.basePath}/orders/${encodeURIComponent(orderId)}`,
      { method: "DELETE", headers, credentials: "same-origin", body: requestBody },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "DELETE /orders"));
    const body = (await res.json()) as { order: TradingOrder };
    return body.order;
  }

  async closeOrder(
    orderId: string,
    volumeLots?: number,
    idempotencyKey?: string,
  ): Promise<TradingOrder> {
    const payload: { volumeLots?: number; idempotencyKey?: string } = {};
    if (volumeLots !== undefined) payload.volumeLots = volumeLots;
    if (idempotencyKey !== undefined) payload.idempotencyKey = idempotencyKey;
    const requestBody = Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
    const headers = requestBody ? { "Content-Type": "application/json" } : undefined;
    const res = await this.fetchFn(
      `${this.basePath}/orders/${encodeURIComponent(orderId)}/close`,
      { method: "POST", headers, credentials: "same-origin", body: requestBody },
    );
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /orders/close"));
    const responseBody = (await res.json()) as { order: TradingOrder };
    return responseBody.order;
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

  async history(
    symbol: string,
    contract: string,
    timeframe: string,
    limit = 1_500,
  ): Promise<import("../cache/types").Bar[]> {
    const params = new URLSearchParams({ symbol, contract, tf: timeframe, limit: String(limit) });
    const body = await this.getJson<{ bars: import("../cache/types").Bar[] }>(`/history?${params}`);
    return body.bars;
  }

  async instruments(): Promise<Instrument[]> {
    const body = await this.getJson<{ instruments: Instrument[] }>("/instruments");
    return body.instruments;
  }

  async aiScan(input: {
    instrumentId?: string;
    symbol?: string;
    contract?: string;
    timeframe: string;
    depth?: "short" | "medium" | "deep";
    density?: "auto" | "less" | "normal" | "more";
    strength?: "all" | "moderate" | "strong";
    states?: string[];
    groups?: string[];
    patterns?: string[];
    targetsAndStop?: boolean;
    analyses?: string[];
    endTime?: number;
    from?: number;
    to?: number;
  }): Promise<AiScanResponse> {
    const res = await this.fetchFn(`${this.basePath}/ai-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /ai-scan"));
    return (await res.json()) as AiScanResponse;
  }

  async workspaces(): Promise<Workspace[]> {
    const body = await this.getJson<{ workspaces: Workspace[] }>("/workspaces");
    return body.workspaces;
  }

  async createWorkspace(input: { name: string; payload: WorkspacePayload; bootstrap?: boolean }): Promise<Workspace> {
    const res = await this.fetchFn(`${this.basePath}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "POST /workspaces"));
    return ((await res.json()) as { workspace: Workspace }).workspace;
  }

  async saveWorkspace(workspaceId: string, input: { name: string; payload: WorkspacePayload }): Promise<Workspace> {
    const res = await this.fetchFn(`${this.basePath}/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "PUT /workspaces"));
    return ((await res.json()) as { workspace: Workspace }).workspace;
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const res = await this.fetchFn(`${this.basePath}/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(await this.errorMessage(res, "DELETE /workspaces"));
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

  /** Save only /lq state without replacing the rest of the user's profile. */
  async saveMeLiquidityChart(
    liquidityChart: LiquidityChartProfileState,
  ): Promise<LiquidityChartProfileState> {
    const res = await this.fetchFn(`${this.basePath}/me/profile/liquidity-chart`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ liquidityChart }),
    });
    if (!res.ok) {
      throw new Error(
        await this.errorMessage(res, "PATCH /me/profile/liquidity-chart"),
      );
    }
    const body = (await res.json()) as {
      liquidityChart: LiquidityChartProfileState;
    };
    return body.liquidityChart;
  }

  /** Fetch native iceberg order snapshot. */
  async getIcebergs(params: {
    symbol?: string;
    contract?: string;
    limit?: number;
    min_volume?: number;
  } = {}): Promise<import("../orderflow/nativeIcebergs").NativeIcebergSnapshot> {
    const query = new URLSearchParams({
      symbol: params.symbol ?? "GC",
      contract: params.contract ?? "GC",
      limit: String(params.limit ?? 1000),
      min_volume: String(params.min_volume ?? 1),
    });
    return this.getJson(`/orderflow/icebergs?${query}`);
  }

  /** Fetch completed SI stop chains history. */
  async getSiStops(params: {
    symbol?: string;
    contract?: string;
    limit?: number;
  } = {}): Promise<{
    source: string;
    symbol: string;
    contract: string;
    connected: boolean;
    chains: import("../socket/messages").SiStopChain[];
  }> {
    const query = new URLSearchParams({
      symbol: params.symbol ?? "GC",
      contract: params.contract ?? "GC",
      limit: String(params.limit ?? 5000),
    });
    return this.getJson(`/orderflow/si-stops?${query}`);
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

  /** Load Web Push config and VAPID public key for the active alert profile. */
  async webPushConfig(profileId = "default"): Promise<WebPushNotificationConfig> {
    const body = await this.getJson<{ webPush: WebPushNotificationConfig }>(
      `/notifications/webpush?${this.profileQuery(profileId)}`,
    );
    return body.webPush;
  }

  /** Enable/disable server-side Web Push delivery for the active profile. */
  async saveWebPushConfig(
    input: WebPushNotificationInput,
    profileId = "default",
  ): Promise<WebPushNotificationConfig> {
    const res = await this.fetchFn(
      `${this.basePath}/notifications/webpush?${this.profileQuery(profileId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new Error(await this.errorMessage(res, "PUT /notifications/webpush"));
    }
    const body = (await res.json()) as { webPush: WebPushNotificationConfig };
    return body.webPush;
  }

  /** Save this browser/device's Push API subscription for the active profile. */
  async saveWebPushSubscription(
    subscription: unknown,
    profileId = "default",
  ): Promise<WebPushNotificationConfig> {
    const res = await this.fetchFn(
      `${this.basePath}/notifications/webpush/subscription?${this.profileQuery(
        profileId,
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      },
    );
    if (!res.ok) {
      throw new Error(
        await this.errorMessage(res, "POST /notifications/webpush/subscription"),
      );
    }
    const body = (await res.json()) as { webPush: WebPushNotificationConfig };
    return body.webPush;
  }

  /** Remove this browser/device's Push API subscription from the active profile. */
  async deleteWebPushSubscription(
    endpoint: string,
    profileId = "default",
  ): Promise<WebPushNotificationConfig> {
    const res = await this.fetchFn(
      `${this.basePath}/notifications/webpush/subscription?${this.profileQuery(
        profileId,
      )}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      },
    );
    if (!res.ok) {
      throw new Error(
        await this.errorMessage(res, "DELETE /notifications/webpush/subscription"),
      );
    }
    const body = (await res.json()) as { webPush: WebPushNotificationConfig };
    return body.webPush;
  }

  /** Send a Web Push test notification using saved subscriptions. */
  async testWebPushConfig(profileId = "default"): Promise<WebPushSendResult> {
    const res = await this.fetchFn(
      `${this.basePath}/notifications/webpush/test?${this.profileQuery(profileId)}`,
      { method: "POST" },
    );
    if (!res.ok) {
      throw new Error(
        await this.errorMessage(res, "POST /notifications/webpush/test"),
      );
    }
    return (await res.json()) as WebPushSendResult;
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
    range?: { from?: number; to?: number },
  ): Promise<VolumeDeltaBar[]> {
    const params = new URLSearchParams({
      symbol,
      contract,
      tf: timeframe,
    });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    if (range?.from !== undefined) params.set("from", String(range.from));
    if (range?.to !== undefined) params.set("to", String(range.to));
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
    const body = await this.footprintDetails(symbol, contract, { count });
    return body.bars;
  }

  /** M1 footprint bars for a latest/range request plus centered-history metadata. */
  async footprintDetails(
    symbol: string,
    contract: string,
    query: FootprintQuery = {},
  ): Promise<FootprintResponse> {
    const params = new URLSearchParams({
      symbol,
      contract,
    });
    if (query.count !== undefined) {
      params.set("count", String(query.count));
    }
    if (query.from !== undefined) {
      params.set("from", String(query.from));
    }
    if (query.to !== undefined) {
      params.set("to", String(query.to));
    }
    if (query.at !== undefined) {
      params.set("at", String(query.at));
    }
    if (query.context !== undefined) {
      params.set("context", String(query.context));
    }
    const body = await this.getJson<FootprintRestResponse>(
      `/orderflow/footprint?${params.toString()}`,
    );
    return {
      symbol: body.symbol,
      contract: body.contract,
      tf: body.tf,
      at: body.at,
      context: body.context,
      targetFound: body.targetFound,
      bars: body.bars.map((bar) => footprintRestBarToMessage(body, bar)),
    };
  }

  /** Confirmed M1 FVG Signal Grader candle colors. */
  async fvgSignals(
    symbol: string,
    contract: string,
    limit?: number,
    range?: { from?: number; to?: number },
  ): Promise<FvgSignalUpdateMessage[]> {
    const params = new URLSearchParams({
      symbol,
      contract,
      tf: "1m",
    });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    if (range?.from !== undefined) params.set("from", String(range.from));
    if (range?.to !== undefined) params.set("to", String(range.to));
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

  /** Original-style TDU momentum triangles and bar delta divergence. */
  async tduSignals(
    symbol: string,
    contract: string,
    timeframe: Timeframe,
    limit?: number,
    range?: { from?: number; to?: number },
  ): Promise<TduSignalUpdateMessage[]> {
    const params = new URLSearchParams({ symbol, contract, tf: timeframe });
    if (limit !== undefined) params.set("limit", String(limit));
    if (range?.from !== undefined) params.set("from", String(range.from));
    if (range?.to !== undefined) params.set("to", String(range.to));
    const body = await this.getJson<{
      symbol: string;
      contract: string;
      tf: Timeframe;
      signals: TduSignalRestRow[];
    }>(`/orderflow/tdu-signals?${params.toString()}`);
    return body.signals.map((signal) => ({
      type: "tdu_signal_update",
      symbol: body.symbol,
      contract: body.contract,
      tf: body.tf,
      time: signal.time,
      momentumDirection: signal.momentumDirection,
      momentumLevel: signal.momentumLevel,
      deltaDivergence: signal.deltaDivergence,
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
    source?: DeltaProfileSource;
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
    if (input.source !== undefined) {
      params.set("source", input.source);
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
    range?: { from?: number; to?: number },
    cacheOnly?: boolean,
  ): Promise<BigTradeMessage[]> {
    const params = new URLSearchParams({ symbol, contract });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    if (range?.from !== undefined) params.set("from", String(range.from));
    if (range?.to !== undefined) params.set("to", String(range.to));
    if (cacheOnly !== undefined) params.set("cacheOnly", String(cacheOnly));
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

  async mgannBigTradeSweepSignals(input: {
    symbol: string;
    contract: string;
    timeframe: string;
    profileId?: string;
    from?: number;
    to?: number;
    limit?: number;
    settings?: object;
  }): Promise<AlertSignalRestRow[]> {
    const params = new URLSearchParams({
      symbol: input.symbol,
      contract: input.contract,
      tf: input.timeframe,
      profileId: input.profileId ?? "default",
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
    if (input.settings !== undefined) {
      params.set("settings", JSON.stringify(input.settings));
    }
    const body = await this.getJson<{ signals: AlertSignalRestRow[] }>(
      `/signals/mgann-break-ls?${params.toString()}`,
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
