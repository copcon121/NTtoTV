import { useEffect, useState } from "react";

import type { Mt5Account, Mt5ConnectInput } from "../api/client";

const DEFAULT_TERMINAL_PATH = "C:\\Program Files\\MetaTrader 5\\terminal64.exe";

export interface Mt5AccountDialogProps {
  open: boolean;
  account?: Mt5Account;
  pending?: boolean;
  error?: string;
  onSubmit: (input: Mt5ConnectInput) => void;
  onClose: () => void;
}

export function Mt5AccountDialog({
  open,
  account,
  pending = false,
  error,
  onSubmit,
  onClose,
}: Mt5AccountDialogProps) {
  const [login, setLogin] = useState(account?.login ? String(account.login) : "");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(account?.server ?? "");
  const [symbolBroker, setSymbolBroker] = useState(account?.symbolBroker ?? "");
  const [terminalPath, setTerminalPath] = useState(DEFAULT_TERMINAL_PATH);

  useEffect(() => {
    if (!open) return;
    setLogin(account?.login ? String(account.login) : "");
    setPassword("");
    setServer(account?.server ?? "");
    setSymbolBroker(account?.symbolBroker ?? "");
    setTerminalPath(DEFAULT_TERMINAL_PATH);
  }, [account, open]);

  if (!open) return null;

  const parsedLogin = Number(login);
  const canSubmit =
    Number.isInteger(parsedLogin) &&
    parsedLogin > 0 &&
    password.length > 0 &&
    server.trim().length > 0;

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="mt5-dialog"
        aria-label="MT5 account setup"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          const symbol = symbolBroker.trim();
          onSubmit({
            login: parsedLogin,
            password,
            server: server.trim(),
            ...(symbol ? { symbolBroker: symbol } : {}),
            ...(terminalPath.trim() ? { terminalPath: terminalPath.trim() } : {}),
          });
        }}
      >
        <div className="modal-header">
          <h2>MT5 Account</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>
        <label>
          <span>Login</span>
          <input
            autoFocus
            inputMode="numeric"
            value={login}
            onChange={(event) => setLogin(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Server</span>
          <input value={server} onChange={(event) => setServer(event.currentTarget.value)} />
        </label>
        <label>
          <span>Symbol</span>
          <input
            placeholder="Auto detect"
            value={symbolBroker}
            onChange={(event) => setSymbolBroker(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Terminal path</span>
          <input
            value={terminalPath}
            onChange={(event) => setTerminalPath(event.currentTarget.value)}
          />
        </label>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Later
          </button>
          <button type="submit" disabled={pending || !canSubmit}>
            Save Account
          </button>
        </div>
      </form>
    </div>
  );
}
