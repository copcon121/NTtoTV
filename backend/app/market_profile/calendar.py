"""Exchange GC days retain DST; planner sessions use fixed UTC+7 windows."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from ..engines.session_calendar import (
    central_datetime_from_utc_ms,
    central_session_start_ms,
)

HOUR_MS = 3_600_000
DAY_MS = 24 * HOUR_MS
PLANNER_VERSION = "utc7-v2"
PLANNER_TZ = timezone(timedelta(hours=7))
SESSION_HOURS = (("asia", 7, 12), ("eu", 12.5, 22), ("us", 20, 28))


def trading_days(as_of: int, count: int = 5) -> list[dict]:
    local = central_datetime_from_utc_ms(as_of)
    day = local.date() - timedelta(days=local.time() < time(17))
    result: list[dict] = []
    while len(result) < count:
        # The date here is the session's opening CT date (Sunday-Thursday).
        if day.weekday() in (6, 0, 1, 2, 3):
            start = central_session_start_ms(day)
            result.append({
                "start": start,
                "end": start + 23 * HOUR_MS - 1,
                "tradeDate": (day + timedelta(days=1)).isoformat(),
            })
        day -= timedelta(days=1)
    return list(reversed(result))


def session_windows(day: dict) -> list[dict]:
    midnight = int(datetime.fromisoformat(day["tradeDate"]).replace(tzinfo=PLANNER_TZ).timestamp() * 1000)
    return [{
        "tradeDate": day["tradeDate"], "dayStart": day["start"], "dayEnd": day["end"],
        "name": name, "id": f"{day['tradeDate']}:{name}:{PLANNER_VERSION}",
        "start": midnight + int(begin * HOUR_MS),
        "end": min(midnight + int(end * HOUR_MS) - 1, day["end"]),
        "timezone": "Asia/Bangkok",
    } for name, begin, end in SESSION_HOURS]


def active_slots(as_of: int) -> list[dict]:
    day = trading_days(as_of, 1)[0]
    return [w for w in session_windows(day) if w["start"] <= as_of <= w["end"]]


def current_slot(as_of: int) -> dict | None:
    # Both EU and US remain visible during 20:00-22:00. The later opening owns
    # the next LLM read; a restart catches up only the latest session.
    active = active_slots(as_of)
    return active[-1] if active else None
