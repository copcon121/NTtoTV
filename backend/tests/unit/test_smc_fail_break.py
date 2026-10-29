import json
from pathlib import Path

import pytest

from app.engines.alert_engine import Alert, AlertEngine, MarketContext
from app.engines.mgann_pb import MgannPbState, MgannWave, PbSignal
from app.engines.smc_external import SmcBar, SmcBreakEvent
from app.engines.smc_fail_break import SmcFailBreakState, SMC_FAIL_BREAK_RETEST
from app.rest.alerts import _validate_params
from app.rest.errors import ApiError
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord, ProfileRecord


def bar(i, close, high=None, low=None, volume=10):
    return SmcBar(i * 60000, close, high if high is not None else close + .2,
                  low if low is not None else close - .2, close, volume)


def mirror(rows):
    return [SmcBar(b.time, 200-b.open, 200-b.low, 200-b.high, 200-b.close, b.volume) for b in rows]


def feed(detector, rows):
    return [signal for row in rows for signal in detector.on_closed_bar(row)]


def prepared(monkeypatch, flip=False, **params):
    rows = [bar(0, 95, 99, 91), bar(1, 99, 100, 92), bar(2, 95, 99, 91),
            bar(3, 95, 99, 91), bar(4, 101, 102, 100), bar(5, 98)]
    state = SmcFailBreakState(swingLength=2, **params)
    assert feed(state, mirror(rows) if flip else rows) == []
    monkeypatch.setattr(state._detector, "update", lambda _: None)
    context = []
    monkeypatch.setattr(state._pb, "live_waves", lambda *_: list(context))
    return state, context


def set_waves(context, points, flip=False):
    context[:] = [
        MgannWave(a*60000, b*60000, 200-x if flip else x, 200-y if flip else y,
                  (1 if y>x else -1) * (-1 if flip else 1))
        for (a,x),(b,y) in zip(points, points[1:])
    ]


@pytest.mark.parametrize("flip", [False, True])
@pytest.mark.parametrize("return_legs", [1, 2, 3, 5])
def test_multi_wave_return_waits_for_zone_without_leg_count_limit(monkeypatch, flip, return_legs):
    state, context = prepared(monkeypatch, flip)
    points = [(4,102), (6,94)]
    for leg in range(return_legs-1):
        i = 8+4*leg
        points += [(i,97), (i+2,95)]
        set_waves(context, points, flip)
        live = bar(i,97)
        assert state.on_live_bar(mirror([live])[0] if flip else live) == []
        assert len(state._setups) == 1
    end = 8+4*(return_legs-1)
    points += [(end,99.8)]
    set_waves(context, points, flip)
    live = bar(end,99.8,100,99.5)
    live = mirror([live])[0] if flip else live
    signals = state.on_live_bar(live)
    assert len(signals) == 1
    assert signals[0].direction == (1 if flip else -1)
    assert (signals[0].zone_bottom, signals[0].zone_top) == ((100,101) if flip else (99,100))
    assert state.on_live_bar(live) == []
    assert feed(state,[live]) == []


def test_a_deeper_inside_b_does_not_reset_setup(monkeypatch):
    state, context = prepared(monkeypatch)
    set_waves(context, [(4,102),(6,94),(8,97)])
    assert state.on_live_bar(bar(8,97)) == []
    set_waves(context, [(4,102),(6,94),(8,97),(10,92),(12,98)])
    assert state.on_live_bar(bar(12,98)) == []
    assert state._setups[0].inside_price == 92
    set_waves(context, [(8,97),(10,92),(12,98),(14,93),(16,99.8)])
    assert len(state.on_live_bar(bar(16,99.8))) == 1


def test_tick_distance_settings_do_not_gate_wave_geometry(monkeypatch):
    state, context = prepared(monkeypatch, minDisplacementTicks=9999, retestToleranceTicks=0)
    set_waves(context, [(4,102),(6,98),(8,99.8)])
    assert len(state.on_live_bar(bar(8,99.8))) == 1


def test_touch_without_inward_mgann_wave_does_not_qualify(monkeypatch):
    state, context = prepared(monkeypatch)
    set_waves(context, [(6,94),(8,99.8)])
    assert state.on_live_bar(bar(8,99.8)) == []


def test_reclaim_must_be_a_closed_bar(monkeypatch):
    state, context = prepared(monkeypatch)
    state._setups[0].reclaim_time = None
    set_waves(context, [(4,102),(6,94),(8,99.8)])
    assert state.on_live_bar(bar(8,98)) == []
    assert state._setups[0].reclaim_time is None


def test_level_sweep_keeps_setup_but_breaking_a_invalidates(monkeypatch):
    state, context = prepared(monkeypatch)
    set_waves(context, [(4,102),(6,94),(8,100.5)])
    assert feed(state,[bar(8,100.5)]) == []
    assert len(state._setups) == 1
    assert state.on_live_bar(bar(9,102.1)) == []
    assert state._setups == []


def test_pb_must_belong_to_current_return_leg_and_fire_live(monkeypatch):
    state, context = prepared(monkeypatch, requirePb=True)
    set_waves(context, [(4,102),(6,94),(8,97),(10,95),(12,99.8)])
    live = bar(12,99.8,100,99.5)
    for signal in [PbSignal(8*60000,1,100,99), PbSignal(12*60000,-1,100,99),
                   PbSignal(12*60000,1,98,97)]:
        monkeypatch.setattr(state._pb,"live_signals",lambda *_, signal=signal:[signal])
        assert state.on_live_bar(live) == []
    monkeypatch.setattr(state._pb,"live_signals",lambda *_:[PbSignal(12*60000,1,100,99)])
    assert state.on_live_bar(bar(12,98,100,97)) == []
    result = state.on_live_bar(live)
    assert len(result) == 1 and result[0].pb
    assert state.on_live_bar(live) == []


def test_direction_filter(monkeypatch):
    state, _ = prepared(monkeypatch, direction="long")
    assert state._setups == []


def test_expiry_remains_a_safety_limit(monkeypatch):
    state, context = prepared(monkeypatch, maxBars=3)
    set_waves(context, [(4,102),(6,94)])
    assert feed(state,[bar(i,95) for i in range(6,10)]) == []
    assert state._setups == []


@pytest.mark.parametrize("params", [
    {"swingLength":True},{"maxBars":0},{"requirePb":"yes"},
    {"direction":"up"},{"timeframe":"5m"},{"repeat":"true"},{"useChartSmc":"yes"},
])
def test_invalid_params(params):
    with pytest.raises(ApiError):
        _validate_params(SMC_FAIL_BREAK_RETEST,params)


def test_old_tick_params_are_removed_from_new_definitions():
    params = _validate_params(SMC_FAIL_BREAK_RETEST,{"minDisplacementTicks":50,"retestToleranceTicks":5})
    assert "minDisplacementTicks" not in params and "retestToleranceTicks" not in params
    assert params["useChartSmc"] is True


def multi_wave_rows():
    fixture = json.loads((Path(__file__).parents[3]/"test-fixtures/mgann_multi_wave_retest.json").read_text())
    prices = fixture["pivotPrices"]
    rows = []
    for i in range(fixture["retestIndex"]+6):
        if i<=5:
            value=prices[1]+(prices[0]-prices[1])*i/5
        elif i<=fixture["retestIndex"]:
            segment=min((i-5)//6,len(prices)-2)
            value=prices[segment]+(prices[segment+1]-prices[segment])*(i-5-segment*6)/6
        else:
            value=prices[-1]+(fixture["tailPrice"]-prices[-1])*(i-fixture["retestIndex"])/5
        rows.append(bar(i,value,value,value))
    return rows


@pytest.mark.parametrize("repeat",[False,True])
def test_restart_warmup_live_delivery_and_one_shot_lifecycle(tmp_path,repeat):
    rows=multi_wave_rows()[:72]
    with CacheStore(tmp_path/"cache.sqlite") as cache:
        cache.upsert_bars([BarRecord("GC","GC","1m",r.time,r.open,r.high,r.low,r.close,r.volume,True) for r in rows[:-1]])
        engine=AlertEngine(cache)
        engine.upsert(Alert(id="fail",symbol="GC",type=SMC_FAIL_BREAK_RETEST,
                            params={"swingLength":2,"repeat":repeat}))
        engine=AlertEngine(cache)
        assert cache.read_alert_events("fail")==[]
        last=rows[-1]
        ctx=MarketContext(symbol="GC",contract="GC",time=last.time+1000,bar_tf="5m",
                          bar_time=last.time,bar_open=last.open,bar_high=last.high,
                          bar_low=last.low,bar_close=last.close,bar_volume=last.volume)
        assert engine.evaluate_live_fail_break(ctx)==[]
        ctx.bar_tf="1m"
        fired=engine.evaluate_live_fail_break(ctx)
        assert len(fired)==1 and fired[0].level==100 and fired[0].direction==-1
        assert "mGann multi-wave retest" in fired[0].message
        assert engine.evaluate_live_fail_break(ctx)==[]
        assert cache.read_alert("fail").enabled is repeat
        engine.delete("fail")
        assert "fail" not in engine._fail_break_state


def test_profile_smc_length_is_used_and_only_reseeds_when_changed(tmp_path):
    with CacheStore(tmp_path/"cache.sqlite") as cache:
        cache.upsert_profile(ProfileRecord("p","chart",{"smc":{"swingLength":20}}))
        engine=AlertEngine(cache)
        engine.upsert(Alert(id="follow",profile_id="p",symbol="GC",type=SMC_FAIL_BREAK_RETEST,params={"swingLength":50}))
        original=engine._fail_break_state["follow"]
        assert original.params["swingLength"]==20
        engine.refresh_fail_break_profile("p")
        assert engine._fail_break_state["follow"] is original
        cache.upsert_profile(ProfileRecord("p","chart",{"smc":{"swingLength":35}}))
        engine.refresh_fail_break_profile("p")
        assert engine._fail_break_state["follow"].params["swingLength"]==35
        assert cache.read_alert_events("follow")==[]


def pb_rows():
    # Six alternating Internal-5 pivots; last up wave is shorter and has more volume.
    fixture = json.loads((Path(__file__).parents[3] / "test-fixtures/mgann_pb_live.json").read_text())
    prices = fixture["pivotPrices"]
    rows = []
    for i in range(41):
        if i <= 5:
            value = 120 + (100 - 120) * i / 5
        elif i <= 35:
            segment = min((i - 5) // 6, 4)
            offset = i - 5 - segment * 6
            value = prices[segment] + (prices[segment+1]-prices[segment]) * offset / 6
        else:
            value = 100 - 10 * (i-35)/5
        volume = fixture["boostVolume"] if fixture["boostVolumeFromIndex"] <= i <= fixture["signalIndex"] else fixture["baseVolume"]
        rows.append(bar(i, value, value, value, volume))
    return rows


@pytest.mark.parametrize("flip", [False, True])
def test_real_pb_pivots_confirm_after_five_closed_bars(flip):
    detector = MgannPbState()
    rows = mirror(pb_rows()) if flip else pb_rows()
    signals = [detector.update(row, None) for row in rows]
    assert all(signal is None for signal in signals[:-1])
    assert signals[-1] == PbSignal(35*60000, -1 if flip else 1, rows[35].high, rows[35].low)


@pytest.mark.parametrize("flip", [False, True])
def test_real_live_pb_uses_developing_pivot_and_does_not_mutate_closed_state(flip):
    detector = MgannPbState()
    rows = mirror(pb_rows()) if flip else pb_rows()
    for row in rows[:35]:
        detector.update(row, None)
    before = list(detector._pivots)
    expected = PbSignal(35*60000, -1 if flip else 1, rows[35].high, rows[35].low)
    assert expected in detector.live_signals(rows[35])
    assert list(detector._pivots) == before
    assert expected in detector.live_signals(rows[35])
    # Same live candle changes volume; previews must recalculate, never accumulate it twice.
    quiet = SmcBar(rows[35].time, rows[35].open, rows[35].high, rows[35].low, rows[35].close, 0)
    assert detector._volume == sum(row.volume for row in rows[:35])
    detector.live_signals(quiet)
    assert list(detector._pivots) == before



@pytest.mark.parametrize("kind",["BOS","CHoCH"])
def test_complete_live_pb_retest_uses_real_developing_wave(kind,monkeypatch):
    detector=SmcFailBreakState(swingLength=2,requirePb=True)
    rows=pb_rows()
    setup=SmcBreakEvent(kind,1,100,23*60000,5*60000,115,115)
    monkeypatch.setattr(detector._detector,"update",lambda row:setup if row.time==setup.break_time else None)
    assert feed(detector,rows[:35])==[]
    signals=detector.on_live_bar(rows[35])
    assert len(signals)==1 and signals[0].pb and signals[0].direction==-1
    assert signals[0].time==rows[35].time
    assert detector.on_live_bar(rows[35])==[]
