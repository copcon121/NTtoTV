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
import {
  type BigTradeMessage,
  type FootprintRow,
  type FootprintUpdateMessage,
  type StackedImbalance,
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

export interface BigTradeRestRow {
  tradeId: number;
  time: number;
  price: number;
  volume: number;
  side: "buy" | "sell";
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

export class ApiClient {
  private readonly basePath: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.basePath = options.basePath ?? "/api";
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
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

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.basePath}${path}`);
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
