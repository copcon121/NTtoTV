"""MP planning tables share the existing analyst single writer."""

from __future__ import annotations

import json
import uuid

from ..analyst.store import AnalystStore

SCHEMA = """
CREATE TABLE IF NOT EXISTS mp_subscriptions (
    profile_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mp_runs (
    id TEXT PRIMARY KEY, day_start INTEGER NOT NULL, slot TEXT NOT NULL,
    status TEXT NOT NULL, snapshot TEXT, error TEXT, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mp_plans (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, day_start INTEGER NOT NULL,
    scope TEXT NOT NULL, as_of INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mp_plans_day ON mp_plans(day_start, as_of);
CREATE TABLE IF NOT EXISTS mp_plan_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id TEXT NOT NULL,
    revised_at INTEGER NOT NULL, previous_payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mp_alert_links (
    profile_id TEXT NOT NULL, plan_id TEXT NOT NULL, level_ref TEXT NOT NULL,
    alert_id TEXT NOT NULL, price REAL NOT NULL, reason TEXT NOT NULL,
    PRIMARY KEY(profile_id, plan_id, level_ref)
);
"""


class MpStore:
    def __init__(self, analyst: AnalystStore):
        self.analyst = analyst
        self.writer = analyst.writer
        self.writer.executescript(SCHEMA)

    def _rows(self, sql: str, args=()) -> list[dict]:
        conn = self.analyst.reader()
        try:
            return [dict(r) for r in conn.execute(sql, args).fetchall()]
        finally:
            conn.close()

    def enabled_profiles(self) -> list[str]:
        return [r["profile_id"] for r in self._rows("SELECT profile_id FROM mp_subscriptions WHERE enabled=1")]

    def enabled(self, profile_id: str) -> bool:
        return profile_id in self.enabled_profiles()

    def subscribe(self, profile_id: str, enabled: bool, now: int) -> None:
        self.writer.execute(
            "INSERT INTO mp_subscriptions VALUES (?,?,?) ON CONFLICT(profile_id) "
            "DO UPDATE SET enabled=excluded.enabled, updated_at=excluded.updated_at",
            (profile_id, int(enabled), now),
        )

    def claim(self, slot: dict, now: int) -> bool:
        # Commit before the network request. A timeout/restart never retries a
        # potentially billed request automatically.
        cur = self.writer.execute(
            "INSERT OR IGNORE INTO mp_runs VALUES (?,?,?,'running',NULL,NULL,?,?)",
            (slot["id"], slot["dayStart"], slot["name"], now, now),
        )
        if cur.rowcount == 1:
            return True
        # Only a user-authorized retry may reopen a failed slot. The conditional
        # update is the claim: simultaneous clicks still send one request.
        cur = self.writer.execute(
            "UPDATE mp_runs SET status='running',error=NULL,updated_at=? "
            "WHERE id=? AND status='retry_pending'", (now, slot["id"]),
        )
        return cur.rowcount == 1

    def queue_retry(self, run_id: str) -> bool:
        cur = self.writer.execute(
            "UPDATE mp_runs SET status='retry_pending',error=NULL WHERE id=? AND status='failed'",
            (run_id,),
        )
        return cur.rowcount == 1

    def latest_run(self, slot_id: str) -> dict | None:
        rows = self._rows(
            "SELECT id,status,error,created_at,updated_at FROM mp_runs "
            "WHERE id=? OR id LIKE ? ORDER BY rowid DESC LIMIT 1",
            (slot_id, f"{slot_id}:refresh:%"),
        )
        return rows[0] if rows else None

    def queue_refresh(self, slot: dict, expected_run_id: str, now: int) -> bool:
        # Compare and insert in one statement: stale tabs and simultaneous
        # clicks cannot queue multiple billable reads of the same revision.
        run_id = f"{slot['id']}:refresh:{uuid.uuid4().hex}"
        cur = self.writer.execute(
            "INSERT INTO mp_runs(id,day_start,slot,status,snapshot,error,created_at,updated_at) "
            "SELECT ?,?,?,'retry_pending',NULL,NULL,?,? "
            "WHERE (SELECT id FROM mp_runs WHERE id=? OR id LIKE ? "
            "ORDER BY rowid DESC LIMIT 1)=? "
            "AND EXISTS(SELECT 1 FROM mp_runs WHERE id=? AND status='complete')",
            (run_id, slot["dayStart"], slot["name"], now, now,
             slot["id"], f"{slot['id']}:refresh:%", expected_run_id, expected_run_id),
        )
        return cur.rowcount == 1

    def recover_interrupted(self, now: int) -> None:
        self.writer.execute("UPDATE mp_runs SET status='failed',error=?,updated_at=? WHERE status='running'", (
            "Backend restarted during analysis; this slot will not be requested again automatically.", now,
        ))

    def run(self, run_id: str) -> dict | None:
        rows = self._rows("SELECT id,status,error,created_at,updated_at FROM mp_runs WHERE id=?", (run_id,))
        return rows[0] if rows else None

    def finish(self, run_id: str, plans: list[dict], snapshot: dict, now: int, error: str | None = None) -> None:
        def write(conn):
            for plan in plans:
                conn.execute("INSERT OR IGNORE INTO mp_plans VALUES (?,?,?,?,?,?,?)", (
                    plan["id"], run_id, plan["dayStart"], plan["scope"], plan["asOf"],
                    plan["expiresAt"], json.dumps(plan, ensure_ascii=False),
                ))
            conn.execute("UPDATE mp_runs SET status=?,snapshot=?,error=?,updated_at=? WHERE id=?", (
                "failed" if error else "complete", json.dumps(snapshot, ensure_ascii=False), error, now, run_id,
            ))
        self.writer.write(write)

    def plans(self, day_start: int | None = None, limit: int = 80) -> list[dict]:
        sql = "SELECT payload FROM mp_plans"
        args: tuple = ()
        if day_start is not None:
            sql += " WHERE day_start=?"
            args = (day_start,)
        sql += " ORDER BY as_of DESC, scope, rowid DESC LIMIT ?"
        return [json.loads(r["payload"]) for r in self._rows(sql, (*args, limit))]

    def repair_reports(self, run_id: str, reports: list[dict], now: int) -> None:
        """Correct prose while preserving IDs, context time and alert lifecycle.

        The old reports are archived in the same transaction. Existing alert
        selections must match exactly; neither fired history nor registrations
        can be replaced through this repair seam.
        """
        def write(conn):
            rows = conn.execute("SELECT id,payload FROM mp_plans WHERE run_id=?", (run_id,)).fetchall()
            existing = {json.loads(row["payload"])["scope"]: row for row in rows}
            if len(reports) != len(existing) or {p["scope"] for p in reports} != set(existing):
                raise ValueError("Report correction must cover the existing plan scopes")
            for report in reports:
                row = existing[report["scope"]]
                previous = json.loads(row["payload"])
                old_levels = {a["levelRef"]: a["price"] for a in previous["alerts"]}
                new_levels = {a["levelRef"]: a["price"] for a in report["alerts"]}
                if old_levels != new_levels:
                    raise ValueError("Report correction must preserve existing alert prices")
                fields = ("summary", "mpRead", "dailyRead", "scenarios", "invalidation", "alerts")
                corrected = {**previous, **{key: report[key] for key in fields}, "revisedAt": now}
                conn.execute("INSERT INTO mp_plan_revisions(plan_id,revised_at,previous_payload) VALUES (?,?,?)",
                             (row["id"], now, row["payload"]))
                conn.execute("UPDATE mp_plans SET payload=? WHERE id=?",
                             (json.dumps(corrected, ensure_ascii=False), row["id"]))
        self.writer.write(write)

    def links(self, profile_id: str) -> list[dict]:
        return self._rows("SELECT * FROM mp_alert_links WHERE profile_id=?", (profile_id,))

    def link(self, profile_id: str, plan_id: str, item: dict, alert_id: str) -> None:
        self.writer.execute("INSERT OR IGNORE INTO mp_alert_links VALUES (?,?,?,?,?,?)", (
            profile_id, plan_id, item["levelRef"], alert_id, item["price"], item["reason"],
        ))
