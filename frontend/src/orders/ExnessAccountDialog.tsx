import { useEffect, useState } from "react";
import type { ExnessConnectInput, Mt5Account } from "../api/client";

export interface ExnessAccountDialogProps {
  open: boolean;
  account?: Mt5Account;
  profileName?: string;
  pending?: boolean;
  error?: string;
  onSubmit: (input: ExnessConnectInput) => void;
  onClose: () => void;
  onAcknowledgeUncertain?: (key: string) => void;
}

export function ExnessAccountDialog({ open, account, profileName, pending = false, error, onSubmit, onClose, onAcknowledgeUncertain }: ExnessAccountDialogProps) {
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [gateway, setGateway] = useState("https://api.exness.com");
  const [symbolBroker, setSymbolBroker] = useState("");
  useEffect(() => {
    setApiKey("");
    setApiSecret("");
    setAccountId(open ? account?.accountId ?? "" : "");
    setGateway(account?.gateway ?? "https://api.exness.com");
    setSymbolBroker(account?.symbolBroker ?? "");
  }, [open, account?.accountId, profileName]);
  if (!open) return null;
  const validId = /^[0-9]{1,20}$/.test(accountId) && BigInt(accountId) > 0n && BigInt(accountId) < 2n ** 64n;
  const canSubmit = validId && apiKey.trim().length >= 8 && apiSecret.trim().length > 0;
  const close = () => { setApiKey(""); setApiSecret(""); onClose(); };
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="mt5-dialog exness-dialog" aria-label="Exness account setup" autoComplete="off" onSubmit={(event) => {
        event.preventDefault();
        if (pending || !canSubmit) return;
        const input = { accountId, apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), gateway: gateway.trim(),
          ...(symbolBroker.trim() ? { symbolBroker: symbolBroker.trim() } : {}) };
        setApiKey("");
        setApiSecret("");
        onSubmit(input);
      }}>
        <div className="modal-header">
          <h2>Exness Account</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={close}>x</button>
        </div>
        <p className="exness-account-note">Connection for {profileName ?? "this profile"}. Use an Exness platform-based account and a Trading Full access key.</p>
        {account?.credentialsStored && <p className="exness-account-note" role="status">Credentials saved. Enter key and secret again to change the connection.</p>}
        <div className="exness-account-fields">
          {account?.uncertainActions?.map((action) => <div key={action.key} className="modal-error">
            <p>The result of an earlier {action.action} request is unknown. Check positions and orders in Exness before continuing.</p>
            <button type="button" disabled={pending} onClick={() => onAcknowledgeUncertain?.(action.key)}>I checked Exness; clear the pending lock</button>
          </div>)}
          <label><span>Exness account ID</span><input autoFocus inputMode="numeric" value={accountId}
            onChange={(event) => setAccountId(event.currentTarget.value.trim())} disabled={pending} /></label>
          <label><span>API key</span><input type="password" value={apiKey} autoComplete="off" spellCheck={false}
            onChange={(event) => setApiKey(event.currentTarget.value)} disabled={pending} /></label>
          <label><span>API secret</span><input type="password" value={apiSecret} autoComplete="new-password" spellCheck={false}
            onChange={(event) => setApiSecret(event.currentTarget.value)} disabled={pending} /></label>
          <details><summary>Connection options</summary>
            <label><span>Gateway</span><input value={gateway} type="url" onChange={(event) => setGateway(event.currentTarget.value)} disabled={pending} /></label>
            <label><span>Gold symbol</span><input value={symbolBroker} placeholder="Auto detect" onChange={(event) => setSymbolBroker(event.currentTarget.value)} disabled={pending} /></label>
          </details>
        </div>
        {error && <div className="modal-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" onClick={close}>Close</button>
          <button type="submit" disabled={pending || !canSubmit}>{pending ? "Connecting..." : "Connect"}</button></div>
      </form>
    </div>
  );
}
