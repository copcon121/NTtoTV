import { useState } from "react";

export type AuthDialogMode = "login" | "register";

export interface AuthDialogProps {
  open: boolean;
  mode: AuthDialogMode;
  pending?: boolean;
  error?: string;
  usernameHint?: string;
  onModeChange: (mode: AuthDialogMode) => void;
  onSubmit: (input: {
    username: string;
    password: string;
    mode: AuthDialogMode;
    inviteCode?: string;
  }) => void;
  onClose: () => void;
}

export function AuthDialog({
  open,
  mode,
  pending = false,
  error,
  usernameHint = "local",
  onModeChange,
  onSubmit,
  onClose,
}: AuthDialogProps) {
  const [username, setUsername] = useState(usernameHint);
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="auth-dialog"
        aria-label="Trading account login"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            username: username.trim(),
            password,
            mode,
            ...(mode === "register" ? { inviteCode: inviteCode.trim() } : {}),
          });
        }}
      >
        <div className="modal-header">
          <h2>{mode === "login" ? "Login" : "Create Account"}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>
        <div className="segmented-control" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => onModeChange("login")}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => onModeChange("register")}
          >
            Create
          </button>
        </div>
        <label>
          <span>Username</span>
          <input
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
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
        {mode === "register" && (
          <label>
            <span>Invite code</span>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.currentTarget.value)}
            />
          </label>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              pending ||
              !username.trim() ||
              !password ||
              (mode === "register" && !inviteCode.trim())
            }
          >
            {mode === "login" ? "Login" : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
