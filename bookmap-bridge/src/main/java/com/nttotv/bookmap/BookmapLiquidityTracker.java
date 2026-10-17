package com.nttotv.bookmap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

/**
 * Reduces full-depth updates to threshold signals and persistent-line
 * lifecycles. Raw order-book updates never leave the Bookmap process.
 */
final class BookmapLiquidityTracker {
    interface EventListener {
        void onEvent(Event event);
    }

    static final class Config {
        final boolean relativeEnabled;
        final int relativeTrigger;
        final int relativeFrom;
        final int relativeTo;
        final boolean absoluteEnabled;
        final int absoluteTrigger;
        final int absoluteFrom;
        final int absoluteTo;
        final boolean longTermEnabled;
        final int longTermTrigger;
        final int longTermFrom;
        final int longTermTo;
        final long longTermMinAgeNanos;
        final int longTermUpdateSize;
        final long longTermUpdateIntervalNanos;

        Config(
            int relativeTrigger,
            int relativeFrom,
            int relativeTo,
            int absoluteTrigger,
            int absoluteFrom,
            int absoluteTo,
            int longTermTrigger,
            int longTermFrom,
            int longTermTo,
            long longTermMinAgeNanos,
            int longTermUpdateSize,
            long longTermUpdateIntervalNanos
        ) {
            this(
                true,
                relativeTrigger,
                relativeFrom,
                relativeTo,
                true,
                absoluteTrigger,
                absoluteFrom,
                absoluteTo,
                true,
                longTermTrigger,
                longTermFrom,
                longTermTo,
                longTermMinAgeNanos,
                longTermUpdateSize,
                longTermUpdateIntervalNanos
            );
        }

        Config(
            boolean relativeEnabled,
            int relativeTrigger,
            int relativeFrom,
            int relativeTo,
            boolean absoluteEnabled,
            int absoluteTrigger,
            int absoluteFrom,
            int absoluteTo,
            boolean longTermEnabled,
            int longTermTrigger,
            int longTermFrom,
            int longTermTo,
            long longTermMinAgeNanos,
            int longTermUpdateSize,
            long longTermUpdateIntervalNanos
        ) {
            this.relativeEnabled = relativeEnabled;
            this.relativeTrigger = Math.max(1, relativeTrigger);
            this.relativeFrom = Math.max(0, relativeFrom);
            this.relativeTo = Math.max(this.relativeFrom, relativeTo);
            this.absoluteEnabled = absoluteEnabled;
            this.absoluteTrigger = Math.max(1, absoluteTrigger);
            this.absoluteFrom = Math.max(0, absoluteFrom);
            this.absoluteTo = Math.max(this.absoluteFrom, absoluteTo);
            this.longTermEnabled = longTermEnabled;
            this.longTermTrigger = Math.max(1, longTermTrigger);
            this.longTermFrom = Math.max(0, longTermFrom);
            this.longTermTo = Math.max(this.longTermFrom, longTermTo);
            this.longTermMinAgeNanos = Math.max(0L, longTermMinAgeNanos);
            this.longTermUpdateSize = Math.max(1, longTermUpdateSize);
            this.longTermUpdateIntervalNanos = Math.max(0L, longTermUpdateIntervalNanos);
        }
    }

    static final class Event {
        final long timeNanos;
        final String eventKind;
        final String action;
        final String side;
        final int priceLevel;
        final double price;
        final int size;
        final int previousSize;
        final int change;
        final int threshold;
        final int domDistance;
        final double strength;
        final String lineId;
        final long lineStartTimeNanos;
        final boolean snapshot;

        Event(
            long timeNanos,
            String eventKind,
            String action,
            String side,
            int priceLevel,
            double price,
            int size,
            int previousSize,
            int change,
            int threshold,
            int domDistance,
            double strength,
            String lineId,
            long lineStartTimeNanos,
            boolean snapshot
        ) {
            this.timeNanos = timeNanos;
            this.eventKind = eventKind;
            this.action = action;
            this.side = side;
            this.priceLevel = priceLevel;
            this.price = price;
            this.size = size;
            this.previousSize = previousSize;
            this.change = change;
            this.threshold = threshold;
            this.domDistance = domDistance;
            this.strength = strength;
            this.lineId = lineId;
            this.lineStartTimeNanos = lineStartTimeNanos;
            this.snapshot = snapshot;
        }
    }

    private static final class Candidate {
        final String key;
        final String side;
        final int priceLevel;
        final long startedAt;
        final String lineId;
        int currentSize;
        int peakSize;
        int domDistance;
        int lastEmittedSize;
        long lastEmittedAt;
        boolean published;

        Candidate(
            String key,
            String side,
            int priceLevel,
            long startedAt,
            int size,
            int domDistance
        ) {
            this.key = key;
            this.side = side;
            this.priceLevel = priceLevel;
            this.startedAt = startedAt;
            this.lineId = side + ":" + priceLevel + ":" + Math.floorDiv(startedAt, 1_000_000L);
            this.currentSize = size;
            this.peakSize = size;
            this.domDistance = domDistance;
            this.lastEmittedSize = size;
            this.lastEmittedAt = startedAt;
        }
    }

    private final double tickSize;
    private final double sizeMultiplier;
    private Config config;
    private final EventListener listener;
    private final NavigableMap<Integer, Integer> bids = new TreeMap<Integer, Integer>();
    private final NavigableMap<Integer, Integer> asks = new TreeMap<Integer, Integer>();
    private final Set<String> absoluteArmed = new HashSet<String>();
    private final Map<String, Candidate> candidates = new HashMap<String, Candidate>();
    private boolean realtime;
    private long currentTimeNanos;

    BookmapLiquidityTracker(
        double tickSize,
        double sizeMultiplier,
        Config config,
        EventListener listener
    ) {
        this.tickSize = tickSize > 0.0 ? tickSize : 0.1;
        this.sizeMultiplier = sizeMultiplier > 0.0 ? sizeMultiplier : 1.0;
        this.config = config;
        this.listener = listener;
    }

    void startRealtime(long timeNanos) {
        realtime = true;
        currentTimeNanos = normalizedTime(timeNanos);
        absoluteArmed.clear();
        candidates.clear();
        seedSide(true, bids);
        seedSide(false, asks);
    }

    void stopRealtime() {
        realtime = false;
    }

    void updateConfig(Config next, long timeNanos) {
        if (next == null) {
            return;
        }
        currentTimeNanos = normalizedTime(timeNanos);
        Config previous = config;
        boolean longTermChanged =
            previous.longTermEnabled != next.longTermEnabled
                || previous.longTermTrigger != next.longTermTrigger
                || previous.longTermFrom != next.longTermFrom
                || previous.longTermTo != next.longTermTo
                || previous.longTermMinAgeNanos != next.longTermMinAgeNanos;
        if (longTermChanged) {
            for (Candidate candidate : new ArrayList<Candidate>(candidates.values())) {
                if (candidate.published) {
                    emitLongTerm(candidate, "end", candidate.currentSize, false);
                }
            }
            candidates.clear();
        }
        config = next;
        absoluteArmed.clear();
        if (!realtime) {
            return;
        }
        seedAbsolute(true, bids);
        seedAbsolute(false, asks);
        if (longTermChanged) {
            seedLongTerm(true, bids);
            seedLongTerm(false, asks);
        }
    }

    void onTimestamp(long timeNanos) {
        currentTimeNanos = normalizedTime(timeNanos);
        if (!realtime) {
            return;
        }
        for (Candidate candidate : new ArrayList<Candidate>(candidates.values())) {
            if (
                !candidate.published
                    && currentTimeNanos - candidate.startedAt >= config.longTermMinAgeNanos
            ) {
                candidate.published = true;
                candidate.lastEmittedAt = currentTimeNanos;
                candidate.lastEmittedSize = candidate.currentSize;
                emitLongTerm(candidate, "start", candidate.currentSize, false);
            }
        }
    }

    void onDepth(boolean isBid, int priceLevel, int rawSize, long timeNanos) {
        currentTimeNanos = normalizedTime(timeNanos);
        NavigableMap<Integer, Integer> book = isBid ? bids : asks;
        int previousSize = book.containsKey(priceLevel) ? book.get(priceLevel) : 0;
        int size = normalizedSize(rawSize);
        if (size <= 0) {
            book.remove(priceLevel);
        } else {
            book.put(priceLevel, size);
        }
        if (!realtime || previousSize == size || bids.isEmpty() || asks.isEmpty()) {
            return;
        }

        String side = isBid ? "bid" : "ask";
        int domDistance = domDistance(isBid, priceLevel);
        int change = Math.abs(size - previousSize);
        if (
            config.relativeEnabled
                && within(domDistance, config.relativeFrom, config.relativeTo)
                && change >= config.relativeTrigger
        ) {
            listener.onEvent(
                event(
                    "relative",
                    size > previousSize ? "added" : "removed",
                    side,
                    priceLevel,
                    size,
                    previousSize,
                    change,
                    config.relativeTrigger,
                    domDistance,
                    null,
                    0L,
                    false
                )
            );
        }

        String key = levelKey(isBid, priceLevel);
        if (!config.absoluteEnabled) {
            absoluteArmed.remove(key);
        } else if (size < Math.floor(config.absoluteTrigger * 0.9)) {
            absoluteArmed.remove(key);
        } else if (
            within(domDistance, config.absoluteFrom, config.absoluteTo)
                && size >= config.absoluteTrigger
                && previousSize < config.absoluteTrigger
                && !absoluteArmed.contains(key)
        ) {
            absoluteArmed.add(key);
            listener.onEvent(
                event(
                    "absolute",
                    "crossed",
                    side,
                    priceLevel,
                    size,
                    previousSize,
                    change,
                    config.absoluteTrigger,
                    domDistance,
                    null,
                    0L,
                    false
                )
            );
        }

        updateLongTerm(isBid, priceLevel, previousSize, size, domDistance);
    }

    List<Event> snapshots() {
        List<Event> events = new ArrayList<Event>();
        for (Candidate candidate : candidates.values()) {
            if (!candidate.published) {
                continue;
            }
            events.add(longTermEvent(candidate, "snapshot", candidate.currentSize, true));
        }
        return events;
    }

    int activeLineCount() {
        int count = 0;
        for (Candidate candidate : candidates.values()) {
            if (candidate.published) {
                count += 1;
            }
        }
        return count;
    }

    private void seedSide(boolean isBid, NavigableMap<Integer, Integer> book) {
        seedAbsolute(isBid, book);
        seedLongTerm(isBid, book);
    }

    private void seedAbsolute(boolean isBid, NavigableMap<Integer, Integer> book) {
        if (!config.absoluteEnabled) {
            return;
        }
        for (Map.Entry<Integer, Integer> entry : book.entrySet()) {
            int level = entry.getKey();
            int size = entry.getValue();
            String key = levelKey(isBid, level);
            int distance = domDistance(isBid, level);
            if (
                size >= config.absoluteTrigger
                    && within(distance, config.absoluteFrom, config.absoluteTo)
            ) {
                absoluteArmed.add(key);
            }
        }
    }

    private void seedLongTerm(boolean isBid, NavigableMap<Integer, Integer> book) {
        if (!config.longTermEnabled) {
            return;
        }
        for (Map.Entry<Integer, Integer> entry : book.entrySet()) {
            int level = entry.getKey();
            int size = entry.getValue();
            String key = levelKey(isBid, level);
            int distance = domDistance(isBid, level);
            if (
                size >= config.longTermTrigger
                    && within(distance, config.longTermFrom, config.longTermTo)
            ) {
                candidates.put(
                    key,
                    new Candidate(
                        key,
                        isBid ? "bid" : "ask",
                        level,
                        currentTimeNanos,
                        size,
                        distance
                    )
                );
            }
        }
    }

    private void updateLongTerm(
        boolean isBid,
        int priceLevel,
        int previousSize,
        int size,
        int domDistance
    ) {
        if (!config.longTermEnabled) {
            return;
        }
        String key = levelKey(isBid, priceLevel);
        Candidate candidate = candidates.get(key);
        if (size < Math.floor(config.longTermTrigger * 0.9)) {
            if (candidate != null) {
                candidates.remove(key);
                if (candidate.published) {
                    candidate.currentSize = size;
                    emitLongTerm(candidate, "end", previousSize, false);
                }
            }
            return;
        }
        if (candidate == null) {
            if (
                size >= config.longTermTrigger
                    && within(domDistance, config.longTermFrom, config.longTermTo)
            ) {
                candidates.put(
                    key,
                    new Candidate(
                        key,
                        isBid ? "bid" : "ask",
                        priceLevel,
                        currentTimeNanos,
                        size,
                        domDistance
                    )
                );
            }
            return;
        }

        candidate.currentSize = size;
        candidate.peakSize = Math.max(candidate.peakSize, size);
        candidate.domDistance = domDistance;
        if (!candidate.published) {
            return;
        }
        int updateChange = Math.abs(size - candidate.lastEmittedSize);
        if (
            updateChange >= config.longTermUpdateSize
                && currentTimeNanos - candidate.lastEmittedAt
                    >= config.longTermUpdateIntervalNanos
        ) {
            int emittedPrevious = candidate.lastEmittedSize;
            candidate.lastEmittedSize = size;
            candidate.lastEmittedAt = currentTimeNanos;
            listener.onEvent(
                event(
                    "long_term",
                    "update",
                    candidate.side,
                    candidate.priceLevel,
                    size,
                    emittedPrevious,
                    updateChange,
                    config.longTermTrigger,
                    candidate.domDistance,
                    candidate.lineId,
                    candidate.startedAt,
                    false
                )
            );
        }
    }

    private void emitLongTerm(
        Candidate candidate,
        String action,
        int previousSize,
        boolean snapshot
    ) {
        listener.onEvent(longTermEvent(candidate, action, previousSize, snapshot));
    }

    private Event longTermEvent(
        Candidate candidate,
        String action,
        int previousSize,
        boolean snapshot
    ) {
        return event(
            "long_term",
            action,
            candidate.side,
            candidate.priceLevel,
            candidate.currentSize,
            previousSize,
            Math.abs(candidate.currentSize - previousSize),
            config.longTermTrigger,
            candidate.domDistance,
            candidate.lineId,
            candidate.startedAt,
            snapshot
        );
    }

    private Event event(
        String eventKind,
        String action,
        String side,
        int priceLevel,
        int size,
        int previousSize,
        int change,
        int threshold,
        int domDistance,
        String lineId,
        long lineStartTimeNanos,
        boolean snapshot
    ) {
        return new Event(
            currentTimeNanos,
            eventKind,
            action,
            side,
            priceLevel,
            round10(priceLevel * tickSize),
            size,
            previousSize,
            change,
            threshold,
            domDistance,
            threshold <= 0 ? 0.0 : (double)Math.max(size, change) / (double)threshold,
            lineId,
            lineStartTimeNanos,
            snapshot
        );
    }

    private int domDistance(boolean isBid, int priceLevel) {
        if (isBid) {
            return bids.isEmpty() ? Integer.MAX_VALUE : bids.lastKey() - priceLevel;
        }
        return asks.isEmpty() ? Integer.MAX_VALUE : priceLevel - asks.firstKey();
    }

    private int normalizedSize(int rawSize) {
        return Math.max(0, (int)Math.round(rawSize / sizeMultiplier));
    }

    private long normalizedTime(long timeNanos) {
        return timeNanos > 0L ? timeNanos : System.currentTimeMillis() * 1_000_000L;
    }

    private static String levelKey(boolean isBid, int priceLevel) {
        return (isBid ? "bid:" : "ask:") + priceLevel;
    }

    private static boolean within(int value, int from, int to) {
        return value >= from && value <= to;
    }

    private static double round10(double value) {
        return Math.round(value * 10_000_000_000.0) / 10_000_000_000.0;
    }
}
