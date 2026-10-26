"""Deterministic ladder calculations and replaceable intrabar snapshots.

Reconstructs the root OF7 analysis report; this is not replay-verified DLL parity.
No dependency on live pipeline, storage, broker, or frontend state.
"""

from dataclasses import replace
from decimal import Decimal

from .config import OF7Config
from .models import OF7Bar, OF7Frame, OF7Snapshot
from .signals import detect_signals
from .research import research_signals, RESEARCH_POLICY_VERSION
from .unfinished import OF7UnfinishedTracker


def price_to_ticks(price: float | str, tick_size: float = 0.1) -> int:
    value = Decimal(str(price)) / Decimal(str(tick_size))
    if not value.is_finite() or value != value.to_integral_value():
        raise ValueError("price must be finite and aligned to tick_size")
    return int(value)


def build_frame(
    bar: OF7Bar, config: OF7Config, *, is_session_high: bool = False,
    is_session_low: bool = False,
) -> OF7Frame:
    cells = {c.price: c for c in bar.cells}

    def volume(p: int, attr: str = "volume") -> int:
        cell = cells.get(p)
        return getattr(cell, attr) if cell is not None else 0

    def poc_for(attr: str) -> int | None:
        if not cells or not any(volume(p, attr) for p in cells):
            return None
        # Side POCs use side-volume neighborhoods, general POC uses total.
        # Remaining ties: deterministic lowest price (not established by report).
        return max(cells, key=lambda p: (volume(p, attr),
                   sum(volume(q, attr) for q in (p - 1, p, p + 1)), -p))

    poc = poc_for("volume")
    val = vah = poc
    if poc is not None:
        prices = sorted(cells)
        left = right = prices.index(poc)
        collected = volume(poc)
        target = bar.volume * config.value_area_percent / 100
        while collected < target and (left > 0 or right < len(prices) - 1):
            lower = volume(prices[left - 1]) if left > 0 else -1
            upper = volume(prices[right + 1]) if right < len(prices) - 1 else -1
            # BarData expands toward the upper neighbor on a tie.
            if lower > upper and left > 0:
                left -= 1
                collected += volume(prices[left])
            else:
                right += 1
                collected += volume(prices[right])
        val, vah = prices[left], prices[right]
    ratio = config.imbalance_in_percent / 100
    asks = tuple(c.price for c in bar.cells if c.ask >= config.minimal_imbalance_volume
                 and c.price - 1 in cells
                 and ((volume(c.price - 1, "bid") == 0 and c.ask > 0)
                      or (volume(c.price - 1, "bid") > 0 and c.ask >= volume(c.price - 1, "bid") * ratio)))
    bids = tuple(c.price for c in bar.cells if c.bid >= config.minimal_imbalance_volume
                 and c.price + 1 in cells
                 and ((volume(c.price + 1, "ask") == 0 and c.bid > 0)
                      or (volume(c.price + 1, "ask") > 0 and c.bid >= volume(c.price + 1, "ask") * ratio)))
    return OF7Frame(bar, poc, poc_for("bid"), poc_for("ask"), val, vah, asks, bids,
                    is_session_high, is_session_low)


def measurements(frame: OF7Frame) -> dict[str, float | int | None]:
    """Continuous inputs, including ratio values inside the no-signal bounds."""
    bar = frame.bar
    cells = {c.price: c for c in bar.cells}

    def extreme_ratio(up: bool) -> float | None:
        extreme = bar.low if up else bar.high
        adjacent = extreme + 1 if up else extreme - 1
        extreme_cell = cells.get(extreme)
        adjacent_cell = cells.get(adjacent)
        denominator = (extreme_cell.bid if up else extreme_cell.ask) if extreme_cell else 0
        numerator = (adjacent_cell.bid if up else adjacent_cell.ask) if adjacent_cell else 0
        return numerator / denominator if denominator else 0.0

    span = bar.high - bar.low
    return {
        "volume": bar.volume, "delta": bar.delta,
        "observed_volume": bar.observed_volume,
        "unclassified_volume": bar.unclassified_volume,
        "bid_volume": sum(c.bid for c in bar.cells),
        "ask_volume": sum(c.ask for c in bar.cells),
        "between_volume": sum(c.between for c in bar.cells) if bar.between_known else None,
        "delta_fraction": bar.delta / bar.volume if bar.volume else None,
        "range_ticks": span, "body_ticks": bar.close - bar.open,
        "close_location": (bar.close - bar.low) / span if span else None,
        "poc_from_low_ticks": frame.poc - bar.low if frame.poc is not None else None,
        "poc_from_close_ticks": frame.poc - bar.close if frame.poc is not None else None,
        "value_area_width_ticks": frame.vah - frame.val if frame.vah is not None and frame.val is not None else None,
        "ask_imbalance_count": len(frame.ask_imbalances),
        "bid_imbalance_count": len(frame.bid_imbalances),
        "ratio_buy_value": extreme_ratio(True) if bar.up else None,
        "ratio_sell_value": extreme_ratio(False) if bar.down else None,
        "ratio_denominator": (cells[bar.low].bid if bar.low in cells else 0) if bar.up else (
            (cells[bar.high].ask if bar.high in cells else 0) if bar.down else None),
    }


class OF7Engine:
    """One engine per source, source contract, timeframe, and configuration.

    Supply snapshots in observed order. Replace current live bar, explicitly close
    it, then advance. Closed bars cannot be revised here; use a fresh replay for
    corrected history. Source switches require a new engine and dataset segment.
    """

    def __init__(self, config: OF7Config | None = None) -> None:
        self.config = config or OF7Config()
        self._frames: list[OF7Frame] = []
        self._observed_at = -1
        self._identity: tuple[str, str, int] | None = None
        self._session_id: str | None = None
        self._session_high: int | None = None
        self._session_low: int | None = None
        self._bar_index = -1
        self._unfinished_tracker = OF7UnfinishedTracker()
        self._unfinished_state = None

    def update(self, bar: OF7Bar, *, observed_at: int,
               calculated_frame: OF7Frame | None = None) -> OF7Snapshot:
        if type(observed_at) is not int or observed_at < max(self._observed_at, bar.time):
            raise ValueError("observed_at must be monotonic UTC ms after bar start")
        if bar.is_closed and observed_at < bar.time + bar.timeframe_ms:
            raise ValueError("closed bar cannot be known before its end")
        identity = (bar.source, bar.source_contract, bar.timeframe_ms)
        if self._identity is not None and self._identity != identity:
            raise ValueError("source/contract/timeframe changed; start a separate engine")
        previous = self._frames[-1] if self._frames else None
        replacing = previous is not None and bar.time == previous.bar.time
        bar_index = bar.reference_bar_index
        if bar_index is None:
            bar_index = self._bar_index if replacing else self._bar_index + 1
        current_bar_index = bar.reference_current_bar_index
        if current_bar_index is None:
            current_bar_index = bar_index
        if current_bar_index < bar_index:
            raise ValueError("reference CurrentBar cannot precede evaluated bar")
        if previous is not None:
            if bar.time < previous.bar.time or (replacing and previous.bar.is_closed):
                raise ValueError("closed or older bar cannot be revised")
            if not replacing and not previous.bar.is_closed:
                raise ValueError("close the previous bar explicitly before advancing")
            if not replacing and bar.time < previous.bar.time + bar.timeframe_ms:
                raise ValueError("bars cannot overlap within one timeframe")
            if replacing and bar.session_id != previous.bar.session_id:
                raise ValueError("session cannot change inside a bar")
            if (replacing and bar_index != self._bar_index) or (not replacing and bar_index <= self._bar_index):
                raise ValueError("reference chart bar index must advance with the bar")
            if not replacing and bar_index != self._bar_index + 1:
                raise ValueError("reference chart bar index gap; start a new engine with fresh history")
        high = self._session_high if self._session_id == bar.session_id else None
        low = self._session_low if self._session_id == bar.session_id else None
        # Session extrema exclude current live bar, so intrabar updates are pure
        # replacements rather than repeated session-state advancement.
        if calculated_frame is not None and calculated_frame.bar != bar:
            raise ValueError("calculated frame must reference the same bar snapshot")
        frame = replace(calculated_frame, is_session_high=high is None or bar.high >= high,
                        is_session_low=low is None or bar.low <= low) if calculated_frame is not None else (
            build_frame(bar, self.config, is_session_high=high is None or bar.high >= high,
                        is_session_low=low is None or bar.low <= low))
        frames = self._frames[:-1] + [frame] if replacing else self._frames + [frame]
        signals = detect_signals(frames, self.config, bar_index=bar_index, current_bar_index=current_bar_index)
        corrected = research_signals(frames, self.config, bar_index=bar_index, current_bar_index=current_bar_index)
        warnings = [
            "chart_detector_runtime_parity_not_verified",
            "session_start_coverage_not_verified",
        ]
        if calculated_frame is None:
            warnings.extend(("aggregate_ladder_cannot_recover_tick_order_poc_and_incremental_va",
                             "bid_poc_uses_side_maximum_not_dll_update_order_quirk"))
        if not bar.between_known:
            warnings.append("between_volume_unknown_poc_and_value_area_may_differ")
        if bar.observed_volume is None:
            warnings.append("observed_input_volume_not_supplied")
        elif bar.unclassified_volume:
            warnings.append("unclassified_trade_volume_present")
        if any(f.bar.unclassified_volume for f in frames[:-1]):
            warnings.append("lookback_contains_unclassified_trade_volume")
        if any(not f.bar.between_known for f in frames[:-1]):
            warnings.append("lookback_between_volume_unknown_multi_bar_signals_may_differ")
        if any(b.bar.time != a.bar.time + bar.timeframe_ms for a, b in zip(frames, frames[1:])):
            warnings.append("history_has_time_gaps_check_session_break_or_data_loss")
        if bar.source == "unknown" or bar.source_contract == "unknown":
            warnings.append("source_provenance_missing")
        if not bar.is_closed:
            warnings.append("provisional_signals_can_disappear")
        if len(frames) < self.config.required_history:
            warnings.append("history_warmup_incomplete")
        self._identity = identity
        self._observed_at = observed_at
        self._bar_index = bar_index
        self._frames = frames[-(self.config.required_history + 1):]
        if bar.is_closed:
            self._unfinished_state = self._unfinished_tracker.update(bar, bar_index=bar_index)
            self._session_id = bar.session_id
            self._session_high = max(high, bar.high) if high is not None else bar.high
            self._session_low = min(low, bar.low) if low is not None else bar.low
        return OF7Snapshot(frame, signals, observed_at, self.config.fingerprint, tuple(warnings),
                           measurements=measurements(frame), analysis_signals=corrected,
                           research_policy_version=RESEARCH_POLICY_VERSION,
                           calculation_basis="supplied_calculated_frame" if calculated_frame is not None
                           else "aggregate_snapshot_approximation",
                           unfinished_business=self._unfinished_state)
