"""DLL-source reconstruction of OF7 7.0.1.0 detector rules.

Prices are integer ladder ticks. Each evaluation is a fresh snapshot, so an
intrabar signal can disappear on the next call just as OF7 resets its series.
Closed-series native validation scope is documented in OF7-VALIDATION.md;
it does not establish every parameter combination or intrabar timing. Zone
lifetimes, renderer behavior and processor reconciliation are outside this module.
"""

from __future__ import annotations

from collections.abc import Sequence

from .config import OF7Config
from .models import OF7Cell, OF7Frame, OF7Signal


def _clusters(prices: Sequence[int], selected: Sequence[int], minimum: int) -> list[tuple[int, ...]]:
    """Runs of qualifying sorted ladder keys, as iterated by the DLL.

    Missing numeric prices are not iterated. A present nonqualifying key ends a
    run. This matters for sparse ladders, which are not automatically zero-filled.
    """
    groups: list[tuple[int, ...]] = []
    run: list[int] = []
    chosen = set(selected)
    for price in prices:
        if price not in chosen:
            if len(run) >= minimum:
                groups.append(tuple(run))
            run = []
        else:
            run.append(price)
    if len(run) >= minimum:
        groups.append(tuple(run))
    return groups


def _swing(
    frames: Sequence[OF7Frame], config: OF7Config, feature: str,
    *, offset: int = 0, allow_equal: bool = False, bar_index: int | None = None,
    current_bar_index: int | None = None,
) -> bool:
    bar_index = len(frames) - 1 if bar_index is None else bar_index
    current_bar_index = bar_index if current_bar_index is None else current_bar_index
    # This check precedes !useLookBack in base DetectSwing, including when the
    # feature's swing filter is disabled. Historical fast mode may be one ahead.
    if current_bar_index <= offset + 1:
        return False
    if feature not in config.lookback_features:
        return True
    end = len(frames) - 1 - offset
    count = min(config.global_lookback_period + 1, bar_index - offset)
    start = end - count
    if count <= 0 or start < 0 or end < 0:
        return False
    target = frames[end].bar
    direction = frames[-1].bar  # offset changes price index, NOT barData direction.
    older = [frame.bar for frame in frames[start:end]]
    if direction.up:
        extreme = min(bar.low for bar in older)
        return target.low <= extreme if allow_equal else target.low < extreme
    if direction.down:
        extreme = max(bar.high for bar in older)
        return target.high >= extreme if allow_equal else target.high > extreme
    return False


def _imbalance(
    cells: dict[int, OF7Cell], price: int, side: str,
    minimum: int, percent: float,
) -> bool:
    cell = cells.get(price)
    other = cells.get(price - 1 if side == "ask" else price + 1)
    if cell is None or other is None:
        return False
    volume = cell.ask if side == "ask" else cell.bid
    denominator = other.bid if side == "ask" else other.ask
    return volume >= minimum and ((denominator == 0 and volume > 0)
                                  or (denominator > 0 and volume * 100 >= denominator * percent))


def detect_signals(
    frames: Sequence[OF7Frame], config: OF7Config, *, bar_index: int | None = None,
    current_bar_index: int | None = None,
) -> tuple[OF7Signal, ...]:
    """Evaluate current frame against earlier frames, never against future bars.

    ``side`` follows the zone's direction; ``original_series`` preserves the
    documented DLL mislabels. Value Area is a fixed output, including neutral
    doji bars, and must not be counted as a directional trading signal.
    """
    if not frames:
        return ()
    bar_index = len(frames) - 1 if bar_index is None else bar_index
    current_bar_index = bar_index if current_bar_index is None else current_bar_index
    if bar_index < 0 or current_bar_index < bar_index:
        raise ValueError("invalid reference bar indices")
    frame = frames[-1]
    bar = frame.bar
    cells = {cell.price: cell for cell in bar.cells}
    prices = sorted(cells)
    previous = frames[-2] if len(frames) >= 2 else None
    old_cells = {cell.price: cell for cell in previous.bar.cells} if previous else {}
    result: list[OF7Signal] = []
    enabled = set(config.enabled_features)
    side = "buy" if bar.up else "sell" if bar.down else "neutral"

    def active(feature: str, *, offset: int = 0, equal: bool = False) -> bool:
        return feature in enabled and _swing(frames, config, feature, offset=offset, allow_equal=equal,
                                             bar_index=bar_index, current_bar_index=current_bar_index)

    def run_end(group: tuple[int, ...]) -> int:
        following = prices.index(group[-1]) + 1
        return prices[following] - 1 if following < len(prices) else bar.high

    def cell_at(price: int) -> OF7Cell:
        # XArray<T>.this[price] returns a shared zero row for a missing key,
        # without inserting that key. Contains-guarded predicates remain separate.
        return cells.get(price, OF7Cell(price))

    def emit(
        feature: str, direction: str, prefix: str, low: int, high: int | None = None,
        *, series: str | None = None, value: int | None = None,
        metrics: dict[str, float] | None = None, warnings: tuple[str, ...] = (),
    ) -> None:
        result.append(OF7Signal(
            feature=feature, side=direction,
            price=value if value is not None else (bar.low if direction == "buy" else bar.high),
            zone_low=low, zone_high=low if high is None else high,
            original_series=series or (prefix + ("Buy" if direction == "buy" else "Sell")),
            metrics=metrics or {}, warnings=warnings,
        ))

    def extreme_zone(feature: str, prefix: str, *, width: int = 1) -> None:
        if side == "buy":
            emit(feature, side, prefix, bar.low, min(bar.high, bar.low + width - 1))
        elif side == "sell":
            emit(feature, side, prefix, max(bar.low, bar.high - width + 1), bar.high)

    def engulfed() -> bool:
        return bool(previous is not None and frame.val is not None and frame.vah is not None
                    and previous.val is not None and previous.vah is not None
                    and frame.val < previous.val and frame.vah > previous.vah)

    if not cells:
        return ()

    feature = "accumulation_distribution"
    if active(feature) and bar_index >= 3 and frame.poc_ask in cells and frame.poc_bid in cells:
        ask = cells[frame.poc_ask].ask
        bid = cells[frame.poc_bid].bid
        second_ask = sorted((cell.ask for cell in cells.values()), reverse=True)[1] if len(cells) > 1 else 0
        second_bid = sorted((cell.bid for cell in cells.values()), reverse=True)[1] if len(cells) > 1 else 0
        if bar.down and ask > bid and (not config.passive_traders_in_control or second_ask > bid):
            emit(feature, "sell", "AccumulationDistribution", frame.poc_ask)
        if bar.up and (bid > ask or not config.passive_traders_in_control or second_bid > ask):
            emit(feature, "buy", "AccumulationDistribution", frame.poc_bid,
                 warnings=("dll_asymmetric_buy_condition",))

    feature = "tails"
    if active(feature) and previous and (not config.tails_check_eva or engulfed()):
        if (bar.down and len(cells) > 1
                and cell_at(bar.high).bid == cell_at(bar.high - 1).bid == 0
                and (not config.tails_check_hh_ll or bar.high > previous.bar.high)):
            emit(feature, "sell", "Tails", bar.high - 1, bar.high, series="TailsBuy",
                 warnings=("dll_series_direction_inverted",))
        if (bar.up and len(cells) > 1
                and cell_at(bar.low).ask == cell_at(bar.low + 1).ask == 0
                and (not config.tails_check_hh_ll or bar.low < previous.bar.low)):
            emit(feature, "buy", "Tails", bar.low, bar.low + 1, series="TailsSell",
                 warnings=("dll_series_direction_inverted",))

    for feature, prefix, daily_only, sign in (
        ("delta_divergence", "DeltaDivergence", config.delta_divergence_only_daily_high_low, 1),
        ("price_action_divergence", "PriceActionDivergence", config.price_action_divergence_only_daily_high_low, -1),
    ):
        if active(feature) and bar_index > 0:
            if bar.up and bar.delta * sign > 0 and (not daily_only or frame.is_session_low):
                extreme_zone(feature, prefix, width=2)
            if bar.down and bar.delta * sign < 0 and (not daily_only or frame.is_session_high):
                extreme_zone(feature, prefix, width=2)

    feature = "exhaustion_prints"
    if active(feature) and bar_index >= 3 and bar.volume > 0 and bar.high != bar.low:
        if bar.up and bar.low in cells and 0 < cells[bar.low].bid <= config.exhaustion_prints_size_limit:
            extreme_zone(feature, "ExhaustionPrints")
        if bar.down and bar.high in cells and 0 < cells[bar.high].ask <= config.exhaustion_prints_size_limit:
            extreme_zone(feature, "ExhaustionPrints")

    feature = "imbalance_reversal"
    if active(feature):
        if bar.up and any(_imbalance(cells, p, "bid", config.imbalance_reversal_minimal_volume,
                                     config.imbalance_in_percent) for p in (bar.low, bar.low + 1)):
            extreme_zone(feature, "ImbalanceReversal", width=2)
        if bar.down and any(_imbalance(cells, p, "ask", config.imbalance_reversal_minimal_volume,
                                       config.imbalance_in_percent) for p in (bar.high, bar.high - 1)):
            extreme_zone(feature, "ImbalanceReversal", width=2)

    feature = "market_sweep"
    if active(feature) and side != "neutral":
        selected = [p for p in prices if (cells[p].bid if bar.up else cells[p].ask)
                    <= config.market_sweep_volume_threshold]
        for group in _clusters(prices, selected, 1):
            if group[-1] - group[0] >= config.market_sweep_cluster_size - 1:
                emit(feature, side, "MarketSweep", group[0], group[-1], metrics={"cluster_size": float(len(group))})

    feature = "market_weakness"
    count = config.market_weakness_sequence_length
    if active(feature) and bar_index - 1 >= count and len(frames) >= count:
        deltas = [f.bar.delta for f in frames[-count:]]
        if count == 1 and side != "neutral":
            extreme_zone(feature, "MarketWeakness")
        elif (bar.up and all(d < 0 for d in deltas) and all(a < b for a, b in zip(deltas, deltas[1:]))) or (
            bar.down and all(d > 0 for d in deltas) and all(a > b for a, b in zip(deltas, deltas[1:]))
        ):
            extreme_zone(feature, "MarketWeakness")

    feature = "orderflows_sequencing"
    if active(feature) and side != "neutral":
        run: list[int] = []
        groups: list[tuple[int, ...]] = []
        prior_volume = 0 if bar.up else float("inf")
        for p in prices:
            volume = cells[p].ask if bar.up else cells[p].bid
            if volume > prior_volume if bar.up else volume < prior_volume:
                run.append(p)
                prior_volume = volume
                continue
            if run and run[-1] - run[0] >= config.orderflows_sequencing_cluster_size - 1:
                groups.append(tuple(run))
            # The DLL discards the breaking row; it is not the first new row.
            run = []
            prior_volume = 0 if bar.up else float("inf")
        if run and run[-1] - run[0] >= config.orderflows_sequencing_cluster_size - 1:
            groups.append(tuple(run))
        for group in groups:
            emit(feature, side, "OrderflowsSequencing", group[0], group[-1],
                 series="OrderflowsSequencingBuy",
                 warnings=("dll_sell_branch_writes_buy_series",) if bar.down else ())

    if frame.poc is not None:
        feature = "poc_slingshot"
        if active(feature) and previous and previous.poc is not None:
            if (bar.up and previous.bar.up and frame.poc < previous.poc) or (
                bar.down and previous.bar.down and frame.poc > previous.poc
            ):
                emit(feature, side, "PocSlingshot", frame.poc)

        for level in range(3):
            feature = f"prominent_poc_level_{level + 1}"
            if feature not in enabled or side == "neutral":
                continue
            count = config.prominent_poc_lookbacks[level]
            count = min(count, bar_index)
            if len(frames) < count + 1:
                continue
            prior_bars = [f.bar for f in frames[-count - 1:-1]] if count else []
            distance = frame.poc - bar.low if bar.up else bar.high - frame.poc
            extreme = not prior_bars or (bar.low <= min(b.low for b in prior_bars) if bar.up
                                         else bar.high >= max(b.high for b in prior_bars))
            cell_delta = cells[frame.poc].delta if frame.poc in cells else 0
            delta_ok = not config.prominent_poc_check_delta[level] or (cell_delta > 0 if bar.up else cell_delta < 0)
            if extreme and distance <= config.prominent_poc_distances[level] - 1 and delta_ok:
                emit(feature, side, f"ProminentPocLevel{level + 1}", frame.poc,
                     metrics={"distance_ticks": float(distance)})
                break

    feature = "thin_prints"
    if active(feature) and side != "neutral":
        for p in prices[1:-1]:
            volume = cells[p].bid if bar.up else cells[p].ask
            if volume <= config.thin_prints_maximum_volume:
                emit(feature, side, "ThinPrints", p, metrics={"cell_volume": float(volume)})

    if side != "neutral":
        endpoint = bar.low if bar.up else bar.high
        adjacent = endpoint + 1 if bar.up else endpoint - 1
        # Direct XArray reads include missing-neighbor zero rows.
        denominator = cell_at(endpoint).bid if bar.up else cell_at(endpoint).ask
        numerator = cell_at(adjacent).bid if bar.up else cell_at(adjacent).ask
        ratio = numerator / denominator if denominator else 0.0
        feature = "ratio_price_defense" if ratio < config.ratio_bounds_low else (
            "ratio_price_exhaustion" if ratio > config.ratio_bounds_high else "")
        if feature and active(feature):
            prefix = "OrderflowsRatioPxDefense" if feature == "ratio_price_defense" else "OrderflowsRatioPxExhaustion"
            emit(feature, side, prefix, endpoint - 1 if bar.up else endpoint + 1,
                 metrics={"ratio": ratio, "denominator": float(denominator)},
                 warnings=("dll_zero_denominator_maps_to_zero",) if not denominator else ())

    feature = "zero_print"
    if active(feature):
        if bar.up and any(p in cells and cells[p].bid == 0 for p in (bar.low, bar.low + 1)):
            emit(feature, "buy", "ZeroPrint", bar.low, bar.low + 1, series="ZeroPrintBuy")
        if bar.down and any(p in cells and cells[p].ask == 0 for p in (bar.high, bar.high - 1)):
            emit(feature, "sell", "ZeroPrint", bar.high - 1, bar.high,
                 series="ZeroPrintBuy", warnings=("dll_sell_branch_writes_buy_series",))

    feature = "value_area"
    if feature in enabled and frame.val is not None and frame.vah is not None:
        for name, value in (("Value Area Low", frame.val), ("Value Area High", frame.vah)):
            emit(feature, side, "", frame.val, frame.vah, series=name, value=value,
                 warnings=("fixed_level_not_directional_signal",))

    feature = "engulfing_value_area"
    if feature in enabled and bar_index >= 1 and engulfed() and side != "neutral":
        emit(feature, side, "EngulfingValueArea", frame.val, frame.vah)

    feature = "multiple_imbalances"
    if active(feature) and side != "neutral":
        count = len(frame.ask_imbalances if bar.up else frame.bid_imbalances)
        if count >= config.extreme_imbalance_threshold:
            emit(feature, side, "MultipleImbalances", bar.high if bar.up else bar.low,
                 metrics={"imbalance_count": float(count)}, warnings=("duplicate_dll_zones_collapsed",))

    # OF7 returns from its shared method when either enabled filter fails.
    cluster_features = ("inverse_imbalance", "stacked_imbalance")
    if all(feature not in enabled or active(feature) for feature in cluster_features):
        for ladder_side, imbalances in (("ask", frame.ask_imbalances), ("bid", frame.bid_imbalances)):
            for feature, minimum in (("inverse_imbalance", config.inverse_imbalance_cluster_size),
                                     ("stacked_imbalance", config.stacked_imbalance_cluster_size)):
                if feature not in enabled:
                    continue
                for group in _clusters(prices, imbalances, minimum):
                    stacked = feature == "stacked_imbalance"
                    direction = "buy" if (ladder_side == "ask") == stacked else "sell"
                    expected = bar.up if direction == "buy" else bar.down
                    terminal_quirk = stacked and ladder_side == "bid" and group[-1] == prices[-1] and not bar.down
                    if expected or terminal_quirk:
                        emit(feature, direction, "StackedImbalance" if stacked else "InverseVolumeImbalance",
                             group[0], run_end(group), metrics={"cluster_size": float(len(group))},
                             warnings=("dll_terminal_bid_cluster_missing_downbar_guard",) if terminal_quirk else ())

    feature = "open_poc"
    count = min(config.open_poc_lookback_bars, bar_index)
    if feature in enabled and bar_index > 1 and len(frames) >= count + 1 and frame.poc is not None:
        older = [f.bar for f in frames[-count - 1:-1]]
        if (bar.up and frame.poc > max(b.high for b in older)) or (
            bar.down and frame.poc < min(b.low for b in older)
        ):
            emit(feature, side, "OpenPOC", frame.poc)

    feature = "aligned_poc"
    if feature in enabled and bar_index > 0 and previous and frame.poc is not None and previous.poc == frame.poc and side != "neutral":
        emit(feature, side, "AlignedPOC", frame.poc)

    feature = "orderflows_gaps"
    if active(feature, offset=1) and previous and None not in (frame.val, frame.vah, previous.val, previous.vah):
        if bar.up and frame.val - previous.vah > 1:
            emit(feature, "buy", "OrderflowsGaps", previous.vah + 1, frame.val - 1)
        if bar.down and previous.val - frame.vah > 1:
            emit(feature, "sell", "OrderflowsGaps", frame.vah + 1, previous.val - 1)

    feature = "imbalance_reload"
    if feature in enabled and bar_index > 0 and previous:
        if bar.up and previous.bar.up:
            selected = set(frame.ask_imbalances) & set(previous.ask_imbalances)
        elif bar.down and previous.bar.down:
            selected = set(frame.bid_imbalances) & set(previous.bid_imbalances)
        else:
            selected = set()
        for price in sorted(selected):
            if max(bar.low, previous.bar.low) <= price <= min(bar.high, previous.bar.high):
                emit(feature, side, "ImbalanceReload", price)

    for feature, prefix, declining in (("volume_decline", "VolumeDecline", True),
                                      ("retail_suck", "RetailSuck", False)):
        if not active(feature) or len(cells) < 3 or side == "neutral":
            continue
        selected = [bar.low + i if bar.up else bar.high - i for i in range(3)]
        values = [cell_at(p).bid if bar.up else cell_at(p).ask for p in selected]
        if all((a < b if declining else a > b) for a, b in zip(values, values[1:])):
            emit(feature, side, prefix, min(selected), max(selected))

    feature = "poc_wave"
    if active(feature, offset=1, equal=True) and bar_index >= 3 and len(frames) >= 3 and len(cells) >= 3:
        first, middle = frames[-3], frames[-2]
        if None not in (first.poc, middle.poc, frame.poc):
            if first.bar.down and middle.bar.up and bar.up and middle.poc < first.poc < frame.poc:
                emit(feature, "buy", "POCWave", middle.bar.low)
            if first.bar.up and middle.bar.down and bar.down and middle.poc > first.poc > frame.poc:
                emit(feature, "sell", "POCWave", middle.bar.high)

    feature = "delta_tail"
    if active(feature) and len(cells) >= 3:
        if bar.up and bar.low in cells and cells[bar.low].delta < 0 and all(c.delta > 0 for p, c in cells.items() if p != bar.low):
            extreme_zone(feature, "DeltaTail")
        if bar.down and bar.high in cells and cells[bar.high].delta > 0 and all(c.delta < 0 for p, c in cells.items() if p != bar.high):
            extreme_zone(feature, "DeltaTail")

    feature = "delta_breakout"
    if feature in enabled and bar_index > 1 and previous and (
        _swing(frames, config, feature, bar_index=bar_index, current_bar_index=current_bar_index)
        or _swing(frames, config, feature, offset=1, bar_index=bar_index, current_bar_index=current_bar_index)
    ):
        acceleration = bar.delta - previous.bar.delta
        if (bar.up and previous.bar.up and bar.delta > 0 and previous.bar.delta > 0
                and acceleration >= config.delta_breakout_threshold):
            emit(feature, "buy", "DeltaBreakout", bar.low, metrics={"delta_acceleration": float(acceleration)})
        if (bar.down and previous.bar.down and bar.delta < 0 and previous.bar.delta < 0
                and acceleration <= -config.delta_breakout_threshold):
            emit(feature, "sell", "DeltaBreakout", bar.high, metrics={"delta_acceleration": float(acceleration)})

    feature = "resting_liquidity"
    if feature in enabled and previous and ((bar.up and previous.bar.up) or (bar.down and previous.bar.down)):
        filter_ok = True
        if feature in config.lookback_features:
            count = min(config.global_lookback_period + 1, bar_index - 1)
            start = len(frames) - 2 - count
            older = [f.bar for f in frames[max(0, start):-2]]
            filter_ok = bar_index >= 2 and start >= 0 and bool(older) and (
                previous.bar.high > max(b.high for b in older) if bar.up else previous.bar.low < min(b.low for b in older))
        if filter_ok:
            selected = [p for p in prices if p in old_cells and (
                min(cells[p].ask, old_cells[p].ask) if bar.up else min(cells[p].bid, old_cells[p].bid))
                >= config.resting_liquidity_threshold]
            if selected:
                chosen = max(selected, key=lambda p: cells[p].ask if bar.up else cells[p].bid)
                emit(feature, side, "RestingLiquidity", chosen,
                     metrics={"cell_volume": float(cells[chosen].ask if bar.up else cells[chosen].bid)})

    feature = "vertical_liquidity"
    # The documented DLL lookback includes the current extreme, blocking all
    # results. Preserve that behavior rather than silently correcting it.
    if feature in enabled and feature not in config.lookback_features and side != "neutral":
        selected = [p for p in prices if (cells[p].ask if bar.up else cells[p].bid)
                    >= config.vertical_liquidity_threshold]
        for group in _clusters(prices, selected, config.vertical_liquidity_cluster_size):
            emit(feature, side, "VerticalLiquidity", group[0], run_end(group),
                 metrics={"cluster_size": float(len(group))})

    return tuple(result)
