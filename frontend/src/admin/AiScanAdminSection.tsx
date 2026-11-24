import { useEffect, useState } from "react";

import { aiScanAdminApi, type AiScanAdminConfig, type AiScanTestResult } from "./rithmicAdminApi";

export function AiScanAdminSection() {
  const [config, setConfig] = useState<AiScanAdminConfig>();
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [test, setTest] = useState<AiScanTestResult>();

  const load = () => {
    setError("");
    void aiScanAdminApi.get().then((body) => setConfig(body.config)).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not load AI Scan settings.");
    });
  };
  useEffect(load, []);

  async function save(runTest: boolean) {
    if (!config) return;
    setBusy(true);
    setError("");
    setNotice("");
    setTest(undefined);
    const key = apiKey;
    setApiKey("");
    try {
      const result = await aiScanAdminApi.save({
        baseUrl: config.baseUrl,
        model: config.model,
        enabled: config.enabled,
        ...(key.trim() ? { apiKey: key } : {}),
      });
      setConfig(result.config);
      setNotice("AI Scan settings saved.");
      if (runTest) setTest(await aiScanAdminApi.test());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save AI Scan settings.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-card admin-ai-section" aria-label="AI Scan configuration">
    <div className="admin-section-title">
      <div><h2>AI Scan · 9router</h2><p>Connect AI to rank and explain chart drawings.</p></div>
    </div>
    {config && <form onSubmit={(event) => { event.preventDefault(); void save(false); }}>
      <fieldset disabled={busy} className="admin-ai-fields">
        <div className="admin-grid">
          <label className="admin-field"><span className="admin-field-label">Base URL</span>
            <input type="url" required value={config.baseUrl} onChange={(event) => setConfig({ ...config, baseUrl: event.currentTarget.value })} />
          </label>
          <label className="admin-field"><span className="admin-field-label">Model</span>
            <input required maxLength={160} value={config.model} onChange={(event) => setConfig({ ...config, model: event.currentTarget.value })} />
          </label>
          <label className="admin-field"><span className="admin-field-label">API key</span>
            <input type="password" autoComplete="new-password" spellCheck={false} value={apiKey}
              placeholder={config.apiKeyConfigured ? "Configured · leave blank to keep the current key" : "Enter a key or set NINEROUTER_API_KEY"}
              onChange={(event) => setApiKey(event.currentTarget.value)} />
          </label>
        </div>
        <div className="admin-ai-controls">
          <label className="admin-switch"><input type="checkbox" checked={config.enabled} onChange={(event) => setConfig({ ...config, enabled: event.currentTarget.checked })} />Enable AI ranking</label>
          <span>{config.apiKeySource === "environment" ? "Key from environment variable" : config.apiKeySource === "secret-store" ? "Key in secret store" : "No API key configured"}</span>
          <div className="admin-buttons">
            <button type="submit">Save AI settings</button>
            <button type="button" className="admin-primary" onClick={() => void save(true)}>{busy ? "Processing…" : "Save & test AI"}</button>
          </div>
        </div>
      </fieldset>
      <p className="admin-ai-help">Keys entered here are stored separately on the server. You can also set the NINEROUTER_API_KEY environment variable. The test asks for an OK-only reply with stream=false.</p>
    </form>}
    {!config && !error && <p role="status">Loading AI Scan settings…</p>}
    {error && <div className="admin-message error" role="alert">{error}{!config && <button type="button" onClick={load}>Retry</button>}</div>}
    {notice && <p className="admin-ai-notice" role="status">{notice}</p>}
    {test && <div className={`admin-operation ${test.ok ? "success" : "error"}`} role="status">
      <strong>{test.httpStatus === null ? "No HTTP response received" : `HTTP ${test.httpStatus}`}</strong>
      <span>{test.endpoint}</span>
      {test.content && <pre className="admin-ai-response">{test.content}</pre>}
      {test.error && <pre className="admin-ai-response">{test.error}</pre>}
    </div>}
  </section>;
}
