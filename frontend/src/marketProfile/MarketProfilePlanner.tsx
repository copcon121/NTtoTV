import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiClient } from "../api/client";
import { AuthDialog, type AuthDialogMode } from "../auth/AuthDialog";
import { ChartSocket } from "../socket/ChartSocket";
import type { AlertEventMessage } from "../socket/messages";
import { mpRequest, type MpPlanAlert, type MpPlannerState, type PlanScope } from "./plannerApi";

const SCOPE_LABELS: Record<PlanScope, string> = { daily: "Ngày", asia: "Á", eu: "Âu", us: "Mỹ" };
const ALERT_LABELS: Record<MpPlanAlert["status"], string> = {
  armed: "Đang theo dõi", fired: "Đã báo", disabled: "Đã tắt", expired: "Hết hạn", pending: "Chưa đặt",
  superseded: "Đã chuyển sang plan mới", deleted: "Đã xóa",
};
const clock = (time: number) => new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short",
}).format(time);

export function MarketProfilePlanner({ api, ws }: { api: ApiClient; ws: string }) {
  const [user, setUser] = useState<{ id: string; username: string } | null>();
  const [state, setState] = useState<MpPlannerState>();
  const [scope, setScope] = useState<PlanScope>("daily");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthDialogMode>("login");
  const [toast, setToast] = useState<AlertEventMessage>();
  const [telegram, setTelegram] = useState<boolean>();
  const [collapsed, setCollapsed] = useState(false);
  const handled = useRef(new Set<string>());
  const deepLinkHandled = useRef(false);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    const data = await mpRequest<MpPlannerState>("/plans");
    if (!mounted.current) return;
    setState(data);
    if (!deepLinkHandled.current) {
      const id = new URLSearchParams(window.location.search).get("planId");
      const linked = data.plans.find((p) => p.id === id);
      if (linked) { setScope(linked.scope); setDate(linked.tradeDate); }
      deepLinkHandled.current = true;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void api.me().then((value) => {
      if (mounted.current) setUser(value ?? null);
    }).catch((e: Error) => { if (mounted.current) setError(e.message); });
    return () => { mounted.current = false; };
  }, [api]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () => { void reload().catch((e: Error) => { if (active) setError(e.message); }); };
    refresh();
    void api.telegramConfig(user.id).then((value) => {
      if (active) setTelegram(value.enabled && value.hasBotToken && Boolean(value.chatId));
    }).catch(() => { if (active) setTelegram(false); });
    const interval = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [api, user, reload]);

  useEffect(() => {
    if (!user) return;
    const socket = new ChartSocket({ url: ws });
    const off = socket.on("alert_event", (event) => {
      if (event.profileId !== user.id || !event.alertId.startsWith("mp_")) return;
      const key = `${event.alertId}:${event.time}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      if (handled.current.size > 300) handled.current.delete(handled.current.values().next().value!);
      setToast(event);
      playSound();
      void reload().catch(() => {});
    });
    socket.subscribe("GC", ["alert_event"]);
    socket.connect();
    const timer = window.setInterval(() => socket.ensureConnected(), 5000);
    return () => { window.clearInterval(timer); off(); socket.close(); };
  }, [user, ws, reload]);

  const action = async (work: () => Promise<unknown>) => {
    setPending(true); setError("");
    try { await work(); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPending(false); }
  };

  const selectedDate = date || state?.currentSlot?.tradeDate
    || state?.tradingDays[state.tradingDays.length - 1]?.tradeDate || "";
  const plan = state?.plans.find((p) => p.tradeDate === selectedDate && p.scope === scope);
  const dates = [...new Set([...(state?.tradingDays.map((d) => d.tradeDate) ?? []),
    ...(state?.plans.map((p) => p.tradeDate) ?? [])])].sort().reverse();

  return <aside className={`mp-planner${collapsed ? " is-collapsed" : ""}`} aria-label="MP Planner">
    <div className="mp-planner-heading">
      <div><strong>MP Planner</strong><small>Plan ngày · Á · Âu · Mỹ</small></div>
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
        {collapsed ? "Mở plan" : "Thu gọn"}
      </button>
    </div>
    {!collapsed && <div className="mp-planner-body">
      <p className="mp-planner-muted">LLM đọc TPO, Volume Profile và nến daily. Alert nhắc anh quan sát vùng giá trong plan.</p>
      {user === undefined && !error && <p>Đang kiểm tra tài khoản…</p>}
      {user === null && <button type="button" onClick={() => setAuthOpen(true)}>Đăng nhập để dùng planner</button>}
      {user && <>
        <div className="mp-planner-controls">
          <span>{user.username}</span>
          <button type="button" disabled={pending || !state || (!state.settings.available && !state.settings.enabled)}
            onClick={() => void action(() => mpRequest("/settings", "PUT", { enabled: !state?.settings.enabled }))}>
            {state?.settings.enabled ? "Tắt plan + alert" : "Bật plan + alert"}
          </button>
          <button type="button" disabled={pending || !state?.settings.enabled || !state.currentSlot
            || Boolean(state.run && !["waiting", "failed"].includes(state.run.status))}
            onClick={() => void action(() => mpRequest("/plans/run", "POST"))}>
            {state?.run?.status === "failed" ? "Thử lại phiên này" : "Tạo plan phiên hiện tại"}
          </button>
        </div>
        <p className="mp-planner-muted">UTC+7: Á 07:00–12:00 · Âu 12:30–22:00 · Mỹ 20:00–04:00 hôm sau. Đọc ở đầu mỗi phiên; đầu Á tạo thêm plan ngày.</p>
        <p className="mp-planner-muted">Plan ngày là bối cảnh. Alert theo plan phiên mới nhất, tối đa 2 vùng ưu tiên; có thể không đặt khi chưa rõ.</p>
        {state?.settings.llm?.model && <p className="mp-planner-muted">{state.settings.llm.model} · Reasoning {state.settings.llm.reasoningEffort === "xhigh" ? "Extra High" : state.settings.llm.reasoningEffort}</p>}
        {state?.currentSlot && <p className="mp-planner-muted">Phiên {SCOPE_LABELS[state.currentSlot.name]}: {clock(state.currentSlot.start)} – {clock(state.currentSlot.end)} (UTC+7)</p>}
        {(state?.activeSlots?.length ?? 0) > 1 && <p className="mp-planner-muted">Âu và Mỹ cùng đang mở. Khi plan Mỹ sẵn sàng, alert chuyển sang plan Mỹ.</p>}
        {state && !state.settings.available && <p role="status">Chưa cấu hình LLM cho backend.</p>}
        {telegram === false && <p className="mp-planner-warning">Telegram của profile này chưa bật hoặc chưa cấu hình đủ. Có thể cấu hình trong Alerts trên chart chính.</p>}
        {state?.run?.status === "running" && <p role="status">LLM đang đọc bối cảnh và tạo plan…</p>}
        {state?.run?.status === "retry_pending" && <p role="status">Đã nhận yêu cầu chạy lại, đang chuẩn bị bối cảnh…</p>}
        {state?.run?.error && <p className="mp-planner-warning">{state.run.error}</p>}
        <label className="mp-planner-date">Ngày GC <select aria-label="Ngày kế hoạch" value={selectedDate} onChange={(e) => setDate(e.target.value)}>
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select></label>
        <div className="mp-planner-tabs" role="tablist" aria-label="Kế hoạch MP">
          {(Object.keys(SCOPE_LABELS) as PlanScope[]).map((key) => <button key={key} type="button" role="tab"
            aria-selected={scope === key} onClick={() => setScope(key)}>{SCOPE_LABELS[key]}</button>)}
        </div>
        {!plan && <p className="mp-planner-muted">Chưa có plan {SCOPE_LABELS[scope]} cho ngày này. Bật planner để tạo tự động ở đầu phiên.</p>}
        {plan && <article className="mp-plan" aria-label={`Plan ${SCOPE_LABELS[scope]}`}>
          <div className="mp-plan-time">Bối cảnh lúc {clock(plan.asOf)}{plan.createdLate ? " · Tạo bù giữa phiên" : ""}
            <br />{plan.expired ? "Đã hết hạn" : "Hiệu lực đến"} {clock(plan.expiresAt)}</div>
          {plan.legacySchedule && <p className="mp-planner-warning">Bản này dùng lịch phiên cũ. Alert đã ngừng; xem plan mới theo UTC+7.</p>}
          <p className="mp-plan-summary">{plan.summary}</p>
          <h3>Đọc Market Profile</h3><p>{plan.mpRead}</p>
          <h3>Nến daily</h3><p>{plan.dailyRead}</p>
          <h3>Kịch bản theo dõi</h3>
          {plan.scenarios.map((scenario, i) => <section className="mp-plan-scenario" key={i}>
            <strong>{scenario.title}</strong><p>{scenario.condition}</p><p>{scenario.action}</p>
            <p className="mp-planner-muted">Vô hiệu: {scenario.invalidation}</p>
          </section>)}
          <h3>Điều kiện cần xem lại</h3><p>{plan.invalidation}</p>
          <h3>Alert từ plan</h3>
          {plan.alerts.length === 0 && <p className="mp-planner-muted">{scope === "daily" ? "Plan ngày cung cấp bối cảnh; alert nằm trong plan phiên." : "Chưa chọn vùng có đủ cơ sở để đặt alert."}</p>}
          {plan.alerts.map((alert) => <div className="mp-plan-alert" key={alert.levelRef}>
            <div><strong>{alert.price.toFixed(1)}</strong><span>{ALERT_LABELS[alert.status]}</span></div>
            <small>{alert.label} · {alert.source}</small><p>{alert.reason}</p><p>{alert.scenario}</p>
            <button type="button" disabled={pending || !alert.alertId || plan.expired || alert.status === "superseded" || !state?.settings.enabled}
              onClick={() => void action(() => mpRequest(`/alerts/${alert.alertId}`, "PATCH", { enabled: !alert.enabled }))}>
              {alert.enabled ? "Tắt alert" : ["fired", "deleted"].includes(alert.status) ? "Bật lại" : "Bật alert"}
            </button>
          </div>)}
          <details className="mp-planner-quality"><summary>Nguồn và chất lượng dữ liệu</summary>
            <p>Volume VA là mốc chính. Volume theo giá và TPO được dựng từ nến 1 phút; lịch tin chưa tích hợp.</p>
            {plan.dataQuality.map((line, i) => <p key={i}>{line}</p>)}
          </details>
        </article>}
      </>}
      {error && <p className="mp-planner-error" role="alert">{error}</p>}
    </div>}
    {toast && <div className="mp-planner-toast" role="alert">
      <button type="button" aria-label="Đóng thông báo MP" onClick={() => setToast(undefined)}>×</button>
      <strong>GC {toast.price.toFixed(1)}</strong><p>{toast.message}</p>
    </div>}
    <AuthDialog open={authOpen} mode={authMode} pending={pending} error={error} onModeChange={setAuthMode}
      onClose={() => setAuthOpen(false)} onSubmit={(input) => {
        setPending(true); setError("");
        const request = input.mode === "login" ? api.login(input.username, input.password)
          : api.register(input.username, input.password, input.inviteCode);
        void request.then((value) => { setUser(value); setAuthOpen(false); })
          .catch((e: Error) => setError(e.message)).finally(() => setPending(false));
      }} />
  </aside>;
}

function playSound() {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.frequency.value = 740; gain.gain.value = 0.08;
    oscillator.start(); oscillator.stop(audio.currentTime + 0.2);
    oscillator.onended = () => { void audio.close(); };
  } catch { /* Visual and Telegram alerts remain available without audio. */ }
}
