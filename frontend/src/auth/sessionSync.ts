// Cross-tab messages carry only a change marker. The HttpOnly cookie remains
// the credential, and every listener verifies the current user with the server.
export const AUTH_SESSION_STORAGE_KEY = "nttotv.auth-session-change";
export const AUTH_SESSION_CHECK_EVENT = "nttotv:auth-session-check";

export function requestAuthSessionCheck(): void {
  window.dispatchEvent(new Event(AUTH_SESSION_CHECK_EVENT));
}

export function notifyAuthSessionChanged(): void {
  try {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Focus and periodic checks still work when browser storage is unavailable.
  }
  requestAuthSessionCheck();
}
