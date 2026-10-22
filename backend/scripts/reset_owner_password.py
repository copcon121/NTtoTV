"""Reset the first local user without exposing the temporary password in argv."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.storage.cache_store import CacheStore


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--username", default="admin")
    args = parser.parse_args()
    password = sys.stdin.readline().rstrip("\r\n")
    if len(password) < 8:
        parser.error("temporary password must contain at least 8 characters")

    cache = CacheStore(args.database)
    try:
        owner = cache.users.reset_first_user_credentials(
            args.username,
            password,
            require_password_change=True,
        )
    finally:
        cache.close()
    print(
        f"owner reset: username={owner.username} "
        f"must_change_password={owner.must_change_password}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
