#!/usr/bin/env python3
"""Create a transactionally consistent SQLite backup, including WAL state."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: sqlite-online-backup.py SOURCE DESTINATION")
    source = Path(sys.argv[1]).resolve()
    destination = Path(sys.argv[2]).resolve()
    if not source.is_file():
        raise SystemExit(f"source does not exist: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True) as src:
        with sqlite3.connect(destination) as dst:
            src.backup(dst)
            row = dst.execute("PRAGMA integrity_check").fetchone()
            if row is None or row[0] != "ok":
                raise RuntimeError(f"backup integrity check failed: {row}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
