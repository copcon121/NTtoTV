"""Build GC calendar candles from cached trading-session candles."""

from itertools import groupby

from ..engines.session_calendar import (
    WEEKLY_TF,
    calendar_bucket_end,
    timeframe_bucket_start,
)
from ..models.timestamp import now_ms
from .records import BarRecord, VolumeDeltaRecord


def daily_read_bounds(
    timeframe: str, to: int | None, limit: int | None
) -> tuple[int | None, int | None]:
    # A query selects calendar candles by open time. Read the full last
    # candle even if the cutoff falls partway through its trading days.
    daily_to = (
        calendar_bucket_end(timeframe_bucket_start(to, timeframe), timeframe) - 1
        if to is not None
        else None
    )
    days_per_bucket = 7 if timeframe == WEEKLY_TF else 31
    return daily_to, None if limit is None else days_per_bucket * limit


def rollup_bars(
    rows: list[BarRecord], timeframe: str, frm: int | None, limit: int | None
) -> list[BarRecord]:
    results: list[BarRecord] = []
    now = now_ms()
    buckets = groupby(rows, key=lambda row: timeframe_bucket_start(row.time, timeframe))
    for bucket, group in buckets:
        if frm is not None and bucket < frm:
            continue
        daily = list(group)
        first, last = daily[0], daily[-1]
        results.append(
            BarRecord(
                symbol=first.symbol,
                contract=first.contract,
                timeframe=timeframe,
                time=bucket,
                open=first.open,
                high=max(row.high for row in daily),
                low=min(row.low for row in daily),
                close=last.close,
                volume=sum(row.volume for row in daily),
                closed=calendar_bucket_end(bucket, timeframe) <= now,
                source=last.source,
            )
        )
    return results if limit is None else results[-limit:]


def rollup_volume_delta(
    rows: list[VolumeDeltaRecord], timeframe: str, frm: int | None, limit: int | None
) -> list[VolumeDeltaRecord]:
    results: list[VolumeDeltaRecord] = []
    buckets = groupby(rows, key=lambda row: timeframe_bucket_start(row.time, timeframe))
    for bucket, group in buckets:
        if frm is not None and bucket < frm:
            continue
        daily = list(group)
        first = daily[0]
        delta = high = low = 0
        for row in daily:
            high = max(high, delta + row.delta_high)
            low = min(low, delta + row.delta_low)
            delta += row.delta
        results.append(
            VolumeDeltaRecord(
                symbol=first.symbol,
                contract=first.contract,
                timeframe=timeframe,
                time=bucket,
                volume=sum(row.volume for row in daily),
                buy_volume=sum(row.buy_volume for row in daily),
                sell_volume=sum(row.sell_volume for row in daily),
                delta=delta,
                delta_high=high,
                delta_low=low,
                open_delta=0,
                close_delta=delta,
            )
        )
    return results if limit is None else results[-limit:]
