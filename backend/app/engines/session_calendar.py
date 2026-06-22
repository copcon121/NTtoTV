"""Trading-session calendar helpers for GC futures.

The platform receives UTC millisecond timestamps, but the daily GC candle should
match the exchange trading session rather than a UTC calendar day. GC uses the
US Central Time session template: Sunday 17:00 CT through Friday 16:00 CT with a
daily maintenance break from 16:00 to 17:00 CT.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from app.models.timestamp import from_canonical_ms, to_canonical_ms

DAILY_TF = "1D"
SESSION_ANCHORED_TFS = frozenset({"4h", DAILY_TF})
GC_SESSION_START_HOUR_CT = 17
GC_SESSION_BREAK_START_HOUR_CT = 16

TF_MS: dict[str, int] = {
    "1m": 60_000,
    "3m": 3 * 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    DAILY_TF: 24 * 60 * 60_000,
}


def timeframe_bucket_start(ts_ms: int, tf: str) -> int:
    """Floor ``ts_ms`` to the start of ``tf``.

    Intraday buckets remain epoch-aligned UTC intervals. The daily bucket is the
    GC session start timestamp in UTC.
    """

    try:
        interval = TF_MS[tf]
    except KeyError:
        raise ValueError(f"unsupported timeframe: {tf!r}") from None
    if tf == DAILY_TF:
        return gc_session_bucket_start(ts_ms)
    if tf in SESSION_ANCHORED_TFS:
        return gc_session_intraday_bucket_start(ts_ms, interval)
    return (ts_ms // interval) * interval


def gc_session_bucket_start(ts_ms: int) -> int:
    """Return the UTC ms timestamp for the GC session containing ``ts_ms``."""

    central_dt = central_datetime_from_utc_ms(ts_ms)
    session_date = central_dt.date()
    if central_dt.time() < time(GC_SESSION_START_HOUR_CT):
        session_date -= timedelta(days=1)
    return central_session_start_ms(session_date)


def gc_session_intraday_bucket_start(ts_ms: int, interval_ms: int) -> int:
    """Return the session-anchored intraday bucket start for ``ts_ms``."""

    session_start = gc_session_bucket_start(ts_ms)
    return session_start + ((ts_ms - session_start) // interval_ms) * interval_ms


def is_gc_session_open(ts_ms: int) -> bool:
    """Return whether ``ts_ms`` is inside normal GC trading hours."""

    central_dt = central_datetime_from_utc_ms(ts_ms)
    local_time = central_dt.time()
    weekday = central_dt.weekday()  # Monday=0, Sunday=6.
    if weekday == 5:
        return False
    if weekday == 6 and local_time < time(GC_SESSION_START_HOUR_CT):
        return False
    if weekday == 4 and local_time >= time(GC_SESSION_BREAK_START_HOUR_CT):
        return False
    if time(GC_SESSION_BREAK_START_HOUR_CT) <= local_time < time(GC_SESSION_START_HOUR_CT):
        return False
    return True


def central_datetime_from_utc_ms(ts_ms: int) -> datetime:
    """Convert UTC milliseconds to a naive US Central local datetime.

    This avoids relying on the optional IANA tzdata package on Windows. The GC
    data in this app is modern, so the post-2007 US DST rules are sufficient.
    """

    utc_dt = from_canonical_ms(ts_ms)
    return (utc_dt + timedelta(hours=central_offset_hours_for_utc(utc_dt))).replace(
        tzinfo=None
    )


def central_session_start_ms(session_date: date) -> int:
    """Convert a Central session date's 17:00 CT open to UTC ms."""

    offset_hours = central_offset_hours_for_local_session_start(session_date)
    offset = timezone(timedelta(hours=offset_hours))
    local_start = datetime(
        session_date.year,
        session_date.month,
        session_date.day,
        GC_SESSION_START_HOUR_CT,
        tzinfo=offset,
    )
    return to_canonical_ms(local_start)


def central_offset_hours_for_utc(utc_dt: datetime) -> int:
    """Return the UTC offset for US Central Time at a UTC datetime."""

    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    utc_dt = utc_dt.astimezone(timezone.utc)
    start = us_central_dst_start_utc(utc_dt.year)
    end = us_central_dst_end_utc(utc_dt.year)
    return -5 if start <= utc_dt < end else -6


def central_offset_hours_for_local_session_start(local_date: date) -> int:
    """Return US Central offset at 17:00 on ``local_date``."""

    start = second_sunday(local_date.year, 3)
    end = first_sunday(local_date.year, 11)
    return -5 if start <= local_date < end else -6


def us_central_dst_start_utc(year: int) -> datetime:
    """DST starts at 02:00 CST on the second Sunday in March."""

    day = second_sunday(year, 3)
    return datetime(year, 3, day.day, 8, tzinfo=timezone.utc)


def us_central_dst_end_utc(year: int) -> datetime:
    """DST ends at 02:00 CDT on the first Sunday in November."""

    day = first_sunday(year, 11)
    return datetime(year, 11, day.day, 7, tzinfo=timezone.utc)


def first_sunday(year: int, month: int) -> date:
    return nth_weekday(year, month, weekday=6, n=1)


def second_sunday(year: int, month: int) -> date:
    return nth_weekday(year, month, weekday=6, n=2)


def nth_weekday(year: int, month: int, *, weekday: int, n: int) -> date:
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return first + timedelta(days=offset + 7 * (n - 1))
