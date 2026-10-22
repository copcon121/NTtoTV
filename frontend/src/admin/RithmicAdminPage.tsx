import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  type RithmicConnectionOutcome,
  type RithmicAdminConfig,
  type RithmicAdminSnapshot,
  type RithmicLoginTestResponse,
  type RithmicPlantLoginResult,
  rithmicAdminApi,
} from "./rithmicAdminApi";

type FormConfig = RithmicAdminConfig & { password: string; weeklyGb: number };

function Tooltip({ text }: { text: string }) {
  return (
    <span className="admin-tooltip" tabIndex={0} aria-label={`Giải thích: ${text}`}>
      ?<span role="tooltip">{text}</span>
    </span>
  );
}

function Field({ label, help, locked = false, children }: {
  label: string; help: string; locked?: boolean; children: ReactNode;
}) {
  return <label className="admin-field">
    <span className="admin-field-label">{label}<Tooltip text={help} />{locked && <em>Khóa</em>}</span>
    {children}
  </label>;
}

function asForm(config: RithmicAdminConfig): FormConfig {
  return {
    ...config,
    password: "",
    weeklyGb: Number((config.historyWeeklyByteLimit / 1_000_000_000).toFixed(2)),
  };
}

export function adminPayload(form: FormConfig): Record<string, unknown> {
  const { stored: _stored, passwordConfigured: _passwordConfigured, weeklyGb, ...rest } = form;
  return { ...rest, password: form.password, historyWeeklyByteLimit: Math.round(weeklyGb * 1_000_000_000) };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function runtimeParts(snapshot?: RithmicAdminSnapshot) {
  const market = record(snapshot?.runtime.marketData);
  const rithmic = record(record(market.sources).rithmic);
  const history = record(market.historySync);
  return { market, rithmic, history };
}

function statusLabel(snapshot?: RithmicAdminSnapshot): { text: string; tone: string } {
  if (!snapshot?.runtime.marketServiceRunning) return { text: "Disconnected", tone: "off" };
  const { market, rithmic, history } = runtimeParts(snapshot);
  if (!rithmic.connected && rithmic.lastError) return { text: "Login failed", tone: "warn" };
  if (rithmic.connected && !snapshot.config.historyEnabled) return { text: "Connected", tone: "ready" };
  if (market.activeSource === "rithmic" && history.state === "synced") return { text: "Ready", tone: "ready" };
  if (rithmic.connected && history.lastError) return { text: "History failed", tone: "warn" };
  if (rithmic.connected) return { text: "History syncing", tone: "sync" };
  return { text: "Connecting / Degraded", tone: "warn" };
}

function runtimePlantLabels(snapshot?: RithmicAdminSnapshot) {
  if (!snapshot) return { ticker: "STOPPED", tickerTone: "", history: "STOPPED", historyTone: "" };
  const { rithmic, history } = runtimeParts(snapshot);
  const ticker = rithmic.connected
    ? "CONNECTED"
    : rithmic.lastError
      ? "ERROR"
      : snapshot.runtime.marketServiceRunning ? "CONNECTING" : "STOPPED";
  const historyText = !snapshot.config.historyEnabled
    ? "OFF"
    : history.connected
      ? history.state === "synced" ? "SYNCED" : "CONNECTED"
      : history.lastError
        ? "ERROR"
        : snapshot.runtime.historyServiceRunning ? "CONNECTING" : "STOPPED";
  return {
    ticker,
    tickerTone: ticker === "CONNECTED" ? "ok" : ticker === "ERROR" ? "error" : "pending",
    history: historyText,
    historyTone: ["CONNECTED", "SYNCED"].includes(historyText) ? "ok" : historyText === "ERROR" ? "error" : "pending",
  };
}

function plantTestText(result?: RithmicPlantLoginResult): string {
  if (!result) return "Không nhận được phản hồi riêng từ plant";
  const code = result.rpCode?.length ? result.rpCode.join(", ") : "không có";
  return result.ok ? `Đăng nhập thành công · rpCode ${code}` : `Đăng nhập thất bại · rpCode ${code}`;
}

function LoginTestFeedback({ result }: { result: RithmicLoginTestResponse }) {
  const ticker = result.result?.tickerPlant;
  const history = result.result?.historyPlant;
  return <div className={`admin-operation ${result.ok ? "success" : "error"}`} role="status">
    <strong>{result.ok ? "Test login thành công" : "Test login thất bại"}</strong>
    {result.error && <span>{result.error}</span>}
    <div className="admin-operation-plants">
      <span><b>Ticker Plant</b><em className={ticker?.ok ? "ok" : "error"}>{plantTestText(ticker)}</em></span>
      <span><b>History Plant</b><em className={history?.ok ? "ok" : "error"}>{plantTestText(history)}</em></span>
    </div>
  </div>;
}

function ConnectFeedback({ result }: { result: RithmicConnectionOutcome }) {
  const history = result.historyPlant;
  return <div className={`admin-operation ${result.ok ? "success" : "error"}`} role="status">
    <strong>{result.ok ? "Kết nối Rithmic thành công" : "Kết nối Rithmic chưa thành công"}</strong>
    <span>{result.message}</span>
    <div className="admin-operation-plants">
      <span><b>Ticker Plant</b><em className={result.tickerPlant.connected ? "ok" : "error"}>{result.tickerPlant.connected ? "CONNECTED" : result.tickerPlant.error || "NOT CONNECTED"}</em></span>
      <span><b>History Plant</b><em className={!history.enabled ? "off" : history.connected ? "ok" : "error"}>{!history.enabled ? "OFF" : history.connected ? String(history.state || "CONNECTED").toUpperCase() : history.error || "NOT CONNECTED"}</em></span>
    </div>
  </div>;
}

export function RithmicAdminPage() {
  const safeTransport = window.isSecureContext || ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const [snapshot, setSnapshot] = useState<RithmicAdminSnapshot>();
  const [form, setForm] = useState<FormConfig>();
  const [dirty, setDirty] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [username, setUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [testResult, setTestResult] = useState<RithmicLoginTestResponse>();
  const [connectResult, setConnectResult] = useState<RithmicConnectionOutcome>();
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async (poll = false) => {
    try {
      const auth = await rithmicAdminApi.me();
      if (auth.user.mustChangePassword) {
        setPasswordChangeRequired(true);
        setLoginRequired(false);
        setForbidden(false);
        return;
      }
      const next = await rithmicAdminApi.snapshot();
      setSnapshot(next);
      if (!poll || !dirty) setForm(asForm(next.config));
      setLoginRequired(false);
      setPasswordChangeRequired(false);
      setForbidden(false);
    } catch (caught) {
      if (caught instanceof AdminApiError && caught.status === 401) setLoginRequired(true);
      else if (caught instanceof AdminApiError && caught.status === 403) setForbidden(true);
      else if (!poll) setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [dirty]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (loginRequired || passwordChangeRequired || forbidden) return;
    const timer = window.setInterval(() => void load(true), 2500);
    return () => window.clearInterval(timer);
  }, [load, loginRequired, passwordChangeRequired, forbidden]);

  const set = <K extends keyof FormConfig>(key: K, value: FormConfig[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setDirty(true);
  };
  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name); setError(undefined); setNotice(undefined);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(undefined); }
  };
  const save = async () => {
    if (!form) return;
    const result = await rithmicAdminApi.save(adminPayload(form));
    setForm(asForm(result.config));
    setDirty(false);
    setNotice("Đã lưu cấu hình an toàn trên VPS.");
    await load();
  };
  const state = useMemo(() => statusLabel(snapshot), [snapshot]);
  const plantLabels = useMemo(() => runtimePlantLabels(snapshot), [snapshot]);

  if (loginRequired) return <AdminLogin
    username={username} password={loginPassword} busy={!!busy} error={error}
    safeTransport={safeTransport}
    setUsername={setUsername} setPassword={setLoginPassword}
    onSubmit={(event) => {
      event.preventDefault();
      void run("login", async () => {
        const result = await rithmicAdminApi.login(username.trim(), loginPassword);
        setLoginPassword("");
        if (result.user.mustChangePassword) {
          setLoginRequired(false);
          setPasswordChangeRequired(true);
        } else {
          await load();
        }
      });
    }}
  />;
  if (passwordChangeRequired) return <AdminPasswordChange
    busy={!!busy} error={error}
    onSubmit={(currentPassword, newPassword) => void run("password", async () => {
      await rithmicAdminApi.changePassword(currentPassword, newPassword);
      setPasswordChangeRequired(false);
      setNotice("Đã đổi mật khẩu quản trị. Mật khẩu tạm không còn hiệu lực.");
      await load();
    })}
  />;
  if (forbidden) return <main className="admin-login-shell"><section className="admin-login-card">
    <div className="admin-kicker">403 · OWNER ONLY</div><h1>Không có quyền quản trị</h1>
    <p>Chỉ tài khoản đầu tiên của hệ thống được phép thay đổi kết nối Rithmic.</p><a href="/">← Về biểu đồ</a>
  </section></main>;
  if (!form) return <main className="admin-loading">Đang tải Rithmic Control Center…</main>;

  const marketData = snapshot?.runtime.marketData ?? {};
  return <main className="rithmic-admin">
    <header className="admin-header"><div><div className="admin-kicker">GC FLOW · ORACLE VPS</div>
      <h1>Rithmic Control Center</h1><p>Cấu hình, kiểm tra entitlement và điều khiển connector mà không cần dùng Linux terminal.</p>
    </div><div className="admin-header-actions"><span className={`admin-status ${state.tone}`}><i />{state.text}</span><a href="/">Mở biểu đồ ↗</a></div></header>
    <div className="admin-runtime-strip"><span>Ticker Plant <b className={plantLabels.tickerTone}>{plantLabels.ticker}</b></span><span>History Plant <b className={plantLabels.historyTone}>{plantLabels.history}</b></span><span>Physical contract <b>{form.physicalContract}</b></span><span>Auto-connect <b>{form.autoConnect ? "ON" : "OFF"}</b></span></div>
    {(error || notice) && <div className={`admin-message ${error ? "error" : "success"}`}>{error ?? notice}</div>}
    <form onSubmit={(event) => { event.preventDefault(); void run("save", save); }}>
      <AdminSection number="01" title="Connection & login" subtitle="Endpoint và thông tin đăng nhập Paper.">
        <Field label="WebSocket URI" help="Máy chủ Rithmic Protocol Gateway. Paper mobile hiện dùng wss://rprotocol-mobile.rithmic.com:443."><input value={form.websocketUri} onChange={(e) => set("websocketUri", e.currentTarget.value)} /></Field>
        <Field label="Rithmic user" help="Tên đăng nhập tài khoản Rithmic Paper do broker/Rithmic cung cấp."><input autoComplete="username" value={form.user} onChange={(e) => set("user", e.currentTarget.value)} /></Field>
        <Field label="Rithmic password" help="Secret được lưu riêng với quyền 0600. Để trống khi lưu sẽ giữ nguyên mật khẩu hiện có."><div className="admin-password"><input type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={form.passwordConfigured ? "Đã lưu — để trống để giữ nguyên" : "Chưa cấu hình"} value={form.password} onChange={(e) => set("password", e.currentTarget.value)} /><button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Ẩn" : "Hiện"}</button></div></Field>
        <Field label="Template ID" help="Mã message RequestLogin của Rithmic protocol. Connector này yêu cầu cố định là 10." locked><input readOnly value={form.templateId} /></Field>
        <Field label="Template version" help="Phiên bản schema protobuf mà client khai báo với Rithmic. Mặc định tương thích hiện tại là 5.55."><input value={form.templateVersion} onChange={(e) => set("templateVersion", e.currentTarget.value)} /></Field>
        <Field label="User message" help="Chuỗi chẩn đoán tùy chọn gửi trong login request để nhận diện phiên connector."><input value={form.userMessage} onChange={(e) => set("userMessage", e.currentTarget.value)} /></Field>
      </AdminSection>
      <AdminSection number="02" title="Application identity" subtitle="Danh tính ứng dụng phải được entitlement Rithmic chấp thuận.">
        <Field label="App name" help="Tên ứng dụng đã đăng ký hoặc được Rithmic/broker cấp quyền. Phải dùng đúng identity đã được cấp phép."><input value={form.appName} onChange={(e) => set("appName", e.currentTarget.value)} /></Field>
        <Field label="App version" help="Phiên bản connector gửi kèm login để Rithmic nhận dạng client."><input value={form.appVersion} onChange={(e) => set("appVersion", e.currentTarget.value)} /></Field>
        <Field label="System name" help="Môi trường đúng như Rithmic công bố; tài khoản Paper thường dùng Rithmic Paper Trading."><input value={form.systemName} onChange={(e) => set("systemName", e.currentTarget.value)} /></Field>
        <Field label="Ticker infra type" help="Plant nhận realtime L1/L2/MBO. Cố định là 1; GUI không cho phép Order Plant." locked><input readOnly value={form.tickerInfraType} /></Field>
        <Field label="History infra type" help="Plant tải minute bars và volume profile lịch sử. Cố định là 3." locked><input readOnly value={form.historyInfraType} /></Field>
        <Field label="Aggregated quotes" help="Yêu cầu gộp quote khi đăng nhập Ticker Plant. Giữ tắt để dùng luồng trực tiếp chi tiết."><Toggle checked={form.aggregatedQuotes} onChange={(value) => set("aggregatedQuotes", value)} /></Field>
      </AdminSection>
      <AdminSection number="03" title="Client fingerprint" subtitle="Các trường fingerprint gửi nguyên trạng tới Rithmic.">
        <Field label="MAC address" help="MAC client gửi trong RequestLogin. Có thể nhập nhiều địa chỉ, cách nhau bằng dấu phẩy hoặc xuống dòng."><textarea rows={3} value={form.macAddresses.join("\n")} onChange={(e) => set("macAddresses", e.currentTarget.value.split(/[\s,]+/).filter(Boolean))} /></Field>
        <Field label="OS platform" help="Tên nền tảng client khai báo với Rithmic. Đây là field protocol, không tự phát hiện VPS."><input value={form.osPlatform} onChange={(e) => set("osPlatform", e.currentTarget.value)} /></Field>
        <Field label="OS version" help="Chuỗi phiên bản hệ điều hành gửi trong login; có thể giữ giá trị compatibility đã kiểm tra."><input value={form.osVersion} onChange={(e) => set("osVersion", e.currentTarget.value)} /></Field>
      </AdminSection>
      <AdminSection number="04" title="Market subscription" subtitle="Instrument realtime và điều kiện đạt trạng thái ready.">
        <Field label="Exchange" help="Exchange code dùng trong subscription Rithmic, ví dụ COMEX cho Gold Futures."><input value={form.exchange} onChange={(e) => set("exchange", e.currentTarget.value)} /></Field>
        <Field label="Wire symbol" help="Mã instrument gửi tới Rithmic, thường là mã expiry dạng GCZ6."><input value={form.wireSymbol} onChange={(e) => set("wireSymbol", e.currentTarget.value)} /></Field>
        <Field label="Physical contract" help="Tên contract vật lý lưu cho raw realtime, ví dụ GC 12-26. Chart vẫn dùng logical contract GC."><input value={form.physicalContract} onChange={(e) => set("physicalContract", e.currentTarget.value)} /></Field>
        <Field label="Market data modes" help="L1 là giá/last, L2 là market depth, MBO là market-by-order. Cả ba là bắt buộc để hệ thống đạt Ready." locked><span className="admin-checks">{["l1", "l2", "mbo"].map((mode) => <label key={mode}><input type="checkbox" checked disabled />{mode.toUpperCase()}</label>)}</span></Field>
        <Field label="Qualification seconds" help="Số giây feed phải ổn định liên tục trước khi thành nguồn authoritative."><input type="number" min={0} max={300} value={form.qualificationSeconds} onChange={(e) => set("qualificationSeconds", Number(e.currentTarget.value))} /></Field>
      </AdminSection>
      <AdminSection number="05" title="History & recovery" subtitle="Tự lấp gap bằng History Plant, không dùng file NT.">
        <Field label="History Plant" help="Bật client History Plant độc lập để tải minute bars/volume profile và tự sửa gap."><Toggle checked={form.historyEnabled} onChange={(value) => set("historyEnabled", value)} /></Field>
        <Field label="Audit interval (seconds)" help="Chu kỳ rà soát 24 giờ gần nhất để tìm và xếp hàng các phút bị thiếu."><input type="number" min={30} max={86400} value={form.historyAuditSeconds} onChange={(e) => set("historyAuditSeconds", Number(e.currentTarget.value))} /></Field>
        <Field label="Initial lookback (days)" help="Số ngày lịch sử tối đa được seed khi database chưa có high-watermark."><input type="number" min={1} max={365} value={form.historyLookbackDays} onChange={(e) => set("historyLookbackDays", Number(e.currentTarget.value))} /></Field>
        <Field label="Weekly download limit (GB)" help="Ngưỡng tự dừng trước hạn mức tải history mỗi tuần; GUI giới hạn từ 0.1 đến 40 GB."><input type="number" min={0.1} max={40} step={0.1} value={form.weeklyGb} onChange={(e) => set("weeklyGb", Number(e.currentTarget.value))} /></Field>
        <Field label="Auto-connect after reboot" help="Nếu bật, systemd tự khởi động Rithmic bằng cấu hình đã lưu sau khi VPS reboot."><Toggle checked={form.autoConnect} onChange={(value) => set("autoConnect", value)} /></Field>
      </AdminSection>
      <section className="admin-actions"><div className="admin-action-copy"><b>{dirty ? "Có thay đổi chưa lưu" : "Cấu hình đã đồng bộ"}</b><small>Test mở đồng thời Ticker + History Plant. Hãy Disconnect trước nếu connector đang chạy.</small>
        {testResult && <LoginTestFeedback result={testResult} />}
        {connectResult && <ConnectFeedback result={connectResult} />}
      </div><div className="admin-buttons">
        <button type="submit" disabled={!!busy}>{busy === "save" ? "Đang lưu…" : "Save config"}</button>
        <button type="button" disabled={!!busy || !!snapshot?.runtime.marketServiceRunning} onClick={() => void run("test", async () => { const result = await rithmicAdminApi.test(adminPayload(form)); setTestResult(result); setConnectResult(undefined); if (result.ok) setNotice("Test login thành công trên cả Ticker Plant và History Plant."); else setError(`Test login thất bại: ${result.error || "Rithmic từ chối đăng nhập"}`); })}>{busy === "test" ? "Đang test…" : "Test login"}</button>
        <button type="button" className="admin-primary" disabled={!!busy} onClick={() => void run("connect", async () => { setTestResult(undefined); await save(); const next = await rithmicAdminApi.connect(); setSnapshot(next); setForm(asForm(next.config)); setDirty(false); setConnectResult(next.connection); if (next.ok) setNotice("Rithmic đã xác nhận kết nối thành công."); else setError(`Kết nối chưa thành công: ${next.connection?.message || "chưa nhận được xác nhận login"}`); })}>{busy === "connect" ? "Đang chờ xác nhận…" : "Save & connect"}</button>
        <button type="button" className="admin-danger" disabled={!!busy || !snapshot?.runtime.marketServiceRunning} onClick={() => void run("disconnect", async () => { const next = await rithmicAdminApi.disconnect(); setSnapshot(next); setForm(asForm(next.config)); setDirty(false); setConnectResult(undefined); setNotice("Đã ngắt Rithmic và tắt auto-connect."); })}>Disconnect</button>
      </div></section>
    </form>
    <details className="admin-diagnostics"><summary>Runtime diagnostics</summary><pre>{JSON.stringify(marketData, null, 2)}</pre></details>
  </main>;
}

function AdminSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: ReactNode }) {
  return <section className="admin-card"><div className="admin-section-title"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="admin-grid">{children}</div></section>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <span className="admin-switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} /><span>{checked ? "Bật" : "Tắt"}</span></span>;
}

function AdminLogin({ username, password, busy, error, safeTransport, setUsername, setPassword, onSubmit }: {
  username: string; password: string; busy: boolean; error?: string; safeTransport: boolean;
  setUsername: (value: string) => void; setPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <main className="admin-login-shell"><form className="admin-login-card" onSubmit={onSubmit}>
    <div className="admin-kicker">GC FLOW · OWNER</div><h1>Đăng nhập quản trị</h1>
    <p>Dùng tài khoản đầu tiên đã tạo trên hệ thống. Khu vực này chứa cấu hình kết nối Rithmic.</p>
    {!safeTransport && <div className="admin-message error">IP hiện chỉ có HTTP. Vì an toàn, không nhập mật khẩu tại đây. Hãy chạy <b>OPEN-ORACLE-ADMIN.cmd</b> rồi mở địa chỉ localhost do công cụ cung cấp.</div>}
    <Field label="Tên đăng nhập" help="Tên tài khoản owner của GC Flow, không phải tài khoản Rithmic."><input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} /></Field>
    <Field label="Mật khẩu quản trị" help="Mật khẩu đăng nhập website GC Flow, không phải mật khẩu Rithmic."><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} /></Field>
    {error && <div className="admin-message error">{error}</div>}
    <button className="admin-primary" disabled={!safeTransport || busy || !username.trim() || !password}>Đăng nhập</button><a href="/">← Về biểu đồ</a>
  </form></main>;
}

function AdminPasswordChange({ busy, error, onSubmit }: {
  busy: boolean;
  error?: string;
  onSubmit: (currentPassword: string, newPassword: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = !!confirmPassword && newPassword !== confirmPassword;
  return <main className="admin-login-shell"><form className="admin-login-card" onSubmit={(event) => {
    event.preventDefault();
    if (!mismatch) onSubmit(currentPassword, newPassword);
  }}>
    <div className="admin-kicker">SECURITY · FIRST LOGIN</div><h1>Đổi mật khẩu lần đầu</h1>
    <p>Tài khoản đang dùng mật khẩu tạm. Bạn phải đặt mật khẩu riêng trước khi mở Rithmic Control Center.</p>
    <Field label="Mật khẩu tạm" help="Nhập lại mật khẩu tạm vừa dùng để đăng nhập."><input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.currentTarget.value)} /></Field>
    <Field label="Mật khẩu mới" help="Dùng ít nhất 8 ký tự và không trùng mật khẩu tạm. Nên dùng chuỗi dài, riêng biệt."><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.currentTarget.value)} /></Field>
    <Field label="Nhập lại mật khẩu mới" help="Nhập lại chính xác mật khẩu mới để tránh khóa nhầm tài khoản."><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.currentTarget.value)} /></Field>
    {mismatch && <div className="admin-message error">Hai lần nhập mật khẩu mới chưa giống nhau.</div>}
    {error && <div className="admin-message error">{error}</div>}
    <button className="admin-primary" disabled={busy || !currentPassword || newPassword.length < 8 || mismatch || !confirmPassword}>{busy ? "Đang cập nhật…" : "Đổi mật khẩu và tiếp tục"}</button>
  </form></main>;
}
