"""Encrypted account settings and durable broker intents, owned by login user."""

from __future__ import annotations

import json
import os
from pathlib import Path

from cryptography.fernet import Fernet

from ..storage.connection import SingleWriter, connect, connect_reader


SCHEMA = """
CREATE TABLE IF NOT EXISTS execution_accounts (
 user_id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE, credentials BLOB NOT NULL,
 symbol TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS execution_orders (
 user_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS execution_operations (
 user_id TEXT NOT NULL, account_id TEXT NOT NULL, key TEXT NOT NULL, action TEXT NOT NULL,
 request TEXT NOT NULL, order_id TEXT, operation_id TEXT, state TEXT NOT NULL,
 result TEXT, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,key)
);
CREATE TABLE IF NOT EXISTS execution_trailing (
 user_id TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
 payload TEXT NOT NULL, PRIMARY KEY(user_id,target_type,target_id)
);
CREATE TABLE IF NOT EXISTS execution_events (
 user_id TEXT NOT NULL, account_id TEXT NOT NULL, event_id TEXT NOT NULL,
 PRIMARY KEY(user_id,account_id,event_id)
);
"""


class ExecutionStore:
    def __init__(self, path: Path, key_path: Path):
        self.path, self.key_path = Path(path), Path(key_path)
        conn = connect(path, check_same_thread=False)
        conn.execute("PRAGMA synchronous=FULL")
        self.writer = SingleWriter(conn)
        self.writer.executescript(SCHEMA)
        self._vault: Fernet | None = None

    def _cipher(self) -> Fernet:
        if self._vault is None:
            self.key_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.key_path.exists():
                # Never replace a missing key when encrypted accounts already exist.
                if self.accounts():
                    raise RuntimeError("Execution encryption key is missing; restore the original key file")
                try:
                    fd = os.open(self.key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(fd, "wb") as file:
                        file.write(Fernet.generate_key())
                        file.flush()
                        os.fsync(file.fileno())
                except FileExistsError:
                    pass
            self._vault = Fernet(self.key_path.read_bytes())
        return self._vault

    def rows(self, sql, values=()):
        with connect_reader(self.path) as conn:
            return [dict(row) for row in conn.execute(sql, values).fetchall()]

    def accounts(self):
        return self.rows("SELECT user_id, account_id, symbol, enabled FROM execution_accounts")

    def account(self, user_id, *, secret=False):
        rows = self.rows("SELECT * FROM execution_accounts WHERE user_id=?", (user_id,))
        if not rows:
            return None
        row = rows[0]
        encrypted = row.pop("credentials")
        if secret:
            row.update(json.loads(self._cipher().decrypt(encrypted)))
        return row

    def save_account(self, user_id, account_id, credentials, symbol):
        encrypted = self._cipher().encrypt(json.dumps(credentials).encode())
        self.writer.execute(
            "INSERT INTO execution_accounts VALUES (?,?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET "
            "account_id=excluded.account_id, credentials=excluded.credentials, symbol=excluded.symbol, enabled=1",
            (user_id, account_id, encrypted, symbol))

    def orders(self, user_id):
        return [json.loads(r["payload"]) for r in self.rows("SELECT payload FROM execution_orders WHERE user_id=?", (user_id,))]

    def save_order(self, user_id, order):
        self.writer.execute("INSERT INTO execution_orders VALUES (?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload",
                            (user_id, order["id"], json.dumps(order, allow_nan=False)))

    def operations(self, user_id):
        return self.rows("SELECT * FROM execution_operations WHERE user_id=? ORDER BY created_at", (user_id,))

    def operation(self, user_id, key):
        rows = self.rows("SELECT * FROM execution_operations WHERE user_id=? AND key=?", (user_id, key))
        return rows[0] if rows else None

    def intent(self, user_id, account_id, key, action, request, order_id, now):
        self.writer.execute("INSERT INTO execution_operations VALUES (?,?,?,?,?,?,NULL,'sending',NULL,?)",
                            (user_id, account_id, key, action, json.dumps(request, sort_keys=True), order_id, now))

    def update_operation(self, user_id, key, state, operation_id=None, result=None):
        self.writer.execute("UPDATE execution_operations SET state=?, operation_id=COALESCE(?,operation_id), result=? WHERE user_id=? AND key=?",
                            (state, operation_id, json.dumps(result) if result is not None else None, user_id, key))

    def seen_event(self, user_id, account_id, event_id):
        return bool(self.rows("SELECT 1 FROM execution_events WHERE user_id=? AND account_id=? AND event_id=?", (user_id, account_id, event_id)))

    def mark_event(self, user_id, account_id, event_id):
        self.writer.execute("INSERT OR IGNORE INTO execution_events VALUES (?,?,?)", (user_id, account_id, event_id))

    def trailings(self, user_id):
        return [json.loads(r["payload"]) for r in self.rows("SELECT payload FROM execution_trailing WHERE user_id=?", (user_id,))]

    def save_trailing(self, user_id, rule):
        self.writer.execute("INSERT INTO execution_trailing VALUES (?,?,?,?) ON CONFLICT(user_id,target_type,target_id) DO UPDATE SET payload=excluded.payload",
                            (user_id, rule["targetType"], rule["targetId"], json.dumps(rule)))

    def delete_trailing(self, user_id, target_type, target_id):
        self.writer.execute("DELETE FROM execution_trailing WHERE user_id=? AND target_type=? AND target_id=?", (user_id, target_type, target_id))

    def close(self):
        self.writer.connection.close()
