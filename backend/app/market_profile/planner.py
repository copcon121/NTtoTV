"""Three durable LLM slots and profile-scoped managed touch alerts."""

from __future__ import annotations

import asyncio
import hashlib
import logging

from ..engines.alert_engine import Alert, AlertEngine
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from .calendar import PLANNER_VERSION, active_slots, current_slot, session_windows, trading_days
from .llm import MpLlmClient
from .snapshot import build_snapshot
from .store import MpStore

logger = logging.getLogger(__name__)
SCOPE_NAMES = {"daily": "Ngày", "asia": "Á", "eu": "Âu", "us": "Mỹ"}


class MpPlanner:
    def __init__(self, cache: CacheStore, store: MpStore, client: MpLlmClient, alerts: AlertEngine):
        self.cache, self.store, self.client, self.alerts = cache, store, client, alerts
        self._task: asyncio.Task | None = None
        self._waiting: dict | None = None

    def start(self) -> None:
        if self._task is None:
            self.store.recover_interrupted(now_ms())
            self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    def settings(self, profile_id: str) -> dict:
        return {"enabled": self.store.enabled(profile_id), "available": self.client.enabled,
                "profileId": profile_id, "timezone": "Asia/Bangkok",
                "schedule": ["07:00", "12:30", "20:00"], "plannerVersion": PLANNER_VERSION,
                "llm": self.client.configuration() if hasattr(self.client, "configuration") else {},
                "reason": None if self.client.enabled else "Analyst LLM is not configured"}

    def subscribe(self, profile_id: str, enabled: bool) -> dict:
        if enabled and not self.client.enabled:
            raise ValueError("Analyst LLM is not configured")
        was_enabled = self.store.enabled(profile_id)
        self.store.subscribe(profile_id, enabled, now_ms())
        if enabled:
            if not was_enabled:
                self.retry_failed_current()
            for rec in self.cache.read_alerts(profile_id=profile_id):
                if (rec.id.startswith("mp_") and rec.params.get("mpPaused")
                        and not rec.params.get("mpDeletedAt")
                        and rec.params.get("mpExpiresAt", 0) > now_ms()):
                    rec.params.pop("mpPaused", None)
                    rec.enabled = True
                    self.alerts.upsert(Alert.from_record(rec))
            self.sync_alerts()
        else:
            for rec in self.cache.read_alerts(profile_id=profile_id):
                if rec.id.startswith("mp_") and rec.enabled:
                    rec.params["mpPaused"] = True
                    rec.enabled = False
                    self.alerts.upsert(Alert.from_record(rec))
        return self.settings(profile_id)

    def retry_failed_current(self) -> bool:
        slot = current_slot(now_ms())
        run = self.store.latest_run(slot["id"]) if slot else None
        return bool(run and self.store.queue_retry(run["id"]))

    def refresh_current(self, expected_run_id: str) -> bool:
        if not self.client.enabled:
            raise ValueError("Analyst LLM is not configured")
        at = now_ms()
        slot = current_slot(at)
        if slot is None:
            raise ValueError("Outside a GC trading session")
        return self.store.queue_refresh(slot, expected_run_id, at)

    async def run_current(self, at: int | None = None) -> dict:
        at = now_ms() if at is None else at
        # Session handoff must not wait for data availability or an LLM reply.
        self.sync_alerts(at)
        slot = current_slot(at)
        if slot is None:
            return {"status": "closed", "error": "Outside a GC trading session"}
        existing = self.store.latest_run(slot["id"])
        if existing and existing["status"] != "retry_pending":
            self._waiting = None
            return existing
        if not self.client.enabled:
            return {"status": "unavailable", "error": "Analyst LLM is not configured"}
        if existing:
            slot = {**slot, "id": existing["id"]}
        refreshed = ":refresh:" in slot["id"]
        prior = self.store.plans(limit=8)
        # Snapshot construction performs only cache reads; never block ingestion.
        snapshot = await asyncio.to_thread(build_snapshot, self.cache, at, prior)
        if not snapshot["profiles"] or not any(not p["developing"] for p in snapshot["profiles"]):
            self._waiting = {"id": slot["id"], "status": "waiting", "error": "Chưa có profile ngày đã hoàn tất để lên plan."}
            return self._waiting
        # A closed/quiet feed must not spend a scheduled LLM slot on stale tape.
        latest = self.cache.read_bars("GC", "GC", "1m", to=at, limit=1)
        if not latest or at - latest[-1].time > 180_000:
            self._waiting = {"id": slot["id"], "status": "waiting", "error": "Đang chờ dữ liệu GC mới để đọc plan."}
            return self._waiting
        self._waiting = None
        today = [p for p in self.store.plans(slot["dayStart"]) if p.get("plannerVersion") == PLANNER_VERSION]
        scopes = (["daily"] if not refreshed and not any(p["scope"] == "daily" for p in today) else []) + [slot["name"]]
        snapshot["requestedScopes"] = scopes
        if not self.store.claim(slot, at):
            return self.store.run(slot["id"]) or {"status": "running"}
        try:
            reports = await asyncio.to_thread(self.client.analyze_plan, snapshot)
            finished = now_ms()
            plans = [{
                **p, "id": f"{slot['id']}:{p['scope']}", "runId": slot["id"],
                "dayStart": slot["dayStart"], "tradeDate": slot["tradeDate"],
                "asOf": at, "createdAt": finished, "scheduledAt": slot["start"],
                "createdLate": at - slot["start"] > 120_000,
                "refreshed": refreshed,
                "expiresAt": slot["dayEnd"] if p["scope"] == "daily" else slot["end"],
                "dataQuality": snapshot["dataQuality"], "allowedToAutoTrade": False,
                "plannerVersion": PLANNER_VERSION,
                "llm": self.client.configuration() if hasattr(self.client, "configuration") else {},
            } for p in reports]
        except asyncio.CancelledError:
            # The durable claim remains, avoiding an ambiguous second API call.
            raise
        except Exception as exc:
            error = _analysis_error_message(exc)
            self.store.finish(slot["id"], [], snapshot, now_ms(), error)
            logger.warning("%s", error)
            return self.store.run(slot["id"]) or {"status": "failed"}
        # Saving a valid report and registering its alerts are separate,
        # recoverable steps across the analyst/cache databases. If registration
        # fails, reconciliation retries it without another LLM request.
        self.store.finish(slot["id"], plans, snapshot, finished)
        self.sync_alerts()
        return self.store.run(slot["id"]) or {"status": "failed"}

    def _alert_plans(self, at: int, plans: list[dict] | None = None) -> dict[str, dict]:
        slot = current_slot(at)
        if slot is None:
            return {}
        valid = [p for p in (self.store.plans() if plans is None else plans)
                 if p.get("plannerVersion") == PLANNER_VERSION and p["scope"] == slot["name"]
                 and p["tradeDate"] == slot["tradeDate"] and p["scheduledAt"] == slot["start"]
                 and p["asOf"] <= at < p["expiresAt"]]
        latest = max(valid, key=lambda p: (p["scheduledAt"], p["asOf"]), default=None)
        return {latest["id"]: latest} if latest else {}

    def sync_alerts(self, at: int | None = None) -> None:
        at = now_ms() if at is None else at
        plans = self._alert_plans(at)
        enabled_profiles = set(self.store.enabled_profiles())
        # Paused profiles also need old/fired alerts and history cleaned up.
        profiles = enabled_profiles | {a.profile_id for a in self.cache.read_alerts(profile_id=None)
                                       if a.params.get("source") == "mp_plan"}
        for profile in profiles:
            existing = {a.id: a for a in self.cache.read_alerts(profile_id=profile) if a.id.startswith("mp_")}
            links = self.store.links(profile)
            linked = {(x["plan_id"], x["level_ref"]): x["alert_id"] for x in links}
            for plan in (plans.values() if profile in enabled_profiles else []):
                expires = _alert_expiry(plan)
                for item in plan["alerts"]:
                    key = (plan["id"], item["levelRef"])
                    if key in linked:
                        alert_id = linked[key]
                        if alert_id not in existing:
                            # A legacy chart tab could delete price alerts after
                            # receiving an event. A surviving link cannot prove
                            # whether its missing alert already fired or was
                            # deleted manually. Retain a hidden, disabled row.
                            rec = self.cache.read_alert(alert_id, profile)
                            if rec is None:
                                self.alerts.upsert(Alert(alert_id, "GC", "price_crosses_level", {
                                    "level": item["price"], "source": "mp_plan", "repeat": False,
                                    "mpExpiresAt": expires, "mpRecoveredMissing": True,
                                    "mpDeletedAt": at,
                                }, enabled=False, profile_id=profile))
                                rec = self.cache.read_alert(alert_id, profile)
                            existing[alert_id] = rec
                        continue
                    tick = round(item["price"] * 10)
                    # Only an armed, unexpired alert can be shared with a new plan.
                    # Already-fired daily alerts are not resurrected by reconciliation.
                    candidate = None
                    if plan.get("refreshed"):
                        # A new read is not a rearm action. Preserve fired,
                        # disabled and deleted alerts at the same session price.
                        slot_id = plan["runId"].split(":refresh:", 1)[0]
                        prior_ids = {link["alert_id"] for link in links
                                     if link["plan_id"].startswith(f"{slot_id}:")
                                     and link["plan_id"] != plan["id"]}
                        candidate = next((a for a in existing.values() if a.id in prior_ids
                                          and float(a.params.get("mpExpiresAt", 0)) > at
                                          and round(float(a.params["level"]) * 10) == tick), None)
                    if candidate is None:
                        candidate = next((a for a in existing.values() if a.enabled
                                          and float(a.params.get("mpExpiresAt", 0)) > at
                                          and round(float(a.params["level"]) * 10) == tick), None)
                    if candidate is None:
                        digest = hashlib.sha256(f"{profile}:{plan['runId']}:{tick}".encode()).hexdigest()[:24]
                        alert_id = f"mp_{digest}"
                        rec = self.cache.read_alert(alert_id, profile)
                        if rec is None:
                            self.alerts.upsert(Alert(alert_id, "GC", "price_crosses_level", {
                                "level": tick / 10, "source": "mp_plan", "repeat": False,
                                "mpExpiresAt": expires,
                            }, profile_id=profile))
                            rec = self.cache.read_alert(alert_id, profile)
                        existing[alert_id] = rec
                    else:
                        alert_id = candidate.id
                    self.store.link(profile, plan["id"], item, alert_id)
                    linked[key] = alert_id
                    links.append({"plan_id": plan["id"], "level_ref": item["levelRef"],
                                  "alert_id": alert_id, "reason": item["reason"]})
            for alert_id, rec in existing.items():
                refs = [x for x in links if x["alert_id"] == alert_id and x["plan_id"] in plans]
                if (not refs or rec.params.get("mpFiredAt") or rec.params.get("mpDeletedAt")
                        or rec.params.get("mpExpiresAt", 0) <= at):
                    self.alerts.retire_mp_alert(alert_id, at)
                    continue
                latest_ref = max(refs, key=lambda x: plans[x["plan_id"]]["asOf"])
                plan = plans[latest_ref["plan_id"]]
                item = next(x for x in plan["alerts"] if x["levelRef"] == latest_ref["level_ref"])
                params = {**rec.params,
                          "mpExpiresAt": max(_alert_expiry(plans[x["plan_id"]]) for x in refs),
                          "mpMessage": f"GC chạm {item['label']} tại {rec.params['level']:.1f}. "
                                       f"Plan {SCOPE_NAMES[plan['scope']]}: {item['reason']} "
                                       f"{item['scenario']}\nhttps://gcflowpy.xyz/mp?planId={plan['id']}"}
                if params != rec.params:
                    rec.params = params
                    self.alerts.upsert(Alert.from_record(rec))

    def response(self, profile: str, day_start: int | None = None) -> dict:
        at = now_ms()
        self.sync_alerts(at)
        plans = self.store.plans(day_start)
        active = self._alert_plans(at)
        links = self.store.links(profile)
        alerts = {a.id: a for a in self.cache.read_alerts(profile_id=profile) if a.id.startswith("mp_")}
        for plan in plans:
            plan["expired"] = at >= plan["expiresAt"]
            plan["legacySchedule"] = plan.get("plannerVersion") != PLANNER_VERSION
            for item in plan["alerts"]:
                link = next((x for x in links if x["plan_id"] == plan["id"] and x["level_ref"] == item["levelRef"]), None)
                rec = alerts.get(link["alert_id"]) if link else None
                item["alertId"] = rec.id if rec else None
                item["enabled"] = bool(rec and rec.enabled)
                item["status"] = ("expired" if plan["expired"] else "superseded" if plan["id"] not in active
                                  else "pending" if rec is None
                                  else "deleted" if rec.params.get("mpDeletedAt")
                                  else "armed" if rec.enabled else "fired" if rec.params.get("mpFiredAt")
                                  else "disabled")
            # Retain the plan's prose, but consumed/previous-session alerts no
            # longer appear in either the chart list or the plan history.
            plan["alerts"] = [item for item in plan["alerts"]
                              if item["status"] in ("armed", "disabled", "pending")]
        slot = current_slot(at)
        run = self.store.latest_run(slot["id"]) if slot else None
        if slot and self._waiting and self._waiting["id"] == (run["id"] if run else slot["id"]):
            run = {**(run or {}), **self._waiting}
        return {"plans": plans, "settings": self.settings(profile), "currentSlot": slot,
                "activeSlots": active_slots(at),
                "run": run,
                "serverTime": at, "tradingDays": trading_days(at, 20)}

    def toggle_alert(self, profile: str, alert_id: str, enabled: bool) -> None:
        rec = self.cache.read_alert(alert_id, profile)
        if rec is None or not alert_id.startswith("mp_"):
            raise ValueError("MP alert not found")
        if enabled and (rec.params.get("mpFiredAt") or rec.params.get("mpDeletedAt")):
            raise ValueError("MP alert has already been removed")
        if enabled and (not self.store.enabled(profile) or rec.params.get("mpExpiresAt", 0) <= now_ms()):
            raise ValueError("Planner is disabled or the alert has expired")
        if enabled and not any(link["alert_id"] == alert_id and link["plan_id"] in self._alert_plans(now_ms())
                               for link in self.store.links(profile)):
            raise ValueError("Alerts belong to the latest session plan; this plan has been superseded")
        self.alerts.set_enabled(alert_id, enabled)

    async def _loop(self) -> None:
        while True:
            try:
                self.sync_alerts()
                if self.store.enabled_profiles():
                    await self.run_current()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("MP planner loop failed (%s)", type(exc).__name__)
            await asyncio.sleep(10)


def _alert_expiry(plan: dict) -> int:
    windows = session_windows({"tradeDate": plan["tradeDate"], "start": plan["dayStart"],
                               "end": plan["expiresAt"]})
    return min([plan["expiresAt"]] + [w["start"] for w in windows if w["start"] > plan["scheduledAt"]])


def _analysis_error_message(error: Exception) -> str:
    """Expose useful categories, never raw provider bodies/credentials."""
    detail = str(error).lower()
    if isinstance(error, TimeoutError) or "timed out" in detail:
        reason = "LLM chưa trả lời kịp thời."
    elif "model_not_found" in detail or "model is not supported" in detail:
        reason = "Model đang cấu hình không được 9router hỗ trợ."
    elif any(word in detail for word in ("429", "rate limit", "quota")):
        reason = "9router hoặc nhà cung cấp đang giới hạn lượt gọi."
    elif "unknown or duplicate" in detail:
        reason = "LLM chọn mức alert không khớp hoặc bị trùng."
    elif "scope" in detail or "number of plans" in detail:
        reason = "LLM trả thiếu hoặc sai loại plan ngày/phiên."
    elif any(word in detail for word in ("json", "report text", "scenario", "alert policy")):
        reason = "Nội dung LLM trả về chưa đúng định dạng plan."
    else:
        reason = "Không đọc được kết quả từ API LLM."
    return reason + " Chưa tạo alert mới. Anh có thể bấm Thử lại phiên này."
