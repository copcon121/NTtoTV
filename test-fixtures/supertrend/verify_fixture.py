"""Verify the language-neutral Pine-v4 Supertrend golden fixture.

This helper is deliberately isolated from application code.  It uses Decimal
arithmetic so the checked values are independent of JavaScript/Python binary
floating-point rounding in future production implementations.
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any


FIXTURE = Path(__file__).with_name("pine_v4_supertrend_golden.json")
FIELDS = (
    "time",
    "tr",
    "atr",
    "basicLower",
    "basicUpper",
    "finalLower",
    "finalUpper",
    "trend",
    "buySignal",
    "sellSignal",
    "changeSignal",
)


def dec(value: Any) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def load_fixture() -> dict[str, Any]:
    with FIXTURE.open("r", encoding="utf-8") as handle:
        return json.load(handle, parse_float=Decimal)


def true_ranges(bars: list[dict[str, Any]], *, handle_first_na: bool) -> list[Decimal | None]:
    result: list[Decimal | None] = []
    for index, bar in enumerate(bars):
        high = dec(bar["high"])
        low = dec(bar["low"])
        if index == 0:
            result.append(high - low if handle_first_na else None)
            continue
        previous_close = dec(bars[index - 1]["close"])
        result.append(
            max(
                high - low,
                abs(high - previous_close),
                abs(low - previous_close),
            )
        )
    return result


def atr_values(
    ranges: list[Decimal | None], *, period: int, mode: str
) -> list[Decimal | None]:
    values: list[Decimal] = []
    output: list[Decimal | None] = []
    previous: Decimal | None = None
    divisor = Decimal(period)

    for current in ranges:
        if current is not None:
            values.append(current)

        if mode == "wilderRma":
            if current is None:
                output.append(None)
                continue
            if previous is None:
                if len(values) < period:
                    output.append(None)
                    continue
                previous = sum(values[-period:], Decimal(0)) / divisor
            else:
                previous = (previous * Decimal(period - 1) + current) / divisor
            output.append(previous)
            continue

        if mode == "simpleSma":
            output.append(
                sum(values[-period:], Decimal(0)) / divisor
                if len(values) >= period
                else None
            )
            continue

        raise AssertionError(f"unknown ATR mode: {mode}")

    return output


def calculate(
    bars: list[dict[str, Any]], settings: dict[str, Any], mode: str
) -> list[dict[str, Any]]:
    period = int(settings["period"])
    multiplier = dec(settings["multiplier"])
    initial_trend = int(settings["initialTrend"])
    ranges = true_ranges(bars, handle_first_na=mode == "wilderRma")
    atrs = atr_values(ranges, period=period, mode=mode)

    final_lowers: list[Decimal | None] = []
    final_uppers: list[Decimal | None] = []
    trends: list[int] = []
    output: list[dict[str, Any]] = []

    for index, (bar, tr, atr) in enumerate(zip(bars, ranges, atrs, strict=True)):
        previous_trend = trends[index - 1] if index else initial_trend
        trend = previous_trend
        basic_lower: Decimal | None = None
        basic_upper: Decimal | None = None
        final_lower: Decimal | None = None
        final_upper: Decimal | None = None

        if atr is not None:
            source = (dec(bar["high"]) + dec(bar["low"])) / Decimal(2)
            basic_lower = source - multiplier * atr
            basic_upper = source + multiplier * atr
            previous_lower = (
                final_lowers[index - 1]
                if index and final_lowers[index - 1] is not None
                else basic_lower
            )
            previous_upper = (
                final_uppers[index - 1]
                if index and final_uppers[index - 1] is not None
                else basic_upper
            )
            assert previous_lower is not None and previous_upper is not None

            previous_close = dec(bars[index - 1]["close"]) if index else None
            final_lower = (
                max(basic_lower, previous_lower)
                if previous_close is not None and previous_close > previous_lower
                else basic_lower
            )
            final_upper = (
                min(basic_upper, previous_upper)
                if previous_close is not None and previous_close < previous_upper
                else basic_upper
            )

            close = dec(bar["close"])
            if previous_trend == -1 and close > previous_upper:
                trend = 1
            elif previous_trend == 1 and close < previous_lower:
                trend = -1

        buy = trend == 1 and previous_trend == -1
        sell = trend == -1 and previous_trend == 1
        final_lowers.append(final_lower)
        final_uppers.append(final_upper)
        trends.append(trend)
        output.append(
            {
                "time": int(bar["time"]),
                "tr": tr,
                "atr": atr,
                "basicLower": basic_lower,
                "basicUpper": basic_upper,
                "finalLower": final_lower,
                "finalUpper": final_upper,
                "trend": trend,
                "buySignal": buy,
                "sellSignal": sell,
                "changeSignal": buy or sell,
            }
        )

    return output


def assert_value(actual: Any, expected: Any, path: str) -> None:
    if expected is None or isinstance(expected, bool):
        if actual is not expected:
            raise AssertionError(f"{path}: expected {expected!r}, got {actual!r}")
        return
    if isinstance(actual, Decimal) or isinstance(expected, Decimal):
        if actual is None or dec(actual) != dec(expected):
            raise AssertionError(f"{path}: expected {expected!r}, got {actual!r}")
        return
    if actual != expected:
        raise AssertionError(f"{path}: expected {expected!r}, got {actual!r}")


def assert_rows(actual: list[dict[str, Any]], expected: list[dict[str, Any]], label: str) -> None:
    if len(actual) != len(expected):
        raise AssertionError(f"{label}: expected {len(expected)} rows, got {len(actual)}")
    for index, (actual_row, expected_row) in enumerate(zip(actual, expected, strict=True)):
        for field in FIELDS:
            assert_value(actual_row[field], expected_row[field], f"{label}[{index}].{field}")


def row_at(rows: list[dict[str, Any]], time: int) -> dict[str, Any]:
    return next(row for row in rows if row["time"] == time)


def validate_fixture(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != 1:
        raise AssertionError("unsupported schemaVersion")
    settings = data["settings"]
    if settings["source"] != "hl2":
        raise AssertionError("this fixture requires source=hl2")
    if int(settings["period"]) <= 0 or dec(settings["multiplier"]) <= 0:
        raise AssertionError("period and multiplier must be positive")

    bars = data["bars"]
    times = [int(bar["time"]) for bar in bars]
    if times != sorted(times) or len(times) != len(set(times)):
        raise AssertionError("bars must have unique ascending times")
    for index, bar in enumerate(bars):
        low, high = dec(bar["low"]), dec(bar["high"])
        if low > high or not (low <= dec(bar["open"]) <= high) or not (
            low <= dec(bar["close"]) <= high
        ):
            raise AssertionError(f"bars[{index}] has invalid OHLC")

    calculated: dict[str, list[dict[str, Any]]] = {}
    for mode in ("wilderRma", "simpleSma"):
        calculated[mode] = calculate(bars, settings, mode)
        assert_rows(calculated[mode], data["expected"][mode], f"expected.{mode}")

    # Semantic coverage checks: these fail if the vectors stop exercising the
    # edge cases named in the fixture, even if expected rows are edited too.
    rma = calculated["wilderRma"]
    sma = calculated["simpleSma"]
    assert row_at(rma, 60000)["atr"] == Decimal(2)
    assert row_at(sma, 60000)["atr"] is None
    assert row_at(rma, 240000)["tr"] == row_at(sma, 240000)["tr"] == Decimal(4)
    assert dec(bars[4]["close"]) == row_at(rma, 180000)["finalUpper"]
    assert not row_at(rma, 240000)["buySignal"] and not row_at(sma, 240000)["buySignal"]
    assert dec(bars[7]["close"]) == row_at(sma, 360000)["finalLower"]
    assert row_at(rma, 420000)["sellSignal"] and not row_at(sma, 420000)["sellSignal"]
    assert row_at(sma, 480000)["sellSignal"]

    probe = data["realtimeRollbackProbe"]
    base_time = int(probe["baseThroughTime"])
    base_index = times.index(base_time)
    base_bars = bars[: base_index + 1]
    for snapshot in probe["snapshots"]:
        independently_replayed = calculate(
            [*base_bars, snapshot["bar"]], settings, probe["mode"]
        )[-1:]
        assert_rows(
            independently_replayed,
            [snapshot["expected"]],
            f"realtimeRollbackProbe.{snapshot['id']}",
        )


def main() -> None:
    data = load_fixture()
    validate_fixture(data)
    print(
        "OK: 9 closed bars x 2 ATR modes plus 2 independent realtime "
        "rollback snapshots"
    )


if __name__ == "__main__":
    main()
