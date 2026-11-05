import { useEffect, useRef } from "react";

import type { ApiClient, AuthUser } from "../api/client";
import { AUTH_SESSION_CHECK_EVENT, AUTH_SESSION_STORAGE_KEY } from "./sessionSync";

export function useAuthSessionSync(
  api: Pick<ApiClient, "me">,
  onVerified: (user: AuthUser | undefined) => void,
): void {
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    let active = true;
    let checking = false;
    let revision = 0;
    const check = async () => {
      revision++;
      if (checking) return;
      checking = true;
      while (active) {
        const startedRevision = revision;
        try {
          const user = await api.me();
          // A login/logout in another tab may have replaced the cookie while
          // this request was in flight. Recheck before publishing that result.
          if (active && startedRevision === revision) onVerifiedRef.current(user);
        } catch {
          // A network/server failure is not evidence that the user logged out.
        }
        if (startedRevision === revision) break;
      }
      checking = false;
    };
    const onCheck = () => { void check(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") onCheck();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_STORAGE_KEY) onCheck();
    };
    window.addEventListener(AUTH_SESSION_CHECK_EVENT, onCheck);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onCheck);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(AUTH_SESSION_CHECK_EVENT, onCheck);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onCheck);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [api]);
}
