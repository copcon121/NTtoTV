export type PlanScope = "daily" | "asia" | "eu" | "us";

export interface MpPlanAlert {
  levelRef: string;
  price: number;
  label: string;
  source: string;
  reason: string;
  scenario: string;
  alertId: string | null;
  enabled: boolean;
  status: "armed" | "fired" | "disabled" | "deleted" | "expired" | "pending" | "superseded";
}

export interface MpPlan {
  id: string;
  scope: PlanScope;
  tradeDate: string;
  asOf: number;
  createdAt: number;
  expiresAt: number;
  createdLate: boolean;
  expired: boolean;
  legacySchedule?: boolean;
  llm?: { model?: string; reasoningEffort?: string };
  summary: string;
  mpRead: string;
  dailyRead: string;
  invalidation: string;
  dataQuality: string[];
  scenarios: { title: string; condition: string; action: string; invalidation: string }[];
  alerts: MpPlanAlert[];
}

export interface MpPlannerState {
  plans: MpPlan[];
  settings: { enabled: boolean; available: boolean; profileId: string; reason: string | null;
    llm?: { model?: string; reasoningEffort?: string } };
  currentSlot: { id: string; name: PlanScope; tradeDate: string; start: number; end: number } | null;
  activeSlots?: { name: PlanScope; start: number; end: number }[];
  run: { status: string; error: string | null } | null;
  tradingDays: { start: number; end: number; tradeDate: string }[];
  serverTime: number;
}

export async function mpRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/mp${path}`, {
    method, credentials: "same-origin",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(error?.error?.message ?? `MP Planner: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
