import { useEffect, useRef, useState } from "react";

import type { Mt5Account, Mt5ConnectInput, Mt5Terminal } from "../api/client";

const DEFAULT_TERMINAL_PATH = "C:\\Program Files\\MetaTrader 5\\terminal64.exe";

export interface Mt5AccountDialogProps {
  open: boolean;
  account?: Mt5Account;
  pending?: boolean;
  error?: string;
  terminals?: Mt5Terminal[];
  onSubmit: (input: Mt5ConnectInput) => void;
  onClose: () => void;
}

export function Mt5AccountDialog({
  open,
  account,
  pending = false,
  error,
  terminals = [],
  onSubmit,
  onClose,
}: Mt5AccountDialogProps) {
  const [login, setLogin] = useState(account?.login ? String(account.login) : "");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(account?.server ?? "");
  const [symbolBroker, setSymbolBroker] = useState(account?.symbolBroker ?? "");
  const [terminalPath, setTerminalPath] = useState(account?.terminalPath ?? DEFAULT_TERMINAL_PATH);
  // Track whether the user has manually edited the terminal path field so
  // auto-fill does not overwrite a deliberate manual choice.
  const userEditedTerminal = useRef(false);

  useEffect(() => {
    if (!open) return;
    setLogin(account?.login ? String(account.login) : "");
    setPassword("");
    setServer(account?.server ?? "");
    setSymbolBroker(account?.symbolBroker ?? "");
    setTerminalPath(account?.terminalPath ?? DEFAULT_TERMINAL_PATH);
    userEditedTerminal.current = false;
  }, [account, open]);

  // Auto-fill terminal path and server when login matches a detected terminal.
  useEffect(() => {
    if (!open || userEditedTerminal.current) return;
    const parsed = Number(login);
    if (!Number.isInteger(parsed) || parsed <= 0 || terminals.length === 0) return;
    const match = terminals.find((t) => t.login === parsed);
    if (match?.path) {
      setTerminalPath(match.path);
      if (match.server && !server.trim()) {
        setServer(match.server);
      }
    }
  }, [login, open, terminals]);

  if (!open) return null;

  const parsedLogin = Number(login);
  const canSubmit =
    Number.isInteger(parsedLogin) &&
    parsedLogin > 0 &&
    password.length > 0 &&
    server.trim().length > 0;

  // Show detected terminals as quick-select buttons when multiple are running.
  const terminalHints = terminals.filter((t) => t.login !== null);

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
            onChange={(event) => {
              setTerminalPath(event.currentTarget.value);
              userEditedTerminal.current = true;
            }}
          />
        </label>
        {terminalHints.length > 1 && (
          <div className="terminal-hints" aria-label="Detected terminals">
            {terminalHints.map((t) => (
              <button
                key={t.path}
                type="button"
                className={`terminal-hint${t.path === terminalPath ? " active" : ""}`}
                onClick={() => {
                  setTerminalPath(t.path);
                  if (t.login !== null) {
                    setLogin(String(t.login));
                  }
                  if (t.server) {
                    setServer(t.server);
                  }
                  userEditedTerminal.current = false;
                }}
              >
                {t.login ?? "?"} — {t.title.split(" - ").slice(1, 2).join("")  || "MT5"}
              </button>
            ))}
          </div>
        )}
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
