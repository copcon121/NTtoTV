"""Read-only broker verification using short-lived Windows profile sessions.

Run with backend's Python from the Windows backend working directory. Sessions
are created through the existing store, held in memory, and revoked in finally.
This script never logs in to Oracle Admin or sends a broker trading operation.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.storage.cache_store import CacheStore


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="https://oracle.gcflowpy.xyz")
    parser.add_argument("--local", action="store_true")
    args = parser.parse_args()
    cookie_name = "nttotv_session" if args.local else "nttotv_windows_session"
    cache = CacheStore(Path(__file__).resolve().parents[1] / "data" / "app.sqlite")
    tokens: list[str] = []
    opener = build_opener(ProxyHandler({}))

    def get(path: str, token: str):
        req = Request(args.url.rstrip("/") + path, headers={"Cookie": f"{cookie_name}={token}"})
        with opener.open(req, timeout=45) as response:
            return json.load(response)

    try:
        with cache.reader() as conn:
            rows = conn.execute(
                "SELECT u.id, u.username, a.login, a.terminal_path FROM users u "
                "JOIN user_mt5_accounts a ON a.user_id=u.id "
                "WHERE lower(u.username) IN ('hieu','hai') ORDER BY lower(u.username)"
            ).fetchall()
        if len(rows) != 2:
            raise RuntimeError("Expected exactly two configured Windows MT5 profiles")
        results = []
        for row in rows:
            token = cache.users.create_session(row["id"], ttl_ms=300_000)
            tokens.append(token)
            identity = get("/api/auth/me", token)["user"]
            assert identity["id"] == row["id"], "Profile identity mismatch"
            status = get("/api/mt5/status", token)
            account = status.get("account") or {}
            assert status.get("connected"), "Windows profile MT5 is disconnected"
            assert account.get("login") == row["login"], "MT5 login mismatch"
            assert str(account.get("terminalPath", "")).casefold() == row["terminal_path"].casefold(), "MT5 terminal mismatch"
            terminals = get("/api/mt5/terminals", token)["terminals"]
            if not args.local:
                assert len(terminals) == 1, "Another profile's terminal was visible"
                assert terminals[0]["path"].casefold() == row["terminal_path"].casefold()
            trades = get("/api/mt5/open-trades", token)
            results.append({
                "profile": row["username"], "connected": True,
                "identityVerified": True, "terminalVerified": True,
                "positions": len(trades.get("positions", [])),
                "pendingOrders": len(trades.get("orders", [])),
            })
        print(json.dumps({"url": args.url, "profiles": results, "brokerMutations": 0}))
    finally:
        for token in tokens:
            cache.users.delete_session(token)
        cache.close()


if __name__ == "__main__":
    main()
