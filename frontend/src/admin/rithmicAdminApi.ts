export interface RithmicAdminConfig {
  stored: boolean;
  autoConnect: boolean;
  websocketUri: string;
  templateId: number;
  templateVersion: string;
  user: string;
  passwordConfigured: boolean;
  appName: string;
  appVersion: string;
  systemName: string;
  tickerInfraType: number;
  historyInfraType: number;
  aggregatedQuotes: boolean;
  userMessage: string;
  macAddresses: string[];
  osPlatform: string;
  osVersion: string;
  exchange: string;
  wireSymbol: string;
  physicalContract: string;
  modes: string[];
  qualificationSeconds: number;
  historyEnabled: boolean;
  historyAuditSeconds: number;
  historyLookbackDays: number;
  historyWeeklyByteLimit: number;
}

export interface RithmicAdminSnapshot {
  config: RithmicAdminConfig;
  runtime: {
    marketServiceRunning: boolean;
    historyServiceRunning: boolean;
    marketData: Record<string, unknown>;
  };
}

export interface RithmicPlantLoginResult {
  ok: boolean;
  messageType?: string;
  rpCode: Array<string | number>;
  heartbeatInterval?: number | null;
}

export interface RithmicLoginTestResponse {
  ok: boolean;
  error?: string;
  result?: {
    tickerPlant?: RithmicPlantLoginResult;
    historyPlant?: RithmicPlantLoginResult;
    appName?: string;
    appVersion?: string;
    system?: string;
  };
}

export interface RithmicConnectionOutcome {
  ok: boolean;
  state: "ready" | "connected" | "partial" | "failed" | "pending" | string;
  message: string;
  ready: boolean;
  tickerPlant: { connected: boolean; error?: string | null };
  historyPlant: {
    enabled: boolean;
    connected: boolean;
    state?: string | null;
    error?: string | null;
  };
}

export type RithmicConnectResponse = RithmicAdminSnapshot & {
  ok: boolean;
  connection?: RithmicConnectionOutcome;
};

export interface AdminUser {
  id: string;
  username: string;
  mustChangePassword: boolean;
}

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
        detail?: string;
      };
      message = body.error?.message ?? body.detail ?? message;
    } catch {
      // Keep the HTTP fallback when a proxy returns a non-JSON error page.
    }
    throw new AdminApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export const rithmicAdminApi = {
  me: () => request<{ user: AdminUser }>("/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: AdminUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ user: AdminUser }>("/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  snapshot: () => request<RithmicAdminSnapshot>("/admin/rithmic"),
  save: (config: Record<string, unknown>) =>
    request<{ ok: boolean; config: RithmicAdminConfig }>("/admin/rithmic", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  test: (config: Record<string, unknown>) =>
    request<RithmicLoginTestResponse>("/admin/rithmic/test", {
      method: "POST",
      body: JSON.stringify(config),
    }),
  connect: () =>
    request<RithmicConnectResponse>("/admin/rithmic/connect", {
      method: "POST",
    }),
  disconnect: () =>
    request<RithmicAdminSnapshot & { ok: boolean }>("/admin/rithmic/disconnect", {
      method: "POST",
    }),
};
