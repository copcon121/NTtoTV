import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../api/client";
import { MarketProfilePlanner } from "./MarketProfilePlanner";
import { mpRequest, type MpPlannerState } from "./plannerApi";

vi.mock("./plannerApi", () => ({ mpRequest: vi.fn() }));
vi.mock("../socket/ChartSocket", () => ({ ChartSocket: class {
  on() { return () => {}; }
  subscribe() {}
  connect() {}
  ensureConnected() {}
  close() {}
} }));

const data = (): MpPlannerState => ({
  settings: { enabled: true, available: true, profileId: "u1", reason: null },
  currentSlot: { id: "2026-10-27:eu", name: "eu", tradeDate: "2026-10-27", start: 1793080800000, end: 1793104199999 },
  run: { id: "2026-10-27:eu", status: "complete", error: null }, serverTime: 1793100000000,
  tradingDays: [{ start: 1793052000000, end: 1793134799999, tradeDate: "2026-10-27" }],
  plans: [{
    id: "2026-10-27:asia:daily", scope: "daily", tradeDate: "2026-10-27", asOf: 1793052000000,
    createdAt: 1793052000000, expiresAt: 1793134799999, createdLate: false, expired: false,
    summary: "Cân bằng trong value hôm trước", mpRead: "TPO D và volume tập trung giữa value",
    dailyRead: "Nến daily đang tích lũy", invalidation: "Giữ giá phía ngoài VAH",
    dataQuality: ["Estimated profile"],
    scenarios: [{ title: "Quan sát VAH", condition: "Giá trở lại VAH", action: "Chờ phản ứng", invalidation: "Giữ trên VAH" }],
    alerts: [{ levelRef: "prev:volume:vah", price: 4200, label: "Volume VAH", source: "volume",
      reason: "Theo dõi biên trên", scenario: "Chờ phản ứng tại VAH", alertId: "mp_test", enabled: true, status: "armed" }],
  }],
});

describe("MP planning panel", () => {
  const api = {
    me: vi.fn(async () => ({ id: "u1", username: "Trader" })),
    telegramConfig: vi.fn(async () => ({ enabled: true, hasBotToken: true, chatId: "test" })),
  } as unknown as ApiClient;

  beforeEach(() => {
    vi.mocked(mpRequest).mockResolvedValue(data());
  });
  afterEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });

  it("shows the actual daily/MP read and saved alerts without generating a plan on mount", async () => {
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    expect(await screen.findByText("Cân bằng trong value hôm trước")).toBeInTheDocument();
    expect(screen.getByText("Nến daily đang tích lũy")).toBeInTheDocument();
    expect(screen.getByText("TPO D và volume tập trung giữa value")).toBeInTheDocument();
    expect(screen.getByText("4200.0")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ngày" })).toHaveAttribute("aria-selected", "true");
    expect(vi.mocked(mpRequest).mock.calls.every((call) => call[0] === "/plans")).toBe(true);
  });

  it("toggles a managed alert through its authenticated endpoint", async () => {
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    fireEvent.click(await screen.findByRole("button", { name: "Tắt alert" }));
    await waitFor(() => expect(mpRequest).toHaveBeenCalledWith("/alerts/mp_test", "PATCH", { enabled: false }));
  });

  it("keeps a deleted alert in plan history and only restores it on explicit rearm", async () => {
    const deleted = data();
    deleted.plans[0].alerts[0].enabled = false;
    deleted.plans[0].alerts[0].status = "deleted";
    vi.mocked(mpRequest).mockResolvedValue(deleted);
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    expect(await screen.findByText("Đã xóa")).toBeInTheDocument();
    expect(vi.mocked(mpRequest).mock.calls.every((call) => call[0] === "/plans")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Bật lại" }));
    await waitFor(() => expect(mpRequest).toHaveBeenCalledWith("/alerts/mp_test", "PATCH", { enabled: true }));
  });

  it("lets the user explicitly retry a failed slot", async () => {
    const failed = data(); failed.plans = []; failed.run = { id: "2026-10-27:eu", status: "failed", error: "Previous request failed" };
    vi.mocked(mpRequest).mockResolvedValue(failed);
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    const retry = await screen.findByRole("button", { name: "Thử lại phiên này" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(mpRequest).toHaveBeenCalledWith("/plans/run", "POST"));
  });

  it("lets the user reread a completed session with its latest revision token", async () => {
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    const refresh = await screen.findByRole("button", { name: "Đọc lại phiên hiện tại" });
    expect(refresh).toBeEnabled();
    fireEvent.click(refresh);
    await waitFor(() => expect(mpRequest).toHaveBeenCalledWith("/plans/refresh", "POST", {
      expectedRunId: "2026-10-27:eu",
    }));
    expect(mpRequest).not.toHaveBeenCalledWith("/plans/run", "POST");
  });

  it.each(["running", "retry_pending"])("disables another read while the session is %s", async (status) => {
    const busy = data(); busy.run!.status = status;
    vi.mocked(mpRequest).mockResolvedValue(busy);
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    expect(await screen.findByRole("button", { name: "Đang đọc plan…" })).toBeDisabled();
    expect(vi.mocked(mpRequest).mock.calls.every((call) => call[0] === "/plans")).toBe(true);
  });

  it("shows the queued refresh and switches to the current session", async () => {
    let current = data();
    vi.mocked(mpRequest).mockImplementation(async (path) => {
      if (path === "/plans/refresh") current = {
        ...current, run: { id: "2026-10-27:eu:refresh:1", status: "retry_pending", error: null },
      };
      return current as never;
    });
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    fireEvent.click(await screen.findByRole("button", { name: "Đọc lại phiên hiện tại" }));
    expect(await screen.findByText("Đã nhận yêu cầu chạy lại, đang chuẩn bị bối cảnh…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang đọc plan…" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Âu" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps expired plans readable and prevents rearming expired alerts", async () => {
    const expired = data(); expired.plans[0].expired = true; expired.plans[0].alerts[0].status = "expired";
    expired.plans[0].alerts[0].enabled = false;
    vi.mocked(mpRequest).mockResolvedValue(expired);
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    expect(await screen.findByText("Cân bằng trong value hôm trước")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bật alert" })).toBeDisabled();
    expect(screen.getByText("Hết hạn")).toBeInTheDocument();
  });

  it("opens a linked session report instead of the default day tab", async () => {
    const linked = data(); linked.plans[0].scope = "eu"; linked.plans[0].id = "2026-10-27:eu:eu";
    vi.mocked(mpRequest).mockResolvedValue(linked);
    window.history.replaceState({}, "", "/mp?planId=2026-10-27:eu:eu");
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Âu" })).toHaveAttribute("aria-selected", "true"));
  });

  it("shows fixed UTC+7 windows and the configured Extra High reasoning", async () => {
    const current = data();
    current.settings.llm = { model: "cx/gpt-6.1-sol", reasoningEffort: "xhigh" };
    vi.mocked(mpRequest).mockResolvedValue(current);
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    expect(await screen.findByText(/Reasoning Extra High/)).toBeInTheDocument();
    expect(screen.getByText(/Á 07:00–12:00 · Âu 12:30–22:00 · Mỹ 20:00–04:00/)).toBeInTheDocument();
  });

  it("keeps a previous plan readable while preventing rearming its superseded alerts", async () => {
    const previous = data();
    previous.plans[0].alerts[0].status = "superseded";
    previous.plans[0].alerts[0].enabled = false;
    vi.mocked(mpRequest).mockResolvedValue(previous);
    render(<MarketProfilePlanner api={api} ws="ws://localhost/ws/chart" />);
    expect(await screen.findByText("Đã chuyển sang plan mới")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bật alert" })).toBeDisabled();
    expect(screen.getByText("Cân bằng trong value hôm trước")).toBeInTheDocument();
  });
});
