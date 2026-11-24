import { AiScanAdminSection } from "./AiScanAdminSection";
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
    <span className="admin-tooltip" tabIndex={0} aria-label={`Help: ${text}`}>
      ?<span role="tooltip">{text}</span>
    </span>
  );
}

function Field({ label, help, locked = false, children }: {
  label: string; help: string; locked?: boolean; children: ReactNode;
}) {
  return <label className="admin-field">
    <span className="admin-field-label">{label}<Tooltip text={help} />{locked && <em>Locked</em>}</span>
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
  if (!result) return "No separate response received from this plant";
  const code = result.rpCode?.length ? result.rpCode.join(", ") : "none";
  return result.ok ? `Login successful · rpCode ${code}` : `Login failed · rpCode ${code}`;
}

function LoginTestFeedback({ result }: { result: RithmicLoginTestResponse }) {
  const ticker = result.result?.tickerPlant;
  const history = result.result?.historyPlant;
  return <div className={`admin-operation ${result.ok ? "success" : "error"}`} role="status">
    <strong>{result.ok ? "Login test successful" : "Login test failed"}</strong>
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
    <strong>{result.ok ? "Rithmic connected successfully" : "Rithmic connection unsuccessful"}</strong>
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
    setNotice("Settings saved securely on the VPS.");
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
      setNotice("Admin password changed. The temporary password is no longer valid.");
      await load();
    })}
  />;
  if (forbidden) return <main className="admin-login-shell"><section className="admin-login-card">
    <div className="admin-kicker">403 · OWNER ONLY</div><h1>Admin access denied</h1>
    <p>Only the first account created on this system can change the Rithmic connection.</p><a href="/">← Back to chart</a>
  </section></main>;
  if (!form) return <main className="admin-loading">Loading Rithmic Control Center…</main>;

  const marketData = snapshot?.runtime.marketData ?? {};
  return <main className="rithmic-admin">
    <header className="admin-header"><div><div className="admin-kicker">GC FLOW · ORACLE VPS</div>
      <h1>Control Center</h1><p>Rithmic settings, market data status, and AI Scan connection.</p>
    </div><div className="admin-header-actions"><span className={`admin-status ${state.tone}`}><i />{state.text}</span><a href="/">Open chart ↗</a></div></header>
    <div className="admin-runtime-strip"><span>Ticker Plant <b className={plantLabels.tickerTone}>{plantLabels.ticker}</b></span><span>History Plant <b className={plantLabels.historyTone}>{plantLabels.history}</b></span><span>Physical contract <b>{form.physicalContract}</b></span><span>Auto-connect <b>{form.autoConnect ? "ON" : "OFF"}</b></span></div>
    {(error || notice) && <div className={`admin-message ${error ? "error" : "success"}`}>{error ?? notice}</div>}
    <form onSubmit={(event) => { event.preventDefault(); void run("save", save); }}>
      <AdminSection number="01" title="Connection & login" subtitle="Paper endpoint and login details.">
        <Field label="WebSocket URI" help="Rithmic Protocol Gateway server. Paper mobile currently uses wss://rprotocol-mobile.rithmic.com:443."><input value={form.websocketUri} onChange={(e) => set("websocketUri", e.currentTarget.value)} /></Field>
        <Field label="Rithmic user" help="Rithmic Paper username supplied by your broker or Rithmic."><input autoComplete="username" value={form.user} onChange={(e) => set("user", e.currentTarget.value)} /></Field>
        <Field label="Rithmic password" help="The secret is stored separately with 0600 permissions. Leave blank when saving to keep the current password."><div className="admin-password"><input type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={form.passwordConfigured ? "Saved — leave blank to keep the current password" : "Not configured"} value={form.password} onChange={(e) => set("password", e.currentTarget.value)} /><button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Hide" : "Show"}</button></div></Field>
        <Field label="Template ID" help="RequestLogin message ID in the Rithmic protocol. This connector requires a fixed value of 10." locked><input readOnly value={form.templateId} /></Field>
        <Field label="Template version" help="Protobuf schema version declared by the client to Rithmic. The current compatible default is 5.55."><input value={form.templateVersion} onChange={(e) => set("templateVersion", e.currentTarget.value)} /></Field>
        <Field label="User message" help="Optional diagnostic text sent in the login request to identify this connector session."><input value={form.userMessage} onChange={(e) => set("userMessage", e.currentTarget.value)} /></Field>
      </AdminSection>
      <AdminSection number="02" title="Application identity" subtitle="The application identity must have Rithmic entitlement approval.">
        <Field label="App name" help="Application name registered or authorized by Rithmic or your broker. Use the exact approved identity."><input value={form.appName} onChange={(e) => set("appName", e.currentTarget.value)} /></Field>
        <Field label="App version" help="Connector version sent with login so Rithmic can identify the client."><input value={form.appVersion} onChange={(e) => set("appVersion", e.currentTarget.value)} /></Field>
        <Field label="System name" help="Use the environment name exactly as published by Rithmic. Paper accounts usually use Rithmic Paper Trading."><input value={form.systemName} onChange={(e) => set("systemName", e.currentTarget.value)} /></Field>
        <Field label="Ticker infra type" help="Plant for realtime L1/L2/MBO. Fixed at 1; the interface does not allow Order Plant." locked><input readOnly value={form.tickerInfraType} /></Field>
        <Field label="History infra type" help="Plant for downloading historical minute bars and volume profiles. Fixed at 3." locked><input readOnly value={form.historyInfraType} /></Field>
        <Field label="Aggregated quotes" help="Request aggregated quotes when logging in to Ticker Plant. Leave off for the detailed direct feed."><Toggle checked={form.aggregatedQuotes} onChange={(value) => set("aggregatedQuotes", value)} /></Field>
      </AdminSection>
      <AdminSection number="03" title="Client fingerprint" subtitle="Fingerprint fields are sent unchanged to Rithmic.">
        <Field label="MAC address" help="Client MAC addresses sent in RequestLogin. Separate multiple addresses with commas or new lines."><textarea rows={3} value={form.macAddresses.join("\n")} onChange={(e) => set("macAddresses", e.currentTarget.value.split(/[\s,]+/).filter(Boolean))} /></Field>
        <Field label="OS platform" help="Client platform name declared to Rithmic. This is a protocol field; it does not detect the VPS platform automatically."><input value={form.osPlatform} onChange={(e) => set("osPlatform", e.currentTarget.value)} /></Field>
        <Field label="OS version" help="Operating system version string sent at login. You can keep the tested compatibility value."><input value={form.osVersion} onChange={(e) => set("osVersion", e.currentTarget.value)} /></Field>
      </AdminSection>
      <AdminSection number="04" title="Market subscription" subtitle="Realtime instrument and readiness requirements.">
        <Field label="Exchange" help="Exchange code used in Rithmic subscriptions, such as COMEX for Gold Futures."><input value={form.exchange} onChange={(e) => set("exchange", e.currentTarget.value)} /></Field>
        <Field label="Wire symbol" help="Instrument symbol sent to Rithmic, usually an expiry code such as GCZ6."><input value={form.wireSymbol} onChange={(e) => set("wireSymbol", e.currentTarget.value)} /></Field>
        <Field label="Physical contract" help="Physical contract name stored with raw realtime data, such as GC 12-26. Charts continue to use the logical contract GC."><input value={form.physicalContract} onChange={(e) => set("physicalContract", e.currentTarget.value)} /></Field>
        <Field label="Market data modes" help="L1 provides price/last trade, L2 provides market depth, and MBO provides market-by-order data. All three are required for Ready status." locked><span className="admin-checks">{["l1", "l2", "mbo"].map((mode) => <label key={mode}><input type="checkbox" checked disabled />{mode.toUpperCase()}</label>)}</span></Field>
        <Field label="Qualification seconds" help="Seconds the feed must remain continuously stable before becoming the authoritative source."><input type="number" min={0} max={300} value={form.qualificationSeconds} onChange={(e) => set("qualificationSeconds", Number(e.currentTarget.value))} /></Field>
      </AdminSection>
      <AdminSection number="05" title="History & recovery" subtitle="Repair gaps automatically through History Plant without NT files.">
        <Field label="History Plant" help="Enable an independent History Plant client to download minute bars and volume profiles and repair gaps automatically."><Toggle checked={form.historyEnabled} onChange={(value) => set("historyEnabled", value)} /></Field>
        <Field label="Audit interval (seconds)" help="Interval for auditing the trailing 24 hours and queuing missing minutes for repair."><input type="number" min={30} max={86400} value={form.historyAuditSeconds} onChange={(e) => set("historyAuditSeconds", Number(e.currentTarget.value))} /></Field>
        <Field label="Initial lookback (days)" help="Maximum days of history to seed when the database has no high-watermark."><input type="number" min={1} max={365} value={form.historyLookbackDays} onChange={(e) => set("historyLookbackDays", Number(e.currentTarget.value))} /></Field>
        <Field label="Weekly download limit (GB)" help="Stop automatically before reaching the weekly history download allowance. The interface accepts 0.1 to 40 GB."><input type="number" min={0.1} max={40} step={0.1} value={form.weeklyGb} onChange={(e) => set("weeklyGb", Number(e.currentTarget.value))} /></Field>
        <Field label="Auto-connect after reboot" help="When enabled, systemd starts Rithmic using the saved settings after the VPS reboots."><Toggle checked={form.autoConnect} onChange={(value) => set("autoConnect", value)} /></Field>
      </AdminSection>
      <section className="admin-actions"><div className="admin-action-copy"><b>{dirty ? "Unsaved changes" : "Settings synchronized"}</b><small>The test opens Ticker and History Plant together. Disconnect first if the connector is running.</small>
        {testResult && <LoginTestFeedback result={testResult} />}
        {connectResult && <ConnectFeedback result={connectResult} />}
      </div><div className="admin-buttons">
        <button type="submit" disabled={!!busy}>{busy === "save" ? "Saving…" : "Save config"}</button>
        <button type="button" disabled={!!busy || !!snapshot?.runtime.marketServiceRunning} onClick={() => void run("test", async () => { const result = await rithmicAdminApi.test(adminPayload(form)); setTestResult(result); setConnectResult(undefined); if (result.ok) setNotice("Login test successful on both Ticker Plant and History Plant."); else setError(`Login test failed: ${result.error || "Rithmic rejected the login"}`); })}>{busy === "test" ? "Testing…" : "Test login"}</button>
        <button type="button" className="admin-primary" disabled={!!busy} onClick={() => void run("connect", async () => { setTestResult(undefined); await save(); const next = await rithmicAdminApi.connect(); setSnapshot(next); setForm(asForm(next.config)); setDirty(false); setConnectResult(next.connection); if (next.ok) setNotice("Rithmic confirmed a successful connection."); else setError(`Connection unsuccessful: ${next.connection?.message || "login confirmation not received"}`); })}>{busy === "connect" ? "Waiting for confirmation…" : "Save & connect"}</button>
        <button type="button" className="admin-danger" disabled={!!busy || !snapshot?.runtime.marketServiceRunning} onClick={() => void run("disconnect", async () => { const next = await rithmicAdminApi.disconnect(); setSnapshot(next); setForm(asForm(next.config)); setDirty(false); setConnectResult(undefined); setNotice("Rithmic disconnected and auto-connect disabled."); })}>Disconnect</button>
      </div></section>
    </form>
    <AiScanAdminSection />
    <details className="admin-diagnostics"><summary>Runtime diagnostics</summary><pre>{JSON.stringify(marketData, null, 2)}</pre></details>
  </main>;
}

function AdminSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: ReactNode }) {
  return <section className="admin-card"><div className="admin-section-title"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="admin-grid">{children}</div></section>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <span className="admin-switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} /><span>{checked ? "On" : "Off"}</span></span>;
}

function AdminLogin({ username, password, busy, error, safeTransport, setUsername, setPassword, onSubmit }: {
  username: string; password: string; busy: boolean; error?: string; safeTransport: boolean;
  setUsername: (value: string) => void; setPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <main className="admin-login-shell"><form className="admin-login-card" onSubmit={onSubmit}>
    <div className="admin-kicker">GC FLOW · OWNER</div><h1>Admin login</h1>
    <p>Use the first account created on this system. This area contains Rithmic connection settings.</p>
    {!safeTransport && <div className="admin-message error">This IP address currently supports HTTP only. Do not enter your password here. Run <b>OPEN-ORACLE-ADMIN.cmd</b> then open the localhost address provided by the tool.</div>}
    <Field label="Username" help="Your GC Flow owner account name, separate from your Rithmic account."><input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} /></Field>
    <Field label="Admin password" help="Your GC Flow website login password, separate from your Rithmic password."><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} /></Field>
    {error && <div className="admin-message error">{error}</div>}
    <button className="admin-primary" disabled={!safeTransport || busy || !username.trim() || !password}>Log in</button><a href="/">← Back to chart</a>
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
    <div className="admin-kicker">SECURITY · FIRST LOGIN</div><h1>Change your temporary password</h1>
    <p>This account uses a temporary password. Set your own password before opening Rithmic Control Center.</p>
    <Field label="Temporary password" help="Re-enter the temporary password you just used to log in."><input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.currentTarget.value)} /></Field>
    <Field label="New password" help="Use at least 8 characters and a password different from the temporary one. A long, unique password is recommended."><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.currentTarget.value)} /></Field>
    <Field label="Confirm new password" help="Re-enter the new password exactly to avoid locking yourself out."><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.currentTarget.value)} /></Field>
    {mismatch && <div className="admin-message error">The new passwords do not match.</div>}
    {error && <div className="admin-message error">{error}</div>}
    <button className="admin-primary" disabled={busy || !currentPassword || newPassword.length < 8 || mismatch || !confirmPassword}>{busy ? "Updating…" : "Change password and continue"}</button>
  </form></main>;
}
