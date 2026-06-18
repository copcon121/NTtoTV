from app.analyst.snapshot_builder import SnapshotBuilder, TIMEFRAME_MAP
from app.storage.records import BarRecord, VolumeDeltaRecord


def _bar(tf: str, i: int, close: float) -> BarRecord:
    return BarRecord(
        symbol="GC",
        contract="GC",
        timeframe=tf,
        time=i * 60_000,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=1,
        closed=True,
    )


def _vd(tf: str, i: int, delta: int) -> VolumeDeltaRecord:
    return VolumeDeltaRecord(
        symbol="GC",
        contract="GC",
        timeframe=tf,
        time=i * 60_000,
        volume=abs(delta),
        buy_volume=max(0, delta),
        sell_volume=max(0, -delta),
        delta=delta,
        delta_high=max(0, delta),
        delta_low=min(0, delta),
        open_delta=delta,
        close_delta=delta,
    )


class FakeCache:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str, str]] = []

    def read_bars(self, symbol, contract, timeframe, *_, **__):
        self.calls.append(("bars", symbol, contract, timeframe))
        return [_bar(timeframe, 1, 100.0), _bar(timeframe, 2, 101.0)]

    def read_volume_delta(self, symbol, contract, timeframe, *_, **__):
        self.calls.append(("cvd", symbol, contract, timeframe))
        return [_vd(timeframe, 1, -5), _vd(timeframe, 2, 8)]

    def read_footprint_bars(self, *_, **__):
        raise AssertionError("snapshot builder must not read footprint")

    def read_footprint_levels_range(self, *_, **__):
        raise AssertionError("snapshot builder must not read delta-profile")


class MissingCvdCache(FakeCache):
    def read_volume_delta(self, symbol, contract, timeframe, *_, **__):
        self.calls.append(("cvd", symbol, contract, timeframe))
        return []


def test_snapshot_builder_uses_chart_contract_and_only_bars_plus_cvd():
    cache = FakeCache()
    snapshot = SnapshotBuilder(cache).build(snapshot_time=123)

    expected_tfs = {tf for _, tf, _ in TIMEFRAME_MAP}
    assert snapshot.symbol == "GC"
    assert snapshot.contract == "GC"
    assert set(snapshot.timeframes) == {"H1", "M15", "M5"}
    assert {call[3] for call in cache.calls if call[0] == "bars"} == expected_tfs
    assert {call[3] for call in cache.calls if call[0] == "cvd"} == expected_tfs
    assert all(call[1] == "GC" and call[2] == "GC" for call in cache.calls)
    assert "zones" in snapshot.timeframes["M5"]["smc"]
    assert "zoneContext" in snapshot.timeframes["M5"]["smc"]
    assert "zoneSummary" in snapshot.timeframes["M5"]["smc"]
    assert len(snapshot.timeframes["M5"]["smc"]["zones"]) <= 3
    assert "M1" not in snapshot.timeframes


def test_snapshot_builder_marks_missing_cvd_but_still_returns_snapshot():
    snapshot = SnapshotBuilder(MissingCvdCache()).build(snapshot_time=123)

    assert "missing_cvd_H1" in snapshot.data_quality
    assert snapshot.timeframes["M5"]["cvd"]["status"] == "missing"
    assert snapshot.decision_context["allowedToAutoTrade"] is False
    assert snapshot.decision_context["riskState"] != "candidate"
