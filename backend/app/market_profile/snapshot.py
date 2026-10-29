"""Build factual TPO/volume and daily-candle context, bounded by asOf."""

from __future__ import annotations

import math
from collections import defaultdict

from ..rest.orderflow import _minute_bar_profile_to_dict
from ..storage.cache_store import CacheStore
from .calendar import HOUR_MS, PLANNER_VERSION, current_slot, session_windows, trading_days

STEP = 0.5
MINUTE = 60_000
BRACKET = 30 * MINUTE


def tpo_profile(bars: list, start: int) -> dict:
    """Same 30-minute brackets, row step, POC tie-break and VA as /mp."""
    rows: dict[int, set[int]] = defaultdict(set)
    for bar in bars:
        bracket = (bar.time - start) // BRACKET
        for row in range(math.floor(bar.low / STEP), math.floor(bar.high / STEP) + 1):
            rows[row].add(bracket)
    prices = sorted(rows)
    if not prices:
        return {"rows": [], "poc": None, "vah": None, "val": None}
    total = sum(len(rows[p]) for p in prices)
    mean = sum(p * len(rows[p]) for p in prices) / total
    poc_i = min(range(len(prices)), key=lambda i: (-len(rows[prices[i]]), abs(prices[i] - mean), i))
    lo = hi = poc_i
    included = len(rows[prices[poc_i]])
    while included < total * 0.7 and (lo > 0 or hi < len(prices) - 1):
        below = len(rows[prices[lo - 1]]) if lo > 0 else -1
        above = len(rows[prices[hi + 1]]) if hi < len(prices) - 1 else -1
        if above >= below:
            hi += 1
            included += len(rows[prices[hi]])
        else:
            lo -= 1
            included += len(rows[prices[lo]])
    return {
        "rows": [[round(p * STEP, 2), len(rows[p])] for p in prices],
        "poc": round(prices[poc_i] * STEP, 2),
        "val": round(prices[lo] * STEP, 2),
        "vah": round(prices[hi] * STEP, 2),
        "bracketMinutes": 30,
        "singlePrintRanges": _single_print_ranges(prices, rows),
    }


def _single_print_ranges(prices: list[int], rows: dict) -> list[list[float]]:
    ranges: list[list[float]] = []
    for p in prices:
        if len(rows[p]) != 1:
            continue
        price = round(p * STEP, 2)
        if ranges and abs(ranges[-1][1] + STEP - price) < 1e-6:
            ranges[-1][1] = price
        else:
            ranges.append([price, price])
    return ranges


def _ohlcv(bars: list) -> dict | None:
    if not bars:
        return None
    return {
        "open": bars[0].open, "high": max(b.high for b in bars),
        "low": min(b.low for b in bars), "close": bars[-1].close,
        "volume": sum(b.volume for b in bars),
    }


def build_snapshot(cache: CacheStore, as_of: int, previous_plans: list[dict]) -> dict:
    days = trading_days(as_of, 6)
    slot = current_slot(as_of)
    quality = ["Volume profile estimated from M1 OHLCV; TPO reconstructed from M1 ranges.",
               "Economic-event calendar is not connected."]
    levels: dict[str, dict] = {}

    def level(ref: str, price, label: str, source: str) -> None:
        if price is not None and math.isfinite(float(price)):
            levels[ref] = {"price": round(float(price), 2), "label": label, "source": source}

    profiles: list[dict] = []
    bars_by_day: dict[int, list] = {}
    current_bars: list = []
    for day in days:
        end = min(day["end"], as_of)
        bars = [b for b in cache.read_bars("GC", "GC", "1m", day["start"], end)
                if b.closed and b.time + MINUTE <= as_of and b.volume >= 0
                and all(math.isfinite(x) for x in (b.open, b.high, b.low, b.close))]
        bars_by_day[day["start"]] = bars
        if not bars:
            continue
        expected = max(1, min(1380, (end - day["start"]) // MINUTE))
        if len(bars) < expected * 0.8:
            quality.append(f"{day['tradeDate']}: only {len(bars)}/{expected} expected M1 bars observed.")
        is_current = day["start"] == days[-1]["start"] and as_of <= day["end"]
        if is_current:
            current_bars = bars
        volume = _minute_bar_profile_to_dict(
            symbol="GC", contract="GC", frm=day["start"], to=end,
            row_ticks=5, value_area_pct=70, bars=bars,
        )
        tpo = tpo_profile(bars, day["start"])
        ohlcv = _ohlcv(bars)
        ib_bars = [b for b in bars if b.time < day["start"] + HOUR_MS]
        ib = _ohlcv(ib_bars)
        prefix = day["tradeDate"]
        for mode, data in (("volume", volume), ("tpo", tpo)):
            for key in ("vah", "val", "poc"):
                level(f"{prefix}:{mode}:{key}", data[key], f"{prefix} {mode.upper()} {key.upper()}", mode)
        for key in ("high", "low"):
            level(f"{prefix}:{key}", ohlcv[key], f"{prefix} {key}", "M1")
            if ib:
                level(f"{prefix}:ib:{key}", ib[key], f"{prefix} IB {key}", "M1")
        for i, (low, high) in enumerate(tpo["singlePrintRanges"]):
            level(f"{prefix}:single:{i}:low", low, f"{prefix} TPO single print {i + 1} low", "tpo")
            level(f"{prefix}:single:{i}:high", high, f"{prefix} TPO single print {i + 1} high", "tpo")
        # Compact numeric vectors retain the distribution, not just VA levels.
        profiles.append({
            **day, "developing": is_current, "ohlcv": ohlcv,
            "coveredMinutes": len(bars),
            "initialBalance": {"complete": as_of >= day["start"] + HOUR_MS,
                               "observedMinutes": len(ib_bars), "ohlcv": ib},
            "volume": {"poc": volume["poc"], "vah": volume["vah"], "val": volume["val"],
                       "rows": [[r["price"], round(r["totalVolume"], 3)] for r in volume["rows"]]},
            "tpo": tpo,
        })
    # Five most recent completed days, plus the developing day if present.
    completed = [p for p in profiles if not p["developing"]][-5:]
    developing = next((p for p in profiles if p["developing"]), None)
    if len(completed) < 5:
        quality.append(f"Only {len(completed)}/5 completed profile days available.")
    if not completed:
        quality.append("No previous completed profile is available.")
    latest = cache.read_bars("GC", "GC", "1m", to=as_of, limit=1)
    # Never read a completed future portion of a candle in a historical snapshot.
    last = current_bars[-1].close if current_bars else (completed[-1]["ohlcv"]["close"] if completed else None)
    if latest and not latest[-1].closed and latest[-1].time <= as_of:
        # Live caller only: current OHLCV must not be passed for historical replay.
        from ..models.timestamp import now_ms
        if abs(now_ms() - as_of) < 5_000:
            last = latest[-1].close
    daily = []
    for b in cache.read_bars("GC", "GC", "1D", to=as_of, limit=35):
        day_end = b.time + 23 * HOUR_MS
        if b.closed and day_end <= as_of:
            daily.append({"time": b.time, "open": b.open, "high": b.high, "low": b.low,
                          "close": b.close, "volume": b.volume, "closed": True})
    daily = daily[-20:]
    if len(daily) < 20:
        quality.append(f"Only {len(daily)}/20 closed daily candles available.")
    def session_data(window: dict, bars: list, historical: bool) -> dict:
        start, end, name = window["start"], window["end"], window["name"]
        observed = [b for b in bars if start <= b.time <= end and b.time + MINUTE <= as_of]
        ib_bars = [b for b in observed if b.time < start + HOUR_MS]
        summary, ib = _ohlcv(observed), _ohlcv(ib_bars)
        elapsed = as_of > end
        expected = max(0, (min(end + 1, as_of) - start) // MINUTE)
        exact_close = bool(elapsed and observed and observed[-1].time + MINUTE == end + 1)
        close = summary["close"] if summary and exact_close else None
        prefix = f"session:{window['tradeDate']}:{name}" if historical else f"session:{name}"
        refs = {}
        for key in ("high", "low"):
            if summary:
                level(f"{prefix}:{key}", summary[key], f"{window['tradeDate']} {name.upper()} {key}", "M1")
            if ib:
                level(f"{prefix}:ib:{key}", ib[key], f"{window['tradeDate']} {name.upper()} IB {key}", "M1")
        if close is not None:
            refs["close"] = f"{prefix}:close"
            level(refs["close"], close, f"{window['tradeDate']} {name.upper()} close", "session_close_M1")
        volume = _minute_bar_profile_to_dict(
            symbol="GC", contract="GC", frm=start, to=min(end, as_of),
            row_ticks=5, value_area_pct=70, bars=observed,
        ) if observed else None
        if volume:
            for key in ("vah", "val", "poc"):
                refs[key] = f"{prefix}:volume:{key}"
                level(refs[key], volume[key], f"{window['tradeDate']} {name.upper()} Volume {key.upper()}", "session_volume_M1_estimate")
        if historical and (not exact_close or len(observed) < expected * .8):
            quality.append(f"{window['tradeDate']} {name}: {len(observed)}/{expected} M1 bars; exact session close {'available' if exact_close else 'missing'}.")
        return {**window, "complete": elapsed, "ohlcv": summary,
                "open": observed[0].open if observed and observed[0].time == start else None,
                "close": close, "closeObservedAt": end + 1 if exact_close else None,
                "lastObservedPrice": summary["close"] if summary else None,
                "coveredMinutes": len(observed), "expectedMinutes": expected,
                "initialBalance": {"complete": bool(ib and as_of >= start + HOUR_MS),
                                   "observedMinutes": len(ib_bars), "ohlcv": ib},
                "volume": ({key: volume[key] for key in ("vah", "val", "poc")} | {
                    "rows": [[r["price"], round(r["totalVolume"], 3)] for r in volume["rows"]]
                }) if volume else None, "levelRefs": refs}

    sessions = [session_data(w, current_bars, False) for w in session_windows(days[-1]) if w["start"] <= as_of]
    previous_sessions = {w["name"]: session_data(w, bars_by_day.get(days[-2]["start"], []), True)
                         for w in session_windows(days[-2])}
    same_previous = previous_sessions.get(slot["name"]) if slot else None
    us_previous = previous_sessions["us"]
    current_session = next((s for s in sessions if slot and s["name"] == slot["name"]), None)
    session_open = current_session["open"] if current_session else None
    if session_open is None and slot and latest and latest[-1].time == slot["start"]:
        from ..models.timestamp import now_ms
        if abs(now_ms() - as_of) < 5_000:
            session_open = latest[-1].open

    def position(price, value):
        if price is None or not value or value["val"] is None or value["vah"] is None:
            return "unknown"
        return "above_value" if price > value["vah"] else "below_value" if price < value["val"] else "inside_value"

    previous_close = same_previous["close"] if same_previous else None

    def anchor(session):
        if not session:
            return None
        return {**{key: session[key] for key in ("tradeDate", "name", "start", "end", "open", "close", "closeObservedAt", "coveredMinutes", "expectedMinutes", "levelRefs")},
                "volume": {key: session["volume"][key] for key in ("vah", "val", "poc")} if session["volume"] else None}

    opening_context = {
        "session": slot["name"] if slot else None, "sessionOpen": session_open,
        "previousSameSession": anchor(same_previous),
        "openingGapVsPreviousSessionClose": (round(session_open - previous_close, 2)
            if session_open is not None and previous_close is not None else None),
        "previousUsSession": anchor(us_previous),
        "openVsPreviousUsValue": position(session_open, us_previous["volume"]),
        "currentVsPreviousUsValue": position(last, us_previous["volume"]),
        "closeMeaning": "Observed last M1 close of the custom session, not an official settlement.",
    }
    previous = completed[-1] if completed else None
    location = "unknown"
    if previous and last is not None:
        va = previous["volume"]
        if va["val"] is not None and va["vah"] is not None:
            location = "above_value" if last > va["vah"] else "below_value" if last < va["val"] else "inside_value"
    total_volume = sum(b.volume for b in current_bars)
    tested = []
    for ref, item in levels.items():
        touches = [b.time for b in current_bars if b.low <= item["price"] <= b.high]
        if touches:
            tested.append([ref, touches[0], touches[-1], len(touches)])
    return {
        "symbol": "GC", "contract": "GC", "asOf": as_of, "slot": slot,
        "plannerVersion": PLANNER_VERSION, "sessionTimezone": "Asia/Bangkok",
        "primaryValueArea": "volume", "rowTicks": 5, "valueAreaPct": 70,
        "profiles": completed + ([developing] if developing else []),
        "dailyCandles": daily,
        "developingDaily": developing["ohlcv"] if developing else None,
        "current": {"price": last, "positionVsPreviousValue": location,
                    "vwapApprox": (sum((b.high + b.low + b.close) / 3 * b.volume for b in current_bars)
                                   / total_volume if total_volume else None)},
        "sessions": sessions, "previousSessions": previous_sessions,
        "openingContext": opening_context, "levels": levels,
        "alertPolicy": {"dailyMax": 0, "sessionMax": 2, "allowZero": True,
                        "ownership": "latest valid session plan only; daily is context",
                        "selection": "Rank decision zones by evidence and confluence; one representative level per zone. No numeric win probabilities."},
        "testedLevels": {"method": "M1 range overlap (approximate)",
                         "columns": ["levelRef", "firstTime", "lastTime", "observedMinutes"], "rows": tested},
        "previousPlans": previous_plans, "dataQuality": quality,
    }
