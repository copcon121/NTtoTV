package com.nttotv.bookmap;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

final class BookmapFootprintAccumulator {
    static final long MINUTE_MS = 60_000L;
    private static final long NANOS_PER_MILLI = 1_000_000L;

    interface ClosedBarListener {
        void onClosedBar(Bar bar);
    }

    static final class Row {
        final double price;
        final long bid;
        final long ask;

        Row(double price, long bid, long ask) {
            this.price = price;
            this.bid = bid;
            this.ask = ask;
        }
    }

    static final class Bar {
        final long time;
        final long firstEventTimeNanos;
        final long lastEventTimeNanos;
        final double open;
        final double high;
        final double low;
        final double close;
        final long volume;
        final long buyVolume;
        final long sellVolume;
        final long delta;
        final long deltaHigh;
        final long deltaLow;
        final long tradeEvents;
        final long executionStarts;
        final long executionEnds;
        final long otcTrades;
        final boolean partialStart;
        final List<Row> rows;
        final int aggressorOrderIds;
        final int passiveOrderIds;

        Bar(State state) {
            time = state.time;
            firstEventTimeNanos = state.firstEventTimeNanos;
            lastEventTimeNanos = state.lastEventTimeNanos;
            open = state.open;
            high = state.high;
            low = state.low;
            close = state.close;
            volume = state.volume;
            buyVolume = state.askVolume;
            sellVolume = state.bidVolume;
            delta = state.cumulativeDelta;
            deltaHigh = state.deltaHigh;
            deltaLow = state.deltaLow;
            tradeEvents = state.tradeEvents;
            executionStarts = state.executionStarts;
            executionEnds = state.executionEnds;
            otcTrades = state.otcTrades;
            partialStart = state.partialStart;
            aggressorOrderIds = state.aggressorOrderIds.size();
            passiveOrderIds = state.passiveOrderIds.size();

            List<Row> snapshot = new ArrayList<Row>();
            for (Map.Entry<Double, Level> entry : state.levels.descendingMap().entrySet()) {
                Level level = entry.getValue();
                snapshot.add(new Row(entry.getKey().doubleValue(), level.bid, level.ask));
            }
            rows = Collections.unmodifiableList(snapshot);
        }
    }

    private static final class Level {
        long bid;
        long ask;
    }

    private static final class State {
        final long time;
        final boolean partialStart;
        final TreeMap<Double, Level> levels = new TreeMap<Double, Level>(
            Comparator.naturalOrder()
        );
        final Set<String> aggressorOrderIds = new LinkedHashSet<String>();
        final Set<String> passiveOrderIds = new LinkedHashSet<String>();
        long firstEventTimeNanos;
        long lastEventTimeNanos;
        double open;
        double high;
        double low;
        double close;
        long volume;
        long bidVolume;
        long askVolume;
        long cumulativeDelta;
        long deltaHigh;
        long deltaLow;
        long tradeEvents;
        long executionStarts;
        long executionEnds;
        long otcTrades;

        State(long time, double price, long eventTimeNanos, boolean partialStart) {
            this.time = time;
            this.partialStart = partialStart;
            firstEventTimeNanos = eventTimeNanos;
            lastEventTimeNanos = eventTimeNanos;
            open = price;
            high = price;
            low = price;
            close = price;
        }
    }

    private final double tickSize;
    private final double sizeMultiplier;
    private final ClosedBarListener listener;
    private long currentTimeNanos;
    private State current;
    private boolean firstBarAfterReset = true;
    private long skippedTradesWithoutTimestamp;

    BookmapFootprintAccumulator(
        double tickSize,
        double sizeMultiplier,
        ClosedBarListener listener
    ) {
        if (tickSize <= 0.0) {
            throw new IllegalArgumentException("tickSize must be > 0");
        }
        if (sizeMultiplier <= 0.0) {
            throw new IllegalArgumentException("sizeMultiplier must be > 0");
        }
        if (listener == null) {
            throw new IllegalArgumentException("listener is required");
        }
        this.tickSize = tickSize;
        this.sizeMultiplier = sizeMultiplier;
        this.listener = listener;
    }

    synchronized void reset() {
        currentTimeNanos = 0L;
        current = null;
        firstBarAfterReset = true;
    }

    synchronized void onTimestamp(long timeNanos) {
        currentTimeNanos = timeNanos;
        if (current == null) {
            return;
        }
        long bucket = bucketStart(normalizeTimeMs(timeNanos));
        if (bucket > current.time) {
            emitCurrent();
        } else if (bucket < current.time) {
            reset();
            currentTimeNanos = timeNanos;
        }
    }

    synchronized boolean onTrade(
        double price,
        int rawSize,
        boolean isBidAggressor,
        boolean isExecutionStart,
        boolean isExecutionEnd,
        boolean isOtc,
        String aggressorOrderId,
        String passiveOrderId
    ) {
        if (currentTimeNanos <= 0L || !Double.isFinite(price) || rawSize <= 0) {
            if (currentTimeNanos <= 0L) {
                skippedTradesWithoutTimestamp += 1L;
            }
            return false;
        }

        long volume = Math.round(rawSize / sizeMultiplier);
        if (volume <= 0L) {
            return false;
        }

        long timeMs = normalizeTimeMs(currentTimeNanos);
        long bucket = bucketStart(timeMs);
        // Bookmap trade prices are expressed in instrument pip levels.
        double levelPrice = snapPrice(price * tickSize);
        if (current != null && bucket > current.time) {
            emitCurrent();
        } else if (current != null && bucket < current.time) {
            reset();
            currentTimeNanos = timeMs * NANOS_PER_MILLI;
        }

        if (current == null) {
            current = new State(bucket, levelPrice, currentTimeNanos, firstBarAfterReset);
        }

        current.lastEventTimeNanos = currentTimeNanos;
        current.high = Math.max(current.high, levelPrice);
        current.low = Math.min(current.low, levelPrice);
        current.close = levelPrice;
        current.volume += volume;
        current.tradeEvents += 1L;
        if (isExecutionStart) {
            current.executionStarts += 1L;
        }
        if (isExecutionEnd) {
            current.executionEnds += 1L;
        }
        if (isOtc) {
            current.otcTrades += 1L;
        }
        if (aggressorOrderId != null && !aggressorOrderId.isEmpty()) {
            current.aggressorOrderIds.add(aggressorOrderId);
        }
        if (passiveOrderId != null && !passiveOrderId.isEmpty()) {
            current.passiveOrderIds.add(passiveOrderId);
        }

        Level level = current.levels.get(Double.valueOf(levelPrice));
        if (level == null) {
            level = new Level();
            current.levels.put(Double.valueOf(levelPrice), level);
        }

        // Bookmap names the aggressing order side: bid aggressor is a buyer lifting the ask.
        if (isBidAggressor) {
            level.ask += volume;
            current.askVolume += volume;
            current.cumulativeDelta += volume;
        } else {
            level.bid += volume;
            current.bidVolume += volume;
            current.cumulativeDelta -= volume;
        }
        current.deltaHigh = Math.max(current.deltaHigh, current.cumulativeDelta);
        current.deltaLow = Math.min(current.deltaLow, current.cumulativeDelta);
        return true;
    }

    synchronized long skippedTradesWithoutTimestamp() {
        return skippedTradesWithoutTimestamp;
    }

    synchronized boolean hasOpenBar() {
        return current != null;
    }

    private void emitCurrent() {
        State closed = current;
        current = null;
        if (closed == null || closed.tradeEvents <= 0L) {
            return;
        }
        firstBarAfterReset = false;
        listener.onClosedBar(new Bar(closed));
    }

    private double snapPrice(double price) {
        return round10(Math.round(price / tickSize) * tickSize);
    }

    private static long bucketStart(long timeMs) {
        return Math.floorDiv(timeMs, MINUTE_MS) * MINUTE_MS;
    }

    private static long normalizeTimeMs(long timeNanos) {
        return Math.floorDiv(timeNanos, NANOS_PER_MILLI);
    }

    private static double round10(double value) {
        return Math.round(value * 10_000_000_000.0) / 10_000_000_000.0;
    }
}
